/* Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. */
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

export const API_BASE = localStorage.getItem('dominosApiBase') || import.meta.env.VITE_DOMINOS_API_URL || 'https://api.dominosland.com';
let authToken: string | null = null;

export const API_TARGETS = [
  { id: 'auto', label: 'Auto-detect', url: '' },
  { id: 'local', label: 'Local API', url: 'http://127.0.0.1:3002' },
  { id: 'public', label: 'Public API', url: 'https://api.dominosland.com' },
] as const;

export async function findAvailableApiUrl() {
  const configured = String(import.meta.env.VITE_DOMINOS_API_URL || '').replace(/\/$/, '');
  const candidates = [
    ...API_TARGETS.filter((target) => target.url).map((target) => target.url),
    configured,
  ].filter((url, index, list) => url && list.indexOf(url) === index);

  for (const url of candidates) {
    try {
      const response = await fetch(`${url}/health`, { method: 'GET', signal: AbortSignal.timeout(1800) });
      if (response.ok) return url;
    } catch (_error) {
      // Continue until an accessible API is found.
    }
  }

  throw new Error('Nu am gasit niciun API AlexPanel accesibil.');
}

export interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 45000,
  headers: { 'Content-Type': 'application/json' },
});

export function setApiBase(url: string) {
  const cleanUrl = url.replace(/\/$/, '');
  localStorage.setItem('dominosApiBase', cleanUrl);
  localStorage.setItem('dominosWsBase', cleanUrl);
  api.defaults.baseURL = cleanUrl;
}

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

export async function initializeAuth() {
  if (window.dominosDesktop?.secureStore) {
    try {
      authToken = await window.dominosDesktop.secureStore.get('authToken');
    } catch (_error) {
      authToken = null;
    }
    return;
  }
  authToken = sessionStorage.getItem('dominosToken');
}

export async function saveAuthToken(token: string) {
  authToken = token;
  if (window.dominosDesktop?.secureStore) {
    try {
      await window.dominosDesktop.secureStore.set('authToken', token);
    } catch (_error) {
      // The token remains only in renderer memory when the OS keyring is unavailable.
    }
    return;
  }
  sessionStorage.setItem('dominosToken', token);
}

export function getAuthToken() {
  return authToken;
}

export function connectSocket(): Socket {
  const wsBase = localStorage.getItem('dominosWsBase') || import.meta.env.VITE_DOMINOS_WS_URL || API_BASE;
  return io(wsBase, {
    auth: { token: authToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
}

export async function login(username: string, password: string) {
  const { data } = await api.post<LoginResponse>('/api/auth/login', { username, password });
  await saveAuthToken(data.access_token);
  localStorage.setItem('dominosUser', JSON.stringify(data.user));
  return data;
}

export async function loginWithToken(token: string) {
  await saveAuthToken(token);
  try {
    const { data } = await api.get('/api/auth/me');
    localStorage.setItem('dominosUser', JSON.stringify(data));
    return data;
  } catch (error) {
    logout();
    throw error;
  }
}

export function logout() {
  authToken = null;
  sessionStorage.removeItem('dominosToken');
  if (window.dominosDesktop?.secureStore) {
    void window.dominosDesktop.secureStore.delete('authToken').catch(() => {});
  }
  localStorage.removeItem('dominosUser');
}

export function getSavedUser() {
  const raw = localStorage.getItem('dominosUser');
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

export async function downloadMediaToDevice(id: string, suggestedName: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(id)) {
    throw new Error('Media ID invalid');
  }
  const route = `/api/control/media/${id}/download`;
  if (window.dominosDesktop?.downloads) {
    const base = String(api.defaults.baseURL || API_BASE).replace(/\/$/, '');
    try {
      return await window.dominosDesktop.downloads.saveFromApi(`${base}${route}`, suggestedName);
    } catch (_error) {
      // Keep a browser-compatible fallback for Linux sessions without a keyring.
    }
  }

  const response = await api.get(route, { responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = suggestedName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  return { saved: true };
}
