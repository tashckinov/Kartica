const express = require('express');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const sshpk = require('sshpk');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;
const ADMIN_PUBLIC_KEY = (process.env.ADMIN_PUBLIC_KEY || '').trim();
const SESSION_COOKIE_NAME = 'kartica_admin_session';
const SESSION_TTL_MS = Math.max(parseInt(process.env.ADMIN_SESSION_TTL_MS, 10) || 1000 * 60 * 30, 1000 * 60 * 5);
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
const COOKIE_SAME_SITE = process.env.ADMIN_COOKIE_SAME_SITE || 'Lax';
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const configuredAllowedOrigins = [
  process.env.ADMIN_ALLOWED_ORIGINS,
  process.env.ADMIN_ALLOWED_ORIGIN,
]
  .filter(Boolean)
  .join(',');

const ALLOWED_ORIGINS = (configuredAllowedOrigins
  ? configuredAllowedOrigins.split(',')
  : DEFAULT_ALLOWED_ORIGINS)
  .map((origin) => origin.trim())
  .filter(Boolean);

const activeSessions = new Map();

const normalizeSshPublicKey = (key) => {
  if (!key || typeof key !== 'string') {
    return '';
  }
  const trimmed = key.trim();
  if (!trimmed) {
    return '';
  }
  const [type, value] = trimmed.split(/\s+/);
  if (!type || !value) {
    return '';
  }
  return `${type} ${value}`;
};

const ADMIN_PUBLIC_KEY_NORMALIZED = normalizeSshPublicKey(ADMIN_PUBLIC_KEY);

const derivePublicKeyFromPrivate = (privateKeyContent) => {
  const normalizedContent = typeof privateKeyContent === 'string' ? privateKeyContent.trim() : privateKeyContent;
  const attempts = [
    () => {
      const privateKey = crypto.createPrivateKey({ key: normalizedContent });
      const publicKey = crypto.createPublicKey(privateKey);
      return publicKey.export({ format: 'ssh' }).toString();
    },
    () => {
      const privateKey = sshpk.parsePrivateKey(normalizedContent, 'auto');
      return privateKey.toPublic().toString('ssh');
    },
  ];

  let lastError;
  for (const attempt of attempts) {
    try {
      return attempt();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Unable to derive public key from provided private key');
};

app.use(express.json());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  }
  if (origin) {
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});

function doesPrivateKeyMatchAdmin(privateKeyContent) {
  if (!ADMIN_PUBLIC_KEY_NORMALIZED) {
    console.warn('ADMIN_PUBLIC_KEY is not configured');
    return false;
  }

  if (!privateKeyContent || typeof privateKeyContent !== 'string') {
    return false;
  }

  const normalizedContent = privateKeyContent.trim();
  if (!normalizedContent) {
    return false;
  }

  try {
    const derivedPublicKey = normalizeSshPublicKey(derivePublicKeyFromPrivate(normalizedContent));
    return derivedPublicKey === ADMIN_PUBLIC_KEY_NORMALIZED;
  } catch (error) {
    console.warn('Failed to derive admin public key from provided key', error);

    const normalizedProvided = normalizeSshPublicKey(normalizedContent);
    if (normalizedProvided && normalizedProvided === ADMIN_PUBLIC_KEY_NORMALIZED) {
      return true;
    }

    try {
      const publicKeyFromInput = crypto
        .createPublicKey({ key: normalizedContent, format: 'ssh' })
        .export({ format: 'ssh' })
        .toString();
      return normalizeSshPublicKey(publicKeyFromInput) === ADMIN_PUBLIC_KEY_NORMALIZED;
    } catch (secondaryError) {
      console.warn('Provided key does not match configured admin key', secondaryError);
    }

    return false;
  }
}

function setSessionCookie(res, token, ttlMs = SESSION_TTL_MS) {
  const maxAgeSeconds = Math.max(Math.floor(ttlMs / 1000), 0);
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAgeSeconds}`,
    `SameSite=${COOKIE_SAME_SITE}`,
  ];
  if (COOKIE_SECURE) {
    cookieParts.push('Secure');
  }
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

function clearSessionCookie(res) {
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    `SameSite=${COOKIE_SAME_SITE}`,
  ];
  if (COOKIE_SECURE) {
    cookieParts.push('Secure');
  }
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

function getSessionTokenFromRequest(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return '';
  }

  const cookies = cookieHeader.split(';').map((chunk) => chunk.trim());
  for (const cookie of cookies) {
    if (!cookie) continue;
    const [name, value] = cookie.split('=');
    if (name === SESSION_COOKIE_NAME) {
      return value || '';
    }
  }
  return '';
}

function getActiveSession(token) {
  if (!token) {
    return null;
  }
  const session = activeSessions.get(token);
  if (!session) {
    return null;
  }
  if (session.expiresAt <= Date.now()) {
    activeSessions.delete(token);
    return null;
  }
  return session;
}

function requireAdmin(req, res, next) {
  const token = getSessionTokenFromRequest(req);
  const session = getActiveSession(token);
  if (!session) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  session.expiresAt = Date.now() + SESSION_TTL_MS;
  setSessionCookie(res, token, SESSION_TTL_MS);
  req.adminSessionToken = token;
  return next();
}

app.post('/auth/login', (req, res) => {
  const privateKeyContent = req.body?.key;

  if (!privateKeyContent || typeof privateKeyContent !== 'string' || !privateKeyContent.trim()) {
    return res.status(400).json({ error: 'Приватный ключ не передан' });
  }

  if (!doesPrivateKeyMatchAdmin(privateKeyContent)) {
    return res.status(401).json({ error: 'Предоставленный ключ не подходит для входа' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;

  activeSessions.set(token, { expiresAt });
  setSessionCookie(res, token, SESSION_TTL_MS);

  return res.json({ status: 'ok', expiresAt });
});

app.post('/auth/logout', (req, res) => {
  const token = getSessionTokenFromRequest(req);
  if (token) {
    activeSessions.delete(token);
  }
  clearSessionCookie(res);
  return res.status(204).send();
});

app.get('/auth/verify', requireAdmin, (req, res) => {
  const token = req.adminSessionToken;
  const session = getActiveSession(token);
  res.json({ status: 'ok', expiresAt: session?.expiresAt });
});

function parsePagination(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const pageSize = Math.max(Math.min(parseInt(query.pageSize, 10) || 10, 200), 1);
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip };
}

function serializeGroupSummary(group) {
  return {
    id: group.id,
    title: group.title,
    description: group.description,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    cardsCount: group._count?.cards ?? group.cardsCount ?? 0,
  };
}

function normalizeCardPayload(card, index) {
  if (!card || typeof card !== 'object') {
    const error = new Error(`Card at position ${index + 1} is invalid`);
    error.statusCode = 400;
    throw error;
  }
  const term = String(card.term ?? '').trim();
  const translation = String(card.translation ?? card.definition ?? '').trim();
  const exampleRaw = card.example ?? '';
  const imageRaw = card.image ?? null;

  if (!term) {
    const error = new Error(`Card at position ${index + 1} is missing a term`);
    error.statusCode = 400;
    throw error;
  }
  if (!translation) {
    const error = new Error(`Card at position ${index + 1} is missing a translation`);
    error.statusCode = 400;
    throw error;
  }

  const example = String(exampleRaw ?? '').trim();
  const image = imageRaw === null || imageRaw === undefined ? null : String(imageRaw).trim();

  return {
    term,
    definition: translation,
    example: example || null,
    image: image || null,
  };
}

async function replaceGroupCards(groupId, cardsPayload) {
  const cardsData = cardsPayload.map(normalizeCardPayload);

  return prisma.$transaction(async (tx) => {
    await tx.card.deleteMany({ where: { groupId } });
    if (cardsData.length) {
      await tx.card.createMany({
        data: cardsData.map((card) => ({
          ...card,
          groupId,
        })),
      });
    }

    return tx.group.findUnique({
      where: { id: groupId },
      include: {
        cards: { orderBy: { id: 'asc' } },
      },
    });
  });
}

app.get('/groups', async (req, res) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);

    const [total, groups] = await Promise.all([
      prisma.group.count(),
      prisma.group.findMany({
        skip,
        take: pageSize,
        orderBy: { id: 'asc' },
        include: { _count: { select: { cards: true } } },
      }),
    ]);

    res.json({
      data: groups.map((group) => serializeGroupSummary(group)),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (error) {
    console.error('Failed to fetch groups', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

app.get('/groups/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid group id' });
    }

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        cards: {
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json(group);
  } catch (error) {
    console.error('Failed to fetch group', error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

app.get('/cards', async (req, res) => {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);

    const [total, cards] = await Promise.all([
      prisma.card.count(),
      prisma.card.findMany({
        skip,
        take: pageSize,
        orderBy: { id: 'asc' },
        include: {
          group: {
            select: { id: true, title: true },
          },
        },
      }),
    ]);

    res.json({
      data: cards,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (error) {
    console.error('Failed to fetch cards', error);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

app.get('/cards/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid card id' });
    }

    const card = await prisma.card.findUnique({
      where: { id },
      include: {
        group: {
          select: { id: true, title: true },
        },
      },
    });

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    res.json(card);
  } catch (error) {
    console.error('Failed to fetch card', error);
    res.status(500).json({ error: 'Failed to fetch card' });
  }
});

app.post('/groups', requireAdmin, async (req, res) => {
  try {
    const title = String(req.body?.title ?? '').trim();
    const descriptionRaw = req.body?.description;

    if (!title) {
      return res.status(400).json({ error: 'Group title is required' });
    }

    const group = await prisma.group.create({
      data: {
        title,
        description:
          descriptionRaw === null || descriptionRaw === undefined
            ? null
            : String(descriptionRaw).trim() || null,
      },
      include: {
        _count: { select: { cards: true } },
      },
    });

    res.status(201).json(serializeGroupSummary(group));
  } catch (error) {
    console.error('Failed to create group', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

app.put('/groups/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid group id' });
    }

    const titleRaw = req.body?.title;
    const descriptionRaw = req.body?.description;

    if (titleRaw !== undefined && String(titleRaw).trim() === '') {
      return res.status(400).json({ error: 'Group title cannot be empty' });
    }

    const data = {};
    if (titleRaw !== undefined) {
      data.title = String(titleRaw).trim();
    }
    if (descriptionRaw !== undefined) {
      const normalized = String(descriptionRaw ?? '').trim();
      data.description = normalized || null;
    }

    const updated = await prisma.group.update({
      where: { id },
      data,
      include: {
        _count: { select: { cards: true } },
      },
    });

    res.json(serializeGroupSummary(updated));
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Group not found' });
    }
    console.error('Failed to update group', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

app.put('/groups/:id/cards', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid group id' });
    }

    const cardsPayload = Array.isArray(req.body?.cards) ? req.body.cards : null;
    if (!cardsPayload) {
      return res.status(400).json({ error: 'Cards payload must be an array' });
    }

    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const updatedGroup = await replaceGroupCards(id, cardsPayload);

    res.json(updatedGroup);
  } catch (error) {
    const status = error.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 500;
    if (status >= 500) {
      console.error('Failed to update cards', error);
    }
    res.status(status).json({ error: error.message || 'Failed to update cards' });
  }
});

app.delete('/groups/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid group id' });
    }

    await prisma.group.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Group not found' });
    }
    console.error('Failed to delete group', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const server = app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
