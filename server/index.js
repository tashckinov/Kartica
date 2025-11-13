const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { execSync } = require('child_process');
const { isValid } = require('@telegram-apps/init-data-node');

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || 'file:./prisma/dev.db';
const TELEGRAM_BOT_SECRET = process.env.TELEGRAM_BOT_SECRET || '';
const runPrismaCommand = (command, label) => {
  try {
    execSync(command, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL },
      shell: true
    });
  } catch (error) {
    console.error(`Failed to run ${label}`, error);
    process.exit(1);
  }
};

runPrismaCommand('npx prisma generate', 'prisma generate');
runPrismaCommand('npx prisma migrate deploy', 'prisma migrate deploy');

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const parseTelegramUser = (initData) => {
  const data = new URLSearchParams(initData);
  const rawUser = data.get('user');
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(rawUser));
  } catch (error) {
    return null;
  }
};

const upsertUserFromTelegram = async (payload) => {
  if (!payload || typeof payload.id === 'undefined') {
    return null;
  }

  const telegramId = String(payload.id);
  const createData = {
    telegramId,
    firstName: payload.first_name ?? null,
    lastName: payload.last_name ?? null,
    username: payload.username ?? null,
    languageCode: payload.language_code ?? null,
    photoUrl: payload.photo_url ?? null
  };

  const updateData = { ...createData };
  delete updateData.telegramId;

  return prisma.user.upsert({
    where: { telegramId },
    update: updateData,
    create: createData
  });
};

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const authenticateInitData = async (req, { required = true } = {}) => {
  try {
    const initData = req.headers['x-telegram-data'];
    if (!initData) {
      if (required) {
        throw createHttpError(403, 'Access denied');
      }
      return null;
    }

    if (!TELEGRAM_BOT_SECRET) {
      const message = 'TELEGRAM_BOT_SECRET is not configured';
      if (required) {
        console.error(message);
        throw createHttpError(500, 'Server configuration error');
      }
      console.warn(message);
      return null;
    }

    if (!isValid(initData, TELEGRAM_BOT_SECRET)) {
      throw createHttpError(403, 'Access denied');
    }

    const telegramUser = parseTelegramUser(initData);
    if (!telegramUser) {
      throw createHttpError(401, 'Invalid token. Refresh page please');
    }

    const user = await upsertUserFromTelegram(telegramUser);
    if (!user) {
      throw createHttpError(401, 'Invalid token. Refresh page please');
    }

    req.user = user;
    req.telegram = { user: telegramUser };
    return user;
  } catch (error) {
    if (error.status) {
      throw error;
    }
    console.error('Failed to authenticate request', error);
    throw createHttpError(401, 'Invalid token. Refresh page please');
  }
};

const mapGroupForResponse = (group, likedGroupIds = new Set()) => ({
  id: group.id,
  name: group.name,
  subtitle: group.subtitle,
  description: group.description,
  coverImage: group.coverImage,
  createdAt: group.createdAt,
  updatedAt: group.updatedAt,
  cards: Array.isArray(group.cards) ? group.cards : [],
  cardsCount: typeof group.cardsCount === 'number' ? group.cardsCount : Array.isArray(group.cards) ? group.cards.length : 0,
  isLiked: likedGroupIds.has(group.id)
});

const mapProfileGroup = (record) => {
  if (!record || !record.group) {
    return null;
  }

  return {
    groupId: record.groupId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    group: {
      id: record.group.id,
      name: record.group.name,
      subtitle: record.group.subtitle,
      description: record.group.description,
      coverImage: record.group.coverImage,
      createdAt: record.group.createdAt,
      updatedAt: record.group.updatedAt,
      cardsCount: record.group._count?.cards ?? 0
    }
  };
};

const mapHistoryEntry = (record, likedGroupIds = new Set()) => {
  const base = mapProfileGroup(record);
  if (!base) {
    return null;
  }

  return {
    ...base,
    type: 'history',
    lastOpenedAt: record.lastOpenedAt ?? record.updatedAt ?? record.createdAt,
    group: {
      ...base.group,
      isLiked: likedGroupIds.has(base.groupId)
    }
  };
};

const mapLikeEntry = (record) => {
  const base = mapProfileGroup(record);
  if (!base) {
    return null;
  }

  return {
    ...base,
    type: 'like',
    likedAt: record.createdAt,
    group: {
      ...base.group,
      isLiked: true
    }
  };
};

const getLikedGroupIdsForUser = async (userId) => {
  const likes = await prisma.groupLike.findMany({
    where: { userId },
    select: { groupId: true }
  });

  return new Set(likes.map((like) => like.groupId));
};

const publicDir = path.join(__dirname, '..');
const swaggerHtmlPath = path.join(__dirname, '../docs/swagger.html');
const openApiPath = path.join(__dirname, '../docs/openapi.yaml');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8'
};

const sendJson = (res, status, data) => {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Data'
  });
  res.end(body);
};

const sendError = (res, status, message) => {
  sendJson(res, status, { error: message });
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(data);
        resolve(parsed);
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });

const serveStatic = (req, res, pathname) => {
  const safePath = path.normalize(path.join(publicDir, pathname));
  if (!safePath.startsWith(publicDir)) {
    sendError(res, 403, 'Forbidden');
    return;
  }

  let filePath = safePath;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendError(res, 404, 'Not found');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(filePath);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*'
  });
  stream.pipe(res);
};

const handleApi = async (req, res) => {
  const parsed = url.parse(req.url, true);
  const segments = parsed.pathname.split('/').filter(Boolean);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Data'
    });
    res.end();
    return;
  }

  const ensureAuth = async (options) => {
    try {
      const authUser = await authenticateInitData(req, options);
      return { user: authUser, halt: false };
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 401;
      sendError(res, status, error.message || 'Invalid token. Refresh page please');
      return { user: null, halt: true };
    }
  };

  try {
    if (parsed.pathname === '/api/me' && req.method === 'GET') {
      const { user, halt } = await ensureAuth({ required: true });
      if (halt) {
        return;
      }

      const [historyRecords, likedRecords] = await Promise.all([
        prisma.groupHistory.findMany({
          where: { userId: user.id },
          include: {
            group: {
              include: {
                _count: { select: { cards: true } }
              }
            }
          },
          orderBy: { lastOpenedAt: 'desc' }
        }),
        prisma.groupLike.findMany({
          where: { userId: user.id },
          include: {
            group: {
              include: {
                _count: { select: { cards: true } }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        })
      ]);

      const likedGroupIds = new Set(likedRecords.map((entry) => entry.groupId));
      const history = historyRecords
        .map((record) => mapHistoryEntry(record, likedGroupIds))
        .filter(Boolean);
      const likes = likedRecords.map(mapLikeEntry).filter(Boolean);

      sendJson(res, 200, {
        user: {
          id: user.id,
          telegramId: user.telegramId,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          languageCode: user.languageCode,
          photoUrl: user.photoUrl
        },
        history,
        likes
      });
      return;
    }

    if (parsed.pathname === '/api/groups' && req.method === 'GET') {
      const { user, halt } = await ensureAuth({ required: false });
      if (halt) {
        return;
      }

      const likedGroupIds = user ? await getLikedGroupIdsForUser(user.id) : new Set();
      const groups = await prisma.group.findMany({ include: { cards: true } });
      const payload = groups.map((group) => mapGroupForResponse(group, likedGroupIds));
      sendJson(res, 200, payload);
      return;
    }

    if (parsed.pathname === '/api/groups' && req.method === 'POST') {
      const { halt } = await ensureAuth({ required: true });
      if (halt) {
        return;
      }

      const body = await readBody(req);
      if (!body || !body.name) {
        sendError(res, 400, 'Поле name обязательно');
        return;
      }

      try {
        const group = await prisma.group.create({
          data: {
            name: body.name,
            subtitle: body.subtitle ?? null,
            description: body.description ?? null,
            coverImage: body.coverImage ?? null
          },
          include: { cards: true }
        });
        const payload = mapGroupForResponse(group, new Set());
        sendJson(res, 201, payload);
      } catch (error) {
        if (error.message.includes('UNIQUE')) {
          sendError(res, 409, 'Группа с таким именем уже существует');
          return;
        }
        throw error;
      }
      return;
    }

    if (segments.length >= 2 && segments[0] === 'api' && segments[1] === 'groups') {
      const groupId = Number(segments[2]);
      if (!Number.isInteger(groupId)) {
        sendError(res, 400, 'Некорректный идентификатор группы');
        return;
      }

      if (segments.length === 3 && req.method === 'GET') {
        const { user, halt } = await ensureAuth({ required: false });
        if (halt) {
          return;
        }

        const group = await prisma.group.findUnique({ include: { cards: true }, where: { id: groupId } });
        if (!group) {
          sendError(res, 404, 'Группа не найдена');
          return;
        }
        const likedGroupIds = user ? await getLikedGroupIdsForUser(user.id) : new Set();
        sendJson(res, 200, mapGroupForResponse(group, likedGroupIds));
        return;
      }

      if (segments.length === 4 && segments[3] === 'cards') {
        if (req.method === 'GET') {
          const { halt } = await ensureAuth({ required: false });
          if (halt) {
            return;
          }

          const cards = await prisma.card.findMany({ where: { groupId } });
          sendJson(res, 200, cards);
          return;
        }

        if (req.method === 'POST') {
          const { halt } = await ensureAuth({ required: true });
          if (halt) {
            return;
          }

          const body = await readBody(req);
          if (!body || !body.translation) {
            sendError(res, 400, 'Поле translation обязательно');
            return;
          }

          const group = await prisma.group.findUnique({ where: { id: groupId } });
          if (!group) {
            sendError(res, 404, 'Группа не найдена');
            return;
          }

          const card = await prisma.card.create({
            data: {
              translation: body.translation,
              original: body.original ?? null,
              image: body.image ?? null,
              groupId
            }
          });
          sendJson(res, 201, card);
          return;
        }
      }

      if (segments.length === 4 && segments[3] === 'history' && req.method === 'POST') {
        const { user, halt } = await ensureAuth({ required: true });
        if (halt) {
          return;
        }

        const group = await prisma.group.findUnique({ where: { id: groupId } });
        if (!group) {
          sendError(res, 404, 'Группа не найдена');
          return;
        }

        const entry = await prisma.groupHistory.upsert({
          where: { userId_groupId: { userId: user.id, groupId } },
          update: { lastOpenedAt: new Date() },
          create: { userId: user.id, groupId }
        });

        sendJson(res, 200, { groupId, lastOpenedAt: entry.lastOpenedAt });
        return;
      }

      if (segments.length === 4 && segments[3] === 'like') {
        const { user, halt } = await ensureAuth({ required: true });
        if (halt) {
          return;
        }

        const group = await prisma.group.findUnique({ where: { id: groupId } });
        if (!group) {
          sendError(res, 404, 'Группа не найдена');
          return;
        }

        if (req.method === 'POST') {
          const entry = await prisma.groupLike.upsert({
            where: { userId_groupId: { userId: user.id, groupId } },
            update: { groupId },
            create: { userId: user.id, groupId }
          });
          sendJson(res, 200, { groupId, isLiked: true, likedAt: entry.createdAt });
          return;
        }

        if (req.method === 'DELETE') {
          await prisma.groupLike.deleteMany({ where: { userId: user.id, groupId } });
          sendJson(res, 200, { groupId, isLiked: false, likedAt: null });
          return;
        }
      }
    }

    sendError(res, 404, 'Маршрут не найден');
  } catch (error) {
    console.error('API error:', error);
    sendError(res, 500, 'Внутренняя ошибка сервера');
  }
};

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);

  if (parsed.pathname.startsWith('/api/docs')) {
    if (req.method === 'GET') {
      if (!fs.existsSync(swaggerHtmlPath)) {
        sendError(res, 404, 'Документация не найдена');
        return;
      }
      const html = fs.readFileSync(swaggerHtmlPath);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(html);
      return;
    }
  }

  if (parsed.pathname === '/api/openapi.yaml') {
    if (!fs.existsSync(openApiPath)) {
      sendError(res, 404, 'Спецификация не найдена');
      return;
    }
    const spec = fs.readFileSync(openApiPath, 'utf8');
    res.writeHead(200, {
      'Content-Type': 'application/yaml; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(spec);
    return;
  }

  if (parsed.pathname.startsWith('/api/')) {
    handleApi(req, res);
    return;
  }

  const pathname = parsed.pathname === '/' ? '/index.html' : parsed.pathname;
  serveStatic(req, res, pathname);
});

const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
