import React from 'react';
import { useStore } from './store';
import { ConnectionStatus } from './App';

type SidebarProps = {
  connectionStatus: ConnectionStatus;
  onRetry: () => void;
  isEffectivelyCollapsed: boolean;
};

const Sidebar: React.FC<SidebarProps> = ({ connectionStatus, onRetry, isEffectivelyCollapsed }) => {
  const activeView = useStore((state) => state.activeView);
  const setActiveView = useStore((state) => state.setActiveView);
  const settings = useStore((state) => state.settings);
  const isManuallyCollapsed = useStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useStore((state) => state.toggleSidebar);

  const homeIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
  );

  const controllerIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" x2="4" y1="21" y2="14"></line>
        <line x1="4" x2="4" y1="10" y2="3"></line>
        <line x1="12" x2="12" y1="21" y2="12"></line>
        <line x1="12" x2="12" y1="8" y2="3"></line>
        <line x1="20" x2="20" y1="21" y2="16"></line>
        <line x1="20" x2="20" y1="12" y2="3"></line>
        <line x1="2" x2="6" y1="14" y2="14"></line>
        <line x1="10" x2="14" y1="8" y2="8"></line>
        <line x1="18" x2="22" y1="16" y2="16"></line>
    </svg>
  );

  const raceIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="21" x2="9" y2="3"></line>
      <path d="M9 3 C 13 2, 17 4, 21 5 L 20 12 C 16 13, 12 11, 9 10 Z"></path>
      <line x1="9" y1="6.5" x2="20.5" y2="8.5"></line>
      <line x1="15" y1="4" x2="14.5" y2="11"></line>
    </svg>
  );
  
  const positionIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19 C 9 13, 15 11, 19 5"></path>
      <polyline points="15 5, 19 5, 19 9"></polyline>
      <path d="M5 5 C 9 11, 15 13, 19 19" strokeDasharray="4 4"></path>
      <polyline points="15 19, 19 19, 19 15"></polyline>
    </svg>
  );

  const leaderboardIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="10" y1="6" x2="21" y2="6"></line>
        <line x1="10" y1="12" x2="21" y2="12"></line>
        <line x1="10" y1="18" x2="21" y2="18"></line>
        <path d="M4 6h1v4"></path>
        <path d="M4 10h2"></path>
        <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path>
    </svg>
  );

  const tiresIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M15 12 13.5 14.6 10.5 14.6 9 12 10.5 9.4 13.5 9.4 15 12z"></path>
    </svg>
  );

  const statsIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V10"/>
        <path d="M18 20V4"/>
        <path d="M6 20V16"/>
    </svg>
  );

  const pitstopIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 20 V 13 H 7 V 6 H 17 V 8 H 21 V 12 H 17 V 14 H 14 V 20 Z"></path>
    </svg>
  );

  const weatherIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
    </svg>
  );

  const raceControlIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
        <line x1="4" y1="22" x2="4" y2="15"></line>
    </svg>
  );

  const debugIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20.5c-4.2 0-8-2.6-8-6.5s3.8-6.5 8-6.5 8 2.6 8 6.5-3.8 6.5-8 6.5Z"></path>
      <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path>
      <path d="M12 4V2"></path>
      <path d="m4.9 6.4-.9-.9"></path>
      <path d="m19.1 6.4.9-.9"></path>
      <path d="M12 22v-2"></path>
      <path d="m4.9 17.6-.9.9"></path>
      <path d="m19.1 17.6.9.9"></path>
      <path d="M2 12h2"></path>
      <path d="M20 12h2"></path>
      <path d="m6.2 10.4-3.7-2.9"></path>
      <path d="m17.8 10.4 3.7-2.9"></path>
      <path d="m6.2 13.6-3.7 2.9"></path>
      <path d="m17.8 13.6 3.7 2.9"></path>
    </svg>
  );

  const collapseIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m11 17-5-5 5-5"></path>
      <path d="m18 17-5-5 5-5"></path>
    </svg>
  );

  const expandIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m13 17 5-5-5-5"></path>
      <path d="m6 17 5-5-5-5"></path>
    </svg>
  );

  const retryIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"></polyline>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
    </svg>
  );

  const navItems = [
    { id: 'home', label: 'Home', icon: homeIcon, restricted: false },
    { id: 'race', label: 'Race', icon: raceIcon, restricted: true },
    { id: 'leaderboard', label: 'Leaderboard', icon: leaderboardIcon, restricted: true },
    { id: 'position', label: 'Position', icon: positionIcon, restricted: true },
    { id: 'tires', label: 'Tires', icon: tiresIcon, restricted: true },
    { id: 'tire-stats', label: 'Tire Stats', icon: statsIcon, restricted: true },
    { id: 'pitstops', label: 'Pitstops', icon: pitstopIcon, restricted: true },
    { id: 'weather', label: 'Weather', icon: weatherIcon, restricted: true },
    { id: 'race-control', label: 'Race Control', icon: raceControlIcon, restricted: true },
    { id: 'controller', label: 'Controller', icon: controllerIcon, restricted: true },
  ];

  if (settings.debugMode) {
    navItems.push({ id: 'debug', label: 'Debug', icon: debugIcon, restricted: true });
  }

  const connectionTitleMap: Record<ConnectionStatus, string> = {
    'not-configured': 'Not configured. Go to Settings.',
    connecting: 'Connecting to Multiviewer...',
    connected: 'Connected to Multiviewer',
    error: 'Connection to Multiviewer failed',
  };
  
  const connectionStatusLabelMap: Record<ConnectionStatus, string> = {
    'not-configured': 'Not Configured',
    connecting: 'Connecting',
    connected: 'Connected',
    error: 'Failed',
  };

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <h1>
          <span className="logo-multiviewer">
            {isEffectivelyCollapsed ? 'MV' : 'MultiViewer'}
          </span>
          <br />
          <span className={isEffectivelyCollapsed ? 'logo-multiviewer logo-remote' : 'logo-remote'}>
            Remote
          </span>
        </h1>
      </div>
      <ul className="nav-links">
        {navItems.map(item => {
          const isConnected = connectionStatus === 'connected';
          const isDisabled = item.restricted && !isConnected;
          
          let className = '';
          if (activeView === item.id) className += 'active';
          if (isDisabled) className += ' disabled';

          return (
            <li key={item.id}>
              <a
                href="#"
                className={className}
                onClick={(e) => { 
                  e.preventDefault();
                  if (!isDisabled) {
                    setActiveView(item.id);
                  }
                }}
                title={isDisabled ? 'Requires an active connection' : item.label}
              >
                {item.icon}
                <span>{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
      <div className="sidebar-footer">
        <a
          href="#"
          className={activeView === 'settings' ? 'active' : ''}
          onClick={(e) => { e.preventDefault(); setActiveView('settings'); }}
          title="Settings"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.44,0.17-0.48,0.41L9.18,5.03C8.59,5.27,8.06,5.59,7.56,5.97L5.17,5.01C4.95,4.94,4.7,5.01,4.58,5.23L2.66,8.55 c-0.11,0.2-0.06,0.47,0.12,0.61l2.03,1.58C4.78,11.06,4.76,11.37,4.76,11.7c0,0.32,0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.42,2.22 c0.04,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44,0.17,0.48,0.41l0.42-2.22c0.59-0.24,1.12-0.56,1.62-0.94l2.39,0.96 c0.22,0.07,0.47,0,0.59-0.22l1.92-3.32c0.11-0.2,0.06-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
          </svg>
          <span>Settings</span>
        </a>
        <div
          className={`connection-status ${connectionStatus === 'error' ? 'clickable' : ''}`}
          onClick={connectionStatus === 'error' ? onRetry : undefined}
          title={connectionTitleMap[connectionStatus]}
          role={connectionStatus === 'error' ? "button" : undefined}
          aria-label={connectionStatus === 'error' ? "Retry connection" : undefined}
          tabIndex={connectionStatus === 'error' ? 0 : undefined}
          onKeyDown={connectionStatus === 'error' ? (e) => { if (e.key === 'Enter') onRetry(); } : undefined}
        >
          <span className={`connection-indicator ${connectionStatus}`} />
          <span className="connection-status-label">{connectionStatusLabelMap[connectionStatus]}</span>
          {connectionStatus === 'error' && <span className="retry-icon">{retryIcon}</span>}
        </div>
        <button
            className="sidebar-toggle"
            onClick={toggleSidebar}
            title={isManuallyCollapsed ? 'Expand' : 'Collapse'}
        >
          {isManuallyCollapsed ? expandIcon : collapseIcon}
        </button>
        <div className="sidebar-version">
          v{__APP_VERSION__.split('.').slice(0, 2).join('.')}
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;