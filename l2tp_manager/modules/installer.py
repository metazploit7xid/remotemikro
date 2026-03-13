import os
from utils.system import run_command
from utils.logger import log
from config import config

def install_server():
    log.info("Starting L2TP Server Installation...")
    
    # Install packages
    log.info("Installing required packages (xl2tpd, ppp, iptables)...")
    success, _, err = run_command("apt-get update && apt-get install -y xl2tpd ppp iptables socat")
    if not success:
        log.error(f"Failed to install packages: {err}")
        return

    # Configure xl2tpd
    log.info("Configuring xl2tpd...")
    xl2tpd_conf = f"""[global]
ipsec saref = no
force userspace = yes

[lns default]
ip range = {config['client_range']}
local ip = {config['vpn_server_ip']}
require chap = yes
refuse pap = yes
require authentication = yes
name = l2tpd
ppp debug = yes
pppoptfile = /etc/ppp/options.xl2tpd
length bit = yes
"""
    with open('/etc/xl2tpd/xl2tpd.conf', 'w') as f:
        f.write(xl2tpd_conf)

    # Configure ppp
    log.info("Configuring ppp options...")
    ppp_options = f"""ipcp-accept-local
ipcp-accept-remote
ms-dns {config['dns1']}
ms-dns {config['dns2']}
noccp
auth
crtscts
idle 1800
mtu 1410
mru 1410
nodefaultroute
debug
lock
proxyarp
connect-delay 5000
name l2tpd
refuse-pap
refuse-chap
refuse-mschap
require-mschap-v2
"""
    with open('/etc/ppp/options.xl2tpd', 'w') as f:
        f.write(ppp_options)

    # Ensure chap-secrets exists
    if not os.path.exists('/etc/ppp/chap-secrets'):
        open('/etc/ppp/chap-secrets', 'w').close()

    # Enable IP forwarding
    log.info("Enabling IP forwarding...")
    run_command("sysctl -w net.ipv4.ip_forward=1")
    run_command("sed -i 's/#net.ipv4.ip_forward=1/net.ipv4.ip_forward=1/g' /etc/sysctl.conf")

    # Setup NAT
    log.info("Setting up NAT with iptables...")
    run_command(f"iptables -t nat -A POSTROUTING -s {config['vpn_network']} -j MASQUERADE")
    run_command("apt-get install -y iptables-persistent")
    run_command("netfilter-persistent save")

    # Restart services
    log.info("Restarting services...")
    run_command("systemctl restart xl2tpd")
    run_command("systemctl enable xl2tpd")

    log.info("L2TP Server Installation Completed Successfully!")
