const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const cardsData = [
  { term: 'Cat', definition: 'Кошка', example: 'The cat slept on the sofa.', image: null },
  { term: 'Dog', definition: 'Собака', example: 'Our dog loves to play fetch.', image: null },
  { term: 'Horse', definition: 'Лошадь', example: 'The horse galloped across the field.', image: null },
  { term: 'Cow', definition: 'Корова', example: 'The cow grazed in the meadow.', image: null },
  { term: 'Sheep', definition: 'Овца', example: 'A sheep was nibbling on the grass.', image: null },
  { term: 'Goat', definition: 'Коза', example: 'The goat climbed the rocky hill.', image: null },
  { term: 'Pig', definition: 'Свинья', example: 'The pig rolled in the mud to stay cool.', image: null },
  { term: 'Chicken', definition: 'Курица', example: 'A chicken clucked loudly in the yard.', image: null },
  { term: 'Duck', definition: 'Утка', example: 'The duck swam across the pond.', image: null },
  { term: 'Goose', definition: 'Гусь', example: 'A goose honked near the lake.', image: null },
  { term: 'Rabbit', definition: 'Кролик', example: 'The rabbit hopped through the garden.', image: null },
  { term: 'Fox', definition: 'Лиса', example: 'The fox dashed into the forest.', image: null },
  { term: 'Bear', definition: 'Медведь', example: 'A bear searched for berries.', image: null },
  { term: 'Wolf', definition: 'Волк', example: 'The wolf howled at the moon.', image: null },
  { term: 'Lion', definition: 'Лев', example: 'The lion rested in the shade.', image: null },
  { term: 'Tiger', definition: 'Тигр', example: 'The tiger prowled silently.', image: null },
  { term: 'Elephant', definition: 'Слон', example: 'The elephant sprayed water with its trunk.', image: null },
  { term: 'Giraffe', definition: 'Жираф', example: 'The giraffe reached leaves on the tall tree.', image: null },
  { term: 'Zebra', definition: 'Зебра', example: 'The zebra ran with the herd.', image: null },
  { term: 'Monkey', definition: 'Обезьяна', example: 'The monkey swung from branch to branch.', image: null },
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
