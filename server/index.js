const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { execFileSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || 'file:./prisma/dev.db';

const resolveDbPath = (connection) => {
  if (connection.startsWith('file:')) {
    return path.resolve(process.cwd(), connection.replace('file:', ''));
  }
  return path.resolve(process.cwd(), connection);
};

const dbPath = resolveDbPath(DATABASE_URL);
const migrationSql = fs.readFileSync(path.join(__dirname, '../prisma/migrations/0001_init/migration.sql'), 'utf8');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
execFileSync('sqlite3', [dbPath], { input: migrationSql, encoding: 'utf8' });

const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

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
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
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
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  try {
    if (parsed.pathname === '/api/groups' && req.method === 'GET') {
      const groups = await prisma.group.findMany({ include: { cards: true } });
      sendJson(res, 200, groups);
      return;
    }

    if (parsed.pathname === '/api/groups' && req.method === 'POST') {
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
        sendJson(res, 201, group);
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
        const group = await prisma.group.findUnique({ where: { id: groupId }, include: { cards: true } });
        if (!group) {
          sendError(res, 404, 'Группа не найдена');
          return;
        }
        sendJson(res, 200, group);
        return;
      }

      if (segments.length === 4 && segments[3] === 'cards') {
        if (req.method === 'GET') {
          const cards = await prisma.card.findMany({ where: { groupId } });
          sendJson(res, 200, cards);
          return;
        }

        if (req.method === 'POST') {
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
