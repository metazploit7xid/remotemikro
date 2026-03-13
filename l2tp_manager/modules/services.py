from utils.logger import log
from utils.system import run_command

def manage_service(action):
    if action in ['start', 'stop', 'restart', 'status']:
        log.info(f"Executing '{action}' on xl2tpd...")
        success, stdout, stderr = run_command(f"systemctl {action} xl2tpd")
        if action == 'status':
            log.info(stdout if success else stderr)
        else:
            if success:
                log.info(f"Service xl2tpd {action}ed successfully.")
            else:
                log.error(f"Failed to {action} xl2tpd: {stderr}")
    else:
        log.error("Invalid action.")
