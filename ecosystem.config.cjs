module.exports = {
  apps: [
    {
      name: 'wapcpharm-api',
      // Run via tsx (TypeScript runner) — avoids tsc bundler issues
      script: '/root/app/wapcpharm-classroom/node_modules/.bin/tsx',
      args: 'src/index.ts',
      cwd: '/root/app/wapcpharm-classroom/server',
      // Production settings
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      // Restart on crash, with exponential backoff
      restart_delay: 3000,
      max_restarts: 10,
      // Logging
      out_file: '/var/log/wapcpharm/api.out.log',
      error_file: '/var/log/wapcpharm/api.err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
