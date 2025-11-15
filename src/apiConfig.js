const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!rawApiBaseUrl) {
  throw new Error(
    'VITE_API_BASE_URL is not defined. Create a .env file (see .env.example) with the API base URL.'
  );
}

export const apiBaseUrl = rawApiBaseUrl.replace(/\/$/, '');
