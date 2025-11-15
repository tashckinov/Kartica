const TelegramBot = require('node-telegram-bot-api');

let bot = null;
let isStopping = false;

const isUnauthorizedError = (error) => {
  if (!error) {
    return false;
  }

  if (error.code === 'ETELEGRAM') {
    const statusCode = error.response?.statusCode || error.response?.body?.error_code;
    if (statusCode === 401) {
      return true;
    }
    const message = typeof error.message === 'string' ? error.message : '';
    if (message.includes('401') && message.toLowerCase().includes('unauthorized')) {
      return true;
    }
  }

  return false;
};

const stopPollingSafely = async (currentBot) => {
  if (!currentBot || isStopping) {
    return;
  }

  isStopping = true;

  try {
    currentBot.removeAllListeners('polling_error');
    currentBot.removeAllListeners('text');

    await currentBot.stopPolling();
  } catch (stopError) {
    console.error('Не удалось корректно остановить Telegram-бота.', stopError);
  } finally {
    if (bot === currentBot) {
      bot = null;
    }

    isStopping = false;
  }
};

const getTelegramToken = () => (process.env.ADMIN_TELEGRAM_BOT_TOKEN || '').trim();

const getMiniAppUrl = () =>
  (
    process.env.ADMIN_TELEGRAM_MINIAPP_URL ||
    process.env.TELEGRAM_MINIAPP_URL ||
    ''
  ).trim();

const getBotApiBaseUrl = () =>
  (
    process.env.ADMIN_TELEGRAM_BOT_API_BASE_URL ||
    process.env.TELEGRAM_BOT_API_BASE_URL ||
    ''
  ).trim();

const parseBoolean = (value) => {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
};

const shouldUseTestEnvironment = () => {
  const flag =
    process.env.ADMIN_TELEGRAM_BOT_USE_TEST_ENV ??
    process.env.TELEGRAM_BOT_USE_TEST_ENV ??
    '';

  return parseBoolean(flag);
};

const buildGreetingMessage = (message, miniAppUrl) => {
  const firstName = (message?.from?.first_name || '').trim();
  const lastName = (message?.from?.last_name || '').trim();
  const hasName = firstName || lastName;

  const name = [firstName, lastName].filter(Boolean).join(' ');
  const greetingName = hasName ? `, ${name}` : '';

  const intro = `Привет${greetingName}!`;
  if (miniAppUrl) {
    return `${intro}\n\nНажми кнопку ниже, чтобы открыть мини-приложение.`;
  }
  return `${intro}\n\nМини-приложение временно недоступно. Обратитесь к администратору.`;
};

const startTelegramBot = () => {
  if (bot) {
    return bot;
  }

  const token = getTelegramToken();

  if (!token) {
    console.warn('ADMIN_TELEGRAM_BOT_TOKEN is not configured. Telegram bot will not start.');
    return null;
  }

  const miniAppUrl = getMiniAppUrl();

  const botOptions = { polling: true };

  const baseApiUrl = getBotApiBaseUrl();
  if (baseApiUrl) {
    botOptions.baseApiUrl = baseApiUrl;
  }

  if (shouldUseTestEnvironment()) {
    botOptions.testEnvironment = true;
    console.info('Telegram bot test environment enabled.');
  }

  try {
    bot = new TelegramBot(token, botOptions);
  } catch (error) {
    console.error('Не удалось инициализировать Telegram-бота.', error);
    bot = null;
    return null;
  }

  bot.onText(/^\/start(?:@\w+)?$/i, async (message) => {
    const chatId = message.chat.id;
    const greeting = buildGreetingMessage(message, miniAppUrl);

    const replyMarkup = miniAppUrl
      ? {
          inline_keyboard: [
            [
              {
                text: 'Открыть приложение',
                web_app: { url: miniAppUrl },
              },
            ],
          ],
        }
      : undefined;

    try {
      await bot.sendMessage(chatId, greeting, replyMarkup ? { reply_markup: replyMarkup } : undefined);
    } catch (error) {
      console.error('Не удалось отправить приветственное сообщение в Telegram:', error);
    }
  });

  const handlePollingError = async (error) => {
    if (isUnauthorizedError(error)) {
      console.error(
        'Telegram отклонил ADMIN_TELEGRAM_BOT_TOKEN. Остановлен опрос обновлений. Проверьте корректность токена.',
        error,
      );
      const activeBot = bot;
      await stopPollingSafely(activeBot);
      return;
    }

    console.error('Ошибка при получении обновлений Telegram:', error);
  };

  bot.on('polling_error', handlePollingError);

  bot
    .getMe()
    .catch(async (error) => {
      if (isUnauthorizedError(error)) {
        console.error(
          'Telegram отклонил ADMIN_TELEGRAM_BOT_TOKEN при попытке получить информацию о боте. Остановлен опрос обновлений. Проверьте переменную окружения.',
          error,
        );
        const activeBot = bot;
        await stopPollingSafely(activeBot);
      } else {
        console.error('Не удалось получить информацию о Telegram-боте.', error);
      }
    });

  console.log('Telegram bot polling started.');

  return bot;
};

module.exports = {
  startTelegramBot,
  getBotInstance: () => bot,
};
