const express = require('express');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;

const TELEGRAM_BOT_TOKEN = (process.env.ADMIN_TELEGRAM_BOT_TOKEN || '').trim();
const TELEGRAM_ALLOWED_USER_IDS = (process.env.ADMIN_TELEGRAM_ALLOWED_USER_IDS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const TELEGRAM_LOGIN_MAX_AGE_SECONDS = Math.max(
  parseInt(process.env.ADMIN_TELEGRAM_LOGIN_MAX_AGE_SECONDS, 10) || 600,
  60,
);

const ADMIN_TOKEN_SECRET = (process.env.ADMIN_TOKEN_SECRET || '').trim();
const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const ADMIN_TOKEN_HEADER = { alg: 'HS256', typ: 'JWT' };

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const configuredAllowedOriginsRaw = [
  process.env.ADMIN_ALLOWED_ORIGINS,
  process.env.ADMIN_ALLOWED_ORIGIN,
]
  .filter((value) => typeof value === 'string' && value.trim())
  .map((value) => value.trim())
  .join(',');

const STATIC_ALLOWED_ORIGINS = (configuredAllowedOriginsRaw
  ? configuredAllowedOriginsRaw.split(',')
  : DEFAULT_ALLOWED_ORIGINS)
  .map((origin) => origin.trim())
  .filter(Boolean);

const hasExplicitAllowedOrigins = Boolean(configuredAllowedOriginsRaw);

const ADMIN_GROUP_OWNERSHIP_ERROR = 'Можно изменять только созданные вами группы';

app.use(express.json());

app.use((req, res, next) => {
  const originHeader = req.headers.origin;
  let allowedOrigin = '';

  if (originHeader && STATIC_ALLOWED_ORIGINS.includes(originHeader)) {
    allowedOrigin = originHeader;
  } else if (originHeader && !hasExplicitAllowedOrigins) {
    allowedOrigin = originHeader;
  } else if (STATIC_ALLOWED_ORIGINS.length) {
    [allowedOrigin] = STATIC_ALLOWED_ORIGINS;
  }

  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  }
  if (originHeader) {
    const existingVary = res.getHeader('Vary');
    if (!existingVary) {
      res.setHeader('Vary', 'Origin');
    } else if (Array.isArray(existingVary)) {
      if (!existingVary.includes('Origin')) {
        res.setHeader('Vary', [...existingVary, 'Origin']);
      }
    } else if (typeof existingVary === 'string') {
      const parts = existingVary.split(/,\s*/).filter(Boolean);
      if (!parts.includes('Origin')) {
        parts.push('Origin');
        res.setHeader('Vary', parts.join(', '));
      }
    }
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});

const toBase64Url = (value) =>
  Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const fromBase64UrlToBuffer = (value) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64');
};

const fromBase64Url = (value) => fromBase64UrlToBuffer(value).toString('utf-8');

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

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const params = new URLSearchParams();
      Object.entries(parsed).forEach(([key, value]) => {
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
  } catch (error) {
    // ignore JSON errors
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

  const secretSeed = authSource === 'widget' ? TELEGRAM_BOT_TOKEN : `WebAppData${TELEGRAM_BOT_TOKEN}`;
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

const generateAdminToken = (user) => {
  if (!ADMIN_TOKEN_SECRET) {
    throw new Error('ADMIN_TOKEN_SECRET не настроен на сервере');
  }
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = issuedAtSeconds + Math.floor(ADMIN_TOKEN_TTL_MS / 1000);

  const payload = {
    sub: user.id,
    iat: issuedAtSeconds,
    exp: expiresAtSeconds,
    iss: 'kartica-admin',
    user,
  };

  const encodedHeader = toBase64Url(JSON.stringify(ADMIN_TOKEN_HEADER));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', ADMIN_TOKEN_SECRET)
    .update(data)
    .digest();
  const encodedSignature = toBase64Url(signature);

  return {
    token: `${data}.${encodedSignature}`,
    expiresAt: expiresAtSeconds * 1000,
  };
};

const verifyAdminToken = (token) => {
  if (!token || typeof token !== 'string') {
    throw new Error('Токен администратора не передан');
  }
  if (!ADMIN_TOKEN_SECRET) {
    throw new Error('ADMIN_TOKEN_SECRET не настроен на сервере');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Неверный формат токена администратора');
  }

  const [encodedHeader, encodedPayload, signaturePart] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac('sha256', ADMIN_TOKEN_SECRET)
    .update(data)
    .digest();

  let providedSignature;
  try {
    providedSignature = fromBase64UrlToBuffer(signaturePart);
  } catch (error) {
    throw new Error('Неверный формат подписи токена администратора');
  }

  if (
    expectedSignature.length !== providedSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, providedSignature)
  ) {
    throw new Error('Не удалось подтвердить токен администратора');
  }

  let header;
  let payload;
  try {
    header = JSON.parse(fromBase64Url(encodedHeader));
    payload = JSON.parse(fromBase64Url(encodedPayload));
  } catch (error) {
    throw new Error('Не удалось разобрать токен администратора');
  }

  if (!header || header.alg !== 'HS256') {
    throw new Error('Неподдерживаемый алгоритм подписи токена администратора');
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('Неверная структура токена администратора');
  }

  if (!payload.sub) {
    throw new Error('Токен администратора не содержит идентификатор пользователя');
  }

  if (payload.exp && Number.isFinite(payload.exp)) {
    const expiresAtMs = Number(payload.exp) * 1000;
    if (expiresAtMs < Date.now()) {
      throw new Error('Токен администратора истёк');
    }
  }

  return payload;
};

const getAdminTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (typeof req.headers['x-admin-token'] === 'string') {
    return req.headers['x-admin-token'].trim();
  }
  return '';
};

function requireAdmin(req, res, next) {
  let payload;
  try {
    const token = getAdminTokenFromRequest(req);
    payload = verifyAdminToken(token);
    req.adminToken = token;
  } catch (error) {
    return res.status(401).json({ error: error.message || 'Unauthorized' });
  }

  const normalizedUser = normalizeTelegramUser(payload.user);
  const adminUserId = normalizedUser?.id || String(payload.sub || '').trim();
  if (!adminUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.adminUser = normalizedUser || { id: adminUserId };
  req.adminUserId = adminUserId;
  req.adminTokenExpiresAt = payload.exp ? Number(payload.exp) * 1000 : null;

  return next();
}

function getAdminUserId(req) {
  if (!req || typeof req !== 'object') {
    return '';
  }
  if (typeof req.adminUserId === 'string' && req.adminUserId.trim()) {
    return req.adminUserId.trim();
  }
  return '';
}

const parsePagination = (query = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(query.pageSize, 10) || 20, 1), 200);
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip };
};

const serializeGroupSummary = (group) => ({
  id: group.id,
  title: group.title,
  description: group.description,
  createdAt: group.createdAt,
  updatedAt: group.updatedAt,
  cardsCount: group._count?.cards ?? 0,
  ownerId: group.ownerId ?? null,
});

const normalizeCardPayload = (card, index) => {
  if (!card || typeof card !== 'object') {
    const error = new Error(`Card at position ${index + 1} is not an object`);
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
};

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

app.post('/auth/token', (req, res) => {
  const initDataRaw = req.body?.initData;

  if (!initDataRaw || typeof initDataRaw !== 'string' || !initDataRaw.trim()) {
    return res.status(400).json({ error: 'Данные Telegram не переданы' });
  }

  try {
    const { user } = verifyTelegramLogin(initDataRaw);
    const normalizedUser = normalizeTelegramUser(user);
    const { token, expiresAt } = generateAdminToken(normalizedUser);

    return res.json({ token, expiresAt, user: normalizedUser });
  } catch (error) {
    console.warn('Failed to issue admin token', error);
    const statusCode =
      error && typeof error.message === 'string' &&
      error.message === 'Telegram авторизация не настроена на сервере'
        ? 500
        : 401;
    return res
      .status(statusCode)
      .json({ error: error.message || 'Не удалось выдать токен администратора' });
  }
});

app.get('/auth/session', requireAdmin, (req, res) => {
  res.json({
    user: req.adminUser,
    expiresAt: req.adminTokenExpiresAt,
  });
});

app.post('/auth/logout', (req, res) => {
  res.status(204).send();
});

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
