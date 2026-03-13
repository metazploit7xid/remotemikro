import os
import json
from utils.logger import log

CONFIG_DIR = "/etc/l2tp-manager"
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")

DEFAULT_CONFIG = {
    "vpn_network": "172.16.101.0/24",
    "vpn_server_ip": "172.16.101.1",
    "client_range": "172.16.101.10-172.16.101.100",
    "dns1": "8.8.8.8",
    "dns2": "8.8.4.4"
}

def load_config():
    if not os.path.exists(CONFIG_FILE):
        log.warning(f"Config file not found. Creating default at {CONFIG_FILE}")
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG
    
    try:
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        log.error(f"Failed to load config: {e}")
        return DEFAULT_CONFIG

def save_config(config_data):
    try:
        if not os.path.exists(CONFIG_DIR):
            os.makedirs(CONFIG_DIR, exist_ok=True)
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config_data, f, indent=4)
        log.info("Configuration saved successfully.")
    except Exception as e:
        log.error(f"Failed to save config: {e}")

config = load_config()
