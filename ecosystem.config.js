module.exports = {
  apps: [{
    name: "l2tp-manager",
    script: "server.ts",
    interpreter: "./node_modules/.bin/tsx",
    env: {
      NODE_ENV: "production",
      PORT: 3000
    }
  }]
}
