<template>
  <section class="card">
    <h2 class="card__title">Учите слова легко</h2>
    <p class="card__text">
      Kartica — мини-приложение для Telegram, которое помогает пополнять словарный запас
      и тренироваться каждый день. Мы готовим карточки, напоминания и индивидуальную
      подборку заданий.
    </p>
    <p class="card__text">
      Используйте навигацию сверху, чтобы перейти в профиль и проверить подключение к
      API, как только он будет готов.
    </p>
  </section>
</template>

<style scoped>
.card {
  background: var(--card-background);
  border-radius: 1.5rem;
  padding: clamp(1.75rem, 4vw, 2.5rem);
  max-width: 640px;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.2);
  display: grid;
  gap: 1rem;
}

.card__title {
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  margin: 0;
}

.card__text {
  font-size: 1.05rem;
  line-height: 1.65;
  margin: 0;
  color: var(--app-text-secondary);
}
</style>
