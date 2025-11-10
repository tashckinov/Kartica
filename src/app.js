const topics = [
  {
    id: 'serbian-lesson-1',
    title: 'Сербский язык',
    subtitle: 'Урок 1 · Приветствия',
    description: 'Первые вежливые фразы, с которых начинается любое знакомство.',
    coverImage:
      'https://images.unsplash.com/photo-1522174010635-1c7a5de87c5d?auto=format&fit=crop&w=900&q=80',
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

const createFlashcard = (card, { topicTitle, showTopic = false } = {}) => {
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
        ${
          showTopic
            ? `<span class="flashcard-topic">${topicTitle}</span>`
            : ''
        }
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

const createTopicCard = (topic) => {
  const hasCover = Boolean(topic.coverImage);
  const cardsCount = topic.cards.length;
  const cardWord = cardsCount === 1 ? 'карточка' : cardsCount >= 2 && cardsCount <= 4 ? 'карточки' : 'карточек';

  return `
    <article class="topic-card" data-topic-card="${topic.id}" role="button" tabindex="0">
      <div class="topic-card-cover">
        ${
          hasCover
            ? `<img src="${topic.coverImage}" alt="${topic.title}" loading="lazy" />`
            : '<div class="topic-card-placeholder" aria-hidden="true"></div>'
        }
        <span class="topic-card-badge">${cardsCount} ${cardWord}</span>
      </div>
      <div class="topic-card-body">
        <h2 class="topic-card-title">${topic.title}</h2>
        ${
          topic.subtitle
            ? `<p class="topic-card-subtitle">${topic.subtitle}</p>`
            : ''
        }
      </div>
    </article>
  `;
};

const renderTopicDetail = (topic) => {
  const hasCover = Boolean(topic.coverImage);

  return `
    <section class="topic-detail" data-topic-detail="${topic.id}">
      <header class="topic-detail-header">
        <button class="back-button" type="button" data-action="back-to-topics" aria-label="Вернуться к списку тем">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m15 6-6 6 6 6" />
          </svg>
        </button>
        <div class="topic-detail-titles">
          <span class="topic-detail-label">Тема</span>
          <h1 class="topic-detail-title">${topic.title}</h1>
          ${
            topic.subtitle
              ? `<p class="topic-detail-subtitle">${topic.subtitle}</p>`
              : ''
          }
        </div>
      </header>
      <section class="topic-hero">
        ${
          hasCover
            ? `<img src="${topic.coverImage}" alt="${topic.title}" loading="lazy" />`
            : '<div class="topic-hero-placeholder">Добавьте обложку для темы</div>'
        }
        ${
          topic.description
            ? `<p class="topic-detail-description">${topic.description}</p>`
            : ''
        }
      </section>
      <section class="topic-modes">
        <h2 class="topic-modes-title">Режимы</h2>
        <div class="topic-modes-grid">
          <button class="mode-button" type="button" data-mode="study">
            <span class="mode-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
                <path d="M14 3v5h5" />
              </svg>
            </span>
            <span class="mode-content">
              <span class="mode-title">Изучение</span>
              <span class="mode-subtitle">Листайте карточки одну за другой</span>
            </span>
          </button>
        </div>
      </section>
      <section class="topic-cards">
        <div class="topic-cards-header">
          <h2>Карточки</h2>
          <span class="topic-cards-count">${topic.cards.length}</span>
        </div>
        <div class="card-list">
          ${topic.cards
            .map((card) => createFlashcard(card))
            .join('')}
        </div>
      </section>
    </section>
  `;
};

const renderTopicsHome = () => {
  if (!topics.length) {
    return `<div class="empty-state">Темы появятся здесь, как только вы добавите новую группу карточек.</div>`;
  }

  return `
    <header class="app-header">
      <h1 class="app-title">Изучаем языки с карточками</h1>
      <p class="app-subtitle">Выберите тему, чтобы открыть карточки и начать обучение.</p>
    </header>
    <section class="topics-grid">
      ${topics.map((topic) => createTopicCard(topic)).join('')}
    </section>
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
  let activeTopicId = null;

  const getActiveTopic = () => topics.find((topic) => topic.id === activeTopicId) || null;

  const renderHome = () => {
    if (!activeTopicId) {
      return renderTopicsHome();
    }

    const topic = getActiveTopic();
    if (!topic) {
      activeTopicId = null;
      return renderTopicsHome();
    }

    return renderTopicDetail(topic);
  };

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

  const showTopic = (topicId) => {
    activeTopicId = topicId;
    if (activeTab !== 'home') {
      activeTab = 'home';
    }
    render();
  };

  const showTopicsList = () => {
    if (!activeTopicId) return;
    activeTopicId = null;
    render();
  };

  main.addEventListener('click', (event) => {
    if (activeTab !== 'home') return;

    const topicCard = event.target.closest('[data-topic-card]');
    if (topicCard) {
      showTopic(topicCard.dataset.topicCard);
      return;
    }

    const backButton = event.target.closest('[data-action="back-to-topics"]');
    if (backButton) {
      showTopicsList();
      return;
    }

    const modeButton = event.target.closest('[data-mode="study"]');
    if (modeButton) {
      const cardsSection = main.querySelector('.topic-cards');
      if (cardsSection) {
        cardsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  main.addEventListener('keydown', (event) => {
    if (activeTab !== 'home') return;
    if (event.key !== 'Enter' && event.key !== ' ') return;

    const topicCard = event.target.closest('[data-topic-card]');
    if (topicCard) {
      event.preventDefault();
      showTopic(topicCard.dataset.topicCard);
    }
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
