import subprocess
from utils.logger import log

def run_command(command, shell=True, check=False, silent=False):
    try:
        if not silent:
            log.debug(f"Running: {command}")
        result = subprocess.run(command, shell=shell, check=check, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except Exception as e:
        log.error(f"Command failed: {command}\nError: {e}")
        return False, "", str(e)
