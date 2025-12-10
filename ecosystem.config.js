/**
 * PM2 Ecosystem Configuration
 * Production process management for Smart ZZP Hub Backend
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 stop smart-zzp-hub
 *   pm2 restart smart-zzp-hub
 *   pm2 logs smart-zzp-hub
 *   pm2 monit
 */

module.exports = {
  apps: [{
    name: 'smart-zzp-hub',
    script: './backend/src/index.js',
    
    // Instance configuration
    instances: 1, // Change to 'max' for cluster mode
    exec_mode: 'fork', // Change to 'cluster' for multiple instances
    
    // Environment variables
    env: {
      NODE_ENV: 'development',
      PORT: 4000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    
    // Logging
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Advanced features
    watch: false, // Set to true in development if you want auto-restart on file changes
    ignore_watch: ['node_modules', 'logs', '.git'],
    
    // Auto-restart configuration
    max_memory_restart: '500M',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 3000,
    
    // Process management
    cron_restart: '0 3 * * *', // Restart daily at 3 AM (optional)
  }]
};
