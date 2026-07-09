module.exports = {
  apps: [{
    name: 'Staymaster',
    script: 'server.js',
    // 4 workers × 1.5 GB heap = 6 GB committed; leaves ample headroom on a 16 GB host.
    // 'max' would spawn 12 workers (30 GB) and OOM-kill under load.
    instances: 4,
    exec_mode: 'cluster',
    node_args: '--max-old-space-size=1536',
    max_memory_restart: '1800M',
    // Use pm2 reload (zero-downtime rolling restart) instead of cron_restart
    // which restarts ALL instances simultaneously causing a brief outage.
    kill_timeout: 5000,
    listen_timeout: 8000,
    env: {
      NODE_ENV: 'development',
      BOOKING_SYNC_ENABLED: 'false'
    },
    env_production: {
      NODE_ENV: 'production',
      BOOKING_SYNC_ENABLED: 'true'
    }
  }]
};