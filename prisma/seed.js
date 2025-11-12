const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const DATABASE_URL = process.env.DATABASE_URL || 'file:./prisma/dev.db';

const resolveDbPath = (url) => {
  if (url.startsWith('file:')) {
    const relative = url.replace('file:', '');
    return path.resolve(process.cwd(), relative);
  }
  return path.resolve(process.cwd(), url);
};

const dbPath = resolveDbPath(DATABASE_URL);
const migrationPath = path.join(__dirname, 'migrations/0001_init/migration.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
execFileSync('sqlite3', [dbPath], { input: migrationSql, encoding: 'utf8' });

const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

const coverImage = 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?auto=format&fit=crop&w=1200&q=80';

const cards = [
  { translation: 'сломаться (о технике)', original: 'Break down', image: null },
  { translation: 'продолжать делать что-то', original: 'Carry on', image: null },
  { translation: 'случайно наткнуться', original: 'Come across', image: null },
  { translation: 'придумать идею', original: 'Come up with', image: null },
  { translation: 'сократить потребление', original: 'Cut back on', image: null },
  { translation: 'разобраться, понять', original: 'Figure out', image: null },
  { translation: 'ладить, быть в хороших отношениях', original: 'Get along', image: null },
  { translation: 'сдаться, бросить', original: 'Give up', image: null },
  { translation: 'присматривать за кем-то', original: 'Look after', image: null },
  { translation: 'ждать с нетерпением', original: 'Look forward to', image: null },
  { translation: 'выдумать, сочинить', original: 'Make up', image: null },
  { translation: 'подобрать, забрать; подучить', original: 'Pick up', image: null },
  { translation: 'указать, подчеркнуть', original: 'Point out', image: null },
  { translation: 'откладывать на потом', original: 'Put off', image: null },
  { translation: 'случайно встретить', original: 'Run into', image: null },
  { translation: 'организовать, настроить', original: 'Set up', image: null },
  { translation: 'взлететь; быстро стать популярным', original: 'Take off', image: null },
  { translation: 'отклонить предложение', original: 'Turn down', image: null },
  { translation: 'решить проблему; тренироваться', original: 'Work out', image: null },
  { translation: 'поднять тему; воспитывать', original: 'Bring up', image: null }
];

(async () => {
  await prisma.$connect();

  prisma.client.run('DELETE FROM cards; DELETE FROM groups;');

  const group = await prisma.group.create({
    data: {
      name: 'English',
      subtitle: '20 устойчивых фразовых глаголов',
      description:
        'Подборка часто используемых английских фразовых глаголов с переводом на русский язык для ежедневной практики.',
      coverImage
    }
  });

  for (const card of cards) {
    await prisma.card.create({
      data: {
        translation: card.translation,
        original: card.original,
        image: card.image,
        groupId: group.id
      }
    });
  }

  await prisma.$disconnect();
})();
