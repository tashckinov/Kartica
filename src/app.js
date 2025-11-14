const getTelegramInitData = () => window.Telegram?.WebApp?.initData || '';
const hasTelegramAuth = () => Boolean(getTelegramInitData());

const parseTelegramInitDataUser = () => {
  const initData = getTelegramInitData();
  if (!initData) {
    return null;
  }

  try {
    const params = new URLSearchParams(initData);
    const rawUser = params.get('user');
    if (!rawUser) {
      return null;
    }

    return JSON.parse(decodeURIComponent(rawUser));
  } catch (error) {
    console.warn('Failed to parse Telegram init data user payload', error);
    return null;
  }
};

const getTelegramUserId = () => {
  const unsafeUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (unsafeUser && typeof unsafeUser.id !== 'undefined' && unsafeUser.id !== null) {
    return String(unsafeUser.id);
  }

  const parsedUser = parseTelegramInitDataUser();
  if (parsedUser && typeof parsedUser.id !== 'undefined' && parsedUser.id !== null) {
    return String(parsedUser.id);
  }

  return null;
};

const homeState = {
  isLoading: false,
  error: null,
  user: null,
  telegramId: null
};

const getHomeState = () => ({ ...homeState });

const setHomeState = (patch = {}) => {
  Object.assign(homeState, patch);
};

let topics = [];

let profileState = {
  isLoading: true,
  error: null,
  user: null,
  history: [],
  likes: [],
  isAuthorized: hasTelegramAuth()
};

const topicsStatus = {
  isLoading: false,
  error: null
};

const getProfileState = () => ({ ...profileState });

const updateTopicLikes = () => {
  const likedIds = new Set(profileState.likes.map((item) => item.groupId));
  topics = topics.map((topic) => ({ ...topic, isLiked: likedIds.has(topic.groupId) }));
};

const setTopics = (nextTopics = []) => {
  topics = Array.isArray(nextTopics) ? nextTopics : [];
  updateTopicLikes();
};

const setProfileState = (patch = {}, { reconcileTopics = false } = {}) => {
  profileState = { ...profileState, ...patch };
  if (reconcileTopics) {
    updateTopicLikes();
  }
};

const updateTopicsStatus = (patch) => {
  Object.assign(topicsStatus, patch);
};

const getTopicsStatus = () => ({ ...topicsStatus });

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

const showAuthRequiredMessage = () => {
  const message = 'Авторизуйтесь через Telegram, чтобы сохранять историю и избранное.';
  if (window.Telegram?.WebApp?.showAlert) {
    window.Telegram.WebApp.showAlert(message);
    return;
  }
  if (typeof window.alert === 'function') {
    window.alert(message);
  } else {
    console.warn(message);
  }
};

const mapApiCard = (card) => ({
  id: `card-${card.id}`,
  translation: card.translation,
  original: card.original || null,
  image: card.image || null
});

const mapApiGroup = (group) => {
  const cards = Array.isArray(group.cards) ? group.cards.map(mapApiCard) : [];
  const cardsCount = Number.isInteger(group.cardsCount) ? group.cardsCount : cards.length;

  return {
    id: `group-${group.id}`,
    groupId: group.id,
    title: group.name,
    subtitle: group.subtitle || null,
    description: group.description || null,
    coverImage: group.coverImage || null,
    cards,
    cardsCount,
    isLiked: Boolean(group.isLiked)
  };
};

const parseDate = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const mapProfileHistoryItem = (item) => {
  if (!item || !item.group) {
    return null;
  }

  const groupData = {
    ...item.group,
    cards: Array.isArray(item.group.cards) ? item.group.cards : [],
    cardsCount: item.group.cardsCount
  };

  return {
    id: `history-${item.groupId}`,
    groupId: item.groupId,
    lastOpenedAt: parseDate(item.lastOpenedAt),
    group: mapApiGroup(groupData)
  };
};

const mapProfileLikeItem = (item) => {
  if (!item || !item.group) {
    return null;
  }

  const groupData = {
    ...item.group,
    cards: Array.isArray(item.group.cards) ? item.group.cards : [],
    cardsCount: item.group.cardsCount,
    isLiked: true
  };

  return {
    id: `like-${item.groupId}`,
    groupId: item.groupId,
    likedAt: parseDate(item.likedAt),
    group: mapApiGroup(groupData)
  };
};

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

const getCardsCountInfo = (count) => {
  const total = Number.isInteger(count) ? count : 0;
  const word = total === 1 ? 'карточка' : total >= 2 && total <= 4 ? 'карточки' : 'карточек';
  return { total, text: `${total} ${word}` };
};

const createTopicCard = (topic) => {
  const hasCover = Boolean(topic.coverImage);
  const { text: cardsText } = getCardsCountInfo(
    Number.isInteger(topic.cardsCount) ? topic.cardsCount : topic.cards.length
  );

  return `
    <article class="topic-card" data-topic-card="${topic.id}" role="button" tabindex="0">
      <div class="topic-card-cover">
        ${
          hasCover
            ? `<img src="${topic.coverImage}" alt="${topic.title}" loading="lazy" />`
            : '<div class="topic-card-placeholder" aria-hidden="true"></div>'
        }
        <span class="topic-card-badge">${cardsText}</span>
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
        <div class="topic-detail-actions">
          <button
            class="topic-like-button"
            type="button"
            data-action="toggle-like"
            data-group="${topic.groupId}"
            data-liked="${topic.isLiked ? 'true' : 'false'}"
            aria-pressed="${topic.isLiked ? 'true' : 'false'}"
          >
            ${topic.isLiked ? '★ В избранном' : '☆ В избранное'}
          </button>
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
            <span class="mode-title">Изучение</span>
            <span class="mode-subtitle">Листайте карточки одну за другой</span>
          </button>
        </div>
      </section>
      <section class="topic-cards">
        <div class="topic-cards-header">
          <h2>Карточки</h2>
          <span class="topic-cards-count">${Number.isInteger(topic.cardsCount) ? topic.cardsCount : topic.cards.length}</span>
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
  const { isLoading, error } = getTopicsStatus();

  if (isLoading) {
    return `<div class="info-state" data-state="loading">Загружаем карточки...</div>`;
  }

  if (error) {
    return `<div class="info-state" data-state="error">Не удалось загрузить данные. ${error}</div>`;
  }

  if (!topics.length) {
    return `<div class="info-state">Темы появятся здесь, как только вы добавите новую группу карточек.</div>`;
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

const formatDateTime = (value) => {
  const date = parseDate(value);
  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const formatUserDetailValue = (value) => {
  if (value === null || typeof value === 'undefined') {
    return '—';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || '—';
  }

  return value;
};

const renderHomeUserContent = () => {
  const { isLoading, error, user, telegramId } = getHomeState();

  if (isLoading) {
    return '<div class="info-state" data-state="loading">Загружаем данные пользователя...</div>';
  }

  if (error) {
    return `<div class="info-state" data-state="error">${error}</div>`;
  }

  if (!user) {
    if (telegramId) {
      return `<div class="info-state">Пользователь с Telegram ID ${telegramId} не найден.</div>`;
    }

    return '<div class="info-state">Telegram ID не найден. Откройте приложение в Telegram.</div>';
  }

  const rows = [
    { label: 'Telegram ID', value: user.telegramId },
    { label: 'Имя', value: user.firstName },
    { label: 'Фамилия', value: user.lastName },
    { label: 'Имя пользователя', value: user.username ? `@${user.username}` : null },
    { label: 'Язык интерфейса', value: user.languageCode },
    { label: 'Историй изучения', value: typeof user.historyCount === 'number' ? user.historyCount : null },
    { label: 'Избранных групп', value: typeof user.likesCount === 'number' ? user.likesCount : null },
    { label: 'Создан', value: formatDateTime(user.createdAt) || null },
    { label: 'Обновлён', value: formatDateTime(user.updatedAt) || null }
  ];

  return `
    <section class="home-user">
      <header class="home-user-header">
        <h1 class="home-user-title">Данные пользователя</h1>
        <p class="home-user-subtitle">Информация загружена по Telegram ID ${user.telegramId}.</p>
      </header>
      ${
        user.photoUrl
          ? `<div class="home-user-photo"><img src="${user.photoUrl}" alt="Аватар пользователя" loading="lazy" /></div>`
          : ''
      }
      <dl class="home-user-details">
        ${rows
          .map(
            (item) => `
              <div class="home-user-row">
                <dt>${item.label}</dt>
                <dd>${formatUserDetailValue(item.value)}</dd>
              </div>
            `
          )
          .join('')}
      </dl>
    </section>
  `;
};

const renderProfileGroupList = (items, { emptyText, metaFormatter } = {}) => {
  if (!items.length) {
    return `<p class="info-state">${emptyText}</p>`;
  }

  return `
    <ul class="profile-group-list">
      ${items
        .map((item) => {
          const topic = item.group;
          const hasCover = Boolean(topic.coverImage);
          const { text: cardsText } = getCardsCountInfo(topic.cardsCount);
          const meta = typeof metaFormatter === 'function' ? metaFormatter(item) : '';
          const hasMeta = Boolean(meta);

          return `
            <li>
              <button class="profile-group-button" type="button" data-topic-card="${topic.id}" data-group-id="${item.groupId}">
                <span class="profile-group-cover">
                  ${
                    hasCover
                      ? `<img src="${topic.coverImage}" alt="${topic.title}" loading="lazy" />`
                      : '<span class="profile-group-placeholder" aria-hidden="true"></span>'
                  }
                </span>
                <span class="profile-group-content">
                  <span class="profile-group-title">${topic.title}</span>
                  ${
                    topic.subtitle
                      ? `<span class="profile-group-subtitle">${topic.subtitle}</span>`
                      : ''
                  }
                  <span class="profile-group-meta-row">
                    <span class="profile-group-count">${cardsText}</span>
                    ${hasMeta ? `<span class="profile-group-meta">${meta}</span>` : ''}
                  </span>
                </span>
              </button>
            </li>
          `;
        })
        .join('')}
    </ul>
  `;
};

const renderProfile = () => {
  const { isLoading, error, history, likes, user, isAuthorized } = getProfileState();

  if (isLoading) {
    return `<div class="info-state" data-state="loading">Загружаем профиль...</div>`;
  }

  if (error) {
    return `<div class="info-state" data-state="error">Не удалось загрузить профиль. ${error}</div>`;
  }

  if (!isAuthorized) {
    return `
      <section class="profile-layout">
        <header class="profile-header">
          <h1 class="profile-title">Профиль недоступен</h1>
          <p class="profile-description">Авторизуйтесь через Telegram, чтобы отслеживать прогресс и любимые группы.</p>
        </header>
        <p class="info-state">Откройте мини-приложение в Telegram, чтобы сохранять историю изучения и добавлять группы в избранное.</p>
      </section>
    `;
  }

  const displayName = user?.firstName || user?.username || null;
  const profileTitle = displayName ? `Привет, ${displayName}!` : 'Профиль';

  const historySection = renderProfileGroupList(history, {
    emptyText: 'История появится здесь, как только вы начнёте изучать группы.',
    metaFormatter: (item) =>
      item.lastOpenedAt ? `Открыто: ${formatDateTime(item.lastOpenedAt)}` : ''
  });

  const likesSection = renderProfileGroupList(likes, {
    emptyText: 'Отметьте понравившиеся группы, чтобы быстро находить их.',
    metaFormatter: (item) =>
      item.likedAt ? `Добавлено: ${formatDateTime(item.likedAt)}` : ''
  });

  return `
    <section class="profile-layout">
      <header class="profile-header">
        <h1 class="profile-title">${profileTitle}</h1>
        <p class="profile-description">Отслеживайте, что вы изучали, и возвращайтесь к любимым группам.</p>
      </header>
      <section class="profile-section">
        <div class="profile-section-header">
          <h2>Недавнее изучение</h2>
        </div>
        ${historySection}
      </section>
      <section class="profile-section">
        <div class="profile-section-header">
          <h2>Понравившиеся группы</h2>
        </div>
        ${likesSection}
      </section>
    </section>
  `;
};

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
    <div class="study-overlay" aria-hidden="true" hidden></div>
  `;

  const main = root.querySelector('.app-main');
  const navButtons = Array.from(root.querySelectorAll('.nav-button'));
  const studyOverlay = root.querySelector('.study-overlay');
  let activeTab = 'home';
  let activeTopicId = null;
  let studyState = {
    isOpen: false,
    topicId: null,
    cardIndex: 0,
    isFlipped: false
  };

  const getActiveTopic = () => topics.find((topic) => topic.id === activeTopicId) || null;
  const getStudyTopic = () => topics.find((topic) => topic.id === studyState.topicId) || null;
  const getStudyCard = () => {
    const topic = getStudyTopic();
    if (!topic) return null;
    return topic.cards[studyState.cardIndex] || null;
  };

  const applyStudyFlipState = () => {
    const studyCard = studyOverlay.querySelector('.study-card');
    if (!studyCard) return;
    const isFlipped = studyState.isFlipped ? 'true' : 'false';
    studyCard.dataset.flipped = isFlipped;
    studyCard.setAttribute('aria-pressed', isFlipped);
  };

  const renderStudyOverlay = () => {
    if (!studyState.isOpen) {
      studyOverlay.setAttribute('hidden', '');
      studyOverlay.setAttribute('aria-hidden', 'true');
      studyOverlay.innerHTML = '';
      document.body.classList.remove('study-open');
      return;
    }

    const topic = getStudyTopic();
    const card = getStudyCard();

    if (!topic || !card) {
      studyState = {
        isOpen: false,
        topicId: null,
        cardIndex: 0,
        isFlipped: false
      };
      renderStudyOverlay();
      return;
    }

    const hasImage = Boolean(card.image);
    const totalCards = topic.cards.length;
    const currentIndex = studyState.cardIndex + 1;

    const promptText = card.original || card.translation;

    studyOverlay.innerHTML = `
      <div class="study-dialog" role="dialog" aria-modal="true" aria-label="Изучение темы ${topic.title}" tabindex="-1">
        <header class="study-header">
          <div class="study-header-text">
            <span class="study-topic">${topic.title}</span>
            <span class="study-progress">${currentIndex} / ${totalCards}</span>
          </div>
          <button class="study-close" type="button" data-action="study-close" aria-label="Закрыть режим изучения">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="m6 6 12 12" />
              <path d="m18 6-12 12" />
            </svg>
          </button>
        </header>
        <section class="study-card-wrapper">
          <button class="study-card" type="button" data-card="${card.id}" data-flipped="false" aria-pressed="false" aria-label="Перевернуть карточку">
            <span class="visually-hidden">Нажмите, чтобы перевернуть карточку и показать перевод.</span>
            <div class="study-card-inner">
              <div class="study-card-face study-card-front">
                <span class="study-face-label">Слово</span>
                <span class="study-face-text">${promptText}</span>
                <span class="study-face-hint">Нажмите на карточку, чтобы увидеть перевод</span>
              </div>
              <div class="study-card-face study-card-back">
                <span class="study-face-label">Перевод</span>
                <span class="study-face-text">${card.translation}</span>
                ${
                  hasImage
                    ? `<div class="study-back-media"><img src="${card.image}" alt="${card.translation}" loading="lazy" /></div>`
                    : '<div class="study-card-placeholder" aria-hidden="true">Нет изображения</div>'
                }
                ${
                  card.original
                    ? `<span class="study-face-helper">Оригинал: ${card.original}</span>`
                    : ''
                }
              </div>
            </div>
          </button>
        </section>
        <footer class="study-controls">
          <button class="study-nav" type="button" data-action="study-prev" ${studyState.cardIndex === 0 ? 'disabled' : ''}>
            Назад
          </button>
          <button class="study-nav" type="button" data-action="study-next" ${
            studyState.cardIndex >= totalCards - 1 ? 'disabled' : ''
          }>
            Дальше
          </button>
        </footer>
      </div>
    `;

    studyOverlay.removeAttribute('hidden');
    studyOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('study-open');

    const dialog = studyOverlay.querySelector('.study-dialog');
    if (dialog) {
      dialog.focus();
    }

    applyStudyFlipState();
  };

  const closeStudyMode = () => {
    if (!studyState.isOpen) return;
    studyState = {
      isOpen: false,
      topicId: null,
      cardIndex: 0,
      isFlipped: false
    };
    renderStudyOverlay();
  };

  const openStudyMode = (topicId, startIndex = 0) => {
    const topic = topics.find((item) => item.id === topicId);
    if (!topic) return;
    const boundedIndex = Math.min(Math.max(startIndex, 0), topic.cards.length - 1);
    studyState = {
      isOpen: true,
      topicId,
      cardIndex: boundedIndex,
      isFlipped: false
    };
    renderStudyOverlay();
  };

  const showPrevCard = () => {
    if (!studyState.isOpen || studyState.cardIndex === 0) return;
    studyState = {
      ...studyState,
      cardIndex: studyState.cardIndex - 1,
      isFlipped: false
    };
    renderStudyOverlay();
  };

  const showNextCard = () => {
    const topic = getStudyTopic();
    if (!studyState.isOpen || !topic) return;
    if (studyState.cardIndex >= topic.cards.length - 1) return;
    studyState = {
      ...studyState,
      cardIndex: studyState.cardIndex + 1,
      isFlipped: false
    };
    renderStudyOverlay();
  };

  const toggleStudyCard = () => {
    if (!studyState.isOpen) return;
    studyState = {
      ...studyState,
      isFlipped: !studyState.isFlipped
    };
    applyStudyFlipState();
  };

  const ensureActiveTopicIsValid = () => {
    if (!activeTopicId) return;
    const exists = topics.some((topic) => topic.id === activeTopicId);
    if (!exists) {
      activeTopicId = null;
      studyState = {
        ...studyState,
        isOpen: false,
        topicId: null,
        cardIndex: 0,
        isFlipped: false
      };
    }
  };

  const applyTopicLike = (groupId, isLiked) => {
    topics = topics.map((topic) =>
      topic.groupId === groupId ? { ...topic, isLiked: Boolean(isLiked) } : topic
    );
  };

  const loadProfile = async ({ silent = false } = {}) => {
    if (!hasTelegramAuth()) {
      setProfileState(
        {
          isLoading: false,
          error: null,
          user: null,
          history: [],
          likes: [],
          isAuthorized: false
        },
        { reconcileTopics: true }
      );
      if (!silent && activeTab === 'profile') {
        render();
      }
      return;
    }

    if (!silent) {
      setProfileState({ isLoading: true, error: null });
      if (activeTab === 'profile') {
        render();
      }
    }

    try {
      const payload = await requestJson('/api/me');
      const historyRaw = Array.isArray(payload.history) ? payload.history : [];
      const likesRaw = Array.isArray(payload.likes) ? payload.likes : [];

      const likes = likesRaw.map(mapProfileLikeItem).filter(Boolean);
      const likedIds = new Set(likes.map((item) => item.groupId));
      const history = historyRaw
        .map(mapProfileHistoryItem)
        .filter(Boolean)
        .map((entry) => ({
          ...entry,
          group: { ...entry.group, isLiked: likedIds.has(entry.groupId) }
        }));

      const userSummary = payload && typeof payload === 'object' ? payload.user ?? null : null;

      setProfileState(
        {
          isLoading: false,
          error: null,
          user: userSummary,
          history,
          likes,
          isAuthorized: true
        },
        { reconcileTopics: true }
      );

      render();
    } catch (error) {
      console.error('Не удалось загрузить профиль', error);
      const isAuthError = error && (error.status === 401 || error.status === 403);
      if (isAuthError) {
        setProfileState(
          {
            isLoading: false,
            error: null,
            user: null,
            history: [],
            likes: [],
            isAuthorized: false
          },
          { reconcileTopics: true }
        );
        if (!silent && activeTab === 'profile') {
          render();
        }
        return;
      }

      if (!silent) {
        setProfileState(
          {
            isLoading: false,
            error: 'Попробуйте обновить страницу.',
            history: [],
            likes: [],
            isAuthorized: profileState.isAuthorized
          },
          { reconcileTopics: true }
        );
        render();
      }
    }
  };

  const loadHomeUser = async ({ silent = false } = {}) => {
    const telegramId = getTelegramUserId();

    if (!telegramId) {
      setHomeState({
        isLoading: false,
        error: 'Telegram ID не найден. Откройте приложение в Telegram.',
        user: null,
        telegramId: null
      });
      if (!silent && activeTab === 'home') {
        render();
      }
      return;
    }

    setHomeState({
      isLoading: true,
      error: null,
      user: null,
      telegramId
    });
    if (!silent && activeTab === 'home') {
      render();
    }

    try {
      const payload = await requestJson(`/api/users/${encodeURIComponent(telegramId)}`);
      setHomeState({
        isLoading: false,
        error: null,
        user: payload,
        telegramId
      });
    } catch (error) {
      const message =
        error && error.status === 404
          ? `Пользователь с Telegram ID ${telegramId} не найден.`
          : 'Не удалось загрузить данные пользователя. Попробуйте обновить страницу.';
      setHomeState({
        isLoading: false,
        error: message,
        user: null,
        telegramId
      });
    }

    if (!silent && activeTab === 'home') {
      render();
    }
  };

  const markGroupVisited = async (groupId) => {
    if (!Number.isInteger(groupId)) {
      return;
    }

    const { isAuthorized } = getProfileState();
    if (!hasTelegramAuth() || !isAuthorized) {
      return;
    }

    try {
      await requestJson(`/api/groups/${groupId}/history`, { method: 'POST' });
      await loadProfile({ silent: true });
      await loadHomeUser({ silent: true });
    } catch (error) {
      console.error('Не удалось обновить историю пользователя', error);
    }
  };

  const toggleGroupLike = async (groupId) => {
    if (!Number.isInteger(groupId)) {
      return;
    }

    const { isAuthorized } = getProfileState();
    if (!hasTelegramAuth() || !isAuthorized) {
      showAuthRequiredMessage();
      return;
    }

    const topic = topics.find((item) => item.groupId === groupId) || null;
    const shouldLike = topic ? !topic.isLiked : true;

    try {
      if (shouldLike) {
        await requestJson(`/api/groups/${groupId}/like`, { method: 'POST' });
      } else {
        await requestJson(`/api/groups/${groupId}/like`, { method: 'DELETE' });
      }

      applyTopicLike(groupId, shouldLike);
      render();
      await loadProfile({ silent: true });
      await loadHomeUser({ silent: true });
    } catch (error) {
      console.error('Не удалось обновить список избранного', error);
    }
  };

  const refreshTelegramAuth = async ({ silent = false } = {}) => {
    const authorized = hasTelegramAuth();
    const wasAuthorized = profileState.isAuthorized;

    if (wasAuthorized !== authorized) {
      setProfileState({ isAuthorized: authorized });
      if (activeTab === 'profile') {
        render();
      }
    }

    await loadHomeUser({ silent });

    if (!authorized) {
      return;
    }

    await loadProfile({ silent });
  };

  const requestJson = async (input, { method = 'GET', body, headers = {}, signal } = {}) => {
    const nextHeaders = { ...headers };
    const init = { method, headers: nextHeaders, signal };

    if (typeof body !== 'undefined') {
      init.body = body;
      if (!('Content-Type' in nextHeaders)) {
        nextHeaders['Content-Type'] = 'application/json';
      }
    }

    const telegramInitData = getTelegramInitData();
    if (telegramInitData) {
      nextHeaders['X-Telegram-Data'] = telegramInitData;
    }

    const response = await fetch(input, init);

    const contentType = response.headers.get('content-type') || '';
    let payload = null;
    if (contentType.includes('application/json')) {
      payload = await response.json();
    } else {
      payload = await response.text();
    }

    if (!response.ok) {
      const message = payload && typeof payload === 'object' && payload.error
        ? payload.error
        : typeof payload === 'string' && payload
        ? payload
        : `Статус ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  };

  const renderHome = () => renderHomeUserContent();

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
      closeStudyMode();
      activeTab = nextTab;
      render();
    });
  });

  const showTopic = (topicId) => {
    const topic = topics.find((item) => item.id === topicId);
    if (!topic) {
      return;
    }

    activeTopicId = topic.id;
    if (activeTab !== 'home') {
      activeTab = 'home';
    }
    markGroupVisited(topic.groupId);
    render();
  };

  const showTopicsList = () => {
    if (!activeTopicId) return;
    activeTopicId = null;
    closeStudyMode();
    render();
  };

  main.addEventListener('click', (event) => {
    const likeButton = event.target.closest('[data-action="toggle-like"]');
    if (likeButton) {
      event.preventDefault();
      const groupId = Number(likeButton.dataset.group);
      if (Number.isInteger(groupId)) {
        toggleGroupLike(groupId);
      }
      return;
    }

    if (activeTab === 'home') {
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
      if (modeButton && activeTopicId) {
        openStudyMode(activeTopicId, 0);
      }
      return;
    }

    if (activeTab === 'profile') {
      const profileButton = event.target.closest('.profile-group-button');
      if (profileButton) {
        const topicId = profileButton.dataset.topicCard;
        if (topicId) {
          showTopic(topicId);
        }
      }
    }
  });

  main.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    if (activeTab === 'home') {
      const topicCard = event.target.closest('[data-topic-card]');
      if (topicCard) {
        event.preventDefault();
        showTopic(topicCard.dataset.topicCard);
      }
      return;
    }

    if (activeTab === 'profile') {
      const profileButton = event.target.closest('.profile-group-button');
      if (profileButton) {
        event.preventDefault();
        const topicId = profileButton.dataset.topicCard;
        if (topicId) {
          showTopic(topicId);
        }
      }
    }
  });

  render();

  studyOverlay.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    const { action } = actionButton.dataset;

    if (action === 'study-close') {
      closeStudyMode();
    } else if (action === 'study-prev') {
      showPrevCard();
    } else if (action === 'study-next') {
      showNextCard();
    }
  });

  studyOverlay.addEventListener('click', (event) => {
    const studyCard = event.target.closest('.study-card');
    if (!studyCard) return;
    event.preventDefault();
    toggleStudyCard();
  });

  studyOverlay.addEventListener('keydown', (event) => {
    if (!studyState.isOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeStudyMode();
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showPrevCard();
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      showNextCard();
    }
    if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('.study-card')) {
      event.preventDefault();
      toggleStudyCard();
    }
  });

  loadHomeUser();
  loadProfile();

  return {
    navigate: (tab) => {
      if (!['home', 'profile'].includes(tab)) return;
      activeTab = tab;
      closeStudyMode();
      render();
    },
    refreshTelegramAuth
  };
};
