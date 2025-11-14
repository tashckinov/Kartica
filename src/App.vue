<template>
  <div class="app-shell">
    <main class="app-main" aria-live="polite">
      <template v-if="activeTab === 'profile'">
        <div class="profile-screen">
          <div class="profile-card">
            <h2>Профиль</h2>
            <div v-if="isProfileReady" class="profile-user" data-telegram-user>
              <div class="profile-avatar" :data-has-photo="userProfile.photoUrl ? 'true' : 'false'">
                <img
                  v-if="userProfile.photoUrl"
                  :src="userProfile.photoUrl"
                  :alt="`Аватар пользователя ${profileDisplayName}`"
                  loading="lazy"
                />
                <span v-else aria-hidden="true">{{ profileInitials }}</span>
              </div>
              <div class="profile-user-info">
                <span class="profile-user-name">{{ profileDisplayName }}</span>
                <span v-if="showProfileUsername" class="profile-user-username">@{{ userProfile.username }}</span>
                <span v-if="userProfile.languageCode" class="profile-user-language">
                  Язык интерфейса: {{ userProfile.languageCode.toUpperCase() }}
                </span>
              </div>
            </div>
            <p v-else class="profile-placeholder">{{ profileFallbackText }}</p>
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
      <template v-else>
        <section v-if="activeTopic" class="topic-detail" :data-topic-detail="activeTopic.id">
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
            <div class="topic-detail-actions">
              <button
                class="favorite-toggle"
                type="button"
                :aria-pressed="isActiveTopicFavorite ? 'true' : 'false'"
                :data-favorite="isActiveTopicFavorite ? 'true' : 'false'"
                @click="toggleFavorite(activeTopic.id)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path
                    :d="
                      isActiveTopicFavorite
                        ? 'M12 4.5 14.89 9.8l5.61.82-4.05 3.95.95 5.55L12 16.98 6.6 20.12l.95-5.55L3.5 10.62l5.61-.82z'
                        : 'm12 5.19 1.96 3.98 4.4.64-3.18 3.1.75 4.37L12 14.77l-3.93 2.51.75-4.37-3.18-3.1 4.4-.64z'
                    "
                    :fill="isActiveTopicFavorite ? 'currentColor' : 'none'"
                  />
                </svg>
                <span class="favorite-toggle-label">
                  {{ isActiveTopicFavorite ? 'В избранном' : 'В избранное' }}
                </span>
              </button>
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
        <template v-else-if="activeTab === 'favorites'">
          <header class="app-header">
            <h1 class="app-title">Избранные темы</h1>
            <p class="app-subtitle">Собирайте любимые группы карточек, чтобы возвращаться к ним быстрее.</p>
          </header>
          <section v-if="isFavoritesLoading" class="data-state" aria-live="polite">
            <div class="state-card">
              <span class="state-title">Загружаем избранное…</span>
              <span class="state-subtitle">Секундочку, подготавливаем ваши темы.</span>
            </div>
          </section>
          <section v-else-if="favoritesError" class="data-state" aria-live="assertive">
            <div class="state-card">
              <span class="state-title">Не удалось загрузить избранные темы</span>
              <p class="state-subtitle">{{ favoritesError }}</p>
              <button class="state-action" type="button" @click="retryFavorites">Попробовать снова</button>
            </div>
          </section>
          <template v-else>
            <section v-if="favoriteTopics.length" class="topics-grid">
              <article
                v-for="topic in favoriteTopics"
                :key="topic.id"
                class="topic-card"
                role="button"
                tabindex="0"
                :data-topic-card="topic.id"
                @click="showTopic(topic.id)"
                @keydown.enter.prevent="showTopic(topic.id)"
                @keydown.space.prevent="showTopic(topic.id)"
              >
                <button
                  class="topic-card-favorite"
                  type="button"
                  :aria-pressed="isTopicFavorite(topic.id) ? 'true' : 'false'"
                  :data-favorite="isTopicFavorite(topic.id) ? 'true' : 'false'"
                  @click.stop="toggleFavorite(topic.id)"
                >
                  <span class="visually-hidden">
                    {{ favoriteToggleText(topic.id) }}
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path
                      :d="
                        isTopicFavorite(topic.id)
                          ? 'M12 4.5 14.89 9.8l5.61.82-4.05 3.95.95 5.55L12 16.98 6.6 20.12l.95-5.55L3.5 10.62l5.61-.82z'
                          : 'm12 5.19 1.96 3.98 4.4.64-3.18 3.1.75 4.37L12 14.77l-3.93 2.51.75-4.37-3.18-3.1 4.4-.64z'
                      "
                      :fill="isTopicFavorite(topic.id) ? 'currentColor' : 'none'"
                    />
                  </svg>
                </button>
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
              Добавьте группы в избранное, чтобы видеть их здесь.
            </div>
          </template>
        </template>
        <template v-else>
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
            <section v-if="currentTopics.length" class="topics-grid">
              <article
                v-for="topic in currentTopics"
                :key="topic.id"
                class="topic-card"
                role="button"
                tabindex="0"
                :data-topic-card="topic.id"
                @click="showTopic(topic.id)"
                @keydown.enter.prevent="showTopic(topic.id)"
                @keydown.space.prevent="showTopic(topic.id)"
              >
                <button
                  class="topic-card-favorite"
                  type="button"
                  :aria-pressed="isTopicFavorite(topic.id) ? 'true' : 'false'"
                  :data-favorite="isTopicFavorite(topic.id) ? 'true' : 'false'"
                  @click.stop="toggleFavorite(topic.id)"
                >
                  <span class="visually-hidden">
                    {{ favoriteToggleText(topic.id) }}
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path
                      :d="
                        isTopicFavorite(topic.id)
                          ? 'M12 4.5 14.89 9.8l5.61.82-4.05 3.95.95 5.55L12 16.98 6.6 20.12l.95-5.55L3.5 10.62l5.61-.82z'
                          : 'm12 5.19 1.96 3.98 4.4.64-3.18 3.1.75 4.37L12 14.77l-3.93 2.51.75-4.37-3.18-3.1 4.4-.64z'
                      "
                      :fill="isTopicFavorite(topic.id) ? 'currentColor' : 'none'"
                    />
                  </svg>
                </button>
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
              v-if="currentTopics.length && topicsPagination.totalPages > 1"
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
const currentPageTopicIds = ref([]);
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

const favoriteStorageKey = 'kartica:favorites';
const favoriteTopicIds = ref([]);
const isFavoritesLoading = ref(false);
const favoritesError = ref('');

const studyState = reactive({
  isOpen: false,
  topicId: null,
  cardIndex: 0,
  isFlipped: false
});

const studyDialog = ref(null);

const getTopicById = (topicId) => {
  if (!topicId) return null;
  return topics.value.find((topic) => topic.id === topicId) || null;
};

const upsertTopic = (partialTopic = {}) => {
  if (!partialTopic || !partialTopic.id) {
    return null;
  }
  const index = topics.value.findIndex((topic) => topic.id === partialTopic.id);
  const existing = index !== -1 ? topics.value[index] : null;
  const merged = {
    id: partialTopic.id,
    title: partialTopic.title ?? existing?.title ?? '',
    subtitle: partialTopic.subtitle ?? existing?.subtitle ?? '',
    description: partialTopic.description ?? existing?.description ?? '',
    coverImage:
      partialTopic.coverImage !== undefined
        ? partialTopic.coverImage
        : existing?.coverImage ?? null,
    cards:
      partialTopic.cards !== undefined
        ? partialTopic.cards
        : existing?.cards ?? [],
    cardsCount:
      typeof partialTopic.cardsCount === 'number'
        ? partialTopic.cardsCount
        : partialTopic.cards
        ? partialTopic.cards.length
        : existing?.cardsCount ?? (Array.isArray(existing?.cards) ? existing.cards.length : 0),
    hasCardsLoaded:
      partialTopic.hasCardsLoaded !== undefined
        ? partialTopic.hasCardsLoaded
        : existing?.hasCardsLoaded ?? false
  };
  if (index !== -1) {
    topics.value.splice(index, 1, merged);
  } else {
    topics.value.push(merged);
  }
  return merged;
};

const activeTopic = computed(() => getTopicById(activeTopicId.value));
const studyTopic = computed(() => getTopicById(studyState.topicId));
const currentTopics = computed(() =>
  currentPageTopicIds.value
    .map((topicId) => getTopicById(topicId))
    .filter((topic) => topic !== null)
);

const favoriteTopicsSet = computed(() => new Set(favoriteTopicIds.value));
const favoriteTopics = computed(() =>
  favoriteTopicIds.value
    .map((topicId) => getTopicById(topicId))
    .filter((topic) => topic !== null)
);
const isTopicFavorite = (topicId) => favoriteTopicsSet.value.has(topicId);
const isActiveTopicFavorite = computed(() => {
  const topic = activeTopic.value;
  if (!topic) return false;
  return isTopicFavorite(topic.id);
});
const favoriteToggleText = (topicId) =>
  isTopicFavorite(topicId)
    ? 'Удалить тему из избранного'
    : 'Добавить тему в избранное';
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

const loadFavoritesFromStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    const stored = window.localStorage.getItem(favoriteStorageKey);
    if (!stored) return;
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      const filtered = parsed.filter((id) => id !== null && id !== undefined);
      favoriteTopicIds.value = [...new Set(filtered)];
    }
  } catch (error) {
    console.warn('Не удалось загрузить избранные темы из памяти', error);
  }
};

const persistFavorites = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(favoriteStorageKey, JSON.stringify(favoriteTopicIds.value));
  } catch (error) {
    console.warn('Не удалось сохранить избранные темы', error);
  }
};

const ensureFavoriteTopicsLoaded = async () => {
  if (!favoriteTopicIds.value.length) {
    favoritesError.value = '';
    return;
  }
  if (isFavoritesLoading.value) return;
  const missingIds = favoriteTopicIds.value.filter((topicId) => !getTopicById(topicId));
  if (!missingIds.length) {
    favoritesError.value = '';
    return;
  }
  isFavoritesLoading.value = true;
  favoritesError.value = '';
  const results = await Promise.allSettled(
    missingIds.map(async (topicId) => {
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
        upsertTopic({
          id: data.id ?? topicId,
          title: data.title,
          subtitle: data.description || '',
          description: data.description || '',
          coverImage: null,
          cards,
          cardsCount: cards.length,
          hasCardsLoaded: true
        });
      } catch (error) {
        console.error('Failed to load favorite topic', error);
        throw error;
      }
    })
  );
  if (results.some((result) => result.status === 'rejected')) {
    favoritesError.value = 'Не удалось загрузить часть избранных тем. Попробуйте обновить страницу.';
  }
  isFavoritesLoading.value = false;
};

const retryFavorites = () => {
  favoritesError.value = '';
  ensureFavoriteTopicsLoaded();
};

const toggleFavorite = async (topicId) => {
  if (!topicId) return;
  if (isTopicFavorite(topicId)) {
    favoriteTopicIds.value = favoriteTopicIds.value.filter((id) => id !== topicId);
    return;
  }
  favoriteTopicIds.value = [...favoriteTopicIds.value, topicId];
  if (!getTopicById(topicId)) {
    try {
      await ensureTopicDetails(topicId);
    } catch (error) {
      console.warn('Не удалось загрузить тему при добавлении в избранное', error);
    }
  }
};

const userProfile = reactive({
  id: null,
  username: '',
  firstName: '',
  lastName: '',
  photoUrl: '',
  languageCode: ''
});
const isTelegramEnvironment = ref(false);

const setUserProfile = (user = {}) => {
  userProfile.id = user.id ?? null;
  userProfile.username = user.username ?? '';
  userProfile.firstName = user.first_name ?? user.firstName ?? '';
  userProfile.lastName = user.last_name ?? user.lastName ?? '';
  userProfile.photoUrl = user.photo_url ?? user.photoUrl ?? '';
  userProfile.languageCode = user.language_code ?? user.languageCode ?? '';
};

const parseTelegramUserFromInitData = (initData) => {
  if (!initData || typeof initData !== 'string') {
    return null;
  }
  try {
    const params = new URLSearchParams(initData);
    const rawUser = params.get('user');
    if (!rawUser) {
      return null;
    }
    return JSON.parse(rawUser);
  } catch (error) {
    console.warn('Не удалось разобрать пользователя из initData', error);
    return null;
  }
};

const initTelegramIntegration = () => {
  const webApp = window.Telegram?.WebApp;
  let initData = '';
  let telegramUser = null;

  if (webApp) {
    isTelegramEnvironment.value = true;
    initData = webApp.initData || '';
    telegramUser = webApp.initDataUnsafe?.user || null;
  }

  if (!telegramUser && !initData) {
    const params = new URLSearchParams(window.location.search);
    initData = params.get('tgWebAppInitData') || params.get('initData') || '';
    if (initData) {
      isTelegramEnvironment.value = true;
    }
  }

  if (!telegramUser) {
    telegramUser = parseTelegramUserFromInitData(initData) || null;
  }

  if (telegramUser) {
    setUserProfile(telegramUser);
  }
};

const profileNameParts = computed(() =>
  [userProfile.firstName, userProfile.lastName]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
);

const profileDisplayName = computed(() => {
  if (profileNameParts.value.length) {
    return profileNameParts.value.join(' ');
  }
  if (userProfile.username) {
    return `@${userProfile.username}`;
  }
  return '';
});

const profileInitials = computed(() => {
  if (profileNameParts.value.length) {
    return profileNameParts.value
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  if (userProfile.username) {
    return userProfile.username.slice(0, 2).toUpperCase();
  }
  return 'TG';
});

const isProfileReady = computed(() => Boolean(profileDisplayName.value));

const showProfileUsername = computed(
  () => profileNameParts.value.length > 0 && Boolean(userProfile.username)
);

const profileFallbackText = computed(() => {
  if (!isTelegramEnvironment.value) {
    return 'Откройте приложение в Telegram Mini App, чтобы увидеть информацию профиля.';
  }
  return 'Telegram не передал данные пользователя.';
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
    topicsPagination.page = payload.pagination.page;
    topicsPagination.pageSize = payload.pagination.pageSize;
    topicsPagination.total = payload.pagination.total;
    topicsPagination.totalPages = payload.pagination.totalPages;
    currentPageTopicIds.value = payload.data.map((group) => group.id);
    payload.data.forEach((group) => {
      const existing = getTopicById(group.id);
      upsertTopic({
        id: group.id,
        title: group.title,
        subtitle: group.description || existing?.subtitle || '',
        description: group.description || existing?.description || '',
        coverImage: existing?.coverImage ?? null,
        cards: existing?.cards ?? [],
        cardsCount:
          typeof group.cardsCount === 'number'
            ? group.cardsCount
            : existing?.cardsCount ?? (Array.isArray(existing?.cards) ? existing.cards.length : 0),
        hasCardsLoaded: existing?.hasCardsLoaded ?? false
      });
    });
    if (!getTopicById(activeTopicId.value)) {
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
  const topic = getTopicById(topicId);
  if (topic && topic.hasCardsLoaded) {
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
    const updatedTopic = upsertTopic({
      id: data.id ?? topicId,
      title: data.title,
      subtitle: data.description || topic?.subtitle || '',
      description: data.description || topic?.description || '',
      coverImage: topic?.coverImage ?? null,
      cards,
      cardsCount: cards.length,
      hasCardsLoaded: true
    });
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
  activeTopicId.value = null;
  topicDetailsError.value = '';
  isTopicDetailsLoading.value = false;
  activeTab.value = tab;
  if (tab === 'favorites') {
    ensureFavoriteTopicsLoaded();
  }
};

const showTopic = async (topicId) => {
  if (!topicId) return;
  topicDetailsError.value = '';
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
  const topic = getTopicById(topicId);
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
  favoriteTopicIds,
  () => {
    persistFavorites();
    if (!favoriteTopicIds.value.length) {
      favoritesError.value = '';
      isFavoritesLoading.value = false;
      return;
    }
    ensureFavoriteTopicsLoaded();
  },
  { deep: true }
);

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
  loadFavoritesFromStorage();
  initTelegramIntegration();
  loadTopics(1);
  ensureFavoriteTopicsLoaded();
});

onBeforeUnmount(() => {
  document.body.classList.remove('study-open');
});
</script>
