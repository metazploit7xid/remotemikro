#!/usr/bin/env python3
import os
import sys

def check_root():
    if os.geteuid() != 0:
        print("CRITICAL: This script must be run as root! Use 'sudo python3 main.py'")
        sys.exit(1)

def main():
    check_root()
    
    try:
        import colorama
    except ImportError:
        print("Installing required package 'colorama'...")
        os.system("pip3 install colorama")
        
    # Import after ensuring dependencies
    from utils.logger import log
    from menu import handle_menu
    
    # Ensure config directory exists
    if not os.path.exists('/etc/l2tp-manager'):
        os.makedirs('/etc/l2tp-manager', exist_ok=True)
        
    handle_menu()

if __name__ == "__main__":
    main()
