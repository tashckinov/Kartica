const express = require('express');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;
const SESSION_COOKIE_NAME = 'kartica_admin_session';
const SESSION_TTL_MS = Math.max(parseInt(process.env.ADMIN_SESSION_TTL_MS, 10) || 1000 * 60 * 30, 1000 * 60 * 5);
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
const COOKIE_SAME_SITE = process.env.ADMIN_COOKIE_SAME_SITE || 'Lax';
const TELEGRAM_BOT_TOKEN = (process.env.ADMIN_TELEGRAM_BOT_TOKEN || '').trim();
const TELEGRAM_ALLOWED_USER_IDS = (process.env.ADMIN_TELEGRAM_ALLOWED_USER_IDS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const TELEGRAM_LOGIN_MAX_AGE_SECONDS = Math.max(
  parseInt(process.env.ADMIN_TELEGRAM_LOGIN_MAX_AGE_SECONDS, 10) || 600,
  60,
);
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
const ADMIN_GROUP_OWNERSHIP_ERROR = 'Можно изменять только созданные вами группы';

const decodePossibleJson = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }
  try {
    const decoded = decodeURIComponent(value);
    if (decoded && decoded !== value) {
      return decodePossibleJson(decoded);
    }
  } catch (error) {
    // ignore URI errors
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    // ignore invalid JSON
  }

  try {
    const base64Decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
    if (base64Decoded && base64Decoded !== trimmed) {
      return decodePossibleJson(base64Decoded);
    }
  } catch (error) {
    // ignore base64 errors
  }

  return null;
};

const buildInitDataQueryString = (initData) => {
  if (!initData || typeof initData !== 'string') {
    return '';
  }

  let raw = initData.trim();
  if (!raw) {
    return '';
  }

  try {
    const decoded = decodeURIComponent(raw);
    if (decoded && decoded !== raw) {
      raw = decoded;
    }
  } catch (error) {
    // ignore URI errors
  }

  if (raw.includes('=') && raw.includes('&')) {
    return raw;
  }

  const parsedJson = decodePossibleJson(raw);
  if (parsedJson && typeof parsedJson === 'object') {
    const params = new URLSearchParams();
    Object.entries(parsedJson).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      if (typeof value === 'object') {
        params.set(key, JSON.stringify(value));
      } else {
        params.set(key, String(value));
      }
    });
    const result = params.toString();
    if (result) {
      return result;
    }
  }

  try {
    const base64Decoded = Buffer.from(raw, 'base64').toString('utf-8');
    if (base64Decoded && base64Decoded !== raw) {
      return buildInitDataQueryString(base64Decoded);
    }
  } catch (error) {
    // ignore base64 errors
  }

  return '';
};

const parseTelegramInitData = (initDataRaw) => {
  const queryString = buildInitDataQueryString(initDataRaw);
  if (!queryString) {
    throw new Error('Telegram данные не переданы или имеют неверный формат');
  }

  const params = new URLSearchParams(queryString);
  const hash = params.get('hash');
  if (!hash) {
    throw new Error('Telegram данные не содержат проверочный hash');
  }

  const entries = [];
  params.forEach((value, key) => {
    if (key === 'hash') {
      return;
    }
    entries.push(`${key}=${value}`);
  });
  entries.sort();

  const authDate = Number.parseInt(params.get('auth_date'), 10);
  const userRaw = params.get('user');
  let user = null;
  let authSource = 'webapp';

  if (userRaw) {
    try {
      user = JSON.parse(userRaw);
    } catch (error) {
      throw new Error('Не удалось разобрать данные пользователя Telegram');
    }
  }

  if (!user) {
    const idRaw = params.get('id');
    if (idRaw) {
      authSource = 'widget';
      user = {
        id: idRaw,
        first_name: params.get('first_name') || undefined,
        last_name: params.get('last_name') || undefined,
        username: params.get('username') || undefined,
        photo_url: params.get('photo_url') || undefined,
      };
    }
  }

  if (!user) {
    throw new Error('Telegram не передал пользователя');
  }

  return { hash, dataCheckString: entries.join('\n'), authDate, user, authSource };
};

const normalizeTelegramUser = (user) => {
  if (!user || typeof user !== 'object') {
    return null;
  }

  const normalized = { ...user };
  if (normalized.id !== undefined && normalized.id !== null) {
    normalized.id = String(normalized.id);
  } else if (normalized.user && normalized.user.id !== undefined && normalized.user.id !== null) {
    normalized.id = String(normalized.user.id);
  } else {
    normalized.id = '';
  }

  return normalized;
};

const verifyTelegramLogin = (initDataRaw) => {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('Telegram авторизация не настроена на сервере');
  }

  const { hash, dataCheckString, authDate, user, authSource } = parseTelegramInitData(initDataRaw);

  const secretSeed =
    authSource === 'widget' ? TELEGRAM_BOT_TOKEN : `WebAppData${TELEGRAM_BOT_TOKEN}`;
  const secretKey = crypto.createHash('sha256').update(secretSeed).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (calculatedHash !== hash) {
    throw new Error('Не удалось подтвердить данные Telegram');
  }

  if (!Number.isFinite(authDate) || authDate <= 0) {
    throw new Error('Telegram не передал время авторизации');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds - authDate > TELEGRAM_LOGIN_MAX_AGE_SECONDS) {
    throw new Error('Сессия Telegram устарела, авторизуйтесь снова');
  }

  const normalizedUser = normalizeTelegramUser(user);

  if (!normalizedUser || !normalizedUser.id) {
    throw new Error('Telegram не передал пользователя');
  }

  if (TELEGRAM_ALLOWED_USER_IDS.length) {
    const isAllowed = TELEGRAM_ALLOWED_USER_IDS.includes(normalizedUser.id);
    if (!isAllowed) {
      throw new Error('У вас нет доступа к админ-панели');
    }
  }

  return { user: normalizedUser, authDate };
};

const extractTelegramUserId = (user) => {
  const normalized = normalizeTelegramUser(user);
  if (!normalized || typeof normalized.id !== 'string') {
    return '';
  }
  return normalized.id.trim();
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

function getAdminUserId(req) {
  if (!req || typeof req !== 'object') {
    return '';
  }
  if (typeof req.adminUserId === 'string' && req.adminUserId.trim()) {
    return req.adminUserId.trim();
  }
  return extractTelegramUserId(req.adminUser);
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
  const normalizedUser = normalizeTelegramUser(session.user);
  if (!normalizedUser || !normalizedUser.id) {
    activeSessions.delete(token);
    clearSessionCookie(res);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  session.user = normalizedUser;
  req.adminSessionToken = token;
  req.adminUser = normalizedUser;
  req.adminUserId = normalizedUser.id.trim();
  return next();
}

async function ensureGroupOwnedByUser(groupId, userId) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, ownerId: true },
  });

  if (!group) {
    const error = new Error('Group not found');
    error.statusCode = 404;
    throw error;
  }

  if (!userId || group.ownerId !== userId) {
    const error = new Error(ADMIN_GROUP_OWNERSHIP_ERROR);
    error.statusCode = 403;
    throw error;
  }

  return group;
}

app.post('/auth/login', (req, res) => {
  const initDataRaw = req.body?.initData;

  if (!initDataRaw || typeof initDataRaw !== 'string' || !initDataRaw.trim()) {
    return res.status(400).json({ error: 'Данные Telegram не переданы' });
  }

  try {
    const { user } = verifyTelegramLogin(initDataRaw);
    const normalizedUser = normalizeTelegramUser(user);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_TTL_MS;

    activeSessions.set(token, { expiresAt, user: normalizedUser });
    setSessionCookie(res, token, SESSION_TTL_MS);

    return res.json({ status: 'ok', expiresAt, user: normalizedUser });
  } catch (error) {
    console.warn('Telegram admin login failed', error);
    const statusCode =
      error && typeof error.message === 'string' && error.message === 'Telegram авторизация не настроена на сервере'
        ? 500
        : 401;
    return res
      .status(statusCode)
      .json({ error: error.message || 'Не удалось авторизоваться через Telegram' });
  }
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
  const user = normalizeTelegramUser(req.adminUser);
  if (session && user) {
    session.user = user;
  }
  res.json({ status: 'ok', expiresAt: session?.expiresAt, user: user || null });
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
    ownerId: group.ownerId || null,
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
    const ownerId = getAdminUserId(req);

    if (!title) {
      return res.status(400).json({ error: 'Group title is required' });
    }

    if (!ownerId) {
      return res.status(403).json({ error: 'Не удалось определить владельца группы' });
    }

    const group = await prisma.group.create({
      data: {
        title,
        description:
          descriptionRaw === null || descriptionRaw === undefined
            ? null
            : String(descriptionRaw).trim() || null,
        ownerId,
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

    const ownerId = getAdminUserId(req);
    await ensureGroupOwnedByUser(id, ownerId);

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
    if (error.statusCode === 403) {
      return res.status(403).json({ error: error.message });
    }
    if (error.code === 'P2025' || error.statusCode === 404) {
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

    const ownerId = getAdminUserId(req);
    await ensureGroupOwnedByUser(id, ownerId);

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

    const ownerId = getAdminUserId(req);
    await ensureGroupOwnedByUser(id, ownerId);

    await prisma.group.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    if (error.statusCode === 403) {
      return res.status(403).json({ error: error.message });
    }
    if (error.code === 'P2025' || error.statusCode === 404) {
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
