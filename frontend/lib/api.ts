import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { clearSession, getAccessToken, setSession, userFromAccessToken } from './token-store';
import { API_URL } from './config';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

let refreshPromise: Promise<string | null> | null = null;

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const accessToken = getAccessToken();
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      throw error;
    }

    originalRequest._retry = true;
    const newAccessToken = await refreshAccessToken();
    if (!newAccessToken) {
      throw error;
    }

    originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
    return api(originalRequest);
  },
);

export async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post('/auth/refresh')
      .then((response) => {
        const accessToken = response.data.accessToken as string;
        const user = response.data.user ?? userFromAccessToken(accessToken);
        setSession({ accessToken, user });
        return accessToken;
      })
      .catch(() => {
        clearSession();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export { api };
