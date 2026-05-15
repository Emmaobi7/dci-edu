import { io, type Socket } from 'socket.io-client';

let singleton: Socket | null = null;

export function getSocket(): Socket {
  if (singleton && singleton.connected) return singleton;
  if (singleton) {
    singleton.connect();
    return singleton;
  }
  singleton = io({
    withCredentials: true,
    autoConnect: true,
    transports: ['websocket', 'polling'],
  });
  return singleton;
}

export function disconnectSocket(): void {
  if (singleton) {
    singleton.disconnect();
    singleton = null;
  }
}
