import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Settings } from './types';
import { getCookie, setCookie } from './utils';

interface AppState {
  settings: Settings;
  activeView: string;
  isSidebarCollapsed: boolean;
  isSpeedometerVisible: boolean;
  driverHeaderMode: 'OBC_LIVE_TIMING' | 'DRIVER_HEADER';
  setSettings: (newSettings: Settings) => void;
  setActiveView: (view: string) => void;
  toggleSidebar: () => void;
  setIsSpeedometerVisible: (isVisible: boolean) => void;
  setDriverHeaderMode: (mode: 'OBC_LIVE_TIMING' | 'DRIVER_HEADER') => void;
}

const defaultSettings: Settings = {
  multiviewerHost: '',
  refreshDuration: 2000,
  debugMode: false,
  displayMode: 'auto',
  pitstopBattlegroundDuration: 2,
  developerMode: false,
  apiOverrideUrl: '',
  units: 'metric',
};

// Robust function to load settings from cookies, merging with defaults
const loadInitialSettings = (): Settings => {
  const savedSettings = getCookie('settings');
  let settings: Partial<Settings> & { multiviewerUrl?: string } = {}; // Allow old property for migration
  if (savedSettings) {
    try {
      settings = JSON.parse(savedSettings);
    } catch (e) {
      console.error("Failed to parse settings from cookie, using defaults.", e);
      return defaultSettings;
    }
  }

  // Automatic, invisible migration for existing users
  if (settings.multiviewerUrl && !settings.multiviewerHost) {
    try {
      const url = new URL(settings.multiviewerUrl);
      settings.multiviewerHost = url.hostname;
    } catch (e) {
      // If parsing fails, it might just be the hostname already.
      // A simple regex can extract it more robustly from malformed strings.
      const hostMatch = settings.multiviewerUrl.match(/^(?:https?:\/\/)?([^:/]+)/);
      if (hostMatch && hostMatch[1]) {
        settings.multiviewerHost = hostMatch[1];
      }
    }
    // Clean up the old property
    delete settings.multiviewerUrl;
  }

  return { ...defaultSettings, ...settings };
};

export const useStore = create<AppState>()(
  subscribeWithSelector((set) => ({
    // Initial State
    settings: loadInitialSettings(),
    activeView: 'home',
    isSidebarCollapsed: getCookie('sidebarCollapsed') === 'true',
    isSpeedometerVisible: false,
    driverHeaderMode: 'OBC_LIVE_TIMING',

    // Actions
    setSettings: (newSettings) => set({ settings: newSettings }),
    setActiveView: (view) => set({ activeView: view }),
    toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
    setIsSpeedometerVisible: (isVisible) => set({ isSpeedometerVisible: isVisible }),
    setDriverHeaderMode: (mode) => set({ driverHeaderMode: mode }),
  }))
);

// Subscribe to state changes to persist them to cookies
useStore.subscribe(
  (state) => state.settings,
  (settings) => {
    // Make sure we don't save the old 'multiviewerUrl' property if it somehow still exists
    const { multiviewerUrl: _, ...settingsToSave } = settings as Settings & { multiviewerUrl?: string };
    setCookie('settings', JSON.stringify(settingsToSave), 365);
  }
);

useStore.subscribe(
  (state) => state.isSidebarCollapsed,
  (isCollapsed) => {
    setCookie('sidebarCollapsed', String(isCollapsed), 365);
  }
);