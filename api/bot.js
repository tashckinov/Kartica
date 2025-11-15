const TelegramBot = require('node-telegram-bot-api');

let bot = null;

const getTelegramToken = () => (process.env.ADMIN_TELEGRAM_BOT_TOKEN || '').trim();

const getMiniAppUrl = () =>
  (
    process.env.ADMIN_TELEGRAM_MINIAPP_URL ||
    process.env.TELEGRAM_MINIAPP_URL ||
    ''
  ).trim();

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

  try {
    bot = new TelegramBot(token, { polling: true });
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

  bot.on('polling_error', (error) => {
    console.error('Ошибка при получении обновлений Telegram:', error);
  });

  console.log('Telegram bot polling started.');

  return bot;
};

module.exports = {
  startTelegramBot,
  getBotInstance: () => bot,
};
