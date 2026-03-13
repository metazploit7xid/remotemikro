# L2TP Manager Web App

This is a full-stack web application for managing an L2TP VPN server on an Ubuntu/Debian VPS. It provides a user-friendly dashboard to replace the original CLI tool.

## Features

- **Dashboard**: Monitor active L2TP clients, service status, and diagnose ports.
- **VPN Users**: Add, edit, and delete L2TP users with optional static IPs.
- **Port Forwards**: Create and manage port forwards (DNAT) using `iptables` and `socat`.
- **Settings & Install**: Run the initial installation script, control services, or uninstall the server.

## Prerequisites

- A fresh Ubuntu or Debian VPS.
- Root access (the app must be run as root to modify system configurations like `/etc/ppp/chap-secrets`, `iptables`, and systemd services).
- Node.js (v18 or higher) installed.

## Installation & Deployment (24/7 on VPS)

To run this web application 24/7 on your VPS, follow these steps:

### 1. Install Node.js and PM2
Connect to your VPS via SSH and install Node.js and PM2 (a production process manager for Node.js):

```bash
# Install Node.js (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2
```

### 2. Clone and Setup the App
Upload or clone this project to your VPS (e.g., in `/opt/l2tp-manager-web`).

```bash
cd /opt/l2tp-manager-web

# Install dependencies
npm install

# Build the React frontend
npm run build
```

### 3. Start the Server with PM2
Run the compiled server using PM2. The server must be run as root to manage L2TP configurations.

```bash
# Start the server (runs on port 3000 by default)
sudo pm2 start ecosystem.config.js

# Save the PM2 process list so it restarts on server reboot
sudo pm2 save
sudo pm2 startup
```

### 4. Access the Web App
Open your browser and navigate to your VPS IP address on port 3000:
`http://YOUR_VPS_IP:3000`

> **Note:** For security, it is highly recommended to set up a reverse proxy (like Nginx) with SSL (HTTPS) and basic authentication to protect the dashboard from unauthorized access.

### 5. Initial L2TP Setup
Once you access the web interface:
1. Go to the **Settings & Install** tab.
2. Click **Run Install Script** to automatically install `xl2tpd`, `ppp`, `iptables`, `socat`, and configure the default L2TP settings.
3. After installation, you can start adding users and port forwards!

## Security Warning
This application executes shell commands as root. Ensure the web interface is not exposed to the public internet without strong authentication (e.g., Nginx Basic Auth or an authentication proxy).
