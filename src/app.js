let topics = [];

const topicsStatus = {
  isLoading: true,
  error: null
};

const setTopics = (nextTopics = []) => {
  topics = Array.isArray(nextTopics) ? nextTopics : [];
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

const mapApiCard = (card) => ({
  id: `card-${card.id}`,
  translation: card.translation,
  original: card.original || null,
  image: card.image || null
});

const mapApiGroup = (group) => ({
  id: `group-${group.id}`,
  groupId: group.id,
  title: group.name,
  subtitle: group.subtitle || null,
  description: group.description || null,
  coverImage: group.coverImage || null,
  cards: Array.isArray(group.cards) ? group.cards.map(mapApiCard) : []
});

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
            <span class="mode-title">Изучение</span>
            <span class="mode-subtitle">Листайте карточки одну за другой</span>
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

const renderProfile = (messages = {}) => {
  const hasTopics = topics.length > 0;
  const options = topics
    .map((topic) => `<option value="${topic.groupId}">${topic.title}</option>`)
    .join('');
  const groupMessage = messages.createGroup || null;
  const cardMessage = messages.createCard || null;

  const renderFormFeedback = (message) => {
    if (!message) {
      return '<p class="form-feedback" data-feedback hidden></p>';
    }
    return `<p class="form-feedback" data-feedback data-variant="${message.variant}">${message.text}</p>`;
  };

  return `
    <div class="profile-screen">
      <div class="profile-card">
        <h2>Управление карточками</h2>
        <p>Создавайте группы карточек и пополняйте их новыми фразами.</p>
      </div>
      <div class="profile-card">
        <h3>Новая группа</h3>
        <form class="manage-form" data-form="create-group">
          <label class="manage-field">
            <span>Название *</span>
            <input type="text" name="name" required placeholder="Например, English B1" />
          </label>
          <label class="manage-field">
            <span>Подзаголовок</span>
            <input type="text" name="subtitle" placeholder="Краткое описание" />
          </label>
          <label class="manage-field">
            <span>Описание</span>
            <textarea name="description" rows="3" placeholder="Расскажите, что внутри группы"></textarea>
          </label>
          <label class="manage-field">
            <span>Ссылка на обложку</span>
            <input type="url" name="coverImage" placeholder="https://..." />
          </label>
          <button type="submit" class="manage-submit">Создать группу</button>
          ${renderFormFeedback(groupMessage)}
        </form>
      </div>
      <div class="profile-card">
        <h3>Новая карточка</h3>
        ${
          hasTopics
            ? `
                <form class="manage-form" data-form="create-card">
                  <label class="manage-field">
                    <span>Группа *</span>
                    <select name="groupId" required>
                      <option value="" disabled selected>Выберите группу</option>
                      ${options}
                    </select>
                  </label>
                  <label class="manage-field">
                    <span>Оригинал</span>
                    <input type="text" name="original" placeholder="Например, break down" />
                  </label>
                  <label class="manage-field">
                    <span>Перевод *</span>
                    <input type="text" name="translation" required placeholder="Например, сломаться" />
                  </label>
                  <label class="manage-field">
                    <span>Ссылка на изображение</span>
                    <input type="url" name="image" placeholder="https://..." />
                  </label>
                  <button type="submit" class="manage-submit">Добавить карточку</button>
                  ${renderFormFeedback(cardMessage)}
                </form>
              `
            : '<p class="info-state">Создайте хотя бы одну группу, чтобы добавлять карточки.</p>'
        }
      </div>
    </div>
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
  let profileMessages = {
    createGroup: null,
    createCard: null
  };
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

  const setProfileFeedback = (type, text, variant = 'info') => {
    profileMessages = {
      ...profileMessages,
      [type]: text
        ? {
            text,
            variant
          }
        : null
    };
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

  const loadTopics = async () => {
    updateTopicsStatus({ isLoading: true, error: null });
    render();

    try {
      const response = await fetch('/api/groups');
      if (!response.ok) {
        throw new Error(`Статус ${response.status}`);
      }
      const payload = await response.json();
      const mapped = Array.isArray(payload) ? payload.map(mapApiGroup) : [];
      setTopics(mapped);
      updateTopicsStatus({ isLoading: false, error: null });
      ensureActiveTopicIsValid();
      render();
    } catch (error) {
      console.error('Не удалось загрузить группы', error);
      setTopics([]);
      updateTopicsStatus({ isLoading: false, error: 'Попробуйте обновить страницу.' });
      render();
    }
  };

  const requestJson = async (input, { method = 'GET', body, headers = {} } = {}) => {
    const response = await fetch(input, {
      method,
      body,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    });

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
      throw new Error(message);
    }

    return payload;
  };

  const submitGroupForm = async (form) => {
    const formData = new FormData(form);
    const name = (formData.get('name') || '').trim();
    const subtitle = (formData.get('subtitle') || '').trim();
    const description = (formData.get('description') || '').trim();
    const coverImage = (formData.get('coverImage') || '').trim();

    if (!name) {
      setProfileFeedback('createGroup', 'Введите название группы.', 'error');
      render();
      return;
    }

    try {
      await requestJson('/api/groups', {
        method: 'POST',
        body: JSON.stringify({
          name,
          subtitle: subtitle || null,
          description: description || null,
          coverImage: coverImage || null
        })
      });
      form.reset();
      setProfileFeedback('createGroup', 'Группа успешно создана.', 'success');
      await loadTopics();
    } catch (error) {
      setProfileFeedback('createGroup', error.message, 'error');
      render();
    }
  };

  const submitCardForm = async (form) => {
    const formData = new FormData(form);
    const groupId = Number(formData.get('groupId'));
    const original = (formData.get('original') || '').trim();
    const translation = (formData.get('translation') || '').trim();
    const image = (formData.get('image') || '').trim();

    if (!groupId || !Number.isInteger(groupId)) {
      setProfileFeedback('createCard', 'Выберите группу.', 'error');
      render();
      return;
    }

    if (!translation) {
      setProfileFeedback('createCard', 'Добавьте перевод для карточки.', 'error');
      render();
      return;
    }

    try {
      await requestJson(`/api/groups/${groupId}/cards`, {
        method: 'POST',
        body: JSON.stringify({
          original: original || null,
          translation,
          image: image || null
        })
      });
      form.reset();
      setProfileFeedback('createCard', 'Карточка добавлена.', 'success');
      await loadTopics();
    } catch (error) {
      setProfileFeedback('createCard', error.message, 'error');
      render();
    }
  };

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
      main.innerHTML = renderProfile(profileMessages);
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
    activeTopicId = topicId;
    if (activeTab !== 'home') {
      activeTab = 'home';
    }
    render();
  };

  const showTopicsList = () => {
    if (!activeTopicId) return;
    activeTopicId = null;
    closeStudyMode();
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
      if (activeTopicId) {
        openStudyMode(activeTopicId, 0);
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

  main.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-form]');
    if (!form) return;
    event.preventDefault();

    if (form.dataset.form === 'create-group') {
      submitGroupForm(form);
    } else if (form.dataset.form === 'create-card') {
      submitCardForm(form);
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

  loadTopics();

  return {
    navigate: (tab) => {
      if (!['home', 'profile'].includes(tab)) return;
      activeTab = tab;
      closeStudyMode();
      render();
    }
  };
};
