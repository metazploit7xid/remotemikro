from utils.logger import log
from utils.system import run_command

CHAP_SECRETS = "/etc/ppp/chap-secrets"

def add_user(username, password, ip="*"):
    with open(CHAP_SECRETS, 'a') as f:
        f.write(f'"{username}" l2tpd "{password}" {ip}\n')
    log.info(f"User '{username}' added successfully.")

def delete_user(username):
    success, stdout, _ = run_command(f"grep -v '^\"{username}\"' {CHAP_SECRETS} > {CHAP_SECRETS}.tmp && mv {CHAP_SECRETS}.tmp {CHAP_SECRETS}")
    if success:
        log.info(f"User '{username}' deleted successfully.")
    else:
        log.error(f"Failed to delete user '{username}'.")

def list_users():
    log.info("--- VPN Users ---")
    try:
        with open(CHAP_SECRETS, 'r') as f:
            lines = f.readlines()
            for line in lines:
                line = line.strip()
                if line and not line.startswith('#'):
                    parts = line.split()
                    if len(parts) >= 4:
                        user = parts[0].strip('"')
                        ip = parts[3]
                        log.info(f"Username: {user} | IP: {ip}")
    except FileNotFoundError:
        log.error("chap-secrets file not found.")
