const topics = [
  {
    id: 'serbian-lesson-1',
    title: 'Сербский язык · Урок 1',
    cards: [
      {
        id: 'card-1',
        translation: 'Доброе утро',
        original: 'Dobro jutro',
        image:
          'https://images.unsplash.com/photo-1543353071-10c8ba85a904?auto=format&fit=crop&w=800&q=80'
      },
      {
        id: 'card-2',
        translation: 'Спасибо',
        original: 'Hvala',
        image:
          'https://images.unsplash.com/photo-1546707012-85f2643599a0?auto=format&fit=crop&w=800&q=80'
      },
      {
        id: 'card-3',
        translation: 'До скорого',
        original: null,
        image: null
      }
    ]
  }
];

const navItems = [
  {
    id: 'home',
    label: 'Домой',
    icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9.5 12 3l9 6.5" />
        <path d="M5 10v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9" />
        <path d="M9 21V12h6v9" />
      </svg>
    `
  },
  {
    id: 'profile',
    label: 'Профиль',
    icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 20a8 8 0 0 1 16 0" />
        <circle cx="12" cy="9" r="4" />
      </svg>
    `
  }
];

const createFlashcard = (card, topicTitle) => {
  const hasImage = Boolean(card.image);
  const hasOriginal = Boolean(card.original);

  return `
    <article class="flashcard" data-card="${card.id}">
      ${
        hasImage
          ? `<img src="${card.image}" alt="${card.translation}" loading="lazy" />`
          : '<div class="flashcard-image-placeholder">Нет изображения</div>'
      }
      <div class="flashcard-content">
        <span class="flashcard-topic">${topicTitle}</span>
        <span class="flashcard-translation">${card.translation}</span>
        ${
          hasOriginal
            ? `<span class="flashcard-original">${card.original}</span>`
            : ''
        }
      </div>
    </article>
  `;
};

const renderHome = () => {
  if (!topics.length) {
    return `<div class="empty-state">Карточки появятся здесь, как только вы добавите новые темы.</div>`;
  }

  return `
    <header class="app-header">
      <h1 class="app-title">Изучаем языки с карточками</h1>
      <p class="app-subtitle">Три карточки для первого знакомства с сербским языком.</p>
    </header>
    ${topics
      .map(
        (topic) => `
          <section class="topic-section" data-topic="${topic.id}">
            <h2 class="topic-title">${topic.title}</h2>
            <div class="card-list">
              ${topic.cards.map((card) => createFlashcard(card, topic.title)).join('')}
            </div>
          </section>
        `
      )
      .join('')}
  `;
};

const renderProfile = () => `
  <div class="profile-screen">
    <div class="profile-card">
      <h2>Профиль</h2>
      <p>Здесь появится информация об успехах и прогрессе.</p>
    </div>
    <div class="profile-card">
      <h3>Советы</h3>
      <ul>
        <li>Повторяйте карточки каждый день.</li>
        <li>Добавляйте свои темы, когда появится возможность.</li>
        <li>Используйте приложение в Telegram mini app для синхронизации.</li>
      </ul>
    </div>
  </div>
`;

export const createApp = (root) => {
  root.innerHTML = `
    <div class="app-shell">
      <main class="app-main" aria-live="polite"></main>
    </div>
    <nav class="bottom-nav" role="navigation" aria-label="Основное меню">
      <div class="nav-items">
        ${navItems
          .map(
            (item) => `
              <button class="nav-button" data-nav="${item.id}" type="button">
                ${item.icon}
                <span>${item.label}</span>
                <span class="nav-indicator"></span>
              </button>
            `
          )
          .join('')}
      </div>
    </nav>
  `;

  const main = root.querySelector('.app-main');
  const navButtons = Array.from(root.querySelectorAll('.nav-button'));
  let activeTab = 'home';

  const updateNav = () => {
    navButtons.forEach((button) => {
      const isActive = button.dataset.nav === activeTab;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };

  const render = () => {
    if (activeTab === 'home') {
      main.innerHTML = renderHome();
    } else if (activeTab === 'profile') {
      main.innerHTML = renderProfile();
    }
    updateNav();
  };

  navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextTab = button.dataset.nav;
      if (nextTab === activeTab) return;
      activeTab = nextTab;
      render();
    });
  });

  render();

  return {
    navigate: (tab) => {
      if (!['home', 'profile'].includes(tab)) return;
      activeTab = tab;
      render();
    }
  };
};
