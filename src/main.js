import { createApp } from 'vue';
import App from './App.vue';
import './styles.css';
import { initializeTheme } from './theme.js';

initializeTheme();

const app = createApp(App);
app.mount('#app');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker registration failed', error);
    });
  });
}
