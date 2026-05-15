import axios from 'axios';

const envBase = import.meta.env.VITE_API_URL?.trim();
export const API_BASE_URL = envBase && envBase.length > 0 ? envBase.replace(/\/$/, '') : '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});
