from utils.logger import log
from utils.system import run_command

def create_port_forward(vps_port, client_ip, client_port, protocol="tcp"):
    log.info(f"Creating port forward: VPS:{vps_port} -> {client_ip}:{client_port} ({protocol})")
    
    # Using iptables PREROUTING
    cmd1 = f"iptables -t nat -A PREROUTING -p {protocol} --dport {vps_port} -j DNAT --to-destination {client_ip}:{client_port}"
    cmd2 = f"iptables -t nat -A POSTROUTING -p {protocol} -d {client_ip} --dport {client_port} -j MASQUERADE"
    
    success1, _, err1 = run_command(cmd1)
    success2, _, err2 = run_command(cmd2)
    
    if success1 and success2:
        log.info("Port forward created successfully.")
        run_command("netfilter-persistent save", silent=True)
    else:
        log.error(f"Failed to create port forward: {err1} | {err2}")

def delete_port_forward(vps_port, client_ip, client_port, protocol="tcp"):
    log.info(f"Deleting port forward: VPS:{vps_port} -> {client_ip}:{client_port} ({protocol})")
    
    cmd1 = f"iptables -t nat -D PREROUTING -p {protocol} --dport {vps_port} -j DNAT --to-destination {client_ip}:{client_port}"
    cmd2 = f"iptables -t nat -D POSTROUTING -p {protocol} -d {client_ip} --dport {client_port} -j MASQUERADE"
    
    run_command(cmd1)
    run_command(cmd2)
    run_command("netfilter-persistent save", silent=True)
    log.info("Port forward deleted.")

def list_port_forwards():
    log.info("--- Active Port Forwards (DNAT) ---")
    success, stdout, _ = run_command("iptables -t nat -L PREROUTING -n -v | grep DNAT", silent=True)
    if success and stdout:
        log.info(stdout)
    else:
        log.info("No port forwards found.")
