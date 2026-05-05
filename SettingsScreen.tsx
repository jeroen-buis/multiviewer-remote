import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Settings } from './types';
import { useStore } from './store';
import { getApiUrl } from './api';

const SettingsScreen: React.FC = () => {
  const settings = useStore((state) => state.settings);
  const setSettings = useStore((state) => state.setSettings);

  const [localSettings, setLocalSettings] = useState<Settings>(settings);
  const [saveMessage, setSaveMessage] = useState(false);
  const [urlTooltipVisible, setUrlTooltipVisible] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const tooltipContainerRef = useRef<HTMLDivElement>(null);

  // Sync local state if global state changes
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // Click outside handler for tooltip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (tooltipContainerRef.current && !tooltipContainerRef.current.contains(event.target as Node)) {
            setUrlTooltipVisible(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
  
    let finalValue: any;
    if (type === 'checkbox') {
        finalValue = checked;
    } else if (type === 'number') {
        finalValue = value === '' ? '' : parseFloat(value);
    } else {
        finalValue = value;
    }

    setLocalSettings(prev => ({
      ...prev,
      [name]: finalValue,
    }));
  };

  const handleSave = () => {
    const settingsToSave = {
        ...localSettings,
        refreshDuration: Number(localSettings.refreshDuration) || 2000,
        pitstopBattlegroundDuration: Number(localSettings.pitstopBattlegroundDuration) || 0,
    };
    setSettings(settingsToSave);
    setSaveMessage(true);
    setTimeout(() => setSaveMessage(false), 2000);
  };

  const fullApiUrl = useMemo(() => getApiUrl(localSettings), [localSettings]);

  const handleCopyUrl = () => {
      if (!fullApiUrl) return;
      navigator.clipboard.writeText(fullApiUrl).then(() => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
      }).catch((error) => {
          console.error('Failed to copy to clipboard:', error);
      });
  };

  const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  );

  return (
    <div className="settings-container">
      <h1>Settings</h1>
      <div className="settings-screen__form-container">
        <div className="card">
          <div className="settings-screen__form-group">
            <label htmlFor="multiviewerHost">MultiViewer IP or Hostname</label>
            <div className="settings-screen__input-with-icon">
                <input
                  type="text"
                  id="multiviewerHost"
                  name="multiviewerHost"
                  value={localSettings.multiviewerHost}
                  onChange={handleChange}
                  placeholder="e.g., 192.168.1.10"
                />
                <div className="settings-screen__info-icon-container" ref={tooltipContainerRef}>
                    <button
                        className="settings-screen__info-icon"
                        onClick={() => setUrlTooltipVisible(v => !v)}
                        title="Show full API URL for troubleshooting"
                    >
                        <InfoIcon />
                    </button>
                    {urlTooltipVisible && (
                        <div className="settings-screen__url-tooltip">
                            <p>Full API URL:</p>
                            <code>{fullApiUrl || 'Enter a host to see the full URL'}</code>
                            <button onClick={handleCopyUrl} disabled={!fullApiUrl || copySuccess}>
                                {copySuccess ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
          </div>
          <div className="settings-screen__form-group">
            <label htmlFor="refreshDuration">Data Refresh Duration (ms)</label>
            <input
              type="number"
              id="refreshDuration"
              name="refreshDuration"
              value={localSettings.refreshDuration}
              onChange={handleChange}
            />
          </div>
          <div className="settings-screen__form-group">
            <label htmlFor="displayMode">Display Mode</label>
            <select
              id="displayMode"
              name="displayMode"
              value={localSettings.displayMode ?? 'auto'}
              onChange={handleChange}
              className="settings-screen__select"
            >
              <option value="auto">Auto</option>
              <option value="desktop">Desktop</option>
              <option value="tablet">Tablet</option>
              <option value="mobile">Mobile</option>
            </select>
          </div>
          <div className="settings-screen__form-group">
            <label htmlFor="units">Units</label>
            <select
              id="units"
              name="units"
              value={localSettings.units ?? 'metric'}
              onChange={handleChange}
              className="settings-screen__select"
            >
              <option value="metric">Metric (°C, km/h)</option>
              <option value="imperial">Imperial (°F, mph)</option>
            </select>
          </div>
          <div className="settings-screen__form-group">
            <label htmlFor="pitstopBattlegroundDuration">Pitstop Battleground (s)</label>
            <input
              type="number"
              id="pitstopBattlegroundDuration"
              name="pitstopBattlegroundDuration"
              value={localSettings.pitstopBattlegroundDuration}
              onChange={handleChange}
              step="0.1"
              min="0"
            />
          </div>
          <div className="settings-screen__form-group">
            <label>Default Speedometer</label>
            <label className="toggle-switch">
              <input
                type="checkbox"
                name="defaultSpeedometerVisible"
                checked={localSettings.defaultSpeedometerVisible ?? false}
                onChange={handleChange}
              />
              <span className="slider"></span>
            </label>
          </div>
          <div className="settings-screen__form-group">
            <label>Default Onboard Header</label>
            <label className="toggle-switch">
              <input
                type="checkbox"
                name="defaultDriverHeaderMode"
                checked={localSettings.defaultDriverHeaderMode === 'DRIVER_HEADER'}
                onChange={(e) => setLocalSettings(prev => ({
                  ...prev,
                  defaultDriverHeaderMode: e.target.checked ? 'DRIVER_HEADER' : 'OBC_LIVE_TIMING',
                }))}
              />
              <span className="slider"></span>
            </label>
          </div>
          <div className="settings-screen__form-group">
            <label>Debug Mode</label>
            <label className="toggle-switch">
              <input
                type="checkbox"
                name="debugMode"
                checked={localSettings.debugMode ?? false}
                onChange={handleChange}
              />
              <span className="slider"></span>
            </label>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1.5rem 0' }}/>
          <div className="settings-screen__form-group">
            <label>Developer Mode</label>
            <label className="toggle-switch">
              <input
                type="checkbox"
                name="developerMode"
                checked={localSettings.developerMode ?? false}
                onChange={handleChange}
              />
              <span className="slider"></span>
            </label>
          </div>
          {localSettings.developerMode && (
             <div className="settings-screen__form-group">
                <label htmlFor="apiOverrideUrl">API Override URL</label>
                <input
                  type="text"
                  id="apiOverrideUrl"
                  name="apiOverrideUrl"
                  value={localSettings.apiOverrideUrl}
                  onChange={handleChange}
                  placeholder="e.g., https://my-dev-server/api/graphql"
                />
              </div>
          )}
          <div className="settings-screen__form-actions">
            <button className="settings-screen__save-button" onClick={handleSave}>Save</button>
            {saveMessage && <span className="settings-screen__save-message">Settings saved!</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen;