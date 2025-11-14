<template>
  <div class="app-shell">
    <main class="app-main" aria-live="polite">
      <template v-if="activeTab === 'home'">
        <template v-if="!activeTopic">
          <header class="app-header">
            <h1 class="app-title">Изучаем языки с карточками</h1>
            <p class="app-subtitle">Выберите тему, чтобы открыть карточки и начать обучение.</p>
          </header>
          <section v-if="isTopicsLoading" class="data-state" aria-live="polite">
            <div class="state-card">
              <span class="state-title">Загружаем темы…</span>
              <span class="state-subtitle">Подождите немного, мы получаем данные из базы.</span>
            </div>
          </section>
          <section v-else-if="topicsError" class="data-state" aria-live="assertive">
            <div class="state-card">
              <span class="state-title">Не удалось загрузить темы</span>
              <p class="state-subtitle">{{ topicsError }}</p>
              <button class="state-action" type="button" @click="reloadTopics">Попробовать снова</button>
            </div>
          </section>
          <template v-else>
            <section v-if="topics.length" class="topics-grid">
              <article
                v-for="topic in topics"
                :key="topic.id"
                class="topic-card"
                role="button"
                tabindex="0"
                :data-topic-card="topic.id"
                @click="showTopic(topic.id)"
                @keydown.enter.prevent="showTopic(topic.id)"
                @keydown.space.prevent="showTopic(topic.id)"
              >
                <div class="topic-card-cover">
                  <img v-if="topic.coverImage" :src="topic.coverImage" :alt="topic.title" loading="lazy" />
                  <div v-else class="topic-card-placeholder" aria-hidden="true"></div>
                  <span class="topic-card-badge">
                    {{ getCardsCount(topic) }} {{ getCardWord(getCardsCount(topic)) }}
                  </span>
                </div>
                <div class="topic-card-body">
                  <h2 class="topic-card-title">{{ topic.title }}</h2>
                  <p v-if="topic.subtitle" class="topic-card-subtitle">{{ topic.subtitle }}</p>
                </div>
              </article>
            </section>
            <div v-else class="empty-state">
              Темы появятся здесь, как только вы добавите новую группу карточек.
            </div>
            <nav
              v-if="topics.length && topicsPagination.totalPages > 1"
              class="topics-pagination"
              aria-label="Пагинация тем"
            >
              <button
                class="pagination-button"
                type="button"
                :disabled="isTopicsLoading || topicsPagination.page <= 1"
                @click="changeTopicsPage(topicsPagination.page - 1)"
              >
                Назад
              </button>
              <span class="pagination-status">
                Страница {{ topicsPagination.page }} из {{ topicsPagination.totalPages }}
              </span>
              <button
                class="pagination-button"
                type="button"
                :disabled="
                  isTopicsLoading || topicsPagination.page >= topicsPagination.totalPages
                "
                @click="changeTopicsPage(topicsPagination.page + 1)"
              >
                Вперёд
              </button>
            </nav>
          </template>
        </template>
        <section v-else class="topic-detail" :data-topic-detail="activeTopic.id">
          <header class="topic-detail-header">
            <button
              class="back-button"
              type="button"
              data-action="back-to-topics"
              aria-label="Вернуться к списку тем"
              @click="showTopicsList"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m15 6-6 6 6 6" />
              </svg>
            </button>
            <div class="topic-detail-titles">
              <span class="topic-detail-label">Тема</span>
              <h1 class="topic-detail-title">{{ activeTopic.title }}</h1>
              <p v-if="activeTopic.subtitle" class="topic-detail-subtitle">{{ activeTopic.subtitle }}</p>
            </div>
          </header>
          <section class="topic-hero">
            <img v-if="activeTopic.coverImage" :src="activeTopic.coverImage" :alt="activeTopic.title" loading="lazy" />
            <div v-else class="topic-hero-placeholder">Добавьте обложку для темы</div>
            <p v-if="activeTopic.description" class="topic-detail-description">{{ activeTopic.description }}</p>
          </section>
          <section class="topic-modes">
            <h2 class="topic-modes-title">Режимы</h2>
            <div class="topic-modes-grid">
              <button
                class="mode-button"
                type="button"
                data-mode="study"
                :disabled="isTopicDetailsLoading || !canStartStudy"
                @click="openStudyMode(activeTopic.id, 0)"
              >
                <span class="mode-title">Изучение</span>
                <span class="mode-subtitle">Листайте карточки одну за другой</span>
              </button>
            </div>
          </section>
          <section class="topic-cards">
            <div class="topic-cards-header">
              <h2>Карточки</h2>
              <span class="topic-cards-count">{{ activeTopicCardsCount }}</span>
            </div>
            <div v-if="isTopicDetailsLoading" class="data-state" aria-live="polite">
              <div class="state-card">
                <span class="state-title">Загружаем карточки…</span>
                <span class="state-subtitle">Скоро можно будет начать изучение.</span>
              </div>
            </div>
            <div v-else-if="topicDetailsError" class="data-state" aria-live="assertive">
              <div class="state-card">
                <span class="state-title">Не удалось загрузить карточки</span>
                <p class="state-subtitle">{{ topicDetailsError }}</p>
                <button class="state-action" type="button" @click="retryActiveTopic">
                  Попробовать снова
                </button>
              </div>
            </div>
            <div v-else-if="activeTopic.cards && activeTopic.cards.length" class="card-list">
              <article v-for="card in activeTopic.cards" :key="card.id" class="flashcard" :data-card="card.id">
                <img v-if="card.image" :src="card.image" :alt="card.translation" loading="lazy" />
                <div v-else class="flashcard-image-placeholder">Нет изображения</div>
                <div class="flashcard-content">
                  <span class="flashcard-translation">{{ card.translation }}</span>
                  <span v-if="card.original" class="flashcard-original">{{ card.original }}</span>
                  <span v-if="card.example" class="flashcard-example">{{ card.example }}</span>
                </div>
              </article>
            </div>
            <div v-else class="data-state" aria-live="polite">
              <div class="state-card">
                <span class="state-title">В этой теме пока нет карточек</span>
                <span class="state-subtitle">Добавьте карточки через API, чтобы начать учиться.</span>
              </div>
            </div>
          </section>
        </section>
      </template>
      <template v-else>
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
      </template>
    </main>
    <BottomNav :items="navItems" :active="activeTab" @change="navigate" />
    <div
      class="study-overlay"
      :aria-hidden="!studyState.isOpen"
      :hidden="!studyState.isOpen"
      v-show="studyState.isOpen"
    >
      <div
        v-if="studyTopic && studyCard"
        ref="studyDialog"
        class="study-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="`Изучение темы ${studyTopic.title}`"
        tabindex="-1"
        @keydown.esc.prevent="closeStudyMode"
        @keydown.left.prevent="showPrevCard"
        @keydown.right.prevent="showNextCard"
      >
        <header class="study-header">
          <div class="study-header-text">
            <span class="study-topic">{{ studyTopic.title }}</span>
            <span class="study-progress">{{ studyProgress.current }} / {{ studyProgress.total }}</span>
          </div>
          <button class="study-close" type="button" data-action="study-close" aria-label="Закрыть режим изучения" @click="closeStudyMode">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="m6 6 12 12" />
              <path d="m18 6-12 12" />
            </svg>
          </button>
        </header>
        <section class="study-card-wrapper">
          <button
            class="study-card"
            type="button"
            :data-card="studyCard.id"
            :data-flipped="studyState.isFlipped ? 'true' : 'false'"
            :aria-pressed="studyState.isFlipped ? 'true' : 'false'"
            aria-label="Перевернуть карточку"
            @click.prevent="toggleStudyCard"
          >
            <span class="visually-hidden">Нажмите, чтобы перевернуть карточку и показать перевод.</span>
            <div class="study-card-inner">
              <div class="study-card-face study-card-front">
                <span class="study-face-label">Слово</span>
                <span class="study-face-text">{{ studyCard.original || studyCard.translation }}</span>
                <span class="study-face-hint">Нажмите на карточку, чтобы увидеть перевод</span>
              </div>
              <div class="study-card-face study-card-back">
                <span class="study-face-label">Перевод</span>
                <span class="study-face-text">{{ studyCard.translation }}</span>
                <div v-if="studyCard.image" class="study-back-media">
                  <img :src="studyCard.image" :alt="studyCard.translation" loading="lazy" />
                </div>
                <div v-else class="study-card-placeholder" aria-hidden="true">Нет изображения</div>
                <span v-if="studyCard.original" class="study-face-helper">Оригинал: {{ studyCard.original }}</span>
                <span v-if="studyCard.example" class="study-face-example">{{ studyCard.example }}</span>
              </div>
            </div>
          </button>
        </section>
        <footer class="study-controls">
          <button class="study-nav" type="button" data-action="study-prev" :disabled="studyState.cardIndex === 0" @click="showPrevCard">
            Назад
          </button>
          <button
            class="study-nav"
            type="button"
            data-action="study-next"
            :disabled="studyTopic && studyState.cardIndex >= studyTopic.cards.length - 1"
            @click="showNextCard"
          >
            Дальше
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import BottomNav from './components/BottomNav.vue';
import { navItems } from './data/navigation.js';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

const topics = ref([]);
const isTopicsLoading = ref(false);
const topicsError = ref('');
const topicsPagination = reactive({
  page: 1,
  pageSize: 6,
  totalPages: 1,
  total: 0
});

const isTopicDetailsLoading = ref(false);
const topicDetailsError = ref('');

const activeTab = ref('home');
const activeTopicId = ref(null);

const studyState = reactive({
  isOpen: false,
  topicId: null,
  cardIndex: 0,
  isFlipped: false
});

const studyDialog = ref(null);

const activeTopic = computed(
  () => topics.value.find((topic) => topic.id === activeTopicId.value) || null
);
const studyTopic = computed(
  () => topics.value.find((topic) => topic.id === studyState.topicId) || null
);
const activeTopicCardsCount = computed(() => {
  const topic = activeTopic.value;
  if (!topic) return 0;
  if (Array.isArray(topic.cards) && topic.cards.length) {
    return topic.cards.length;
  }
  if (typeof topic.cardsCount === 'number') {
    return topic.cardsCount;
  }
  return 0;
});
const canStartStudy = computed(() => {
  const topic = activeTopic.value;
  return Boolean(
    topic && topic.hasCardsLoaded && Array.isArray(topic.cards) && topic.cards.length
  );
});
const studyCard = computed(() => {
  const topic = studyTopic.value;
  if (!topic || !Array.isArray(topic.cards)) return null;
  return topic.cards[studyState.cardIndex] || null;
});

const studyProgress = computed(() => {
  const topic = studyTopic.value;
  const total = topic && Array.isArray(topic.cards) ? topic.cards.length : 0;
  return {
    current: Math.min(studyState.cardIndex + 1, total),
    total
  };
});

const buildApiUrl = (path, params = {}) => {
  const url = new URL(path, `${apiBaseUrl}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
};

const resetStudyState = () => {
  studyState.isOpen = false;
  studyState.topicId = null;
  studyState.cardIndex = 0;
  studyState.isFlipped = false;
};

const loadTopics = async (page = topicsPagination.page || 1) => {
  if (isTopicsLoading.value) return;
  const targetPage = Math.max(page, 1);
  isTopicsLoading.value = true;
  topicsError.value = '';
  topicDetailsError.value = '';
  try {
    const response = await fetch(
      buildApiUrl('/groups', {
        page: targetPage,
        pageSize: topicsPagination.pageSize
      })
    );
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    const payload = await response.json();
    const previousTopics = new Map(topics.value.map((topic) => [topic.id, topic]));
    topicsPagination.page = payload.pagination.page;
    topicsPagination.pageSize = payload.pagination.pageSize;
    topicsPagination.total = payload.pagination.total;
    topicsPagination.totalPages = payload.pagination.totalPages;
    topics.value = payload.data.map((group) => {
      const existing = previousTopics.get(group.id);
      const cards = existing?.cards ?? [];
      const hasCardsLoaded = Boolean(existing?.hasCardsLoaded);
      return {
        id: group.id,
        title: group.title,
        subtitle: group.description || '',
        description: group.description || '',
        coverImage: existing?.coverImage ?? null,
        cards,
        cardsCount: group.cardsCount ?? (Array.isArray(cards) ? cards.length : 0),
        hasCardsLoaded
      };
    });
    if (!topics.value.some((topic) => topic.id === activeTopicId.value)) {
      activeTopicId.value = null;
      resetStudyState();
    }
  } catch (error) {
    topicsError.value = 'Не удалось загрузить темы. Попробуйте обновить страницу.';
    console.error('Failed to load groups', error);
  } finally {
    isTopicsLoading.value = false;
  }
};

const changeTopicsPage = (page) => {
  if (
    page === topicsPagination.page ||
    page < 1 ||
    (topicsPagination.totalPages && page > topicsPagination.totalPages)
  ) {
    return;
  }
  loadTopics(page);
};

const reloadTopics = () => {
  loadTopics(topicsPagination.page || 1);
};

const ensureTopicDetails = async (topicId) => {
  const topicIndex = topics.value.findIndex((topic) => topic.id === topicId);
  if (topicIndex === -1) return null;
  const topic = topics.value[topicIndex];
  if (topic.hasCardsLoaded) {
    return topic;
  }
  isTopicDetailsLoading.value = true;
  topicDetailsError.value = '';
  try {
    const response = await fetch(buildApiUrl(`/groups/${topicId}`));
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    const data = await response.json();
    const cards = (data.cards || []).map((card) => ({
      id: card.id,
      translation: card.definition,
      original: card.term,
      image: null,
      example: card.example || ''
    }));
    const updatedTopic = {
      ...topic,
      title: data.title,
      subtitle: data.description || topic.subtitle,
      description: data.description || topic.description,
      cards,
      cardsCount: cards.length,
      hasCardsLoaded: true
    };
    topics.value.splice(topicIndex, 1, updatedTopic);
    return updatedTopic;
  } catch (error) {
    topicDetailsError.value = 'Попробуйте обновить страницу или повторить позже.';
    console.error('Failed to load group details', error);
    throw error;
  } finally {
    isTopicDetailsLoading.value = false;
  }
};

const navigate = (tab) => {
  if (tab === activeTab.value) return;
  resetStudyState();
  activeTab.value = tab;
};

const showTopic = async (topicId) => {
  if (!topics.value.some((topic) => topic.id === topicId)) {
    return;
  }
  topicDetailsError.value = '';
  if (activeTab.value !== 'home') {
    activeTab.value = 'home';
  }
  if (activeTopicId.value !== topicId) {
    activeTopicId.value = topicId;
  }
  try {
    await ensureTopicDetails(topicId);
  } catch (error) {
    // Ошибка отобразится пользователю, состояние оставляем для повторной попытки
  }
};

const showTopicsList = () => {
  if (!activeTopicId.value) return;
  activeTopicId.value = null;
  topicDetailsError.value = '';
  isTopicDetailsLoading.value = false;
  resetStudyState();
};

const openStudyMode = (topicId, startIndex = 0) => {
  const topic = topics.value.find((item) => item.id === topicId);
  if (!topic || !topic.hasCardsLoaded || !Array.isArray(topic.cards) || !topic.cards.length) return;
  const boundedIndex = Math.min(Math.max(startIndex, 0), topic.cards.length - 1);
  studyState.isOpen = true;
  studyState.topicId = topicId;
  studyState.cardIndex = boundedIndex;
  studyState.isFlipped = false;
};

const closeStudyMode = () => {
  if (!studyState.isOpen) return;
  resetStudyState();
};

const showPrevCard = () => {
  if (!studyState.isOpen || studyState.cardIndex === 0) return;
  studyState.cardIndex -= 1;
  studyState.isFlipped = false;
};

const showNextCard = () => {
  const topic = studyTopic.value;
  if (!studyState.isOpen || !topic || !Array.isArray(topic.cards)) return;
  if (studyState.cardIndex >= topic.cards.length - 1) return;
  studyState.cardIndex += 1;
  studyState.isFlipped = false;
};

const toggleStudyCard = () => {
  if (!studyState.isOpen) return;
  studyState.isFlipped = !studyState.isFlipped;
};

const retryActiveTopic = () => {
  if (!activeTopicId.value) return;
  ensureTopicDetails(activeTopicId.value);
};

const getCardsCount = (topic) => {
  if (!topic) return 0;
  if (Array.isArray(topic.cards) && topic.cards.length) {
    return topic.cards.length;
  }
  if (typeof topic.cardsCount === 'number') {
    return topic.cardsCount;
  }
  return 0;
};

const getCardWord = (count) => {
  const normalized = Number.isFinite(count) ? count : 0;
  if (normalized === 1) return 'карточка';
  if (normalized >= 2 && normalized <= 4) return 'карточки';
  return 'карточек';
};

watch(
  () => studyState.isOpen,
  (isOpen) => {
    document.body.classList.toggle('study-open', isOpen);
    if (isOpen) {
      nextTick(() => {
        if (studyDialog.value) {
          studyDialog.value.focus();
        }
      });
    }
  }
);

watch(studyTopic, (topic) => {
  if (!topic && studyState.isOpen) {
    resetStudyState();
  }
});

watch(studyCard, (card) => {
  if (!card && studyState.isOpen) {
    resetStudyState();
  }
});

onMounted(() => {
  loadTopics(1);
});

onBeforeUnmount(() => {
  document.body.classList.remove('study-open');
});
</script>
