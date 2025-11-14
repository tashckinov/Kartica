const handler = (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  res.status(200).json({
    user: {
      id: 1,
      first_name: 'Demo',
      last_name: 'User',
      username: 'demo_user',
      language_code: 'ru',
    },
  });
};

module.exports = handler;
module.exports.default = handler;
