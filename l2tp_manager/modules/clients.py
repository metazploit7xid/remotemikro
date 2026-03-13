from utils.logger import log
from utils.system import run_command

def show_connected_clients():
    log.info("--- Connected Clients ---")
    success, stdout, _ = run_command("ip addr show | grep ppp", silent=True)
    if not success or not stdout:
        log.info("No clients currently connected.")
        return

    interfaces = stdout.split('\n')
    for iface in interfaces:
        parts = iface.split()
        if len(parts) >= 2:
            iface_name = parts[1].strip(':')
            # Get IP
            succ, ip_out, _ = run_command(f"ip addr show {iface_name} | grep inet", silent=True)
            if succ and ip_out:
                ip_parts = ip_out.strip().split()
                if len(ip_parts) >= 4:
                    local_ip = ip_parts[1]
                    peer_ip = ip_parts[3]
                    log.info(f"Interface: {iface_name} | Local: {local_ip} | Peer (Client IP): {peer_ip}")
