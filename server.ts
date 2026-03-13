import express from 'express';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { RouterOSAPI } from 'node-routeros';

const execPromise = util.promisify(exec);
const app = express();
app.use(express.json());

const CHAP_SECRETS = '/etc/ppp/chap-secrets';
const FORWARDS_CONFIG = '/etc/l2tp-forwards.conf';
const ROUTES_CONFIG = '/etc/l2tp-routes.conf';
const ADMIN_CONFIG = path.join(process.cwd(), 'admin.json');
const MIKROTIK_CONFIGS = path.join(process.cwd(), 'mikrotik-configs.json');

// Ensure config files exist
[FORWARDS_CONFIG, ROUTES_CONFIG, MIKROTIK_CONFIGS].forEach(file => {
    if (!fs.existsSync(file)) {
        try { fs.writeFileSync(file, file === MIKROTIK_CONFIGS ? '{}' : ''); } catch (e) {}
    }
});

if (!fs.existsSync(ADMIN_CONFIG)) {
    fs.writeFileSync(ADMIN_CONFIG, JSON.stringify({ username: 'admin', password: 'admin' }, null, 2));
}

const sessions = new Set<string>();

// Auth Middleware
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/auth/login')) return next();
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const token = authHeader.split(' ')[1];
    if (!sessions.has(token)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    next();
};

app.use('/api', requireAuth);

// API: Auth Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    try {
        const adminData = JSON.parse(fs.readFileSync(ADMIN_CONFIG, 'utf-8'));
        if (username === adminData.username && password === adminData.password) {
            const token = crypto.randomBytes(32).toString('hex');
            sessions.add(token);
            return res.json({ success: true, token });
        }
    } catch (e) {
        console.error('Error reading admin config:', e);
    }
    res.status(401).json({ error: 'Invalid credentials' });
});

// API: Auth Check
app.get('/api/auth/check', (req, res) => {
    res.json({ success: true });
});

// API: Change Credentials
app.post('/api/auth/change', (req, res) => {
    const { currentPassword, newUsername, newPassword } = req.body;
    try {
        const adminData = JSON.parse(fs.readFileSync(ADMIN_CONFIG, 'utf-8'));
        if (currentPassword !== adminData.password) {
            return res.status(401).json({ error: 'Current password incorrect' });
        }
        
        adminData.username = newUsername || adminData.username;
        adminData.password = newPassword || adminData.password;
        fs.writeFileSync(ADMIN_CONFIG, JSON.stringify(adminData, null, 2));
        
        // Optional: clear other sessions?
        // sessions.clear(); 
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update credentials' });
    }
});

// Helper to run shell commands safely
async function runCmd(cmd: string) {
    try {
        const { stdout, stderr } = await execPromise(cmd);
        return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (error: any) {
        return { success: false, stdout: error.stdout?.trim(), stderr: error.stderr?.trim(), error: error.message };
    }
}

// API: Get Service Status
app.get('/api/status', async (req, res) => {
    const xl2tpd = await runCmd('systemctl is-active xl2tpd');
    const forwards = await runCmd('systemctl is-active l2tp-forwards');
    res.json({ 
        xl2tpd: xl2tpd.stdout === 'active' ? 'running' : 'stopped',
        forwards: forwards.stdout === 'active' ? 'running' : 'stopped'
    });
});

// API: Manage Service
app.post('/api/service', async (req, res) => {
    const { service, action } = req.body;
    if (!['start', 'stop', 'restart'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
    if (!['xl2tpd', 'l2tp-forwards', 'all'].includes(service)) return res.status(400).json({ error: 'Invalid service' });
    
    let result;
    if (service === 'all') {
        await runCmd(`systemctl ${action} xl2tpd`);
        result = await runCmd(`systemctl ${action} l2tp-forwards`);
    } else {
        result = await runCmd(`systemctl ${action} ${service}`);
    }
    res.json(result);
});

// API: Get Users
app.get('/api/users', (req, res) => {
    try {
        if (!fs.existsSync(CHAP_SECRETS)) return res.json([]);
        const content = fs.readFileSync(CHAP_SECRETS, 'utf-8');
        const users = content.split('\n').filter(line => line.trim() && !line.startsWith('#')).map(line => {
            const parts = line.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
            return {
                username: parts[0]?.replace(/"/g, ''),
                password: parts[2]?.replace(/"/g, ''),
                ip: parts[3] || '*'
            };
        });
        res.json(users);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// API: MikroTik Configs
app.get('/api/mikrotik/configs', (req, res) => {
    const configs = JSON.parse(fs.readFileSync(MIKROTIK_CONFIGS, 'utf8') || '{}');
    res.json(configs);
});

app.post('/api/mikrotik/configs', (req, res) => {
    const { username, apiUser, apiPass, apiPort } = req.body;
    const configs = JSON.parse(fs.readFileSync(MIKROTIK_CONFIGS, 'utf8') || '{}');
    configs[username] = { apiUser, apiPass, apiPort: apiPort || 8728 };
    fs.writeFileSync(MIKROTIK_CONFIGS, JSON.stringify(configs, null, 2));
    res.json({ success: true });
});

// API: MikroTik PPPoE Monitoring
app.get('/api/mikrotik/pppoe/:username', async (req, res) => {
    const { username } = req.params;
    const ip = req.query.ip as string;
    
    if (!ip) return res.status(400).json({ error: 'Peer IP required' });

    const configs = JSON.parse(fs.readFileSync(MIKROTIK_CONFIGS, 'utf8') || '{}');
    const config = configs[username] || { apiUser: 'admin', apiPass: '', apiPort: 8728 };

    const api = new RouterOSAPI({
        host: ip,
        user: config.apiUser,
        password: config.apiPass,
        port: parseInt(config.apiPort),
        timeout: 5
    });

    try {
        await api.connect();
        const secrets = await api.write('/ppp/secret/print');
        const active = await api.write('/ppp/active/print');
        api.close();
        
        res.json({ secrets, active });
    } catch (err: any) {
        res.status(500).json({ error: `MikroTik API Error: ${err.message}` });
    }
});

// API: Add User
app.post('/api/users', async (req, res) => {
    const { username, password, ip = '*' } = req.body;
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) return res.status(400).json({ error: 'Invalid username' });
    
    // Check if exists
    const check = await runCmd(`grep -q '^"${username}"' ${CHAP_SECRETS}`);
    if (check.success) return res.status(400).json({ error: 'User already exists' });

    const entry = `"${username}" l2tpd "${password}" ${ip}\n`;
    try {
        fs.appendFileSync(CHAP_SECRETS, entry);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// API: Edit User
app.put('/api/users/:username', async (req, res) => {
    const { username } = req.params;
    const { password, ip = '*' } = req.body;
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) return res.status(400).json({ error: 'Invalid username' });
    
    await runCmd(`grep -v '^"${username}"' ${CHAP_SECRETS} > ${CHAP_SECRETS}.tmp && mv ${CHAP_SECRETS}.tmp ${CHAP_SECRETS}`);
    const entry = `"${username}" l2tpd "${password}" ${ip}\n`;
    try {
        fs.appendFileSync(CHAP_SECRETS, entry);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// API: Delete User
app.delete('/api/users/:username', async (req, res) => {
    const { username } = req.params;
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) return res.status(400).json({ error: 'Invalid username' });
    
    const result = await runCmd(`grep -v '^"${username}"' ${CHAP_SECRETS} > ${CHAP_SECRETS}.tmp && mv ${CHAP_SECRETS}.tmp ${CHAP_SECRETS}`);
    res.json(result);
});

// API: Get Connected Clients
app.get('/api/clients', async (req, res) => {
    const { success, stdout } = await runCmd("ip addr show");
    if (!success) return res.json([]);
    
    const clients: any[] = [];
    let currentIface = '';
    
    stdout.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed.match(/^\d+:\s+ppp\d+:/)) {
            const match = trimmed.match(/^\d+:\s+(ppp\d+):/);
            if (match) currentIface = match[1];
        } else if (trimmed.startsWith('inet ') && currentIface) {
            const parts = trimmed.split(/\s+/);
            // Example: inet 172.16.101.1 peer 172.16.101.10/32 scope global ppp0
            let localIp = parts[1] || '';
            let peerIp = '';
            
            const peerIndex = parts.indexOf('peer');
            if (peerIndex !== -1 && parts[peerIndex + 1]) {
                peerIp = parts[peerIndex + 1].split('/')[0]; // Remove /32
            }
            
            clients.push({
                interface: currentIface,
                localIp: localIp.split('/')[0],
                peerIp: peerIp
            });
            currentIface = '';
        } else if (!trimmed.startsWith('inet ') && !trimmed.startsWith('inet6 ') && !trimmed.startsWith('valid_lft') && !trimmed.match(/^\d+:/)) {
            // Do nothing, just skip other lines
        } else if (trimmed.match(/^\d+:/) && !trimmed.match(/^\d+:\s+ppp\d+:/)) {
            // Reset currentIface if we hit another interface
            currentIface = '';
        }
    });
    res.json(clients);
});

// API: Get Port Forwards
app.get('/api/forwards', (req, res) => {
    try {
        if (!fs.existsSync(FORWARDS_CONFIG)) return res.json([]);
        const content = fs.readFileSync(FORWARDS_CONFIG, 'utf-8');
        const forwards = content.split('\n').filter(line => line.trim() && !line.startsWith('#')).map(line => {
            const [name, extPort, intIp, intPort, desc] = line.split(':');
            return { name, extPort, intIp, intPort, desc };
        });
        res.json(forwards);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// API: Add Port Forward
app.post('/api/forwards', async (req, res) => {
    const { name, extPort, intIp, intPort, desc = '' } = req.body;
    if (!/^[a-zA-Z0-9_-]+$/.test(name) || !/^\d+$/.test(extPort) || !/^\d+$/.test(intPort) || !/^[\d\.]+$/.test(intIp)) {
        return res.status(400).json({ error: 'Invalid input' });
    }
    
    // Check if exists
    const check = await runCmd(`grep -q "^${name}:" ${FORWARDS_CONFIG}`);
    if (check.success) return res.status(400).json({ error: 'Forward name already exists' });

    const entry = `${name}:${extPort}:${intIp}:${intPort}:${desc}\n`;
    fs.appendFileSync(FORWARDS_CONFIG, entry);
    
    // Add iptables rule
    await runCmd(`iptables -A INPUT -p tcp --dport ${extPort} -j ACCEPT`);
    await runCmd(`iptables-save > /etc/iptables/rules.v4`);
    
    // Start socat
    await runCmd(`nohup socat TCP4-LISTEN:${extPort},reuseaddr,fork TCP4:${intIp}:${intPort} >/dev/null 2>&1 &`);
    
    res.json({ success: true });
});

// API: Delete Port Forward
app.delete('/api/forwards/:name', async (req, res) => {
    const { name } = req.params;
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) return res.status(400).json({ error: 'Invalid name' });
    
    // Get extPort before deleting
    const grep = await runCmd(`grep "^${name}:" ${FORWARDS_CONFIG}`);
    if (!grep.success) return res.status(404).json({ error: 'Not found' });
    
    const extPort = grep.stdout.split(':')[1];
    
    // Remove from config
    await runCmd(`sed -i "/^${name}:/d" ${FORWARDS_CONFIG}`);
    
    // Remove iptables rule
    if (extPort) {
        await runCmd(`iptables -D INPUT -p tcp --dport ${extPort} -j ACCEPT`);
        await runCmd(`iptables-save > /etc/iptables/rules.v4`);
        // Kill socat process listening on this port
        await runCmd(`fuser -k ${extPort}/tcp`);
    }
    
    res.json({ success: true });
});

// API: Add Standard MikroTik Forwards
app.post('/api/forwards/mikrotik', async (req, res) => {
    const { username, clientIp } = req.body;
    if (!/^[a-zA-Z0-9_-]+$/.test(username) || !/^[\d\.]+$/.test(clientIp)) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    try {
        async function getUniquePort() {
            for (let i = 0; i < 10; i++) {
                const port = Math.floor(Math.random() * (60000 - 10000 + 1)) + 10000;
                const check = await runCmd(`ss -tuln | grep -q ":${port} "`);
                if (!check.success) {
                    const checkConfig = await runCmd(`grep -q ":${port}:" ${FORWARDS_CONFIG}`);
                    if (!checkConfig.success) return port;
                }
            }
            throw new Error("Could not generate a unique port");
        }

        const winboxPort = await getUniquePort();
        const apiPort = await getUniquePort();

        const winboxName = `${username}-winbox`;
        const apiName = `${username}-api`;

        const check1 = await runCmd(`grep -q "^${winboxName}:" ${FORWARDS_CONFIG}`);
        const check2 = await runCmd(`grep -q "^${apiName}:" ${FORWARDS_CONFIG}`);
        if (check1.success || check2.success) {
            return res.status(400).json({ error: 'Forward names for this user already exist' });
        }

        const entry1 = `${winboxName}:${winboxPort}:${clientIp}:8291:MikroTik Winbox for ${username}\n`;
        const entry2 = `${apiName}:${apiPort}:${clientIp}:8728:MikroTik API for ${username}\n`;
        
        fs.appendFileSync(FORWARDS_CONFIG, entry1);
        fs.appendFileSync(FORWARDS_CONFIG, entry2);

        await runCmd(`iptables -A INPUT -p tcp --dport ${winboxPort} -j ACCEPT`);
        await runCmd(`iptables -A INPUT -p tcp --dport ${apiPort} -j ACCEPT`);
        await runCmd(`iptables-save > /etc/iptables/rules.v4`);

        await runCmd(`nohup socat TCP4-LISTEN:${winboxPort},reuseaddr,fork TCP4:${clientIp}:8291 >/dev/null 2>&1 &`);
        await runCmd(`nohup socat TCP4-LISTEN:${apiPort},reuseaddr,fork TCP4:${clientIp}:8728 >/dev/null 2>&1 &`);

        res.json({ success: true, winboxPort, apiPort });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// API: Diagnose Ports
app.get('/api/diagnose', async (req, res) => {
    const { stdout, stderr, error } = await runCmd("ss -tuln");
    if (!stdout) {
        return res.json({ output: `Error running ss command: ${stderr || error || 'Unknown error'}` });
    }
    
    const filtered = stdout.split('\n').filter(line => line.includes('1701') || line.includes('socat') || line.includes('Netid')).join('\n');
    res.json({ output: filtered || 'No active ports found for 1701 or socat.' });
});

// API: Install Server
app.post('/api/install', async (req, res) => {
    const script = `
        apt-get update && apt-get install -y xl2tpd ppp iptables socat iptables-persistent net-tools &&
        echo '[global]\nipsec saref = no\nforce userspace = yes\n\n[lns default]\nip range = 172.16.101.10-172.16.101.100\nlocal ip = 172.16.101.1\nrequire chap = yes\nrefuse pap = yes\nrequire authentication = yes\nname = l2tpd\nppp debug = yes\npppoptfile = /etc/ppp/options.xl2tpd\nlength bit = yes\n' > /etc/xl2tpd/xl2tpd.conf &&
        echo 'ipcp-accept-local\nipcp-accept-remote\nms-dns 8.8.8.8\nms-dns 8.8.4.4\nnoccp\nauth\ncrtscts\nidle 1800\nmtu 1410\nmru 1410\nnodefaultroute\ndebug\nlock\nproxyarp\nconnect-delay 5000\nname l2tpd\nrefuse-pap\nrefuse-chap\nrefuse-mschap\nrequire-mschap-v2\n' > /etc/ppp/options.xl2tpd &&
        touch /etc/ppp/chap-secrets &&
        touch /etc/l2tp-forwards.conf &&
        sysctl -w net.ipv4.ip_forward=1 &&
        sed -i 's/#net.ipv4.ip_forward=1/net.ipv4.ip_forward=1/g' /etc/sysctl.conf &&
        iptables -t nat -A POSTROUTING -s 172.16.101.0/24 -j MASQUERADE &&
        iptables -A INPUT -p udp -m udp --dport 1701 -j ACCEPT &&
        netfilter-persistent save &&
        cat << 'EOF' > /usr/local/bin/l2tp-forwards-start.sh
#!/bin/bash
pkill -f "socat.*TCP4-LISTEN" 2>/dev/null
while IFS=':' read -r name ext_port int_ip int_port desc; do
    [[ $name =~ ^#.*$ ]] || [[ -z $name ]] && continue
    socat TCP4-LISTEN:"$ext_port",reuseaddr,fork TCP4:"$int_ip":"$int_port" &
done < /etc/l2tp-forwards.conf
EOF
        chmod +x /usr/local/bin/l2tp-forwards-start.sh &&
        cat << 'EOF' > /etc/systemd/system/l2tp-forwards.service
[Unit]
Description=L2TP Port Forwards Service
After=network.target xl2tpd.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/bin/l2tp-forwards-start.sh
ExecStop=/usr/bin/pkill -f "socat.*TCP4-LISTEN"

[Install]
WantedBy=multi-user.target
EOF
        systemctl daemon-reload &&
        systemctl enable xl2tpd &&
        systemctl restart xl2tpd &&
        systemctl enable l2tp-forwards &&
        systemctl restart l2tp-forwards
    `;
    const result = await runCmd(script);
    res.json(result);
});

// API: Uninstall Server
app.post('/api/uninstall', async (req, res) => {
    const script = `
        systemctl stop xl2tpd l2tp-forwards
        systemctl disable xl2tpd l2tp-forwards
        apt-get remove --purge -y xl2tpd
        rm -rf /etc/xl2tpd /etc/ppp/options.xl2tpd /etc/l2tp-forwards.conf /etc/systemd/system/l2tp-forwards.service /usr/local/bin/l2tp-forwards-start.sh
        systemctl daemon-reload
        iptables -t nat -D POSTROUTING -s 172.16.101.0/24 -j MASQUERADE 2>/dev/null
        iptables -D INPUT -p udp -m udp --dport 1701 -j ACCEPT 2>/dev/null
        netfilter-persistent save
    `;
    const result = await runCmd(script);
    res.json(result);
});

async function startServer() {
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
}

startServer();
