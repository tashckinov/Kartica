<template>
  <div class="admin-app">
    <div v-if="!isAuthenticated" class="admin-auth">
      <div class="admin-auth-card">
        <h1>Доступ к админке</h1>
        <p class="muted">
          Создайте ссылку для редактирования в профиле приложения и откройте её в браузере.
        </p>
        <p class="muted">
          Ссылка имеет формат <code>/admin?token=…</code> и действует 12 часов.
        </p>
        <p v-if="tokenCheckPending" class="muted pending-message">Проверяем токен…</p>
        <p v-if="authError" class="form-error">{{ authError }}</p>
        <form class="token-form" @submit.prevent="submitManualToken">
          <label class="form-field">
            <span>Токен доступа</span>
            <input
              v-model.trim="manualToken"
              type="text"
              name="admin-token"
              autocomplete="off"
              placeholder="Вставьте токен из ссылки"
              :disabled="tokenCheckPending"
            />
          </label>
          <button class="primary-button" type="submit" :disabled="tokenCheckPending">
            {{ tokenCheckPending ? 'Проверяем…' : 'Подтвердить токен' }}
          </button>
        </form>
        <p v-if="manualTokenError" class="form-error">{{ manualTokenError }}</p>
        <p class="muted small">
          Если вы только что открыли ссылку с токеном, авторизация произойдёт автоматически. После входа
          токен сохранится в браузере до истечения срока действия.
        </p>
      </div>
    </div>
    <div v-else class="admin-dashboard">
      <header class="admin-header">
        <div class="admin-header__titles">
          <h1>Панель администратора</h1>
          <p>Управление группами и карточками</p>
          <p v-if="adminUserLabel" class="admin-header__user">Вы вошли как {{ adminUserLabel }}</p>
          <p v-if="tokenExpiryText" class="admin-header__user">{{ tokenExpiryText }}</p>
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
                  :class="[
                    'group-list-item',
                    {
                      active: group.id === selectedGroupId,
                      owned: isGroupOwnedByCurrentUser(group),
                    },
                  ]"
                >
                  <button
                    type="button"
                    @click="handleSelectGroup(group.id)"
                    :class="{ owned: isGroupOwnedByCurrentUser(group) }"
                  >
                    <div class="group-list-item__header">
                      <span class="group-list-item__title">{{ group.title }}</span>
                      <span v-if="isGroupOwnedByCurrentUser(group)" class="group-list-item__badge">Моя</span>
                    </div>
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
          <section class="panel">
            <div class="panel-header">
              <h2>Токен владельца</h2>
            </div>
            <div class="panel-body">
              <p class="muted">
                Токен владельца подтверждает доступ к созданным группам. Обновите его и сохраните вместе с секретом,
                чтобы выпускать новые ссылки из профиля.
              </p>
              <div class="claim-token-box" :data-empty="ownerClaimToken ? 'false' : 'true'">
                <code v-if="ownerClaimToken" class="claim-token-value">{{ ownerClaimToken }}</code>
                <span v-else class="claim-token-empty">Токен ещё не получен.</span>
              </div>
              <div class="claim-token-actions">
                <button
                  class="ghost-button"
                  type="button"
                  @click="refreshOwnerClaimToken({ force: true, silent: false })"
                  :disabled="claimTokenLoading"
                >
                  {{ claimTokenLoading ? 'Обновляем…' : 'Обновить токен' }}
                </button>
                <button
                  class="ghost-button"
                  type="button"
                  @click="copyOwnerClaimToken"
                  :disabled="!ownerClaimToken"
                >
                  {{ claimTokenCopyState.copied ? 'Скопировано!' : 'Скопировать' }}
                </button>
              </div>
              <p v-if="claimTokenError" class="form-error">{{ claimTokenError }}</p>
              <p v-if="claimTokenCopyState.error" class="form-error">{{ claimTokenCopyState.error }}</p>
            </div>
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
                <p v-if="activeGroupOwnershipText" class="muted ownership-note">
                  {{ activeGroupOwnershipText }}
                </p>
                <label class="form-field">
                  <span>Название</span>
                  <input v-model.trim="groupForm.title" type="text" required :disabled="!canEditActiveGroup" />
                </label>
                <label class="form-field">
                  <span>Описание</span>
                  <textarea
                    v-model.trim="groupForm.description"
                    rows="4"
                    :disabled="!canEditActiveGroup"
                  ></textarea>
                </label>
                <div class="panel-footer">
                  <button
                    class="primary-button"
                    type="submit"
                    :disabled="groupSaving || groupDeleting || !canEditActiveGroup"
                  >
                    {{ groupSaving ? 'Сохранение...' : 'Сохранить группу' }}
                  </button>
                  <button
                    class="danger-button"
                    type="button"
                    @click="deleteGroup"
                    :disabled="groupDeleting || groupSaving || !canEditActiveGroup"
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
                <p v-if="!canEditActiveGroup" class="ownership-note ownership-note--warning">
                  {{ OWNERSHIP_ERROR_MESSAGE }}
                </p>
                <label class="form-field">
                  <span>Содержимое</span>
                  <textarea
                    v-model="cardsText"
                    rows="16"
                    spellcheck="false"
                    :disabled="!canEditActiveGroup"
                  ></textarea>
                </label>
                <div class="panel-footer">
                  <button
                    class="primary-button"
                    type="button"
                    @click="saveCards"
                    :disabled="cardsSaving || !canEditActiveGroup"
                  >
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
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { apiBaseUrl } from './apiConfig.js';

const OWNERSHIP_ERROR_MESSAGE = 'Вы можете изменять только созданные вами группы';

const ADMIN_TOKEN_STORAGE_KEY = 'karticaAdminToken';
const ADMIN_TOKEN_EXPIRES_AT_KEY = 'karticaAdminTokenExpiresAt';
const ADMIN_IDENTITY_STORAGE_KEY = 'kartica-admin-identity';
const ADMIN_IDENTITY_ID_MAX_LENGTH = 128;
const ADMIN_IDENTITY_NAME_MAX_LENGTH = 120;
const ADMIN_IDENTITY_SECRET_MAX_LENGTH = 512;

const isAuthenticated = ref(false);
const adminUser = ref(null);
const adminToken = ref('');
const tokenExpiresAt = ref(null);
const authError = ref('');
const tokenCheckPending = ref(false);
const manualToken = ref('');
const manualTokenError = ref('');

const ownerClaimToken = ref('');
const claimTokenLoading = ref(false);
const claimTokenError = ref('');
const claimTokenCopyState = reactive({ copied: false, error: '' });

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

const currentUserId = computed(() => {
  const id = adminUser.value?.id ?? adminUser.value?.user?.id;
  if (id === undefined || id === null || id === '') {
    return '';
  }
  return typeof id === 'string' ? id.trim() : String(id).trim();
});

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

const sanitizeIdentitySecret = (value) => {
  if (value === undefined || value === null) {
    return '';
  }
  const stringValue = typeof value === 'string' ? value : String(value);
  const trimmed = stringValue.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.length > ADMIN_IDENTITY_SECRET_MAX_LENGTH) {
    return trimmed.slice(0, ADMIN_IDENTITY_SECRET_MAX_LENGTH);
  }
  return trimmed;
};

const readStoredAdminIdentity = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(ADMIN_IDENTITY_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return {
      id: sanitizeIdentityString(parsed?.id, ADMIN_IDENTITY_ID_MAX_LENGTH),
      displayName: sanitizeIdentityString(parsed?.displayName, ADMIN_IDENTITY_NAME_MAX_LENGTH),
      secret: sanitizeIdentitySecret(parsed?.secret),
      claimToken: sanitizeIdentitySecret(parsed?.claimToken),
    };
  } catch (error) {
    console.warn('Не удалось прочитать сохранённый профиль автора', error);
    return null;
  }
};

const writeStoredAdminIdentity = (payload) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(
      ADMIN_IDENTITY_STORAGE_KEY,
      JSON.stringify({
        id: sanitizeIdentityString(payload?.id, ADMIN_IDENTITY_ID_MAX_LENGTH),
        displayName: sanitizeIdentityString(payload?.displayName, ADMIN_IDENTITY_NAME_MAX_LENGTH),
        secret: sanitizeIdentitySecret(payload?.secret),
        claimToken: sanitizeIdentitySecret(payload?.claimToken),
      }),
    );
  } catch (error) {
    console.warn('Не удалось сохранить данные автора', error);
  }
};

const updateStoredAdminIdentity = (updates = {}) => {
  const current = readStoredAdminIdentity();
  const payload = {
    id: updates.id !== undefined ? updates.id : current?.id,
    displayName: updates.displayName !== undefined ? updates.displayName : current?.displayName,
    secret: updates.secret !== undefined ? updates.secret : current?.secret,
    claimToken: updates.claimToken !== undefined ? updates.claimToken : current?.claimToken,
  };
  writeStoredAdminIdentity(payload);
  return readStoredAdminIdentity();
};

const loadOwnerClaimTokenFromStorage = () => {
  const stored = readStoredAdminIdentity();
  ownerClaimToken.value = stored?.claimToken || '';
};

const persistOwnerClaimToken = (claimToken) => {
  const sanitized = sanitizeIdentitySecret(claimToken);
  const updated = updateStoredAdminIdentity({
    id: currentUserId.value || undefined,
    displayName: adminUser.value?.displayName || adminUser.value?.name || undefined,
    claimToken: sanitized,
  });
  ownerClaimToken.value = updated?.claimToken || sanitized || '';
};

const refreshOwnerClaimToken = async ({ force = false, silent = false } = {}) => {
  if (!force && ownerClaimToken.value) {
    return ownerClaimToken.value;
  }

  claimTokenLoading.value = true;
  if (!silent) {
    claimTokenError.value = '';
  }

  try {
    const response = await fetch(buildApiUrl('/auth/claim-token'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...createAuthHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }

    const data = await response.json();
    if (!data || typeof data.claimToken !== 'string' || !data.claimToken.trim()) {
      throw new Error('Сервер не вернул токен владельца.');
    }

    persistOwnerClaimToken(data.claimToken);
    claimTokenError.value = '';

    if (!silent) {
      showFeedback('success', 'Токен владельца обновлён');
    }

    return ownerClaimToken.value;
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Не удалось обновить токен владельца';
    if (!silent) {
      claimTokenError.value = message;
      showFeedback('error', message);
    } else {
      console.warn('Failed to refresh claim token', error);
    }
    throw error;
  } finally {
    claimTokenLoading.value = false;
  }
};

const copyOwnerClaimToken = async () => {
  claimTokenCopyState.error = '';
  if (!ownerClaimToken.value) {
    return;
  }
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(ownerClaimToken.value);
      claimTokenCopyState.copied = true;
      setTimeout(() => {
        claimTokenCopyState.copied = false;
      }, 2000);
    } else {
      throw new Error('Clipboard API недоступен');
    }
  } catch (error) {
    console.warn('Failed to copy claim token', error);
    claimTokenCopyState.error = 'Не удалось скопировать токен. Скопируйте его вручную.';
    claimTokenCopyState.copied = false;
  }
};

const buildApiUrl = (path, params = {}) => {
  const url = new URL(path, `${apiBaseUrl}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
};

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

const resetActiveGroup = () => {
  activeGroup.value = null;
  activeGroupLoading.value = false;
  activeGroupError.value = '';
  selectedGroupId.value = null;
  groupForm.title = '';
  groupForm.description = '';
  cardsText.value = '';
};

const clearStoredToken = () => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch (error) {
    console.warn('Не удалось удалить сохранённый токен администратора', error);
  }
  try {
    window.localStorage.removeItem(ADMIN_TOKEN_EXPIRES_AT_KEY);
  } catch (error) {
    console.warn('Не удалось удалить срок действия токена администратора', error);
  }
  tokenExpiresAt.value = null;
};

const storeToken = (token, expiresAt) => {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
    } catch (error) {
      console.warn('Не удалось сохранить токен администратора', error);
    }
    try {
      if (typeof expiresAt === 'number' && Number.isFinite(expiresAt)) {
        window.localStorage.setItem(ADMIN_TOKEN_EXPIRES_AT_KEY, String(expiresAt));
      } else {
        window.localStorage.removeItem(ADMIN_TOKEN_EXPIRES_AT_KEY);
      }
    } catch (error) {
      console.warn('Не удалось сохранить срок действия токена администратора', error);
    }
  }
  tokenExpiresAt.value = typeof expiresAt === 'number' ? expiresAt : null;
};

const loadStoredToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const token = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    if (!token) {
      return null;
    }
    const expiresRaw = window.localStorage.getItem(ADMIN_TOKEN_EXPIRES_AT_KEY);
    const expiresAtValue = expiresRaw ? Number(expiresRaw) : null;
    if (expiresAtValue && Number.isFinite(expiresAtValue) && expiresAtValue <= Date.now()) {
      clearStoredToken();
      return null;
    }
    return { token, expiresAt: expiresAtValue };
  } catch (error) {
    console.warn('Не удалось прочитать сохранённый токен администратора', error);
    return null;
  }
};

const createAuthHeaders = (tokenOverride) => {
  const token = tokenOverride || adminToken.value;
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
};

const clearAuthState = () => {
  clearStoredToken();
  isAuthenticated.value = false;
  adminUser.value = null;
  adminToken.value = '';
  authError.value = '';
  manualTokenError.value = '';
  groups.value = [];
  groupsError.value = '';
  resetActiveGroup();
};

const isGroupOwnedByCurrentUser = (group) => {
  if (!group || typeof group !== 'object') {
    return false;
  }
  const ownerRaw = group.ownerId ?? group.owner_id;
  if (ownerRaw === undefined || ownerRaw === null || ownerRaw === '') {
    return false;
  }
  return String(ownerRaw).trim() === currentUserId.value;
};

const canEditActiveGroup = computed(() => isGroupOwnedByCurrentUser(activeGroup.value));

const activeGroupOwnershipText = computed(() => {
  const group = activeGroup.value;
  if (!group) {
    return '';
  }
  const ownerIdRaw = group.ownerId ?? group.owner_id ?? '';
  const ownerId = typeof ownerIdRaw === 'string' ? ownerIdRaw.trim() : String(ownerIdRaw ?? '').trim();
  if (!ownerId) {
    return 'Группа создана до появления авторов и доступна только для чтения.';
  }
  if (canEditActiveGroup.value) {
    return 'Вы создали эту группу и можете её редактировать.';
  }
  return `Группа создана другим пользователем (ID ${ownerId}). Редактирование недоступно.`;
});

const adminUserLabel = computed(() => {
  if (!adminUser.value) {
    return '';
  }
  const displayName =
    adminUser.value.displayName ??
    adminUser.value.name ??
    adminUser.value.user?.displayName ??
    adminUser.value.user?.name ??
    '';
  const firstName = adminUser.value.first_name ?? adminUser.value.firstName ?? adminUser.value.user?.first_name ?? '';
  const lastName = adminUser.value.last_name ?? adminUser.value.lastName ?? adminUser.value.user?.last_name ?? '';
  const username = adminUser.value.username ?? adminUser.value.user?.username ?? '';
  const id = adminUser.value.id ?? adminUser.value.user?.id;
  if (displayName && typeof displayName === 'string' && displayName.trim()) {
    const trimmed = displayName.trim();
    if (username) {
      return `${trimmed} (@${username})`;
    }
    return trimmed;
  }
  const parts = [firstName, lastName]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);
  if (parts.length) {
    if (username) {
      return `${parts.join(' ')} (@${username})`;
    }
    return parts.join(' ');
  }
  if (username) {
    return `@${username}`;
  }
  if (id) {
    return `ID ${id}`;
  }
  return '';
});

const tokenExpiryText = computed(() => {
  if (!tokenExpiresAt.value) {
    return '';
  }
  const remainingMs = tokenExpiresAt.value - Date.now();
  if (remainingMs <= 0) {
    return 'Токен истёк — получите новую ссылку в профиле.';
  }
  const totalMinutes = Math.floor(remainingMs / 60000);
  if (totalMinutes >= 180) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes > 0) {
      return `Токен действует ещё примерно ${hours} ч ${minutes} мин.`;
    }
    return `Токен действует ещё примерно ${hours} ч.`;
  }
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `Токен действует ещё примерно ${hours} ч ${minutes} мин.`;
  }
  const minutes = Math.max(totalMinutes, 1);
  return `Токен действует ещё примерно ${minutes} мин.`;
});

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
  const ownerId = updated.ownerId ?? updated.owner_id;
  if (ownerId !== undefined) {
    normalized.ownerId = ownerId ?? null;
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

const handleUnauthorized = () => {
  const message = 'Токен доступа недействителен или истёк. Получите новую ссылку в профиле.';
  clearAuthState();
  authError.value = message;
  showFeedback('error', message);
  return message;
};

const parseErrorResponse = async (response) => {
  if (response.status === 401) {
    return handleUnauthorized();
  }
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

const fetchGroups = async () => {
  groupsLoading.value = true;
  groupsError.value = '';
  try {
    const response = await fetch(buildApiUrl('/groups', { page: 1, pageSize: 200 }), {
      headers: {
        ...createAuthHeaders(),
      },
    });
    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }
    const data = await response.json();
    if (!data || !Array.isArray(data.data)) {
      throw new Error('Некорректный ответ сервера при загрузке групп');
    }
    groups.value = data.data.map((group) => ({
      ...group,
      ownerId: group.ownerId ?? group.owner_id ?? null,
    }));
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
    const response = await fetch(buildApiUrl(`/groups/${groupId}`), {
      headers: {
        ...createAuthHeaders(),
      },
    });
    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }
    const data = await response.json();
    const normalized = {
      ...data,
      ownerId: data.ownerId ?? data.owner_id ?? null,
    };
    activeGroup.value = normalized;
    groupForm.title = normalized.title || '';
    groupForm.description = normalized.description || '';
    cardsText.value = formatCardsText(normalized.cards || []);
    updateGroupInList({
      id: normalized.id,
      title: normalized.title,
      description: normalized.description,
      cardsCount: Array.isArray(normalized.cards) ? normalized.cards.length : undefined,
      ownerId: normalized.ownerId,
      createdAt: normalized.createdAt,
      updatedAt: normalized.updatedAt,
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

const createGroup = async () => {
  if (newGroupSaving.value) return;
  const title = newGroupForm.title.trim();
  const description = newGroupForm.description.trim();
  if (!title) {
    showFeedback('error', 'Укажите название группы');
    return;
  }
  newGroupSaving.value = true;
  try {
    const response = await fetch(buildApiUrl('/groups'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...createAuthHeaders(),
      },
      body: JSON.stringify({ title, description }),
    });
    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }
    const data = await response.json();
    updateGroupInList(data);
    newGroupForm.title = '';
    newGroupForm.description = '';
    showFeedback('success', 'Группа создана');
  } catch (error) {
    console.error('Failed to create group', error);
    showFeedback('error', error.message || 'Не удалось создать группу');
  } finally {
    newGroupSaving.value = false;
  }
};

const saveGroupDetails = async () => {
  if (!activeGroup.value) return;
  if (!canEditActiveGroup.value) {
    showFeedback('error', OWNERSHIP_ERROR_MESSAGE);
    return;
  }
  groupSaving.value = true;
  try {
    const response = await fetch(buildApiUrl(`/groups/${activeGroup.value.id}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...createAuthHeaders(),
      },
      body: JSON.stringify({
        title: groupForm.title,
        description: groupForm.description,
      }),
    });
    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }
    const data = await response.json();
    updateGroupInList(data);
    activeGroup.value = {
      ...activeGroup.value,
      ...data,
    };
    showFeedback('success', 'Группа обновлена');
  } catch (error) {
    console.error('Failed to save group', error);
    showFeedback('error', error.message || 'Не удалось сохранить группу');
  } finally {
    groupSaving.value = false;
  }
};

const deleteGroup = async () => {
  if (!activeGroup.value) return;
  if (!canEditActiveGroup.value) {
    showFeedback('error', OWNERSHIP_ERROR_MESSAGE);
    return;
  }
  if (typeof window !== 'undefined' && !window.confirm('Удалить группу и все её карточки?')) {
    return;
  }
  groupDeleting.value = true;
  try {
    const response = await fetch(buildApiUrl(`/groups/${activeGroup.value.id}`), {
      method: 'DELETE',
      headers: {
        ...createAuthHeaders(),
      },
    });
    if (!response.ok && response.status !== 204) {
      throw new Error(await parseErrorResponse(response));
    }
    removeGroupFromList(activeGroup.value.id);
    resetActiveGroup();
    showFeedback('success', 'Группа удалена');
  } catch (error) {
    console.error('Failed to delete group', error);
    showFeedback('error', error.message || 'Не удалось удалить группу');
  } finally {
    groupDeleting.value = false;
  }
};

const saveCards = async () => {
  if (!activeGroup.value) return;
  if (!canEditActiveGroup.value) {
    showFeedback('error', OWNERSHIP_ERROR_MESSAGE);
    return;
  }
  cardsSaving.value = true;
  try {
    const parsedCards = parseCardsText(cardsText.value);
    const response = await fetch(buildApiUrl(`/groups/${activeGroup.value.id}/cards`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...createAuthHeaders(),
      },
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
    const normalized = {
      ...data,
      ownerId: data.ownerId ?? data.owner_id ?? activeGroup.value?.ownerId ?? null,
    };
    activeGroup.value = normalized;
    cardsText.value = formatCardsText(normalized.cards || []);
    updateGroupInList({
      id: normalized.id,
      title: normalized.title,
      description: normalized.description,
      cardsCount: Array.isArray(normalized.cards) ? normalized.cards.length : undefined,
      ownerId: normalized.ownerId,
      createdAt: normalized.createdAt,
      updatedAt: normalized.updatedAt,
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

const extractTokenFromUrl = () => {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    const url = new URL(window.location.href);
    const searchToken = url.searchParams.get('token');
    if (searchToken) {
      return searchToken;
    }
  } catch (error) {
    // ignore URL parse errors
  }

  const { search, hash, pathname, href } = window.location;

  if (search) {
    const params = new URLSearchParams(search);
    const token = params.get('token');
    if (token) {
      return token;
    }
  }

  if (hash && hash.length > 1) {
    const hashParams = new URLSearchParams(hash.slice(1));
    const token = hashParams.get('token');
    if (token) {
      return token;
    }
  }

  const pathMatch = pathname.match(/&token=([^/?#]+)/i);
  if (pathMatch) {
    return decodeURIComponent(pathMatch[1]);
  }

  const hrefMatch = href.match(/[?&]token=([^&#]+)/i);
  if (hrefMatch) {
    return decodeURIComponent(hrefMatch[1]);
  }

  return '';
};

const stripTokenFromUrl = () => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    let pathname = url.pathname.replace(/&token=[^/?#]*/i, '');
    if (!pathname) {
      pathname = '/';
    }
    let hash = url.hash;
    if (hash && hash.includes('token=')) {
      const hashParams = new URLSearchParams(hash.slice(1));
      hashParams.delete('token');
      const normalized = hashParams.toString();
      hash = normalized ? `#${normalized}` : '';
    }
    const searchString = url.searchParams.toString();
    const search = searchString ? `?${searchString}` : '';
    const cleanedUrl = `${url.origin}${pathname}${search}${hash}`;
    window.history.replaceState({}, '', cleanedUrl);
  } catch (error) {
    const cleaned = window.location.href
      .replace(/([?&])token=[^&#]*&?/, '$1')
      .replace(/([?&])$/, '')
      .replace(/&token=[^#?]*/, '');
    window.history.replaceState({}, '', cleaned);
  }
};

const establishSession = async (token, options = {}) => {
  const { persist = true, silent = false } = options;
  if (!token) {
    if (!silent) {
      authError.value = 'Укажите токен доступа.';
    }
    return false;
  }
  if (!silent) {
    tokenCheckPending.value = true;
    authError.value = '';
    manualTokenError.value = '';
  }
  try {
    const response = await fetch(buildApiUrl('/auth/session'), {
      headers: {
        Accept: 'application/json',
        ...createAuthHeaders(token),
      },
    });
    if (!response.ok) {
      const message = await parseErrorResponse(response);
      if (!silent) {
        authError.value = message;
      }
      return false;
    }
    const data = await response.json();
    adminToken.value = token;
    isAuthenticated.value = true;
    adminUser.value = data?.user || null;
    const storedIdentity = updateStoredAdminIdentity({
      id: currentUserId.value || data?.user?.id || data?.user?.user?.id,
      displayName:
        data?.user?.displayName ||
        data?.user?.name ||
        data?.user?.user?.displayName ||
        data?.user?.user?.name ||
        undefined,
    });
    ownerClaimToken.value = storedIdentity?.claimToken || ownerClaimToken.value;
    const expiresAt =
      data && typeof data.expiresAt === 'number' && Number.isFinite(data.expiresAt)
        ? data.expiresAt
        : null;
    if (persist) {
      storeToken(token, expiresAt);
    } else {
      tokenExpiresAt.value = expiresAt;
    }
    authError.value = '';
    manualTokenError.value = '';
    if (!silent) {
      showFeedback('success', 'Доступ к админке открыт');
    }
    await fetchGroups();
    if (!ownerClaimToken.value) {
      try {
        await refreshOwnerClaimToken({ force: true, silent: true });
      } catch (error) {
        // already logged inside refreshOwnerClaimToken
      }
    }
    return true;
  } catch (error) {
    if (!silent) {
      authError.value =
        error instanceof Error && error.message
          ? error.message
          : 'Не удалось подтвердить токен. Попробуйте снова.';
    }
    return false;
  } finally {
    if (!silent) {
      tokenCheckPending.value = false;
    }
  }
};

const submitManualToken = async () => {
  manualTokenError.value = '';
  authError.value = '';
  const token = manualToken.value.trim();
  if (!token) {
    manualTokenError.value = 'Укажите токен, полученный в профиле.';
    return;
  }
  const success = await establishSession(token, { persist: true, silent: false });
  if (!success) {
    manualTokenError.value = authError.value || 'Не удалось подтвердить токен. Проверьте ссылку.';
  } else {
    manualToken.value = '';
  }
};

const logout = async () => {
  try {
    await fetch(buildApiUrl('/auth/logout'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...createAuthHeaders(),
      },
    });
  } catch (error) {
    console.warn('Failed to notify server about logout', error);
  } finally {
    showFeedback('success', 'Вы вышли из админки');
    clearAuthState();
  }
};

const initializeAuth = async () => {
  loadOwnerClaimTokenFromStorage();
  const tokenFromUrl = extractTokenFromUrl();
  if (tokenFromUrl) {
    const success = await establishSession(tokenFromUrl, { persist: true, silent: false });
    stripTokenFromUrl();
    if (!success) {
      manualToken.value = tokenFromUrl;
      manualTokenError.value = authError.value;
    }
    return;
  }
  const stored = loadStoredToken();
  if (stored?.token) {
    adminToken.value = stored.token;
    if (stored.expiresAt) {
      tokenExpiresAt.value = stored.expiresAt;
    }
    const success = await establishSession(stored.token, { persist: true, silent: true });
    if (!success) {
      clearAuthState();
    }
  }
};

onMounted(() => {
  initializeAuth();
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

.admin-auth-card code {
  display: inline-block;
  padding: 2px 6px;
  background: #f3f4f6;
  border-radius: 6px;
  font-size: 14px;
  color: #0f172a;
}

.token-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pending-message {
  color: #4b5563;
}

.muted.small {
  font-size: 14px;
  color: #6b7280;
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

.admin-header__user {
  margin: 4px 0 0;
  color: #4b5563;
  font-size: 14px;
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
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.12);
  overflow: hidden;
}

.panel-header {
  padding: 20px 24px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.panel-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-footer {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}

.panel-meta {
  font-size: 14px;
  color: #6366f1;
  font-weight: 600;
}

.panel-subtitle {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}

.form-vertical {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field input,
.form-field textarea {
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  font-size: 15px;
  background: #f9fafb;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.form-field input:focus,
.form-field textarea:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  background: #ffffff;
}

.claim-token-box {
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(99, 102, 241, 0.08);
  border: 1px dashed rgba(99, 102, 241, 0.3);
  font-family: 'Fira Code', 'JetBrains Mono', monospace;
  font-size: 14px;
  color: #1f2937;
  word-break: break-all;
}

.claim-token-box[data-empty='true'] {
  background: rgba(148, 163, 184, 0.12);
  border-color: rgba(148, 163, 184, 0.45);
  color: #6b7280;
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.claim-token-value {
  display: block;
}

.claim-token-empty {
  display: block;
  font-size: 14px;
}

.claim-token-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.primary-button,
.ghost-button,
.danger-button {
  padding: 12px 20px;
  border-radius: 12px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.primary-button {
  background: linear-gradient(135deg, #4f46e5, #2563eb);
  color: #ffffff;
  box-shadow: 0 12px 30px rgba(79, 70, 229, 0.35);
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.ghost-button {
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.5);
  color: #1f2937;
}

.ghost-button:hover:not(:disabled) {
  background: rgba(148, 163, 184, 0.12);
}

.danger-button {
  background: linear-gradient(135deg, #dc2626, #ef4444);
  color: #ffffff;
  box-shadow: 0 12px 30px rgba(220, 38, 38, 0.35);
}

.danger-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.group-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-list-item button {
  width: 100%;
  text-align: left;
  background: #f8fafc;
  border: 1px solid transparent;
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

.group-list-item.owned button {
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.25);
}

.group-list-item:not(.active) button.owned:hover {
  background: #e0ecff;
}

.group-list-item__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.group-list-item__title {
  font-weight: 600;
}

.group-list-item__badge {
  background: #2563eb;
  color: #ffffff;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
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

.form-error {
  color: #dc2626;
  font-size: 14px;
}

.muted {
  color: #6b7280;
}

.ownership-note {
  margin: 0;
  font-size: 14px;
}

.ownership-note--warning {
  color: #b45309;
  background: #fef3c7;
  padding: 10px 12px;
  border-radius: 10px;
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

  .admin-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
  }

  .admin-header__actions {
    width: 100%;
  }

  .admin-header__actions button {
    flex: 1;
  }
}
</style>
