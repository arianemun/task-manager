/** PM2 — TZ تهران؛ مسیرهای data/uploads/backups خارج از build */
module.exports = {
  apps: [
    {
      name: "task-manager",
      cwd: "./.next/standalone",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      user: "www",
      env: {
        NODE_ENV: "production",
        TZ: "Asia/Tehran",
        PORT: 3230,
        HOSTNAME: "0.0.0.0",
        // این مسیرها را نسبت به ریشه پروژه (نه standalone) تنظیم کنید:
        // DATABASE_URL=file:/var/task-manager/data/app.db
        // UPLOAD_DIR=/var/task-manager/uploads
        // BACKUP_DIR=/var/task-manager/backups
      },
    },
    {
      name: "task-manager-realtime",
      cwd: ".",
      script: "./node_modules/tsx/dist/cli.mjs",
      args: "realtime/server.ts",
      instances: 1,
      exec_mode: "fork",
      user: "www",
      env: {
        NODE_ENV: "production",
        TZ: "Asia/Tehran",
        REALTIME_PORT: 3231,
      },
    },
  ],
};
