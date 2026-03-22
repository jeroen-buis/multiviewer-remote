import React, { useState } from 'react';
import { ApiData, FetchedData, F1LiveTimingState } from './types';

type DebugScreenProps = {
  apiData: ApiData;
};

const formatTabName = (name: string): string => {
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
};

const f1TimingKeys: (keyof F1LiveTimingState)[] = [
  'SessionInfo', 'SessionStatus', 'WeatherData', 'WeatherDataSeries', 'LapCount', 'DriverList',
  'TrackStatus', 'TimingData', 'LapSeries', 'TimingAppData', 'RaceControlMessages'
];

const DebugScreen: React.FC<DebugScreenProps> = ({ apiData }) => {
  const [activeTab, setActiveTab] = useState('players');

  const tabs: { id: string; label: string; type: 'static' | 'dynamic'; data: FetchedData<any> }[] = [
    // Static
    { id: 'subscription', label: 'Subscription', type: 'static', data: apiData.subscription },
    { id: 'systemInfo', label: 'System Info', type: 'static', data: apiData.systemInfo },
    { id: 'version', label: 'Version', type: 'static', data: apiData.version },
    // Dynamic
    { id: 'players', label: 'Players', type: 'dynamic', data: apiData.players },
    ...f1TimingKeys.map(key => ({
      // FIX: Cast key to string to match the explicit type of `tabs` array.
      id: key as string,
      label: formatTabName(key as string),
      type: 'dynamic' as 'dynamic',
      data: {
        data: apiData.f1LiveTimingState.data?.[key],
        error: apiData.f1LiveTimingState.error,
        lastUpdated: apiData.f1LiveTimingState.lastUpdated
      }
    }))
  ];

  const renderContent = () => {
    const activeTabData = tabs.find(tab => tab.id === activeTab)?.data;

    if (!activeTabData) {
      return <p className="status">Select a tab to view data.</p>;
    }

    if (activeTabData.error) {
      return <p className="error">Error: {activeTabData.error}</p>;
    }
    if (activeTabData.data === null || activeTabData.data === undefined) {
      return <p className="status">Loading or no data available...</p>;
    }
    return (
      <>
        <p className="status">Last Updated: {activeTabData.lastUpdated ? activeTabData.lastUpdated.toLocaleString() : 'N/A'}</p>
        <pre><code>{JSON.stringify(activeTabData.data, null, 2)}</code></pre>
      </>
    );
  };
  
  return (
    <div>
      <h1>Debug</h1>
      <div className="card">
        <div className="debug-screen__tabs">
          {tabs.map(tab => (
            <button 
              key={tab.id}
              className={`debug-screen__tab-button ${activeTab === tab.id ? 'active' : ''}`} 
              onClick={() => setActiveTab(tab.id)}
            >
              <span className={`debug-screen__tab-indicator debug-screen__tab-indicator--${tab.type}`}></span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default DebugScreen;
