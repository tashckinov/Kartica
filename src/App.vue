<template>
  <div class="app-shell">
    <main class="app-main" aria-live="polite">
      <template v-if="activeTab === 'home'">
        <template v-if="!activeTopic">
          <header class="app-header">
            <h1 class="app-title">Изучаем языки с карточками</h1>
            <p class="app-subtitle">Выберите тему, чтобы открыть карточки и начать обучение.</p>
          </header>
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
                <span class="topic-card-badge">{{ topic.cards.length }} {{ getCardWord(topic.cards.length) }}</span>
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
              <button class="mode-button" type="button" data-mode="study" @click="openStudyMode(activeTopic.id, 0)">
                <span class="mode-title">Изучение</span>
                <span class="mode-subtitle">Листайте карточки одну за другой</span>
              </button>
            </div>
          </section>
          <section class="topic-cards">
            <div class="topic-cards-header">
              <h2>Карточки</h2>
              <span class="topic-cards-count">{{ activeTopic.cards.length }}</span>
            </div>
            <div class="card-list">
              <article v-for="card in activeTopic.cards" :key="card.id" class="flashcard" :data-card="card.id">
                <img v-if="card.image" :src="card.image" :alt="card.translation" loading="lazy" />
                <div v-else class="flashcard-image-placeholder">Нет изображения</div>
                <div class="flashcard-content">
                  <span class="flashcard-translation">{{ card.translation }}</span>
                  <span v-if="card.original" class="flashcard-original">{{ card.original }}</span>
                </div>
              </article>
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
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import BottomNav from './components/BottomNav.vue';
import { navItems } from './data/navigation.js';
import { topics } from './data/topics.js';

const activeTab = ref('home');
const activeTopicId = ref(null);

const studyState = reactive({
  isOpen: false,
  topicId: null,
  cardIndex: 0,
  isFlipped: false
});

const studyDialog = ref(null);

const activeTopic = computed(() => topics.find((topic) => topic.id === activeTopicId.value) || null);
const studyTopic = computed(() => topics.find((topic) => topic.id === studyState.topicId) || null);
const studyCard = computed(() => {
  const topic = studyTopic.value;
  if (!topic) return null;
  return topic.cards[studyState.cardIndex] || null;
});

const studyProgress = computed(() => ({
  current: Math.min(studyState.cardIndex + 1, studyTopic.value ? studyTopic.value.cards.length : 0),
  total: studyTopic.value ? studyTopic.value.cards.length : 0
}));

const resetStudyState = () => {
  studyState.isOpen = false;
  studyState.topicId = null;
  studyState.cardIndex = 0;
  studyState.isFlipped = false;
};

const navigate = (tab) => {
  if (tab === activeTab.value) return;
  resetStudyState();
  activeTab.value = tab;
};

const showTopic = (topicId) => {
  activeTopicId.value = topicId;
  if (activeTab.value !== 'home') {
    activeTab.value = 'home';
  }
};

const showTopicsList = () => {
  if (!activeTopicId.value) return;
  activeTopicId.value = null;
  resetStudyState();
};

const openStudyMode = (topicId, startIndex = 0) => {
  const topic = topics.find((item) => item.id === topicId);
  if (!topic) return;
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
  if (!studyState.isOpen || !topic) return;
  if (studyState.cardIndex >= topic.cards.length - 1) return;
  studyState.cardIndex += 1;
  studyState.isFlipped = false;
};

const toggleStudyCard = () => {
  if (!studyState.isOpen) return;
  studyState.isFlipped = !studyState.isFlipped;
};

const getCardWord = (count) => {
  if (count === 1) return 'карточка';
  if (count >= 2 && count <= 4) return 'карточки';
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

onBeforeUnmount(() => {
  document.body.classList.remove('study-open');
});
</script>
