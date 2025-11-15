const TelegramBot = require('node-telegram-bot-api');

const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const miniAppUrl = (process.env.TELEGRAM_MINIAPP_URL || '').trim();

let bot = null;

if (!token) {
  console.warn('TELEGRAM_BOT_TOKEN is not configured. Telegram bot will not start.');
} else {
  bot = new TelegramBot(token, { polling: true });
}

const buildGreetingMessage = (message) => {
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

bot?.onText(/^\/start(?:@\w+)?$/i, async (message) => {
  const chatId = message.chat.id;
  const greeting = buildGreetingMessage(message);

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

bot?.on('polling_error', (error) => {
  console.error('Ошибка при получении обновлений Telegram:', error);
});

module.exports = bot;
