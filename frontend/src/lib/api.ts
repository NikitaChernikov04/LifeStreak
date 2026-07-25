import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data?.data ?? response.data,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    const message = error.response?.data?.message ?? error.message ?? 'Что-то пошло не так';
    return Promise.reject(new Error(Array.isArray(message) ? message.join(', ') : message));
  },
);
