const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const cardsData = [
  { term: 'Cat', definition: 'Кошка', example: 'The cat slept on the sofa.' },
  { term: 'Dog', definition: 'Собака', example: 'Our dog loves to play fetch.' },
  { term: 'Horse', definition: 'Лошадь', example: 'The horse galloped across the field.' },
  { term: 'Cow', definition: 'Корова', example: 'The cow grazed in the meadow.' },
  { term: 'Sheep', definition: 'Овца', example: 'A sheep was nibbling on the grass.' },
  { term: 'Goat', definition: 'Коза', example: 'The goat climbed the rocky hill.' },
  { term: 'Pig', definition: 'Свинья', example: 'The pig rolled in the mud to stay cool.' },
  { term: 'Chicken', definition: 'Курица', example: 'A chicken clucked loudly in the yard.' },
  { term: 'Duck', definition: 'Утка', example: 'The duck swam across the pond.' },
  { term: 'Goose', definition: 'Гусь', example: 'A goose honked near the lake.' },
  { term: 'Rabbit', definition: 'Кролик', example: 'The rabbit hopped through the garden.' },
  { term: 'Fox', definition: 'Лиса', example: 'The fox dashed into the forest.' },
  { term: 'Bear', definition: 'Медведь', example: 'A bear searched for berries.' },
  { term: 'Wolf', definition: 'Волк', example: 'The wolf howled at the moon.' },
  { term: 'Lion', definition: 'Лев', example: 'The lion rested in the shade.' },
  { term: 'Tiger', definition: 'Тигр', example: 'The tiger prowled silently.' },
  { term: 'Elephant', definition: 'Слон', example: 'The elephant sprayed water with its trunk.' },
  { term: 'Giraffe', definition: 'Жираф', example: 'The giraffe reached leaves on the tall tree.' },
  { term: 'Zebra', definition: 'Зебра', example: 'The zebra ran with the herd.' },
  { term: 'Monkey', definition: 'Обезьяна', example: 'The monkey swung from branch to branch.' },
];

async function main() {
  await prisma.card.deleteMany();
  await prisma.group.deleteMany();

  const group = await prisma.group.create({
    data: {
      title: 'Английский. Животные',
      description: '20 карточек с названиями животных на английском языке.',
      cards: {
        create: cardsData,
      },
    },
    include: { cards: true },
  });

  console.log(`Created group "${group.title}" with ${group.cards.length} cards.`);
}

main()
  .catch((error) => {
    console.error('Failed to seed database', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
