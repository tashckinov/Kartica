const DEFAULT_USER = {
  id: 1,
  first_name: 'Demo',
  last_name: 'User',
  username: 'demo_user',
  language_code: 'ru',
};

export async function fetchUserProfile(signal) {
  try {
    const response = await fetch('/api/user', { signal });

    if (!response.ok) {
      throw new Error('Не удалось получить данные профиля');
    }

    const payload = await response.json();
    return payload.user ?? DEFAULT_USER;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }

    console.warn('Falling back to stub profile due to error:', error);
    return DEFAULT_USER;
  }
}
