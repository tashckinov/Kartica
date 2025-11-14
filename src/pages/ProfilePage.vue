<template>
  <section class="profile-card" v-if="state === 'loaded'">
    <div class="avatar" aria-hidden="true">{{ initials }}</div>
    <div class="profile-content">
      <h2 class="profile-name">{{ fullName }}</h2>
      <p class="profile-username">@{{ user.username }}</p>
      <p class="profile-meta">Язык интерфейса: {{ user.language_code?.toUpperCase() }}</p>
    </div>
  </section>

  <section class="profile-card" v-else-if="state === 'loading'">
    <p>Загружаем данные профиля…</p>
  </section>

  <section class="profile-card profile-card--error" v-else>
    <p>Не удалось загрузить профиль. Попробуйте обновить страницу.</p>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { fetchUserProfile } from '../services/user.js';

const user = ref(null);
const state = ref('loading');

const initials = computed(() => {
  if (!user.value) return '';
  const { first_name: firstName, last_name: lastName } = user.value;
  return [firstName, lastName]
    .filter(Boolean)
    .map((part) => part.trim().charAt(0).toUpperCase())
    .join('');
});

const fullName = computed(() => {
  if (!user.value) return '';
  const { first_name: firstName, last_name: lastName } = user.value;
  return [firstName, lastName].filter(Boolean).join(' ');
});

let abortController;

onMounted(async () => {
  abortController = new AbortController();
  state.value = 'loading';

  try {
    user.value = await fetchUserProfile(abortController.signal);
    state.value = 'loaded';
  } catch (error) {
    if (error.name === 'AbortError') {
      return;
    }
    state.value = 'error';
  }
});

onBeforeUnmount(() => {
  if (abortController) {
    abortController.abort();
  }
});
</script>

<style scoped>
.profile-card {
  background: var(--card-background);
  border-radius: 1.5rem;
  padding: clamp(1.75rem, 4vw, 2.5rem);
  max-width: 520px;
  width: 100%;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.2);
  display: grid;
  gap: 1.5rem;
  align-items: center;
  text-align: center;
}

.profile-card--error {
  color: #f87171;
}

.avatar {
  width: 96px;
  height: 96px;
  margin: 0 auto;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, var(--app-accent), rgba(14, 116, 144, 0.8));
  color: white;
  font-size: 2rem;
  font-weight: 700;
}

.profile-content {
  display: grid;
  gap: 0.5rem;
}

.profile-name {
  font-size: clamp(1.5rem, 3vw, 2rem);
  margin: 0;
}

.profile-username {
  margin: 0;
  color: var(--app-text-secondary);
}

.profile-meta {
  margin: 0;
  font-size: 0.95rem;
  color: var(--app-text-secondary);
}
</style>
