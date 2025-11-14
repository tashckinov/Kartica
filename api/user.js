const { isValid } = require('@telegram-apps/init-data-node');

const BOT_API = process.env.BOT_API;

const parseUserFromInitData = (initData) => {
  if (!initData) {
    return null;
  }

  const data = new URLSearchParams(initData);
  const userParam = data.get('user');

  if (!userParam) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(userParam));
  } catch (error) {
    throw new Error('Invalid user payload');
  }
};

const handler = (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!BOT_API) {
    res.status(500).json({ error: 'BOT_API is not configured' });
    return;
  }

  const initData = req.header ? req.header('X-Telegram-Data') : req.headers['x-telegram-data'];

  if (!initData || !isValid(initData, BOT_API)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  let user = null;

  try {
    user = parseUserFromInitData(initData);
  } catch (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(200).json({ user });
};

module.exports = handler;
module.exports.default = handler;
