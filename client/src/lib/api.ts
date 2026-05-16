import axios from 'axios';

const envBase = import.meta.env.VITE_API_URL?.trim();
export const API_BASE_URL = envBase && envBase.length > 0 ? envBase.replace(/\/$/, '') : '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Resolve a server-supplied path (e.g. avatarUrl="/users/abc/avatar") to a
// fully qualified URL the browser can load directly with cookies.
export function resolveApiUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
