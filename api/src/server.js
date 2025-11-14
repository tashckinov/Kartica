const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;

function parsePagination(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const pageSize = Math.max(Math.min(parseInt(query.pageSize, 10) || 10, 50), 1);
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip };
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
      data: groups.map((group) => ({
        id: group.id,
        title: group.title,
        description: group.description,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        cardsCount: group._count.cards,
      })),
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
