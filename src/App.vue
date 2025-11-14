<template>
  <div class="app-shell">
    <header class="app-header">
      <h1 class="app-title">Kartica</h1>
      <nav class="app-nav">
        <RouterLink class="nav-link" to="/">Главная</RouterLink>
        <RouterLink class="nav-link" to="/profile">Профиль</RouterLink>
      </nav>
    </header>

    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { RouterLink, RouterView } from 'vue-router';
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: var(--app-background);
  color: var(--app-text-primary);
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem clamp(1rem, 4vw, 2.5rem);
  border-bottom: 1px solid var(--app-border);
}

.app-title {
  font-size: clamp(1.5rem, 4vw, 2rem);
  font-weight: 700;
  margin: 0;
}

.app-nav {
  display: flex;
  gap: 1rem;
}

.nav-link {
  color: inherit;
  text-decoration: none;
  font-weight: 600;
  position: relative;
  padding-bottom: 0.25rem;
}

.nav-link.router-link-active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: var(--app-accent);
}

.app-main {
  flex: 1;
  padding: clamp(1.5rem, 5vw, 3rem);
  display: flex;
  justify-content: center;
}
</style>
