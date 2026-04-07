module.exports = {
  apps: [
    {
      name: "mcp-server",
      cwd: "/root/project/ai-ghostwriter/mcp-server",
      script: "dist/http-server.js",
      node_args: "--enable-source-maps",
      env: {
        NODE_ENV: "production",
        MCP_PORT: 3001,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "500M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/var/log/pm2/mcp-server-error.log",
      out_file: "/var/log/pm2/mcp-server-out.log",
    },
    {
      name: "web-app",
      cwd: "/root/project/ai-ghostwriter/web-app",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "1G",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/var/log/pm2/web-app-error.log",
      out_file: "/var/log/pm2/web-app-out.log",
    },
  ],
};
