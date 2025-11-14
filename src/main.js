import { createApp } from 'vue';
import App from './App.vue';
import AdminApp from './AdminApp.vue';
import './styles.css';
import { initializeTheme } from './theme.js';

initializeTheme();

const isAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

const app = createApp(isAdminRoute ? AdminApp : App);
app.mount('#app');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker registration failed', error);
    });
  });
}
