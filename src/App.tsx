import React, { useState, useEffect } from 'react';
import { 
  Activity, Users, Network, Settings, Plus, Trash2, Edit,
  Play, Square, RefreshCw, Server, Shield, Terminal, Search,
  Menu, X, Moon, Sun, Lock, LogOut, ChevronUp, ChevronDown,
  Monitor, Eye, Database, CheckCircle2, XCircle, LogIn
} from 'lucide-react';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('l2tp_token'));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!token);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [status, setStatus] = useState({ xl2tpd: 'unknown', forwards: 'unknown' });
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [forwards, setForwards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [diagnoseOutput, setDiagnoseOutput] = useState('');
  
  // Monitoring states
  const [mikrotikConfigs, setMikrotikConfigs] = useState<any>({});
  const [monitoringData, setMonitoringData] = useState<any>(null);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [monitoringFilter, setMonitoringFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [showConfigModal, setShowConfigModal] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState({ apiUser: 'admin', apiPass: '', apiPort: '8728' });
  
  // New states for Dark Mode, Mobile Menu, and Forward Type
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('l2tp_dark_mode') === 'true');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [forwardType, setForwardType] = useState<'standard' | 'custom'>('standard');
  const [isLogsOpen, setIsLogsOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('l2tp_token');
    setToken(null);
    setIsAuthenticated(false);
  };

  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      handleLogout();
      throw new Error('Unauthorized');
    }
    return response;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('l2tp_token', data.token);
        setToken(data.token);
        setIsAuthenticated(true);
      } else {
        setLoginError(data.error || 'Login failed');
      }
    } catch (e) {
      setLoginError('Network error');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('l2tp_dark_mode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('l2tp_dark_mode', 'false');
    }
  }, [isDarkMode]);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  const fetchStatus = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiFetch('/api/status');
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      setStatus({ xl2tpd: 'error', forwards: 'error' });
    }
  };

  const fetchClients = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiFetch('/api/clients');
      setClients(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiFetch('/api/users');
      setUsers(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMikrotikConfigs = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiFetch('/api/mikrotik/configs');
      const data = await res.json();
      setMikrotikConfigs(data);
    } catch (e) {}
  };

  const fetchPPPoE = async (username: string, ip: string) => {
    setMonitoringLoading(true);
    setMonitoringData(null);
    try {
      const res = await apiFetch(`/api/mikrotik/pppoe/${username}?ip=${ip}`);
      const data = await res.json();
      if (data.error) {
        addLog(`Error: ${data.error}`);
      } else {
        setMonitoringData({ username, ...data });
        addLog(`Fetched PPPoE data for ${username}`);
      }
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
    }
    setMonitoringLoading(false);
  };

  const saveMikrotikConfig = async () => {
    if (!showConfigModal) return;
    try {
      const url = showConfigModal === '__global__' ? '/api/mikrotik/configs/global' : '/api/mikrotik/configs';
      const payload = showConfigModal === '__global__' ? configForm : { username: showConfigModal, ...configForm };
      
      await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      addLog(`Saved MikroTik config for ${showConfigModal === '__global__' ? 'Global Default' : showConfigModal}`);
      fetchMikrotikConfigs();
      setShowConfigModal(null);
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
    }
  };

  const fetchForwards = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiFetch('/api/forwards');
      setForwards(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleDiagnose = async () => {
    setLoading(true);
    addLog("Diagnosing ports...");
    try {
      const res = await apiFetch('/api/diagnose');
      const data = await res.json();
      setDiagnoseOutput(data.output);
      addLog("Diagnose complete.");
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchStatus();
    if (activeTab === 'dashboard') fetchClients();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'forwards') fetchForwards();
    if (activeTab === 'monitoring') {
      fetchUsers();
      fetchClients();
      fetchMikrotikConfigs();
    }
    
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [activeTab, isAuthenticated]);

  const handleService = async (service: string, action: string) => {
    setLoading(true);
    addLog(`Executing ${action} on ${service}...`);
    try {
      const res = await apiFetch('/api/service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, action })
      });
      const data = await res.json();
      addLog(data.success ? `Service ${action} successful.` : `Failed: ${data.stderr || data.error}`);
      fetchStatus();
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const handleInstall = async () => {
    if (!confirm("Are you sure you want to run the L2TP installation script? This will modify system files.")) return;
    setLoading(true);
    addLog("Starting L2TP installation...");
    try {
      const res = await apiFetch('/api/install', { method: 'POST' });
      const data = await res.json();
      addLog(data.success ? "Installation completed successfully!" : `Installation failed: ${data.stderr || data.error}`);
      fetchStatus();
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const handleUninstall = async () => {
    if (!confirm("WARNING: This will completely remove L2TP server, users, and port forwards. Are you sure?")) return;
    setLoading(true);
    addLog("Starting L2TP uninstallation...");
    try {
      const res = await apiFetch('/api/uninstall', { method: 'POST' });
      const data = await res.json();
      addLog(data.success ? "Uninstallation completed successfully!" : `Uninstallation failed: ${data.stderr || data.error}`);
      fetchStatus();
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const handleAddOrEditUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const username = fd.get('username');
    const password = fd.get('password');
    const ip = fd.get('ip') || '*';
    
    setLoading(true);
    try {
      const url = editingUser ? `/api/users/${editingUser.username}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, ip })
      });
      if (res.ok) {
        addLog(`User ${username} ${editingUser ? 'updated' : 'added'}.`);
        fetchUsers();
        setEditingUser(null);
        (e.target as HTMLFormElement).reset();
      } else {
        const data = await res.json();
        addLog(`Failed to save user: ${data.error}`);
      }
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const handleDeleteUser = async (username: string) => {
    if (!confirm(`Delete user ${username}?`)) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/users/${username}`, { method: 'DELETE' });
      if (res.ok) {
        addLog(`User ${username} deleted.`);
        fetchUsers();
      }
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const handleAddForward = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    
    setLoading(true);
    try {
      if (forwardType === 'standard') {
        const res = await apiFetch('/api/forwards/mikrotik', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: payload.username, clientIp: payload.clientIp })
        });
        if (res.ok) {
          const data = await res.json();
          addLog(`Standard MikroTik forwards created for ${payload.username}. Winbox: ${data.winboxPort}, API: ${data.apiPort}`);
          fetchForwards();
          (e.target as HTMLFormElement).reset();
        } else {
          const data = await res.json();
          addLog(`Failed to add standard forwards: ${data.error}`);
        }
      } else {
        const res = await apiFetch('/api/forwards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          addLog(`Port forward added: ${payload.name} (${payload.extPort} -> ${payload.intIp}:${payload.intPort})`);
          fetchForwards();
          (e.target as HTMLFormElement).reset();
        } else {
          const data = await res.json();
          addLog(`Failed to add forward: ${data.error}`);
        }
      }
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const handleDeleteForward = async (name: string) => {
    if (!confirm(`Delete port forward ${name}?`)) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/forwards/${name}`, { method: 'DELETE' });
      if (res.ok) {
        addLog(`Port forward ${name} deleted.`);
        fetchForwards();
      }
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const [changeCreds, setChangeCreds] = useState({ currentPassword: '', newUsername: '', newPassword: '' });
  const [changeCredsMsg, setChangeCredsMsg] = useState({ type: '', text: '' });

  const handleChangeCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setChangeCredsMsg({ type: '', text: '' });
    try {
      const res = await apiFetch('/api/auth/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changeCreds)
      });
      const data = await res.json();
      if (data.success) {
        setChangeCredsMsg({ type: 'success', text: 'Credentials updated successfully.' });
        setChangeCreds({ currentPassword: '', newUsername: '', newPassword: '' });
      } else {
        setChangeCredsMsg({ type: 'error', text: data.error || 'Failed to update credentials' });
      }
    } catch (e: any) {
      setChangeCredsMsg({ type: 'error', text: 'Network error' });
    }
    setLoading(false);
  };

  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-200`}>
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800">
          <div className="flex justify-center mb-6 relative">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl flex items-center justify-center">
              <Shield className="text-indigo-600 dark:text-indigo-400" size={32} />
            </div>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="absolute right-0 top-0 p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
          <h1 className="text-2xl font-bold text-center text-slate-800 dark:text-white mb-8">Remote Mikrotik Login</h1>
          {loginError && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm mb-6 text-center">
              {loginError}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username</label>
              <input 
                type="text" 
                required 
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-800 dark:text-white" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <input 
                type="password" 
                required 
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-800 dark:text-white" 
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 mt-4"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 flex items-center justify-between lg:justify-start gap-3 text-white font-bold text-xl border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Shield className="text-indigo-500" />
            Remote Mikrotik
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {[
            { id: 'dashboard', icon: Activity, label: 'Dashboard' },
            { id: 'users', icon: Users, label: 'VPN Users' },
            { id: 'monitoring', icon: Monitor, label: 'Monitoring' },
            { id: 'forwards', icon: Network, label: 'Port Forwards' },
            { id: 'settings', icon: Settings, label: 'Settings & Install' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === item.id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 space-y-1">
          <div>L2TP: <span className={status.xl2tpd === 'running' ? 'text-emerald-400' : 'text-red-400'}>{status.xl2tpd.toUpperCase()}</span></div>
          <div>Forwards: <span className={status.forwards === 'running' ? 'text-emerald-400' : 'text-red-400'}>{status.forwards.toUpperCase()}</span></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 lg:px-8 py-4 lg:py-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100">
              <Menu size={24} />
            </button>
            <h1 className="text-xl lg:text-2xl font-semibold text-slate-800 dark:text-slate-100 capitalize">{activeTab.replace('-', ' ')}</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button 
              onClick={handleLogout}
              className="text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors flex items-center gap-1"
              title="Logout"
            >
              <LogOut size={20} />
              <span className="hidden sm:inline text-sm font-medium">Logout</span>
            </button>
            <div className="flex items-center gap-2 ml-2">
              <span className="relative flex h-3 w-3">
                {(status.xl2tpd === 'running' || status.forwards === 'running') && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${status.xl2tpd === 'running' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
              </span>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300 hidden sm:inline">
                {status.xl2tpd === 'running' ? 'System Active' : 'System Inactive'}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg"><Server size={24} /></div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">L2TP Service</p>
                    <p className="text-xl font-bold capitalize">{status.xl2tpd}</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg"><Network size={24} /></div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Forwards Service</p>
                    <p className="text-xl font-bold capitalize">{status.forwards}</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg"><Activity size={24} /></div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Active Clients</p>
                    <p className="text-xl font-bold">{clients.length}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                    <h2 className="font-semibold text-slate-800 dark:text-slate-100">Connected Clients</h2>
                    <button onClick={fetchClients} className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"><RefreshCw size={18} /></button>
                  </div>
                  <div className="p-0 overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[400px]">
                      <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="px-6 py-3 font-medium">Interface</th>
                          <th className="px-6 py-3 font-medium">Local IP</th>
                          <th className="px-6 py-3 font-medium">Peer IP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {clients.length === 0 ? (
                          <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">No active connections</td></tr>
                        ) : (
                          clients.map((c, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="px-6 py-4 font-mono text-indigo-600 dark:text-indigo-400">{c.interface}</td>
                              <td className="px-6 py-4">{c.localIp}</td>
                              <td className="px-6 py-4 font-medium">{c.peerIp}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                    <h2 className="font-semibold text-slate-800 dark:text-slate-100">Port Diagnostics</h2>
                    <button onClick={handleDiagnose} disabled={loading} className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 flex items-center gap-1 text-sm">
                      <Search size={16} /> Check Ports
                    </button>
                  </div>
                  <div className="p-4 flex-1 bg-slate-900 dark:bg-black text-emerald-400 font-mono text-xs overflow-auto whitespace-pre">
                    {diagnoseOutput || "Click 'Check Ports' to see active listening ports (1701 & socat)."}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                  <h2 className="font-semibold text-slate-800 dark:text-slate-100">VPN Users</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[500px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="px-6 py-3 font-medium">Username</th>
                        <th className="px-6 py-3 font-medium">Password</th>
                        <th className="px-6 py-3 font-medium">Static IP</th>
                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {users.length === 0 ? (
                        <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">No users found</td></tr>
                      ) : (
                        users.map((u, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-6 py-4 font-medium">{u.username}</td>
                            <td className="px-6 py-4 font-mono text-slate-400 dark:text-slate-500">{u.password}</td>
                            <td className="px-6 py-4 font-mono text-slate-500 dark:text-slate-400">{u.ip}</td>
                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                              <button onClick={() => setEditingUser(u)} className="text-blue-500 hover:text-blue-400 p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                                <Edit size={18} />
                              </button>
                              <button onClick={() => handleDeleteUser(u.username)} disabled={loading} className="text-red-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                                <Trash2 size={18} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm h-fit">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                  <h2 className="font-semibold text-slate-800 dark:text-slate-100">{editingUser ? 'Edit User' : 'Add New User'}</h2>
                  {editingUser && (
                    <button onClick={() => setEditingUser(null)} className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">Cancel</button>
                  )}
                </div>
                <form onSubmit={handleAddOrEditUser} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username</label>
                    <input name="username" defaultValue={editingUser?.username} readOnly={!!editingUser} required pattern="^[a-zA-Z0-9_-]+$" className={`w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-800 dark:text-white ${editingUser ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400' : ''}`} placeholder="client01" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                    <input name="password" defaultValue={editingUser?.password} required className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-800 dark:text-white" placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Static IP (Optional)</label>
                    <input name="ip" defaultValue={editingUser?.ip === '*' ? '' : editingUser?.ip} placeholder="*" className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-800 dark:text-white" />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Leave blank or * for dynamic IP.</p>
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                    {editingUser ? <Edit size={18} /> : <Plus size={18} />} {editingUser ? 'Save Changes' : 'Add User'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Port Forwards Tab */}
          {activeTab === 'monitoring' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                  {(['all', 'online', 'offline'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setMonitoringFilter(f)}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        monitoringFilter === f 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setShowConfigModal('__global__');
                      setConfigForm(mikrotikConfigs['__global__'] || { apiUser: 'admin', apiPass: '', apiPort: '8728' });
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                  >
                    <Settings size={16} /> Global API Settings
                  </button>
                  <button 
                    onClick={() => { fetchUsers(); fetchClients(); }}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh Status
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-1 space-y-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Users size={20} className="text-indigo-500" /> MikroTik List
                  </h2>
                  <div className="space-y-3">
                    {users
                      .filter(u => {
                        const isOnline = clients.some(c => c.interface.includes(u.username) || u.username === c.interface); // Simplified matching
                        // Better matching: check if any client IP belongs to this user's expected IP or just check if user is in clients
                        // Since we don't have exact mapping, we'll assume username is part of interface or just check if online
                        const onlineClient = clients.find(c => c.interface.includes(u.username) || u.username === c.interface);
                        if (monitoringFilter === 'online') return !!onlineClient;
                        if (monitoringFilter === 'offline') return !onlineClient;
                        return true;
                      })
                      .map(user => {
                        const onlineClient = clients.find(c => c.interface.includes(user.username) || user.username === c.interface);
                        const isOnline = !!onlineClient;
                        const hasConfig = !!mikrotikConfigs[user.username];

                        return (
                          <div 
                            key={user.username}
                            className={`p-4 rounded-xl border transition-all ${
                              monitoringData?.username === user.username 
                                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10' 
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-700'}`} />
                                <span className="font-bold text-slate-800 dark:text-slate-100">{user.username}</span>
                              </div>
                              <button 
                                onClick={() => {
                                  setShowConfigModal(user.username);
                                  setConfigForm(mikrotikConfigs[user.username] || { apiUser: 'admin', apiPass: '', apiPort: '8728' });
                                }}
                                className="p-1.5 text-slate-400 hover:text-indigo-500 transition-colors"
                                title="API Settings"
                              >
                                <Database size={16} />
                              </button>
                            </div>
                            
                            <div className="text-xs text-slate-500 space-y-1 mb-4">
                              <div className="flex justify-between">
                                <span>Status:</span>
                                <span className={isOnline ? 'text-emerald-500 font-medium' : ''}>{isOnline ? 'Online' : 'Offline'}</span>
                              </div>
                              {isOnline && (
                                <div className="flex justify-between">
                                  <span>Peer IP:</span>
                                  <span className="font-mono">{onlineClient?.peerIp}</span>
                                </div>
                              )}
                            </div>

                            <button
                              disabled={!isOnline || monitoringLoading}
                              onClick={() => {
                                if (hasConfig) {
                                  fetchPPPoE(user.username, onlineClient?.peerIp);
                                } else {
                                  setShowConfigModal(user.username);
                                  setConfigForm({ apiUser: 'admin', apiPass: '', apiPort: '8728' });
                                }
                              }}
                              className={`w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                                isOnline 
                                  ? hasConfig
                                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm' 
                                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              {monitoringLoading && monitoringData?.username === user.username ? (
                                <RefreshCw size={16} className="animate-spin" />
                              ) : (
                                hasConfig ? <Eye size={16} /> : <LogIn size={16} />
                              )}
                              {hasConfig ? 'Monitor PPPoE' : 'Login to Monitor'}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="xl:col-span-2 space-y-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Activity size={20} className="text-indigo-500" /> 
                    {monitoringData ? `PPPoE Clients: ${monitoringData.username}` : 'Select an online MikroTik to monitor'}
                  </h2>

                  {!monitoringData ? (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-400">
                        <Monitor size={32} />
                      </div>
                      <h3 className="text-slate-800 dark:text-slate-100 font-medium mb-1">No Data Selected</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs">
                        Click "Monitor PPPoE" on an online MikroTik to fetch its real-time PPPoE client status.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Secrets</div>
                          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{monitoringData.secrets.length}</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Active Sessions</div>
                          <div className="text-2xl font-bold text-emerald-500">{monitoringData.active.length}</div>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                                <th className="px-6 py-3 font-medium">Status</th>
                                <th className="px-6 py-3 font-medium">User / Profile</th>
                                <th className="px-6 py-3 font-medium">Remote Address</th>
                                <th className="px-6 py-3 font-medium">Uptime</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {monitoringData.secrets.map((secret: any) => {
                                const active = monitoringData.active.find((a: any) => a.name === secret.name);
                                return (
                                  <tr key={secret.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4">
                                      {active ? (
                                        <span className="flex items-center gap-1.5 text-emerald-500 text-xs font-medium">
                                          <CheckCircle2 size={14} /> Online
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                                          <XCircle size={14} /> Offline
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-6 py-4">
                                      <div className="font-medium text-slate-800 dark:text-slate-100">{secret.name}</div>
                                      <div className="text-xs text-slate-500">{secret.profile}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                      <div className="text-sm font-mono text-slate-600 dark:text-slate-400">
                                        {active ? active.address : (secret['remote-address'] || '-')}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4">
                                      <div className="text-xs text-slate-500">{active ? active.uptime : '-'}</div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* MikroTik API Config Modal */}
              {showConfigModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Database size={18} className="text-indigo-500" /> 
                        {showConfigModal === '__global__' ? 'Global Default API Config' : `API Config: ${showConfigModal}`}
                      </h3>
                      <button onClick={() => setShowConfigModal(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X size={20} />
                      </button>
                    </div>
                    <div className="p-6 space-y-4">
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        {showConfigModal === '__global__' 
                          ? 'Set default credentials to be used for all MikroTiks that don\'t have specific settings.'
                          : 'Enter MikroTik API credentials to allow the VPS to fetch PPPoE status via the L2TP tunnel.'}
                      </p>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">API Username</label>
                        <input 
                          type="text" 
                          value={configForm.apiUser}
                          onChange={e => setConfigForm({...configForm, apiUser: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-800 dark:text-white" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">API Password</label>
                        <input 
                          type="password" 
                          value={configForm.apiPass}
                          onChange={e => setConfigForm({...configForm, apiPass: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-800 dark:text-white" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">API Port</label>
                        <input 
                          type="text" 
                          value={configForm.apiPort}
                          onChange={e => setConfigForm({...configForm, apiPort: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-800 dark:text-white" 
                        />
                      </div>
                    </div>
                    <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                      <button onClick={() => setShowConfigModal(null)} className="px-4 py-2 text-slate-600 dark:text-slate-400 font-medium hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                        Cancel
                      </button>
                      <button onClick={saveMikrotikConfig} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'forwards' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                  <h2 className="font-semibold text-slate-800 dark:text-slate-100">Active Port Forwards (socat)</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[600px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="px-6 py-3 font-medium">Name</th>
                        <th className="px-6 py-3 font-medium">VPS Port</th>
                        <th className="px-6 py-3 font-medium">Target (Client IP:Port)</th>
                        <th className="px-6 py-3 font-medium">Description</th>
                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {forwards.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">No port forwards found</td></tr>
                      ) : (
                        forwards.map((f, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{f.name}</td>
                            <td className="px-6 py-4 font-mono text-indigo-600 dark:text-indigo-400">{f.extPort}</td>
                            <td className="px-6 py-4 font-mono dark:text-slate-300">{f.intIp}:{f.intPort}</td>
                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{f.desc}</td>
                            <td className="px-6 py-4 text-right">
                              <button onClick={() => handleDeleteForward(f.name)} disabled={loading} className="text-red-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                                <Trash2 size={18} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm h-fit">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                  <h2 className="font-semibold text-slate-800 dark:text-slate-100">Create Port Forward</h2>
                </div>
                
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 p-1 bg-slate-100 dark:bg-slate-800">
                    <button 
                      type="button"
                      onClick={() => setForwardType('standard')}
                      className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${forwardType === 'standard' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                    >
                      🎯 Standard MikroTik
                    </button>
                    <button 
                      type="button"
                      onClick={() => setForwardType('custom')}
                      className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${forwardType === 'custom' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                    >
                      🛠️ Custom Ports
                    </button>
                  </div>
                </div>

                <form onSubmit={handleAddForward} className="p-6 space-y-4">
                  {forwardType === 'standard' ? (
                    <>
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg text-sm text-indigo-800 dark:text-indigo-300 mb-4 border border-indigo-100 dark:border-indigo-800/50">
                        Automatically sets up Winbox (8291) and API (8728) forwards with unique available ports on the VPS.
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username</label>
                        <input name="username" required pattern="^[a-zA-Z0-9_-]+$" placeholder="client01" className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-800 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Client VPN IP</label>
                        <input name="clientIp" required pattern="^[\d\.]+$" placeholder="172.16.101.10" className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-800 dark:text-white" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Forward Name</label>
                        <input name="name" required pattern="^[a-zA-Z0-9_-]+$" placeholder="client-winbox" className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-800 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">VPS Public Port</label>
                        <input name="extPort" required pattern="^\d+$" placeholder="8080" className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-800 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Client VPN IP</label>
                        <input name="intIp" required pattern="^[\d\.]+$" placeholder="172.16.101.10" className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-800 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Client Target Port</label>
                        <input name="intPort" required pattern="^\d+$" placeholder="8291" className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-800 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description (Optional)</label>
                        <input name="desc" placeholder="MikroTik Winbox" className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-800 dark:text-white" />
                      </div>
                    </>
                  )}
                  <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                    <Plus size={18} /> Create Forward
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="max-w-3xl space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <Server className="text-indigo-500" /> Service Controls
                </h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">L2TP Service (xl2tpd)</h3>
                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => handleService('xl2tpd', 'start')} disabled={loading || status.xl2tpd === 'running'} className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 text-sm">
                        <Play size={16} /> Start
                      </button>
                      <button onClick={() => handleService('xl2tpd', 'stop')} disabled={loading || status.xl2tpd !== 'running'} className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 text-sm">
                        <Square size={16} /> Stop
                      </button>
                      <button onClick={() => handleService('xl2tpd', 'restart')} disabled={loading} className="px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 text-sm">
                        <RefreshCw size={16} /> Restart
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Port Forwards Service (socat)</h3>
                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => handleService('l2tp-forwards', 'start')} disabled={loading || status.forwards === 'running'} className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 text-sm">
                        <Play size={16} /> Start
                      </button>
                      <button onClick={() => handleService('l2tp-forwards', 'stop')} disabled={loading || status.forwards !== 'running'} className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 text-sm">
                        <Square size={16} /> Stop
                      </button>
                      <button onClick={() => handleService('l2tp-forwards', 'restart')} disabled={loading} className="px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 text-sm">
                        <RefreshCw size={16} /> Restart
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 border-l-4 border-l-indigo-500">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Initial Installation</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                  Run this only once on a fresh Ubuntu/Debian VPS. It will install xl2tpd, ppp, iptables, socat, configure NAT, and set up the default IP range (172.16.101.0/24).
                </p>
                <button onClick={handleInstall} disabled={loading} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
                  Run Install Script
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 border-l-4 border-l-amber-500">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <Lock className="text-amber-500" size={20} /> Change Admin Credentials
                </h2>
                {changeCredsMsg.text && (
                  <div className={`mb-4 p-3 rounded-lg text-sm ${changeCredsMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {changeCredsMsg.text}
                  </div>
                )}
                <form onSubmit={handleChangeCredentials} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Current Password</label>
                    <input 
                      type="password" 
                      required 
                      value={changeCreds.currentPassword}
                      onChange={e => setChangeCreds({...changeCreds, currentPassword: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-800 dark:text-white" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Username (Optional)</label>
                    <input 
                      type="text" 
                      value={changeCreds.newUsername}
                      onChange={e => setChangeCreds({...changeCreds, newUsername: e.target.value})}
                      placeholder="Leave blank to keep current"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-800 dark:text-white" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Password (Optional)</label>
                    <input 
                      type="password" 
                      value={changeCreds.newPassword}
                      onChange={e => setChangeCreds({...changeCreds, newPassword: e.target.value})}
                      placeholder="Leave blank to keep current"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-800 dark:text-white" 
                    />
                  </div>
                  <button type="submit" disabled={loading} className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
                    Update Credentials
                  </button>
                </form>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 border-l-4 border-l-red-500">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Uninstall Server</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                  Completely remove the L2TP server, all users, port forwards, and firewall rules from this VPS.
                </p>
                <button onClick={handleUninstall} disabled={loading} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
                  Uninstall L2TP Server
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Action Logs Terminal */}
        <div className={`bg-slate-900 dark:bg-black border-t border-slate-800 flex flex-col transition-all duration-300 ease-in-out ${isLogsOpen ? 'h-48' : 'h-10'}`}>
          <div 
            className="h-10 px-4 border-b border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
            onClick={() => setIsLogsOpen(!isLogsOpen)}
          >
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
              <Terminal size={14} /> Action Logs {logs.length > 0 && !isLogsOpen && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px]">{logs.length}</span>}
            </div>
            <button className="text-slate-400 hover:text-white transition-colors">
              {isLogsOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
          <div className={`flex-1 overflow-auto p-4 font-mono text-xs text-slate-300 space-y-1 ${!isLogsOpen ? 'hidden' : ''}`}>
            {logs.length === 0 ? (
              <span className="text-slate-600 dark:text-slate-500">No recent actions...</span>
            ) : (
              logs.map((log, i) => <div key={i} className={log.includes('Error') || log.includes('Failed') ? 'text-red-400' : ''}>{log}</div>)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
