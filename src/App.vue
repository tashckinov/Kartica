<template>
  <div class="app-shell">
    <main class="app-main" aria-live="polite">
      <template v-if="activeTab === 'profile'">
        <div class="profile-screen">
          <div class="profile-card">
            <h2>Профиль</h2>
            <div class="profile-user" data-admin-identity>
              <label class="profile-field">
                <span>Отображаемое имя</span>
                <input
                  v-model="adminDisplayNameModel"
                  type="text"
                  placeholder="Автор карточек"
                  autocomplete="name"
                />
              </label>
              <div class="profile-identity">
                <span class="profile-identity-label">Ваш идентификатор:</span>
                <code class="profile-identity-value">{{ adminIdentity.id }}</code>
                <button type="button" class="profile-identity-copy" @click="copyIdentityId">
                  {{ adminIdentityCopy.copied ? 'Скопировано!' : 'Скопировать ID' }}
                </button>
              </div>
              <p v-if="adminIdentityCopy.error" class="profile-admin-error">{{ adminIdentityCopy.error }}</p>
              <p class="profile-identity-hint">
                Этот идентификатор нужен, чтобы распознавать владельца групп. Храните его в браузере, чтобы
                редактировать созданные материалы.
              </p>
            </div>
          </div>
          <div class="profile-card profile-admin">
            <h3>Создание контента</h3>
            <p class="profile-admin-description">
              Получите специальную ссылку с токеном доступа и откройте панель управления в любом браузере.
            </p>
            <div class="profile-admin-actions">
              <button
                class="profile-admin-button"
                type="button"
                @click="requestAdminLink"
                :disabled="adminLink.loading || !canRequestAdminLink"
              >
                {{ adminLink.loading ? 'Получаем ссылку…' : 'Перейти к созданию' }}
              </button>
              <button
                v-if="hasAdminLink"
                class="profile-admin-copy"
                type="button"
                @click="copyAdminLink"
              >
                {{ adminLink.copied ? 'Скопировано!' : 'Скопировать ссылку' }}
              </button>
            </div>
            <p v-if="adminLink.error" class="profile-admin-error">{{ adminLink.error }}</p>
            <div v-if="hasAdminLink" class="profile-admin-link">
              <input type="text" :value="adminLink.url" readonly />
              <a :href="adminLink.url" target="_blank" rel="noopener" class="profile-admin-open">Открыть панель</a>
            </div>
            <p v-if="hasAdminLink" class="profile-admin-hint">
              После перехода токен сохранится в браузере и будет действовать 12 часов. Затем запросите новую ссылку
              из этого раздела.
            </p>
          </div>
          <div class="profile-card profile-favorites">
            <h3>Избранные темы</h3>
            <div v-if="isFavoritesLoading" class="profile-favorites-state" aria-live="polite">
              <span class="profile-favorites-text">Загружаем избранное…</span>
            </div>
            <div v-else-if="favoritesError" class="profile-favorites-state" role="alert">
              <span class="profile-favorites-text">{{ favoritesError }}</span>
              <button class="profile-favorites-retry" type="button" @click="retryFavorites">
                Попробовать снова
              </button>
            </div>
            <div v-else-if="profileFavoriteTopics.length" class="profile-favorites-grid">
              <article
                v-for="topic in profileFavoriteTopics"
                :key="topic.id"
                class="topic-card profile-favorite-card"
                role="button"
                tabindex="0"
                :data-topic-card="topic.id"
                @click="openTopicFromFavorites(topic.id)"
                @keydown.enter.prevent="openTopicFromFavorites(topic.id)"
                @keydown.space.prevent="openTopicFromFavorites(topic.id)"
              >
                <button
                  class="topic-card-favorite"
                  type="button"
                  :aria-pressed="isTopicFavorite(topic.id) ? 'true' : 'false'"
                  :data-favorite="isTopicFavorite(topic.id) ? 'true' : 'false'"
                  @click.stop="toggleFavorite(topic.id, { preserveCard: true })"
                >
                  <span class="visually-hidden">
                    {{ favoriteToggleText(topic.id) }}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
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
            </div>
            <p v-else class="profile-favorites-empty">
              Добавьте группы в избранное, чтобы видеть их здесь.
            </p>
          </div>
        </div>
      </template>
      <template v-else>
        <section v-if="activeTopic" class="topic-detail" :data-topic-detail="activeTopic.id">
          <header class="topic-detail-header">
            <div class="topic-detail-top">
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
            <h1 class="topic-detail-title">{{ activeTopic.title }}</h1>
            <p v-if="activeTopicDescription" class="topic-detail-description">{{ activeTopicDescription }}</p>
          </header>
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
                <span class="mode-title">Просмотр</span>
                <span class="mode-subtitle">Листайте карточки одну за другой</span>
              </button>
              <button
                class="mode-button"
                type="button"
                data-mode="memorize"
                :disabled="isTopicDetailsLoading || !canStartMemorize"
                @click="openMemorizeMode(activeTopic.id)"
              >
                <span class="mode-title">Заучивание</span>
                <span class="mode-subtitle">Выбирайте верный перевод и закрепляйте слова</span>
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
                <span class="state-subtitle">Скоро можно будет начать просмотр карточек.</span>
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
      class="memorize-overlay"
      :aria-hidden="!memorizeState.isOpen"
      :hidden="!memorizeState.isOpen"
      v-show="memorizeState.isOpen"
    >
      <div
        v-if="memorizeTopic"
        ref="memorizeDialog"
        class="memorize-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="`Заучивание темы ${memorizeTopic.title}`"
        tabindex="-1"
        @keydown.esc.prevent="closeMemorizeMode"
      >
        <header class="memorize-header">
          <button
            class="memorize-close"
            type="button"
            data-action="memorize-close"
            aria-label="Закрыть режим заучивания"
            @click="closeMemorizeMode"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="m6 6 12 12" />
              <path d="m18 6-12 12" />
            </svg>
          </button>
          <div class="memorize-header-text">
            <span class="memorize-topic">{{ memorizeTopic.title }}</span>
            <span class="memorize-progress-label">
              Выучено: {{ memorizeProgress.learned }} из {{ memorizeProgress.total }}
            </span>
          </div>
        </header>
        <div
          class="memorize-progress"
          role="progressbar"
          aria-live="polite"
          :aria-valuemin="0"
          :aria-valuemax="memorizeProgress.requiredUnits"
          :aria-valuenow="memorizeProgress.completedUnits"
          :aria-valuetext="`${memorizeProgressPercent}% завершено`"
        >
          <div class="memorize-progress-bar">
            <div class="memorize-progress-bar-fill" :style="{ width: `${memorizeProgressPercent}%` }"></div>
          </div>
        </div>
        <section v-if="memorizeState.screen === 'prompt'" class="memorize-resume">
          <h2 class="memorize-resume-title">Продолжить обучение?</h2>
          <p class="memorize-resume-text">
            У вас сохранён прогресс заучивания. Вы можете продолжить с места остановки или начать заново.
          </p>
          <div class="memorize-resume-actions">
            <button class="memorize-action primary" type="button" @click="resumeMemorizeProgress">
              Продолжить
            </button>
            <button class="memorize-action" type="button" @click="restartMemorizeProgress">
              Начать заново
            </button>
          </div>
        </section>
        <section v-else-if="memorizeState.screen === 'complete'" class="memorize-complete">
          <div class="memorize-complete-card">
            <h2 class="memorize-complete-title">Отлично! Все слова выучены</h2>
            <p class="memorize-complete-text">
              Вы выбрали правильный перевод для каждого слова столько раз, сколько нужно для зачёта.
            </p>
            <div class="memorize-complete-actions">
              <button class="memorize-action primary" type="button" @click="restartMemorizeProgress">
                Повторить тренировку
              </button>
              <button class="memorize-action" type="button" @click="closeMemorizeMode">
                Закрыть
              </button>
            </div>
          </div>
        </section>
        <section v-else class="memorize-content">
          <div class="memorize-card">
            <div v-if="memorizeCurrentCard && memorizeCurrentCard.image" class="memorize-card-media">
              <img :src="memorizeCurrentCard.image" :alt="memorizePromptText" loading="lazy" />
            </div>
            <div class="memorize-card-body">
              <span class="memorize-card-label">Слово</span>
              <span class="memorize-card-word">{{ memorizePromptText }}</span>
              <span v-if="memorizeCurrentCard && memorizeCurrentCard.example" class="memorize-card-example">
                {{ memorizeCurrentCard.example }}
              </span>
            </div>
          </div>
          <div class="memorize-options" role="group" aria-label="Варианты перевода">
            <button
              v-for="option in memorizeOptions"
              :key="option.id"
              class="memorize-option"
              type="button"
              :data-state="getMemorizeOptionState(option)"
              :disabled="memorizeState.isProcessingAnswer"
              @click="selectMemorizeOption(option)"
            >
              {{ option.text }}
            </button>
          </div>
          <div class="memorize-actions">
            <button
              class="memorize-next memorize-action primary"
              type="button"
              :disabled="!canAdvanceMemorize"
              @click="goToNextMemorizeStep"
            >
              Дальше
            </button>
          </div>
        </section>
      </div>
    </div>
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
        :aria-label="`Просмотр темы ${studyTopic.title}`"
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
          <button class="study-close" type="button" data-action="study-close" aria-label="Закрыть режим просмотра" @click="closeStudyMode">
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
import { apiBaseUrl } from './apiConfig.js';

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
const sessionRemovedFavoriteTopicIds = ref([]);
const isFavoritesLoading = ref(false);
const favoritesError = ref('');

const studyState = reactive({
  isOpen: false,
  topicId: null,
  cardIndex: 0,
  isFlipped: false
});

const studyDialog = ref(null);

const MEMORIZE_BASE_REQUIRED_SUCCESS = 3;
const MEMORIZE_FAST_TRACK_SUCCESS = 2;
const memorizeStoragePrefix = 'kartica:memorize:';

const memorizeState = reactive({
  isOpen: false,
  topicId: null,
  queue: [],
  correctMap: {},
  firstAttemptMap: {},
  currentCardId: null,
  options: [],
  isProcessingAnswer: false,
  screen: 'quiz',
  resumeSnapshot: null,
  totalAnswered: 0,
  selectedOptionId: null,
  revealCorrectId: null,
  pendingAnswerIsCorrect: null
});

const memorizeDialog = ref(null);

const resolveMemorizeRequiredSuccess = (cardId, firstAttemptMap = memorizeState.firstAttemptMap) => {
  if (!cardId) return MEMORIZE_BASE_REQUIRED_SUCCESS;
  return firstAttemptMap?.[cardId] === true
    ? MEMORIZE_FAST_TRACK_SUCCESS
    : MEMORIZE_BASE_REQUIRED_SUCCESS;
};

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
const activeTopicDescription = computed(() => {
  const topic = activeTopic.value;
  if (!topic) return '';
  return topic.description || topic.subtitle || '';
});
const studyTopic = computed(() => getTopicById(studyState.topicId));
const memorizeTopic = computed(() => getTopicById(memorizeState.topicId));
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
const profileFavoriteTopics = computed(() => {
  const visibleRemovedTopics = sessionRemovedFavoriteTopicIds.value
    .map((topicId) => getTopicById(topicId))
    .filter((topic) => topic !== null && !favoriteTopicsSet.value.has(topic.id));
  return [...favoriteTopics.value, ...visibleRemovedTopics];
});
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
const canStartMemorize = computed(() => {
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

const memorizeCurrentCard = computed(() => {
  const topic = memorizeTopic.value;
  if (!topic || !Array.isArray(topic.cards)) return null;
  return topic.cards.find((card) => card.id === memorizeState.currentCardId) || null;
});

const memorizePromptText = computed(() => {
  const card = memorizeCurrentCard.value;
  if (!card) return '';
  return card.original || card.translation || 'Без текста';
});

const memorizeOptions = computed(() => memorizeState.options || []);

const memorizeProgress = computed(() => {
  const topic = memorizeTopic.value;
  const cards = Array.isArray(topic?.cards) ? topic.cards : [];
  let learned = 0;
  let completedUnits = 0;
  let requiredUnits = 0;
  cards.forEach((card) => {
    const requiredSuccess = resolveMemorizeRequiredSuccess(card.id);
    const score = memorizeState.correctMap?.[card.id] ?? 0;
    const clampedScore = Math.min(requiredSuccess, Math.max(0, score));
    if (clampedScore >= requiredSuccess) {
      learned += 1;
    }
    completedUnits += clampedScore;
    requiredUnits += requiredSuccess;
  });
  return {
    learned,
    total: cards.length,
    completedUnits,
    requiredUnits
  };
});

const memorizeProgressPercent = computed(() => {
  if (!memorizeProgress.value.requiredUnits) return 0;
  return Math.min(
    100,
    Math.round(
      (memorizeProgress.value.completedUnits / memorizeProgress.value.requiredUnits) * 100
    )
  );
});

const canAdvanceMemorize = computed(
  () =>
    memorizeState.screen === 'quiz' &&
    memorizeState.pendingAnswerIsCorrect !== null &&
    Boolean(memorizeState.currentCardId)
);

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

const getMemorizeStorageKey = (topicId) => `${memorizeStoragePrefix}${topicId}`;

const loadMemorizeProgress = (topicId) => {
  if (typeof window === 'undefined' || !topicId) return null;
  try {
    const stored = window.localStorage.getItem(getMemorizeStorageKey(topicId));
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const queue = Array.isArray(parsed.queue) ? parsed.queue : [];
    const correctMap = parsed.correctMap && typeof parsed.correctMap === 'object' ? parsed.correctMap : {};
    const firstAttemptMap =
      parsed.firstAttemptMap && typeof parsed.firstAttemptMap === 'object'
        ? parsed.firstAttemptMap
        : {};
    const totalAnswered = Number.isFinite(parsed.totalAnswered) ? parsed.totalAnswered : 0;
    const isComplete = Boolean(parsed.isComplete);
    return { queue, correctMap, firstAttemptMap, totalAnswered, isComplete };
  } catch (error) {
    console.warn('Не удалось загрузить прогресс заучивания', error);
    return null;
  }
};

const persistMemorizeProgress = (topicId, payload) => {
  if (typeof window === 'undefined' || !topicId) return;
  try {
    const data = {
      queue: Array.isArray(payload?.queue) ? payload.queue : [],
      correctMap:
        payload?.correctMap && typeof payload.correctMap === 'object'
          ? { ...payload.correctMap }
          : {},
      firstAttemptMap:
        payload?.firstAttemptMap && typeof payload.firstAttemptMap === 'object'
          ? Object.fromEntries(
              Object.entries(payload.firstAttemptMap).map(([key, value]) => [key, value === true])
            )
          : {},
      totalAnswered: Number.isFinite(payload?.totalAnswered) ? payload.totalAnswered : 0,
      isComplete: Boolean(payload?.isComplete)
    };
    window.localStorage.setItem(getMemorizeStorageKey(topicId), JSON.stringify(data));
  } catch (error) {
    console.warn('Не удалось сохранить прогресс заучивания', error);
  }
};

const clearMemorizeProgress = (topicId) => {
  if (typeof window === 'undefined' || !topicId) return;
  try {
    window.localStorage.removeItem(getMemorizeStorageKey(topicId));
  } catch (error) {
    console.warn('Не удалось очистить прогресс заучивания', error);
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
          image: card.image || null,
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

const removeSessionFavorite = (topicId) => {
  if (!sessionRemovedFavoriteTopicIds.value.length) return;
  sessionRemovedFavoriteTopicIds.value = sessionRemovedFavoriteTopicIds.value.filter(
    (id) => id !== topicId
  );
};

const rememberSessionFavorite = (topicId) => {
  if (!sessionRemovedFavoriteTopicIds.value.includes(topicId)) {
    sessionRemovedFavoriteTopicIds.value = [
      ...sessionRemovedFavoriteTopicIds.value,
      topicId
    ];
  }
};

const toggleFavorite = async (topicId, options = {}) => {
  if (!topicId) return;
  const preserveCard = Boolean(options.preserveCard);
  if (isTopicFavorite(topicId)) {
    favoriteTopicIds.value = favoriteTopicIds.value.filter((id) => id !== topicId);
    if (preserveCard) {
      rememberSessionFavorite(topicId);
    } else {
      removeSessionFavorite(topicId);
    }
    return;
  }
  favoriteTopicIds.value = [...favoriteTopicIds.value, topicId];
  removeSessionFavorite(topicId);
  if (!getTopicById(topicId)) {
    try {
      await ensureTopicDetails(topicId);
    } catch (error) {
      console.warn('Не удалось загрузить тему при добавлении в избранное', error);
    }
  }
};

const ADMIN_IDENTITY_STORAGE_KEY = 'kartica-admin-identity';
const ADMIN_IDENTITY_ID_MAX_LENGTH = 128;
const ADMIN_IDENTITY_NAME_MAX_LENGTH = 120;

const sanitizeIdentityString = (value, maxLength = ADMIN_IDENTITY_NAME_MAX_LENGTH) => {
  if (value === undefined || value === null) {
    return '';
  }
  const stringValue = typeof value === 'string' ? value : String(value);
  const trimmed = stringValue.trim();
  if (!trimmed) {
    return '';
  }
  if (typeof maxLength === 'number' && maxLength > 0 && trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
};

const adminIdentity = reactive({
  id: '',
  displayName: '',
});

const adminIdentityCopy = reactive({
  copied: false,
  error: '',
});

const adminIdentityInitialized = ref(false);

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

const detectTelegramUser = () => {
  const webApp = window.Telegram?.WebApp;
  let telegramUser = webApp?.initDataUnsafe?.user || null;

  if (!telegramUser) {
    const params = new URLSearchParams(window.location.search);
    const initData = params.get('tgWebAppInitData') || params.get('initData') || '';
    if (initData) {
      telegramUser = parseTelegramUserFromInitData(initData) || null;
    }
  }

  return telegramUser;
};

const generateIdentityId = (telegramUser) => {
  if (telegramUser && telegramUser.id !== undefined && telegramUser.id !== null) {
    return sanitizeIdentityString(String(telegramUser.id), ADMIN_IDENTITY_ID_MAX_LENGTH);
  }
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `user-${randomPart}${Date.now().toString(36)}`;
};

const loadStoredIdentity = () => {
  try {
    const raw = localStorage.getItem(ADMIN_IDENTITY_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const id = sanitizeIdentityString(parsed?.id, ADMIN_IDENTITY_ID_MAX_LENGTH);
    if (!id) {
      return null;
    }
    return {
      id,
      displayName: sanitizeIdentityString(parsed?.displayName, ADMIN_IDENTITY_NAME_MAX_LENGTH),
    };
  } catch (error) {
    console.warn('Не удалось загрузить идентификатор администратора', error);
    return null;
  }
};

const persistAdminIdentity = () => {
  if (!adminIdentityInitialized.value || !adminIdentity.id) {
    return;
  }
  try {
    const payload = {
      id: sanitizeIdentityString(adminIdentity.id, ADMIN_IDENTITY_ID_MAX_LENGTH),
      displayName: sanitizeIdentityString(adminIdentity.displayName, ADMIN_IDENTITY_NAME_MAX_LENGTH),
    };
    localStorage.setItem(ADMIN_IDENTITY_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Не удалось сохранить идентификатор администратора', error);
  }
};

const setAdminIdentity = (identity) => {
  adminIdentity.id = sanitizeIdentityString(identity?.id, ADMIN_IDENTITY_ID_MAX_LENGTH) || '';
  adminIdentity.displayName =
    sanitizeIdentityString(identity?.displayName, ADMIN_IDENTITY_NAME_MAX_LENGTH) || '';
};

const initializeAdminIdentity = () => {
  const storedIdentity = loadStoredIdentity();
  if (storedIdentity) {
    setAdminIdentity(storedIdentity);
    adminIdentityInitialized.value = true;
    return;
  }

  const telegramUser = detectTelegramUser();
  const generatedId = generateIdentityId(telegramUser);
  const nameParts = [
    sanitizeIdentityString(telegramUser?.first_name ?? telegramUser?.firstName, 60),
    sanitizeIdentityString(telegramUser?.last_name ?? telegramUser?.lastName, 60),
  ].filter(Boolean);
  const username = sanitizeIdentityString(telegramUser?.username, ADMIN_IDENTITY_NAME_MAX_LENGTH);
  const fallbackName = nameParts.length
    ? sanitizeIdentityString(nameParts.join(' '), ADMIN_IDENTITY_NAME_MAX_LENGTH)
    : username
    ? `@${username}`
    : '';

  setAdminIdentity({ id: generatedId, displayName: fallbackName });
  adminIdentityInitialized.value = true;
  persistAdminIdentity();
};

const adminDisplayNameModel = computed({
  get: () => adminIdentity.displayName,
  set: (value) => {
    adminIdentity.displayName = sanitizeIdentityString(value, ADMIN_IDENTITY_NAME_MAX_LENGTH);
    persistAdminIdentity();
  },
});

const adminLink = reactive({
  url: '',
  loading: false,
  error: '',
  copied: false,
});

const canRequestAdminLink = computed(() => Boolean(adminIdentity.id));
const hasAdminLink = computed(() => Boolean(adminLink.url));

const buildApiUrl = (path, params = {}) => {
  const url = new URL(path, `${apiBaseUrl}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
};

const readApiErrorMessage = async (response, fallbackMessage) => {
  try {
    const data = await response.json();
    if (data && typeof data === 'object' && typeof data.error === 'string') {
      const trimmed = data.error.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  } catch (error) {
    // ignore JSON parsing issues
  }
  return fallbackMessage;
};

const requestAdminLink = async () => {
  adminLink.loading = true;
  adminLink.error = '';
  adminLink.copied = false;
  try {
    if (!adminIdentity.id) {
      throw new Error('Не удалось определить идентификатор пользователя. Обновите страницу.');
    }

    persistAdminIdentity();

    const profilePayload = {};
    if (adminIdentity.displayName) {
      profilePayload.displayName = adminIdentity.displayName;
    }

    const response = await fetch(buildApiUrl('/auth/token'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: adminIdentity.id,
        profile: profilePayload,
      }),
    });

    if (!response.ok) {
      const message = await readApiErrorMessage(response, 'Не удалось получить токен доступа.');
      throw new Error(message);
    }

    const data = await response.json();
    if (!data || typeof data.token !== 'string' || !data.token.trim()) {
      throw new Error('Сервер не вернул токен доступа.');
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const baseUrl = origin ? origin.replace(/\/$/, '') : '';
    adminLink.url = `${baseUrl}/admin?token=${encodeURIComponent(data.token)}`;
  } catch (error) {
    console.error('Failed to request admin token link', error);
    adminLink.url = '';
    adminLink.error =
      error instanceof Error && error.message
        ? error.message
        : 'Не удалось получить токен доступа.';
  } finally {
    adminLink.loading = false;
  }
};

const copyAdminLink = async () => {
  if (!adminLink.url) {
    return;
  }
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(adminLink.url);
      adminLink.copied = true;
      setTimeout(() => {
        adminLink.copied = false;
      }, 2000);
    } else {
      throw new Error('Clipboard API недоступен');
    }
  } catch (error) {
    console.warn('Failed to copy admin link', error);
    adminLink.error = 'Не удалось скопировать ссылку. Скопируйте её вручную.';
    adminLink.copied = false;
  }
};

const copyIdentityId = async () => {
  adminIdentityCopy.error = '';
  if (!adminIdentity.id) {
    return;
  }
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(adminIdentity.id);
      adminIdentityCopy.copied = true;
      setTimeout(() => {
        adminIdentityCopy.copied = false;
      }, 2000);
    } else {
      throw new Error('Clipboard API недоступен');
    }
  } catch (error) {
    console.warn('Failed to copy admin identity', error);
    adminIdentityCopy.error = 'Не удалось скопировать идентификатор. Скопируйте его вручную.';
    adminIdentityCopy.copied = false;
  }
};

const resetStudyState = () => {
  studyState.isOpen = false;
  studyState.topicId = null;
  studyState.cardIndex = 0;
  studyState.isFlipped = false;
};

const resetMemorizeState = () => {
  memorizeState.isOpen = false;
  memorizeState.topicId = null;
  memorizeState.queue = [];
  memorizeState.correctMap = {};
  memorizeState.firstAttemptMap = {};
  memorizeState.currentCardId = null;
  memorizeState.options = [];
  memorizeState.isProcessingAnswer = false;
  memorizeState.screen = 'quiz';
  memorizeState.resumeSnapshot = null;
  memorizeState.totalAnswered = 0;
  memorizeState.selectedOptionId = null;
  memorizeState.revealCorrectId = null;
  memorizeState.pendingAnswerIsCorrect = null;
};

const shuffleArray = (list) => {
  const array = Array.isArray(list) ? [...list] : [];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const normalizeMemorizeFirstAttemptMap = (cards, storedMap = {}) => {
  const map = {};
  const availableIds = new Set(cards.map((card) => card.id));
  if (storedMap && typeof storedMap === 'object') {
    Object.entries(storedMap).forEach(([cardId, value]) => {
      if (availableIds.has(cardId)) {
        map[cardId] = value === true;
      }
    });
  }
  return map;
};

const normalizeMemorizeCorrectMap = (cards, storedMap = {}, firstAttemptMap = {}) => {
  const map = {};
  cards.forEach((card) => {
    const raw = Number(storedMap?.[card.id]);
    if (Number.isFinite(raw) && raw > 0) {
      const required = resolveMemorizeRequiredSuccess(card.id, firstAttemptMap);
      map[card.id] = Math.min(required, Math.max(0, Math.floor(raw)));
    } else {
      map[card.id] = 0;
    }
  });
  return map;
};

const buildMemorizeQueue = (cards, correctMap, firstAttemptMap, storedQueue = []) => {
  const availableIds = new Set(cards.map((card) => card.id));
  let queue = Array.isArray(storedQueue)
    ? storedQueue.filter(
        (cardId) =>
          availableIds.has(cardId) &&
          (correctMap[cardId] ?? 0) < resolveMemorizeRequiredSuccess(cardId, firstAttemptMap)
      )
    : [];
  if (!queue.length) {
    queue = cards
      .filter(
        (card) =>
          (correctMap[card.id] ?? 0) < resolveMemorizeRequiredSuccess(card.id, firstAttemptMap)
      )
      .map((card) => card.id);
    queue = shuffleArray(queue);
  }
  return queue;
};

const getMemorizeOptionText = (card) => card.translation || card.original || 'Без перевода';

const buildMemorizeOptions = (cardId, cards) => {
  const card = cards.find((item) => item.id === cardId);
  if (!card) return [];
  const correctText = getMemorizeOptionText(card) || 'Без перевода';
  const incorrectPool = cards
    .filter((item) => item.id !== cardId)
    .map((item) => getMemorizeOptionText(item))
    .filter((text) => Boolean(text) && text !== correctText);
  const uniqueIncorrect = [...new Set(incorrectPool)];
  while (uniqueIncorrect.length < 3) {
    uniqueIncorrect.push(`Вариант ${uniqueIncorrect.length + 1}`);
  }
  const incorrectOptions = uniqueIncorrect.slice(0, 3).map((text, index) => ({
    id: `incorrect-${cardId}-${index}`,
    text,
    isCorrect: false
  }));
  const options = [
    {
      id: `correct-${cardId}`,
      text: correctText,
      isCorrect: true
    },
    ...incorrectOptions
  ];
  return shuffleArray(options);
};

const persistCurrentMemorizeState = (isCompleteOverride = null) => {
  if (!memorizeState.topicId) return;
  const shouldMarkComplete =
    isCompleteOverride !== null
      ? Boolean(isCompleteOverride)
      : !memorizeState.queue.length && memorizeProgress.value.total > 0;
  persistMemorizeProgress(memorizeState.topicId, {
    queue: memorizeState.queue,
    correctMap: memorizeState.correctMap,
    firstAttemptMap: memorizeState.firstAttemptMap,
    totalAnswered: memorizeState.totalAnswered,
    isComplete: shouldMarkComplete
  });
};

const updateMemorizeOptions = () => {
  const topic = memorizeTopic.value;
  const cardId = memorizeState.currentCardId;
  if (!topic || !Array.isArray(topic.cards) || !cardId) {
    memorizeState.options = [];
    return;
  }
  memorizeState.options = buildMemorizeOptions(cardId, topic.cards);
};

const startMemorizeSession = (topicId, snapshot = null) => {
  const topic = getTopicById(topicId);
  if (!topic || !topic.hasCardsLoaded || !Array.isArray(topic.cards) || !topic.cards.length) {
    return;
  }
  const firstAttemptMap = normalizeMemorizeFirstAttemptMap(topic.cards, snapshot?.firstAttemptMap);
  const correctMap = normalizeMemorizeCorrectMap(topic.cards, snapshot?.correctMap, firstAttemptMap);
  const queue = buildMemorizeQueue(topic.cards, correctMap, firstAttemptMap, snapshot?.queue);
  memorizeState.topicId = topicId;
  memorizeState.correctMap = correctMap;
  memorizeState.firstAttemptMap = firstAttemptMap;
  memorizeState.queue = queue;
  memorizeState.totalAnswered = Number.isFinite(snapshot?.totalAnswered)
    ? snapshot.totalAnswered
    : 0;
  memorizeState.screen = queue.length ? 'quiz' : 'complete';
  memorizeState.currentCardId = queue[0] ?? null;
  memorizeState.isProcessingAnswer = false;
  memorizeState.selectedOptionId = null;
  memorizeState.revealCorrectId = null;
  memorizeState.pendingAnswerIsCorrect = null;
  memorizeState.resumeSnapshot = null;
  updateMemorizeOptions();
  memorizeState.isOpen = true;
  persistCurrentMemorizeState(memorizeState.screen === 'complete');
};

const resumeMemorizeProgress = () => {
  if (!memorizeState.topicId || !memorizeState.resumeSnapshot) return;
  startMemorizeSession(memorizeState.topicId, memorizeState.resumeSnapshot);
};

const restartMemorizeProgress = () => {
  if (!memorizeState.topicId) return;
  clearMemorizeProgress(memorizeState.topicId);
  startMemorizeSession(memorizeState.topicId);
};

const openMemorizeMode = async (topicId) => {
  if (!topicId) return;
  const topic = getTopicById(topicId);
  if (!topic || !topic.hasCardsLoaded || !Array.isArray(topic.cards)) {
    try {
      await ensureTopicDetails(topicId);
    } catch (error) {
      return;
    }
  }
  const readyTopic = getTopicById(topicId);
  if (!readyTopic || !Array.isArray(readyTopic.cards) || !readyTopic.cards.length) return;
  resetStudyState();
  const stored = loadMemorizeProgress(topicId);
  if (stored && stored.isComplete && (!stored.queue || !stored.queue.length)) {
    const firstAttemptMap = normalizeMemorizeFirstAttemptMap(
      readyTopic.cards,
      stored.firstAttemptMap || {}
    );
    const correctMap = normalizeMemorizeCorrectMap(
      readyTopic.cards,
      stored.correctMap || {},
      firstAttemptMap
    );
    memorizeState.topicId = topicId;
    memorizeState.correctMap = correctMap;
    memorizeState.firstAttemptMap = firstAttemptMap;
    memorizeState.queue = [];
    memorizeState.totalAnswered = Number.isFinite(stored.totalAnswered) ? stored.totalAnswered : 0;
    memorizeState.screen = 'complete';
    memorizeState.currentCardId = null;
    memorizeState.options = [];
    memorizeState.resumeSnapshot = null;
    memorizeState.isProcessingAnswer = false;
    memorizeState.selectedOptionId = null;
    memorizeState.revealCorrectId = null;
    memorizeState.pendingAnswerIsCorrect = null;
    memorizeState.isOpen = true;
    persistCurrentMemorizeState(true);
    return;
  }
  if (stored && Array.isArray(stored.queue) && stored.queue.length) {
    const firstAttemptMap = normalizeMemorizeFirstAttemptMap(
      readyTopic.cards,
      stored.firstAttemptMap || {}
    );
    const correctMap = normalizeMemorizeCorrectMap(
      readyTopic.cards,
      stored.correctMap || {},
      firstAttemptMap
    );
    memorizeState.topicId = topicId;
    memorizeState.correctMap = correctMap;
    memorizeState.firstAttemptMap = firstAttemptMap;
    memorizeState.queue = [...stored.queue];
    memorizeState.totalAnswered = Number.isFinite(stored.totalAnswered) ? stored.totalAnswered : 0;
    memorizeState.screen = 'prompt';
    memorizeState.currentCardId = null;
    memorizeState.options = [];
    memorizeState.selectedOptionId = null;
    memorizeState.revealCorrectId = null;
    memorizeState.isProcessingAnswer = false;
    memorizeState.pendingAnswerIsCorrect = null;
    memorizeState.resumeSnapshot = {
      queue: [...memorizeState.queue],
      correctMap: { ...memorizeState.correctMap },
      firstAttemptMap: { ...memorizeState.firstAttemptMap },
      totalAnswered: memorizeState.totalAnswered,
      isComplete: Boolean(stored.isComplete)
    };
    memorizeState.isOpen = true;
    return;
  }
  startMemorizeSession(topicId);
};

const persistMemorizeAndResetSelection = () => {
  memorizeState.selectedOptionId = null;
  memorizeState.revealCorrectId = null;
  memorizeState.isProcessingAnswer = false;
  memorizeState.pendingAnswerIsCorrect = null;
};

const applyMemorizeAnswer = (isCorrect) => {
  const currentId = memorizeState.currentCardId;
  const topic = memorizeTopic.value;
  if (!currentId || !topic || !Array.isArray(topic.cards) || typeof isCorrect !== 'boolean') {
    persistMemorizeAndResetSelection();
    return;
  }
  const queue = Array.isArray(memorizeState.queue) ? [...memorizeState.queue] : [];
  queue.shift();
  const firstAttemptMap = memorizeState.firstAttemptMap || {};
  if (!Object.prototype.hasOwnProperty.call(firstAttemptMap, currentId)) {
    memorizeState.firstAttemptMap = {
      ...firstAttemptMap,
      [currentId]: isCorrect
    };
  }
  const activeFirstAttemptMap = memorizeState.firstAttemptMap;
  if (isCorrect) {
    const requiredSuccess = resolveMemorizeRequiredSuccess(currentId, activeFirstAttemptMap);
    const nextScore = Math.min(
      requiredSuccess,
      (memorizeState.correctMap?.[currentId] ?? 0) + 1
    );
    memorizeState.correctMap = {
      ...memorizeState.correctMap,
      [currentId]: nextScore
    };
    if (nextScore < requiredSuccess) {
      queue.push(currentId);
    }
  } else {
    queue.push(currentId);
  }
  memorizeState.queue = queue;
  memorizeState.totalAnswered += 1;
  if (!queue.length) {
    memorizeState.currentCardId = null;
    memorizeState.options = [];
    memorizeState.screen = 'complete';
    persistCurrentMemorizeState(true);
  } else {
    memorizeState.currentCardId = queue[0];
    memorizeState.screen = 'quiz';
    updateMemorizeOptions();
    persistCurrentMemorizeState(false);
  }
  persistMemorizeAndResetSelection();
};

const selectMemorizeOption = (option) => {
  if (memorizeState.screen !== 'quiz' || memorizeState.isProcessingAnswer || !option) return;
  memorizeState.isProcessingAnswer = true;
  memorizeState.selectedOptionId = option.id;
  memorizeState.pendingAnswerIsCorrect = Boolean(option.isCorrect);
  if (option.isCorrect) {
    memorizeState.revealCorrectId = option.id;
  } else {
    const correctOption = memorizeOptions.value.find((item) => item.isCorrect);
    memorizeState.revealCorrectId = correctOption ? correctOption.id : null;
  }
};

const goToNextMemorizeStep = () => {
  if (!canAdvanceMemorize.value) return;
  applyMemorizeAnswer(memorizeState.pendingAnswerIsCorrect);
};

const getMemorizeOptionState = (option) => {
  if (!option) return 'idle';
  if (option.id === memorizeState.selectedOptionId) {
    return option.isCorrect ? 'correct' : 'incorrect';
  }
  if (memorizeState.revealCorrectId && option.id === memorizeState.revealCorrectId) {
    return 'correct';
  }
  return 'idle';
};

const closeMemorizeMode = () => {
  if (!memorizeState.isOpen) return;
  persistCurrentMemorizeState(memorizeState.screen === 'complete');
  resetMemorizeState();
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
      image: card.image || null,
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
  if (memorizeState.topicId) {
    persistCurrentMemorizeState(memorizeState.screen === 'complete');
  }
  resetMemorizeState();
  activeTopicId.value = null;
  topicDetailsError.value = '';
  isTopicDetailsLoading.value = false;
  activeTab.value = tab;
  if (tab === 'profile') {
    ensureFavoriteTopicsLoaded();
  }
};

const openTopicFromFavorites = async (topicId) => {
  if (!topicId) return;
  if (activeTab.value !== 'home') {
    navigate('home');
    await nextTick();
  }
  showTopic(topicId);
};

const showTopic = async (topicId) => {
  if (!topicId) return;
  topicDetailsError.value = '';
  if (memorizeState.topicId) {
    persistCurrentMemorizeState(memorizeState.screen === 'complete');
  }
  resetMemorizeState();
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
  if (memorizeState.topicId) {
    persistCurrentMemorizeState(memorizeState.screen === 'complete');
  }
  resetMemorizeState();
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
    if (sessionRemovedFavoriteTopicIds.value.length) {
      sessionRemovedFavoriteTopicIds.value = sessionRemovedFavoriteTopicIds.value.filter(
        (id) => !favoriteTopicsSet.value.has(id)
      );
    }
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

watch(
  () => memorizeState.isOpen,
  (isOpen) => {
    document.body.classList.toggle('memorize-open', isOpen);
    if (isOpen) {
      nextTick(() => {
        if (memorizeDialog.value) {
          memorizeDialog.value.focus();
        }
      });
    }
  }
);

watch(memorizeTopic, (topic) => {
  if (!topic && memorizeState.isOpen) {
    resetMemorizeState();
  } else if (topic && memorizeState.isOpen && memorizeState.currentCardId) {
    updateMemorizeOptions();
  }
});

onMounted(() => {
  loadFavoritesFromStorage();
  initializeAdminIdentity();
  loadTopics(1);
  ensureFavoriteTopicsLoaded();
});

onBeforeUnmount(() => {
  document.body.classList.remove('study-open');
  document.body.classList.remove('memorize-open');
});
</script>
