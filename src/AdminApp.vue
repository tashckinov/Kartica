<template>
  <div class="admin-app">
    <div v-if="!isAuthenticated" class="admin-auth">
      <form class="admin-auth-card" @submit.prevent="handleLogin">
        <h1>Вход в админку</h1>
        <label class="form-field">
          <span>Логин</span>
          <input v-model.trim="username" type="text" autocomplete="username" required />
        </label>
        <label class="form-field">
          <span>Пароль</span>
          <input v-model="password" type="password" autocomplete="current-password" required />
        </label>
        <p v-if="loginError" class="form-error">{{ loginError }}</p>
        <button type="submit" class="primary-button">Войти</button>
      </form>
    </div>
    <div v-else class="admin-dashboard">
      <header class="admin-header">
        <div class="admin-header__titles">
          <h1>Панель администратора</h1>
          <p>Управление группами и карточками</p>
        </div>
        <div class="admin-header__actions">
          <button class="ghost-button" type="button" @click="fetchGroups" :disabled="groupsLoading">
            Обновить группы
          </button>
          <button class="ghost-button" type="button" @click="logout">Выйти</button>
        </div>
      </header>
      <div class="admin-content">
        <aside class="admin-sidebar">
          <section class="panel">
            <div class="panel-header">
              <h2>Существующие группы</h2>
              <span v-if="groups.length" class="panel-meta">{{ groups.length }}</span>
            </div>
            <div class="panel-body">
              <p v-if="groupsLoading" class="muted">Загрузка групп...</p>
              <p v-else-if="groupsError" class="form-error">{{ groupsError }}</p>
              <ul v-else class="group-list">
                <li
                  v-for="group in groups"
                  :key="group.id"
                  :class="['group-list-item', { active: group.id === selectedGroupId }]"
                >
                  <button type="button" @click="handleSelectGroup(group.id)">
                    <span class="group-list-item__title">{{ group.title }}</span>
                    <span class="group-list-item__meta">
                      {{ group.cardsCount ?? 0 }} карточ{{ getCardWord(group.cardsCount ?? 0) }}
                    </span>
                  </button>
                </li>
              </ul>
              <p v-if="!groupsLoading && !groups.length" class="muted">Группы ещё не созданы.</p>
            </div>
          </section>
          <section class="panel">
            <div class="panel-header">
              <h2>Новая группа</h2>
            </div>
            <form class="panel-body form-vertical" @submit.prevent="createGroup">
              <label class="form-field">
                <span>Название</span>
                <input v-model.trim="newGroupForm.title" type="text" required />
              </label>
              <label class="form-field">
                <span>Описание</span>
                <textarea v-model.trim="newGroupForm.description" rows="3"></textarea>
              </label>
              <button class="primary-button" type="submit" :disabled="newGroupSaving">
                {{ newGroupSaving ? 'Создание...' : 'Создать группу' }}
              </button>
            </form>
          </section>
        </aside>
        <main class="admin-main">
          <section v-if="activeGroupLoading" class="panel">
            <div class="panel-body">
              <p class="muted">Загрузка данных группы...</p>
            </div>
          </section>
          <section v-else-if="activeGroupError" class="panel">
            <div class="panel-body">
              <p class="form-error">{{ activeGroupError }}</p>
              <button class="ghost-button" type="button" @click="retryActiveGroup">Повторить</button>
            </div>
          </section>
          <div v-else-if="activeGroup" class="panel-grid">
            <section class="panel">
              <div class="panel-header">
                <h2>Настройки группы</h2>
              </div>
              <form class="panel-body form-vertical" @submit.prevent="saveGroupDetails">
                <label class="form-field">
                  <span>Название</span>
                  <input v-model.trim="groupForm.title" type="text" required />
                </label>
                <label class="form-field">
                  <span>Описание</span>
                  <textarea v-model.trim="groupForm.description" rows="4"></textarea>
                </label>
                <div class="panel-footer">
                  <button class="primary-button" type="submit" :disabled="groupSaving || groupDeleting">
                    {{ groupSaving ? 'Сохранение...' : 'Сохранить группу' }}
                  </button>
                  <button
                    class="danger-button"
                    type="button"
                    @click="deleteGroup"
                    :disabled="groupDeleting || groupSaving"
                  >
                    {{ groupDeleting ? 'Удаление...' : 'Удалить группу' }}
                  </button>
                </div>
              </form>
            </section>
            <section class="panel">
              <div class="panel-header">
                <h2>Карточки</h2>
                <p class="panel-subtitle">
                  Каждый ряд: слово;пример;перевод;ссылка_на_изображение (изображение можно не указывать)
                </p>
              </div>
              <div class="panel-body form-vertical">
                <label class="form-field">
                  <span>Содержимое</span>
                  <textarea v-model="cardsText" rows="16" spellcheck="false"></textarea>
                </label>
                <div class="panel-footer">
                  <button class="primary-button" type="button" @click="saveCards" :disabled="cardsSaving">
                    {{ cardsSaving ? 'Сохранение...' : 'Сохранить карточки' }}
                  </button>
                </div>
              </div>
            </section>
          </div>
          <section v-else class="panel">
            <div class="panel-body">
              <p class="muted">Выберите группу в списке, чтобы отредактировать её содержимое.</p>
            </div>
          </section>
        </main>
      </div>
      <transition name="fade">
        <div v-if="feedback.message" :class="['admin-feedback', feedback.type && `is-${feedback.type}`]">
          {{ feedback.message }}
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';

const ADMIN_LOGIN = 'admin';
const ADMIN_PASSWORD = 'adminadmin';
const STORAGE_KEY = 'kartica-admin-authenticated';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

const buildApiUrl = (path, params = {}) => {
  const url = new URL(path, `${apiBaseUrl}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
};

const username = ref('');
const password = ref('');
const loginError = ref('');
const isAuthenticated = ref(false);

const storage = typeof window !== 'undefined' ? window.localStorage : null;

const groups = ref([]);
const groupsLoading = ref(false);
const groupsError = ref('');
const selectedGroupId = ref(null);

const activeGroup = ref(null);
const activeGroupLoading = ref(false);
const activeGroupError = ref('');

const groupForm = reactive({ title: '', description: '' });
const groupSaving = ref(false);
const groupDeleting = ref(false);

const cardsText = ref('');
const cardsSaving = ref(false);

const newGroupForm = reactive({ title: '', description: '' });
const newGroupSaving = ref(false);

const feedback = reactive({ type: '', message: '' });
let feedbackTimer = null;

const getCardWord = (count) => {
  const normalized = Number.isFinite(count) ? count : 0;
  const mod100 = normalized % 100;
  const mod10 = normalized % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'ек';
  if (mod10 === 1) return 'ка';
  if (mod10 >= 2 && mod10 <= 4) return 'ки';
  return 'ек';
};

const showFeedback = (type, message) => {
  feedback.type = type;
  feedback.message = message;
  if (feedbackTimer) {
    clearTimeout(feedbackTimer);
  }
  if (message) {
    feedbackTimer = setTimeout(() => {
      feedback.type = '';
      feedback.message = '';
      feedbackTimer = null;
    }, 4000);
  }
};

const parseErrorResponse = async (response) => {
  try {
    const data = await response.json();
    if (data && typeof data === 'object' && data.error) {
      return data.error;
    }
  } catch (error) {
    // ignore
  }
  return `Запрос завершился с ошибкой ${response.status}`;
};

const resetActiveGroup = () => {
  activeGroup.value = null;
  activeGroupLoading.value = false;
  activeGroupError.value = '';
  selectedGroupId.value = null;
  groupForm.title = '';
  groupForm.description = '';
  cardsText.value = '';
};

const formatCardsText = (cards = []) =>
  cards
    .map((card) => {
      const example = card.example || '';
      const translation = card.definition || card.translation || '';
      const fields = [card.term || '', example, translation];
      const image = card.image || '';
      if (image) {
        fields.push(image);
      }
      return fields.join(';');
    })
    .join('\n');

const parseCardsText = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length);

  return lines.map((line, index) => {
    const parts = line.split(';').map((part) => part.trim());
    if (parts.length < 3) {
      throw new Error(`Строка ${index + 1}: ожидается минимум 3 поля через «;»`);
    }
    const [termRaw, exampleRaw = '', translationRaw = '', ...rest] = parts;
    const term = termRaw.trim();
    const translation = translationRaw.trim();
    const example = exampleRaw.trim();
    const image = rest.join(';').trim();

    if (!term) {
      throw new Error(`Строка ${index + 1}: не указано слово`);
    }
    if (!translation) {
      throw new Error(`Строка ${index + 1}: не указан перевод`);
    }

    return {
      term,
      example,
      translation,
      image: image || '',
    };
  });
};

const updateGroupInList = (updated) => {
  if (!updated || typeof updated !== 'object') return;
  const index = groups.value.findIndex((group) => group.id === updated.id);
  const cardsCount =
    updated.cardsCount !== undefined
      ? updated.cardsCount
      : Array.isArray(updated.cards)
      ? updated.cards.length
      : undefined;
  const normalized = {
    ...(index >= 0 ? groups.value[index] : {}),
    ...updated,
  };
  if (cardsCount !== undefined) {
    normalized.cardsCount = cardsCount;
  }
  if (index >= 0) {
    groups.value.splice(index, 1, normalized);
  } else {
    groups.value.unshift(normalized);
  }
};

const removeGroupFromList = (groupId) => {
  const index = groups.value.findIndex((group) => group.id === groupId);
  if (index >= 0) {
    groups.value.splice(index, 1);
  }
};

const fetchGroups = async () => {
  groupsLoading.value = true;
  groupsError.value = '';
  try {
    const response = await fetch(buildApiUrl('/groups', { page: 1, pageSize: 200 }));
    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }
    const data = await response.json();
    if (!data || !Array.isArray(data.data)) {
      throw new Error('Некорректный ответ сервера при загрузке групп');
    }
    groups.value = data.data;
    if (selectedGroupId.value) {
      const stillExists = data.data.some((group) => group.id === selectedGroupId.value);
      if (!stillExists) {
        resetActiveGroup();
      }
    }
  } catch (error) {
    console.error('Failed to load groups', error);
    groupsError.value = error.message || 'Не удалось загрузить список групп';
  } finally {
    groupsLoading.value = false;
  }
};

const fetchGroupDetails = async (groupId) => {
  activeGroupLoading.value = true;
  activeGroupError.value = '';
  try {
    const response = await fetch(buildApiUrl(`/groups/${groupId}`));
    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }
    const data = await response.json();
    activeGroup.value = data;
    groupForm.title = data.title || '';
    groupForm.description = data.description || '';
    cardsText.value = formatCardsText(data.cards || []);
    updateGroupInList({
      id: data.id,
      title: data.title,
      description: data.description,
      cardsCount: Array.isArray(data.cards) ? data.cards.length : undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  } catch (error) {
    console.error('Failed to load group details', error);
    activeGroupError.value = error.message || 'Не удалось загрузить данные группы';
  } finally {
    activeGroupLoading.value = false;
  }
};

const handleSelectGroup = async (groupId) => {
  if (!groupId) return;
  if (selectedGroupId.value === groupId && activeGroup.value) return;
  selectedGroupId.value = groupId;
  await fetchGroupDetails(groupId);
};

const handleLogin = () => {
  loginError.value = '';
  if (username.value.trim() !== ADMIN_LOGIN || password.value !== ADMIN_PASSWORD) {
    loginError.value = 'Неверный логин или пароль';
    return;
  }
  isAuthenticated.value = true;
  storage?.setItem(STORAGE_KEY, '1');
  showFeedback('success', 'Вы успешно вошли в админку');
  fetchGroups();
};

const logout = () => {
  isAuthenticated.value = false;
  storage?.removeItem(STORAGE_KEY);
  resetActiveGroup();
  username.value = '';
  password.value = '';
  showFeedback('success', 'Вы вышли из админки');
};

const createGroup = async () => {
  if (!newGroupForm.title.trim()) {
    showFeedback('error', 'Введите название группы');
    return;
  }
  newGroupSaving.value = true;
  try {
    const response = await fetch(buildApiUrl('/groups'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newGroupForm.title.trim(),
        description: newGroupForm.description.trim(),
      }),
    });
    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }
    const data = await response.json();
    updateGroupInList(data);
    newGroupForm.title = '';
    newGroupForm.description = '';
    showFeedback('success', 'Группа создана');
    await handleSelectGroup(data.id);
  } catch (error) {
    console.error('Failed to create group', error);
    showFeedback('error', error.message || 'Не удалось создать группу');
  } finally {
    newGroupSaving.value = false;
  }
};

const saveGroupDetails = async () => {
  if (!activeGroup.value) return;
  if (!groupForm.title.trim()) {
    showFeedback('error', 'Название группы не может быть пустым');
    return;
  }
  groupSaving.value = true;
  try {
    const response = await fetch(buildApiUrl(`/groups/${activeGroup.value.id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: groupForm.title.trim(),
        description: groupForm.description.trim(),
      }),
    });
    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }
    const data = await response.json();
    activeGroup.value = { ...activeGroup.value, ...data };
    updateGroupInList(data);
    showFeedback('success', 'Данные группы сохранены');
  } catch (error) {
    console.error('Failed to update group', error);
    showFeedback('error', error.message || 'Не удалось сохранить группу');
  } finally {
    groupSaving.value = false;
  }
};

const deleteGroup = async () => {
  if (!activeGroup.value) return;
  const groupId = activeGroup.value.id;
  const confirmationMessage = `Удалить группу «${activeGroup.value.title || 'Без названия'}»?`;
  const confirmed =
    typeof window === 'undefined' ? true : window.confirm(`${confirmationMessage}\nЭто действие нельзя отменить.`);
  if (!confirmed) {
    return;
  }

  groupDeleting.value = true;
  try {
    const response = await fetch(buildApiUrl(`/groups/${groupId}`), { method: 'DELETE' });
    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }

    removeGroupFromList(groupId);
    resetActiveGroup();
    showFeedback('success', 'Группа удалена');
    await fetchGroups();
  } catch (error) {
    console.error('Failed to delete group', error);
    showFeedback('error', error.message || 'Не удалось удалить группу');
  } finally {
    groupDeleting.value = false;
  }
};

const saveCards = async () => {
  if (!activeGroup.value) return;
  cardsSaving.value = true;
  try {
    const parsedCards = parseCardsText(cardsText.value);
    const response = await fetch(buildApiUrl(`/groups/${activeGroup.value.id}/cards`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cards: parsedCards.map((card) => ({
          term: card.term,
          example: card.example,
          translation: card.translation,
          image: card.image ? card.image : null,
        })),
      }),
    });
    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }
    const data = await response.json();
    activeGroup.value = data;
    cardsText.value = formatCardsText(data.cards || []);
    updateGroupInList({
      id: data.id,
      title: data.title,
      description: data.description,
      cardsCount: Array.isArray(data.cards) ? data.cards.length : undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
    showFeedback('success', 'Карточки сохранены');
  } catch (error) {
    console.error('Failed to save cards', error);
    showFeedback('error', error.message || 'Не удалось сохранить карточки');
  } finally {
    cardsSaving.value = false;
  }
};

const retryActiveGroup = () => {
  if (selectedGroupId.value) {
    fetchGroupDetails(selectedGroupId.value);
  }
};

const restoreSession = () => {
  try {
    const stored = storage?.getItem(STORAGE_KEY);
    if (stored === '1') {
      isAuthenticated.value = true;
      fetchGroups();
    }
  } catch (error) {
    console.warn('Не удалось восстановить сессию администратора', error);
  }
};

onMounted(() => {
  restoreSession();
});

onBeforeUnmount(() => {
  if (feedbackTimer) {
    clearTimeout(feedbackTimer);
  }
});
</script>

<style scoped>
.admin-app {
  min-height: 100vh;
  background: #f3f4f6;
  color: #111827;
}

.admin-auth {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: linear-gradient(135deg, #0f172a, #1e293b);
}

.admin-auth-card {
  width: 100%;
  max-width: 420px;
  background: #ffffff;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.25);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.admin-auth-card h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  color: #0f172a;
}

.admin-dashboard {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.admin-header {
  padding: 24px 40px 16px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.admin-header__titles h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #111827;
}

.admin-header__titles p {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 15px;
}

.admin-header__actions {
  display: flex;
  gap: 12px;
}

.admin-content {
  flex: 1;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
  padding: 0 40px 40px;
  box-sizing: border-box;
}

.admin-sidebar {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.admin-main {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.panel {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.panel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
}

.panel-header {
  padding: 20px 24px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.panel-subtitle {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
}

.panel-meta {
  font-size: 14px;
  color: #6b7280;
}

.panel-body {
  padding: 16px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-footer {
  padding-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.form-vertical {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
}

.form-field input,
.form-field textarea {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #d1d5db;
  font-size: 15px;
  font-family: inherit;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.form-field input:focus,
.form-field textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
}

.form-error {
  color: #dc2626;
  font-size: 14px;
  margin: 0;
}

.muted {
  color: #6b7280;
  margin: 0;
}

.primary-button,
.ghost-button,
.danger-button {
  border: none;
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  font-family: inherit;
}

.primary-button {
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.35);
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: default;
  box-shadow: none;
}

.primary-button:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 32px rgba(37, 99, 235, 0.35);
}

.ghost-button {
  background: #f3f4f6;
  color: #1f2937;
  box-shadow: inset 0 0 0 1px #d1d5db;
}

.ghost-button:hover {
  background: #e5e7eb;
}

.ghost-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.danger-button {
  background: #dc2626;
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(220, 38, 38, 0.3);
}

.danger-button:disabled {
  opacity: 0.6;
  cursor: default;
  box-shadow: none;
}

.danger-button:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 32px rgba(220, 38, 38, 0.3);
  background: #b91c1c;
}

.group-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  margin: 0;
  max-height: 420px;
  overflow-y: auto;
}

.group-list-item button {
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  padding: 12px 14px;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: background 0.2s ease;
}

.group-list-item button:hover {
  background: #eef2ff;
}

.group-list-item.active button {
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.4);
}

.group-list-item__title {
  font-weight: 600;
}

.group-list-item__meta {
  font-size: 13px;
  opacity: 0.8;
}

textarea {
  resize: vertical;
  min-height: 160px;
  font-family: 'Fira Code', 'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
}

.admin-feedback {
  position: fixed;
  right: 32px;
  bottom: 32px;
  padding: 16px 22px;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.2);
  background: #1f2937;
  color: #ffffff;
  font-weight: 600;
  max-width: 360px;
}

.admin-feedback.is-success {
  background: #047857;
}

.admin-feedback.is-error {
  background: #dc2626;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 1280px) {
  .admin-content {
    grid-template-columns: 280px 1fr;
    padding: 0 24px 32px;
  }
}

@media (max-width: 960px) {
  .admin-content {
    grid-template-columns: 1fr;
  }

  .admin-sidebar {
    order: 2;
  }

  .admin-main {
    order: 1;
  }
}
</style>
