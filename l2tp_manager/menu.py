from utils.logger import log
from modules import installer, users, clients, forwards, services

def display_menu():
    print("\n" + "="*30)
    print("       L2TP MANAGER CLI       ")
    print("="*30)
    print("1. Install L2TP Server")
    print("2. Add VPN User")
    print("3. Delete VPN User")
    print("4. List VPN Users")
    print("5. Show Connected Clients")
    print("6. Create Port Forward")
    print("7. Delete Port Forward")
    print("8. List Port Forwards")
    print("9. Manage VPN Service")
    print("10. Exit")
    print("="*30)

def handle_menu():
    while True:
        display_menu()
        choice = input("Select an option (1-10): ")
        
        if choice == '1':
            installer.install_server()
        elif choice == '2':
            username = input("Enter username: ")
            password = input("Enter password: ")
            ip = input("Enter static IP (or press Enter for '*'): ")
            if not ip: ip = "*"
            users.add_user(username, password, ip)
        elif choice == '3':
            username = input("Enter username to delete: ")
            users.delete_user(username)
        elif choice == '4':
            users.list_users()
        elif choice == '5':
            clients.show_connected_clients()
        elif choice == '6':
            vps_port = input("Enter VPS Port (e.g., 6000): ")
            client_ip = input("Enter Client IP (e.g., 172.16.101.10): ")
            client_port = input("Enter Client Port (e.g., 8291): ")
            protocol = input("Enter Protocol (tcp/udp) [default: tcp]: ") or "tcp"
            forwards.create_port_forward(vps_port, client_ip, client_port, protocol)
        elif choice == '7':
            vps_port = input("Enter VPS Port (e.g., 6000): ")
            client_ip = input("Enter Client IP (e.g., 172.16.101.10): ")
            client_port = input("Enter Client Port (e.g., 8291): ")
            protocol = input("Enter Protocol (tcp/udp) [default: tcp]: ") or "tcp"
            forwards.delete_port_forward(vps_port, client_ip, client_port, protocol)
        elif choice == '8':
            forwards.list_port_forwards()
        elif choice == '9':
            action = input("Enter action (start/stop/restart/status): ")
            services.manage_service(action)
        elif choice == '10':
            log.info("Exiting L2TP Manager. Goodbye!")
            break
        else:
            log.warning("Invalid option. Please try again.")
