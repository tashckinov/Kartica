const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATABASE_URL = process.env.DATABASE_URL || 'file:./prisma/dev.db';
const prismaDir = __dirname;
const migrationsDir = path.join(prismaDir, 'migrations');

const runPrismaCommand = (command, label, { allowFailure = false } = {}) => {
  try {
    execSync(command, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL },
      shell: true
    });
    return true;
  } catch (error) {
    if (allowFailure) {
      console.warn(`Failed to run ${label}.`, error.message || error);
      return false;
    }
    console.error(`Failed to run ${label} before seeding`, error);
    process.exit(1);
  }
};

const hasMigrations = () => {
  try {
    const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
    return entries.some((entry) => entry.isDirectory());
  } catch (error) {
    return false;
  }
};

runPrismaCommand('npx prisma generate', 'prisma generate');

const ensureDatabaseSchema = () => {
  const migrationsPresent = hasMigrations();
  const migrated = migrationsPresent
    ? runPrismaCommand('npx prisma migrate deploy', 'prisma migrate deploy', { allowFailure: true })
    : false;

  if (!migrationsPresent) {
    console.warn('No Prisma migrations were found. Falling back to `prisma db push` to sync the schema.');
  }

  if (!migrated) {
    runPrismaCommand('npx prisma db push --skip-generate', 'prisma db push');
  }
};

ensureDatabaseSchema();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

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

  await prisma.groupHistory.deleteMany();
  await prisma.groupLike.deleteMany();
  await prisma.user.deleteMany();
  await prisma.card.deleteMany();
  await prisma.group.deleteMany();

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
