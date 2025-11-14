import { createApp } from './app.js';

const root = document.getElementById('app');
const telegramWebApp = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
const app = createApp(root, { user: null });

const fetchVerifiedTelegramUser = async (webApp) => {
  if (!webApp || !webApp.initData) {
    return null;
  }

  try {
    const response = await fetch('/api/user', {
      method: 'GET',
      headers: {
        'X-Telegram-Data': webApp.initData
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to verify Telegram user: ${response.status}`);
    }

    const payload = await response.json();
    if (payload && typeof payload === 'object' && 'user' in payload) {
      return payload.user ?? null;
    }
    return null;
  } catch (error) {
    console.warn('Unable to fetch verified Telegram user', error);
    return undefined;
  }
};

const setCSSVariable = (name, value) => {
  if (!value) return;
  document.documentElement.style.setProperty(name, value);
};

const normalizeHex = (color) => {
  if (!color || typeof color !== 'string') return null;
  let hex = color.trim();
  if (!hex.startsWith('#')) {
    return hex;
  }
  if (hex.length === 4) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  if (hex.length !== 7) {
    return null;
  }
  return hex;
};

const withAlpha = (color, alpha) => {
  const hex = normalizeHex(color);
  if (!hex) return color || null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const updateMetaThemeColor = (color) => {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const normalized = normalizeHex(color);
  meta.setAttribute('content', normalized || color || '#1f2a38');
};

const applyTelegramTheme = (themeParams = {}) => {
  const {
    bg_color: bgColor,
    text_color: textColor,
    hint_color: hintColor,
    button_color: buttonColor,
    secondary_bg_color: secondaryBgColor,
    section_separator_color: separatorColor
  } = themeParams;

  if (bgColor || secondaryBgColor) {
    updateMetaThemeColor(bgColor || secondaryBgColor);
  }

  setCSSVariable('--bg-color', normalizeHex(bgColor));
  setCSSVariable('--text-color', normalizeHex(textColor));
  setCSSVariable('--secondary-text-color', normalizeHex(hintColor));
  setCSSVariable('--accent-color', normalizeHex(buttonColor));

  if (secondaryBgColor) {
    setCSSVariable('--card-bg', withAlpha(secondaryBgColor, 0.92));
    setCSSVariable('--surface-color', withAlpha(secondaryBgColor, 0.85));
  }

  if (separatorColor) {
    setCSSVariable('--border-color', withAlpha(separatorColor, 0.4));
  }

  if (buttonColor) {
    setCSSVariable('--shadow-color', withAlpha(buttonColor, 0.24));
  }

  const currentBg = getComputedStyle(document.documentElement).getPropertyValue('--bg-color');
  if (currentBg) {
    document.body.style.backgroundColor = currentBg.trim();
  }
};

const ensureDefaultTheme = () => {
  const defaultBg = getComputedStyle(document.documentElement).getPropertyValue('--bg-color');
  updateMetaThemeColor(defaultBg || '#1f2a38');
};

ensureDefaultTheme();

if (telegramWebApp) {
  const webApp = telegramWebApp;
  if (webApp.initDataUnsafe && webApp.initDataUnsafe.user) {
    app.setUser(webApp.initDataUnsafe.user);
  }

  fetchVerifiedTelegramUser(webApp).then((user) => {
    if (user !== undefined) {
      app.setUser(user);
    }
  });
  webApp.ready();
  webApp.expand();
  applyTelegramTheme(webApp.themeParams || {});
  webApp.onEvent('themeChanged', () => {
    applyTelegramTheme(webApp.themeParams || {});
  });

  webApp.onEvent('viewportChanged', ({ isStateStable }) => {
    if (isStateStable) {
      webApp.expand();
    }
  });
} else {
  applyTelegramTheme();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker registration failed', error);
    });
  });
}
