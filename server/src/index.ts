import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { initSocket } from './socket/io.js';

const app = createApp();
const server = http.createServer(app);
initSocket(server);

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${env.PORT}`);
});

const shutdown = (signal: string) => {
  // eslint-disable-next-line no-console
  console.log(`[server] received ${signal}, shutting down`);
  server.close(() => process.exit(0));
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
