// FIX: Load dotenv so PM2_APP_NAME and NODE_ENV in .env are picked up correctly
// when running `pm2 start ecosystem.config.js`
require('dotenv').config();

module.exports = {
  apps: [{
    name: process.env.PM2_APP_NAME || 'ecommerce-bot',
    script: 'index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: process.env.NODE_ENV || 'production'
    },
    env_production: {
      NODE_ENV: 'production'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
