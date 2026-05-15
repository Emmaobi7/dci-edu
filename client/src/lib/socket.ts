import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';

// Socket connects to the API origin (or same origin when VITE_API_URL is unset).
function socketTarget(): string | undefined {
  if (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')) {
    try { return new URL(API_BASE_URL).origin; } catch { return undefined; }
  }
  return undefined;
}

let singleton: Socket | null = null;

export function getSocket(): Socket {
  if (singleton && singleton.connected) return singleton;
  if (singleton) {
    singleton.connect();
    return singleton;
  }
  const target = socketTarget();
  const opts = {
    withCredentials: true,
    autoConnect: true,
    transports: ['websocket', 'polling'],
  };
  singleton = target ? io(target, opts) : io(opts);
  return singleton;
}

export function disconnectSocket(): void {
  if (singleton) {
    singleton.disconnect();
    singleton = null;
  }
}
