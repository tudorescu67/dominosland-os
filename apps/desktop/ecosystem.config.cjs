/* Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. */
module.exports = {
  apps: [
    {
      name: 'dominos-control-web',
      cwd: __dirname,
      script: 'npm',
      args: 'run start:web',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '256M',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
