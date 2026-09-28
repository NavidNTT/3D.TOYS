import axios from 'axios';
import { clientApiBaseUrl } from './apiBase';

/**
 * Shared Axios client for the Laravel API.
 *
 * baseURL resolves NEXT_PUBLIC_API_URL and guarantees the `/api/v1` prefix, so
 * callers can write `api.post('/auth/otp/send')` and still land on
 * `/api/v1/auth/otp/send`. See src/lib/apiBase.ts for the address table.
 */
const api = axios.create({
  baseURL: clientApiBaseUrl(),
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

/**
 * Attach the Sanctum bearer token (persisted by the Zustand auth store)
 * to every request. Reading localStorage lazily inside the interceptor
 * keeps this module safe to import from server components — the token is
 * only accessed in the browser at request time.
 */
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('toy-store-auth');
      if (raw) {
        const parsed = JSON.parse(raw) as {
          state?: { token?: string | null };
        };
        const token = parsed.state?.token;
        if (token) {
          config.headers = config.headers ?? {};
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch {
      // Corrupt persisted state must never break outgoing requests.
    }
  }
  return config;
});

export default api;
