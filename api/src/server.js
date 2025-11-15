const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const express = require('express');
const crypto = require('crypto');

const ensurePrismaClientIsGenerated = () => {
  const apiRoot = path.join(__dirname, '..');
  const schemaPath = path.join(apiRoot, 'prisma', 'schema.prisma');
  const generatedSchemaPath = path.join(apiRoot, 'node_modules', '.prisma', 'client', 'schema.prisma');

  let shouldRegenerate = false;

  try {
    const sourceStats = fs.statSync(schemaPath);
    const generatedStats = fs.statSync(generatedSchemaPath);
    if (sourceStats.mtimeMs > generatedStats.mtimeMs) {
      shouldRegenerate = true;
    }
  } catch (error) {
    shouldRegenerate = true;
  }

  if (!shouldRegenerate) {
    try {
      const generatedSchemaContents = fs.readFileSync(generatedSchemaPath, 'utf8');
      if (!generatedSchemaContents.includes('claimTokenHash')) {
        shouldRegenerate = true;
      }
    } catch (error) {
      shouldRegenerate = true;
    }
  }

  if (!shouldRegenerate) {
    return;
  }

  try {
    execSync('npx prisma generate', {
      cwd: apiRoot,
      stdio: 'ignore',
      env: process.env,
    });
  } catch (error) {
    console.error('Не удалось обновить Prisma Client. Запустите "npm run prisma:generate" вручную.', error);
    throw error;
  }
};

ensurePrismaClientIsGenerated();

const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;

const ADMIN_TOKEN_SECRET = (process.env.ADMIN_TOKEN_SECRET || '').trim();
const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const ADMIN_TOKEN_HEADER = { alg: 'HS256', typ: 'JWT' };
const ADMIN_ID_MAX_LENGTH = 128;
const ADMIN_DISPLAY_NAME_MAX_LENGTH = 120;
const ADMIN_USERNAME_MAX_LENGTH = 64;
const ADMIN_NAME_PART_MAX_LENGTH = 60;
const ADMIN_IDENTITY_SECRET_MAX_LENGTH = 512;
const ADMIN_CLAIM_TOKEN_LENGTH_BYTES = 32;
const ADMIN_TOKEN_VERIFICATION_ERROR = 'Не удалось подтвердить данные администратора.';

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
const GROUP_SEARCH_QUERY_MAX_LENGTH = 120;

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

const sanitizeString = (value, maxLength) => {
  if (value === undefined || value === null) {
    return '';
  }

  const stringValue = typeof value === 'string' ? value : String(value);
  const trimmed = stringValue.trim();

  if (!trimmed) {
    return '';
  }

  if (typeof maxLength === 'number' && maxLength > 0 && trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }

  return trimmed;
};

const sanitizeSecretString = (value) => {
  if (value === undefined || value === null) {
    return '';
  }

  const stringValue = typeof value === 'string' ? value : String(value);
  const trimmed = stringValue.trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.length > ADMIN_IDENTITY_SECRET_MAX_LENGTH) {
    return trimmed.slice(0, ADMIN_IDENTITY_SECRET_MAX_LENGTH);
  }

  return trimmed;
};

const hashAdminIdentitySecret = (secret) =>
  crypto.createHash('sha256').update(secret, 'utf8').digest('hex');

const generateAdminClaimToken = () => crypto.randomBytes(ADMIN_CLAIM_TOKEN_LENGTH_BYTES).toString('hex');

const hashAdminClaimToken = (token) => hashAdminIdentitySecret(token);

const areSecretHashesEqual = (hashA, hashB) => {
  if (!hashA || !hashB) {
    return false;
  }

  try {
    const bufferA = Buffer.from(hashA, 'hex');
    const bufferB = Buffer.from(hashB, 'hex');

    if (bufferA.length === 0 || bufferA.length !== bufferB.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufferA, bufferB);
  } catch (error) {
    return false;
  }
};

const doesClaimTokenMatch = (storedHash, token) => {
  if (!storedHash || !token) {
    return false;
  }

  const providedHash = hashAdminClaimToken(token);
  return areSecretHashesEqual(storedHash, providedHash);
};

const normalizeAdminUser = (rawUser) => {
  if (!rawUser || typeof rawUser !== 'object') {
    return null;
  }

  const candidateId =
    rawUser.id ??
    rawUser.userId ??
    rawUser.user_id ??
    rawUser.user?.id ??
    rawUser.sub ??
    rawUser.uid;

  const id = sanitizeString(candidateId, ADMIN_ID_MAX_LENGTH);

  const firstName = sanitizeString(
    rawUser.first_name ?? rawUser.firstName ?? rawUser.user?.first_name ?? '',
    ADMIN_NAME_PART_MAX_LENGTH,
  );
  const lastName = sanitizeString(
    rawUser.last_name ?? rawUser.lastName ?? rawUser.user?.last_name ?? '',
    ADMIN_NAME_PART_MAX_LENGTH,
  );
  const username = sanitizeString(
    rawUser.username ?? rawUser.user?.username ?? '',
    ADMIN_USERNAME_MAX_LENGTH,
  );
  const explicitDisplayName = sanitizeString(
    rawUser.displayName ??
      rawUser.name ??
      rawUser.fullName ??
      rawUser.user?.displayName ??
      rawUser.user?.name ??
      '',
    ADMIN_DISPLAY_NAME_MAX_LENGTH,
  );

  const normalized = {};

  if (id) {
    normalized.id = id;
  }

  if (explicitDisplayName) {
    normalized.displayName = explicitDisplayName;
  } else {
    const nameParts = [firstName, lastName].filter(Boolean);
    if (nameParts.length) {
      normalized.displayName = sanitizeString(nameParts.join(' '), ADMIN_DISPLAY_NAME_MAX_LENGTH);
    }
  }

  if (firstName) {
    normalized.firstName = firstName;
  }

  if (lastName) {
    normalized.lastName = lastName;
  }

  if (username) {
    normalized.username = username;
  }

  return Object.keys(normalized).length ? normalized : null;
};

const buildAdminUserFromRequest = (body) => {
  const raw = typeof body === 'object' && body !== null ? body : {};

  const userId =
    sanitizeString(raw.userId, ADMIN_ID_MAX_LENGTH) ||
    sanitizeString(raw.user_id, ADMIN_ID_MAX_LENGTH) ||
    sanitizeString(raw.id, ADMIN_ID_MAX_LENGTH);

  if (!userId) {
    const error = new Error('Не передан идентификатор пользователя.');
    error.statusCode = 400;
    throw error;
  }

  const profileRaw =
    typeof raw.profile === 'object' && raw.profile !== null ? raw.profile : {};

  const user = { id: userId };

  const displayName =
    sanitizeString(raw.displayName, ADMIN_DISPLAY_NAME_MAX_LENGTH) ||
    sanitizeString(profileRaw.displayName, ADMIN_DISPLAY_NAME_MAX_LENGTH) ||
    sanitizeString(profileRaw.name, ADMIN_DISPLAY_NAME_MAX_LENGTH);

  if (displayName) {
    user.displayName = displayName;
  }

  const username =
    sanitizeString(raw.username, ADMIN_USERNAME_MAX_LENGTH) ||
    sanitizeString(profileRaw.username, ADMIN_USERNAME_MAX_LENGTH);

  if (username) {
    user.username = username;
  }

  const firstName = sanitizeString(
    profileRaw.firstName ?? profileRaw.first_name,
    ADMIN_NAME_PART_MAX_LENGTH,
  );
  if (firstName) {
    user.firstName = firstName;
  }

  const lastName = sanitizeString(
    profileRaw.lastName ?? profileRaw.last_name,
    ADMIN_NAME_PART_MAX_LENGTH,
  );
  if (lastName) {
    user.lastName = lastName;
  }

  return user;
};

const generateAdminToken = (user) => {
  if (!ADMIN_TOKEN_SECRET) {
    throw new Error('ADMIN_TOKEN_SECRET не настроен на сервере');
  }

  const normalizedUser = normalizeAdminUser(user);
  const fallbackId = sanitizeString(user?.id, ADMIN_ID_MAX_LENGTH);
  const subject = normalizedUser?.id || fallbackId;

  if (!subject) {
    throw new Error('Не удалось определить пользователя администратора');
  }

  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = issuedAtSeconds + Math.floor(ADMIN_TOKEN_TTL_MS / 1000);

  const payload = {
    sub: subject,
    iat: issuedAtSeconds,
    exp: expiresAtSeconds,
    iss: 'kartica-admin',
    user: normalizedUser || { id: subject },
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

  const normalizedUser = normalizeAdminUser(payload.user);
  const adminUserId =
    normalizedUser?.id || sanitizeString(payload.sub, ADMIN_ID_MAX_LENGTH);

  if (!adminUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.adminUser = normalizedUser ? { ...normalizedUser, id: adminUserId } : { id: adminUserId };
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

app.post('/auth/token', async (req, res) => {
  try {
    const userInput = buildAdminUserFromRequest(req.body);
    const secret = sanitizeSecretString(req.body?.secret);
    const claimToken = sanitizeSecretString(req.body?.claimToken);

    if (!secret) {
      const error = new Error('Не передан секрет администратора.');
      error.statusCode = 400;
      throw error;
    }

    const secretHash = hashAdminIdentitySecret(secret);
    const requestedDisplayName = userInput.displayName
      ? sanitizeString(userInput.displayName, ADMIN_DISPLAY_NAME_MAX_LENGTH)
      : '';

    let identityRecord = await prisma.adminIdentity.findUnique({
      where: { id: userInput.id },
    });

    let generatedClaimToken = '';

    const ensureClaimTokenHash = () => {
      if (!generatedClaimToken) {
        generatedClaimToken = generateAdminClaimToken();
      }
      return hashAdminClaimToken(generatedClaimToken);
    };

    if (!identityRecord) {
      const existingGroups = await prisma.group.count({ where: { ownerId: userInput.id } });
      if (existingGroups > 0) {
        const error = new Error(
          claimToken
            ? 'Не удалось подтвердить токен владельца.'
            : 'Для доступа к уже созданной группе нужен токен подтверждения владельца.',
        );
        error.statusCode = 403;
        throw error;
      }

      const claimTokenHash = ensureClaimTokenHash();

      identityRecord = await prisma.adminIdentity.create({
        data: {
          id: userInput.id,
          secretHash,
          claimTokenHash,
          displayName: requestedDisplayName || null,
        },
      });
    } else {
      const updates = {};

      if (!identityRecord.claimTokenHash) {
        updates.claimTokenHash = ensureClaimTokenHash();
      }

      if (!identityRecord.secretHash) {
        if (!claimToken) {
          const error = new Error('Укажите токен владельца, чтобы подтвердить доступ.');
          error.statusCode = 403;
          throw error;
        }
        if (!doesClaimTokenMatch(identityRecord.claimTokenHash, claimToken)) {
          const error = new Error('Не удалось подтвердить токен владельца.');
          error.statusCode = 403;
          throw error;
        }

        updates.secretHash = secretHash;
        if (requestedDisplayName) {
          updates.displayName = requestedDisplayName;
        }
      } else {
        if (!areSecretHashesEqual(identityRecord.secretHash, secretHash)) {
          const error = new Error(ADMIN_TOKEN_VERIFICATION_ERROR);
          error.statusCode = 403;
          throw error;
        }

        if (identityRecord.claimTokenHash) {
          if (claimToken) {
            if (!doesClaimTokenMatch(identityRecord.claimTokenHash, claimToken)) {
              updates.claimTokenHash = ensureClaimTokenHash();
            }
          } else {
            updates.claimTokenHash = ensureClaimTokenHash();
          }
        }

        if (requestedDisplayName && requestedDisplayName !== identityRecord.displayName) {
          updates.displayName = requestedDisplayName;
        }
      }

      if (Object.keys(updates).length > 0) {
        identityRecord = await prisma.adminIdentity.update({
          where: { id: identityRecord.id },
          data: updates,
        });
      }
    }

    const tokenUser = {
      id: identityRecord.id,
      displayName:
        requestedDisplayName || identityRecord.displayName || userInput.displayName || undefined,
      firstName: userInput.firstName,
      lastName: userInput.lastName,
      username: userInput.username,
    };

    const normalizedUser = normalizeAdminUser(tokenUser) || { id: identityRecord.id };

    if (!normalizedUser.displayName && identityRecord.displayName) {
      normalizedUser.displayName = identityRecord.displayName;
    }

    const { token, expiresAt } = generateAdminToken(normalizedUser);

    const responsePayload = { token, expiresAt, user: normalizedUser };
    if (generatedClaimToken) {
      responsePayload.claimToken = generatedClaimToken;
    }

    return res.json(responsePayload);
  } catch (error) {
    console.warn('Failed to issue admin token', error);
    const statusCode =
      Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode < 600
        ? error.statusCode
        : 400;
    return res
      .status(statusCode)
      .json({ error: error?.message || 'Не удалось выдать токен администратора' });
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

app.post('/auth/claim-token', requireAdmin, async (req, res) => {
  try {
    const claimToken = generateAdminClaimToken();
    const claimTokenHash = hashAdminClaimToken(claimToken);

    await prisma.adminIdentity.upsert({
      where: { id: req.adminUserId },
      update: { claimTokenHash },
      create: {
        id: req.adminUserId,
        secretHash: null,
        claimTokenHash,
        displayName: null,
      },
    });

    res.json({ claimToken });
  } catch (error) {
    console.error('Failed to rotate admin claim token', error);
    res.status(500).json({ error: 'Не удалось обновить токен владельца' });
  }
});

app.get('/groups', async (req, res) => {
  let adminUserId = '';

  const candidateToken = getAdminTokenFromRequest(req);
  if (candidateToken) {
    try {
      const payload = verifyAdminToken(candidateToken);
      const normalizedUser = normalizeAdminUser(payload.user);
      adminUserId =
        normalizedUser?.id || sanitizeString(payload.sub, ADMIN_ID_MAX_LENGTH) || '';
      if (!adminUserId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    } catch (error) {
      return res.status(401).json({ error: error?.message || 'Unauthorized' });
    }
  }

  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const rawSearchQuery =
      typeof req.query.search === 'string'
        ? req.query.search
        : typeof req.query.query === 'string'
        ? req.query.query
        : typeof req.query.q === 'string'
        ? req.query.q
        : '';
    const searchQuery = sanitizeString(rawSearchQuery, GROUP_SEARCH_QUERY_MAX_LENGTH);

    const filters = [];

    if (adminUserId) {
      filters.push({ ownerId: adminUserId });
    }

    let whereClause = {};
    if (filters.length === 1) {
      whereClause = filters[0];
    } else if (filters.length > 1) {
      whereClause = { AND: filters };
    }

    let groups = [];
    let total = 0;

    if (searchQuery) {
      const normalizedSearch = searchQuery.toLocaleLowerCase();
      const baseGroups = await prisma.group.findMany({
        where: filters.length ? whereClause : undefined,
        orderBy: { id: 'asc' },
        include: { _count: { select: { cards: true } } },
      });

      const filteredGroups = baseGroups.filter((group) => {
        const title = group.title?.toLocaleLowerCase?.() || '';
        const description = group.description?.toLocaleLowerCase?.() || '';
        return (
          title.includes(normalizedSearch) || description.includes(normalizedSearch)
        );
      });

      total = filteredGroups.length;
      groups = filteredGroups.slice(skip, skip + pageSize);
    } else {
      const [count, paginatedGroups] = await Promise.all([
        prisma.group.count({ where: filters.length ? whereClause : undefined }),
        prisma.group.findMany({
          where: filters.length ? whereClause : undefined,
          skip,
          take: pageSize,
          orderBy: { id: 'asc' },
          include: { _count: { select: { cards: true } } },
        }),
      ]);
      total = count;
      groups = paginatedGroups;
    }

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
  let adminUserId = '';
  const candidateToken = getAdminTokenFromRequest(req);
  if (candidateToken) {
    try {
      const payload = verifyAdminToken(candidateToken);
      const normalizedUser = normalizeAdminUser(payload.user);
      adminUserId =
        normalizedUser?.id || sanitizeString(payload.sub, ADMIN_ID_MAX_LENGTH) || '';
      if (!adminUserId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    } catch (error) {
      return res.status(401).json({ error: error?.message || 'Unauthorized' });
    }
  }

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

    if (adminUserId) {
      const ownerId = group.ownerId ? String(group.ownerId).trim() : '';
      if (!ownerId || ownerId !== adminUserId) {
        return res.status(403).json({ error: 'Недостаточно прав для просмотра группы' });
      }
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
