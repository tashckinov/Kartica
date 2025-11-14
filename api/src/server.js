const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
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

app.post('/groups', async (req, res) => {
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

app.put('/groups/:id', async (req, res) => {
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

app.put('/groups/:id/cards', async (req, res) => {
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
