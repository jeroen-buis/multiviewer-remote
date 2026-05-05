import React, { useMemo, useState, useEffect } from 'react';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import Sidebar from './Sidebar';
import HomeScreen from './HomeScreen';
import StandingsScreen from './StandingsScreen';
import ControllerScreen from './ControllerScreen';
import ControllerScreenMobile from './ControllerScreenMobile';
import RaceScreen from './RaceScreen';
import PositionScreen from './PositionScreen';
import PositionScreenMobile from './PositionScreenMobile';
import TiresScreen from './TiresScreen';
import TiresScreenMobile from './TiresScreenMobile';
import TireStatsScreen from './TireStatsScreen';
import TireStatsScreenMobile from './TireStatsScreenMobile';
import RaceControlScreen from './RaceControlScreen';
import RaceControlScreenMobile from './RaceControlScreenMobile';
import LeaderboardScreen from './LeaderboardScreen';
import LeaderboardScreenMobile from './LeaderboardScreenMobile';
import DebugScreen from './DebugScreen';
import SettingsScreen from './SettingsScreen';
import PitstopsScreen from './PitstopsScreen';
import PitstopsScreenMobile from './PitstopsScreenMobile';
import WeatherScreen from './WeatherScreen';
import WeatherScreenMobile from './WeatherScreenMobile';
import { ApiData, TrackStatus, RaceControlMessage } from './types';
import { queryClient, useStaticData, useDynamicData, getApiUrl } from './api';
import { useStore } from './store';
import RaceScreenMobile from './RaceScreenMobile';
import useWindowSize from './hooks/useWindowSize';

export const useTrackStatusInfo = (
  trackStatus?: TrackStatus,
  raceControlMessages?: RaceControlMessage[]
) => {
  const [statusInfo, setStatusInfo] = React.useState({ className: '', text: '', visible: false });
  // This state will track if we are in the "SC ending" phase.
  const [isSafetyCarEnding, setIsSafetyCarEnding] = React.useState(false);

  React.useEffect(() => {
    const currentStatus = trackStatus?.Status;

    let nextIsSafetyCarEnding = isSafetyCarEnding;

    // Condition to RESET the "ending" state: Track is clear.
    if (currentStatus === '1') {
      nextIsSafetyCarEnding = false;
    }

    // Condition to SET the "ending" state:
    // Track is under SC and the latest relevant message is "SAFETY CAR IN THIS LAP".
    if (currentStatus === '4') {
      // FIX: Correctly sort messages by date to find the most recent one.
      const latestScMessage = raceControlMessages
        ?.filter(msg => msg.Category === 'SafetyCar')
        .sort((a, b) => new Date(b.Utc).getTime() - new Date(a.Utc).getTime())
        [0];
      
      if (latestScMessage?.Message === 'SAFETY CAR IN THIS LAP') {
        nextIsSafetyCarEnding = true;
      }
    }

    // Update the state only if it has changed, to prevent re-renders.
    if (nextIsSafetyCarEnding !== isSafetyCarEnding) {
      setIsSafetyCarEnding(nextIsSafetyCarEnding);
    }
    
    // Now, determine the display text and class based on the current track status and our derived state.
    let newInfo = { className: '', text: '', visible: false };

    if (currentStatus === '1') {
        newInfo = { className: 'status-green', text: 'Track Clear', visible: true };
    } else if (currentStatus === '2') {
        newInfo = { className: 'status-yellow', text: 'Yellow Flag', visible: true };
    } else if (currentStatus === '3' || currentStatus === '5') {
        newInfo = { className: 'status-red', text: 'Red Flag', visible: true };
    } else if (currentStatus === '4') {
        if (nextIsSafetyCarEnding) {
            newInfo = { className: 'status-orange', text: 'Safety Car Ending', visible: true };
        } else {
            newInfo = { className: 'status-orange', text: 'Safety Car', visible: true };
        }
    } else if (currentStatus === '6') {
        newInfo = { className: 'status-orange', text: 'Virtual Safety Car', visible: true };
    } else if (currentStatus === '7') {
        newInfo = { className: 'status-orange', text: 'Virtual Safety Car Ending', visible: true };
    }
    
    setStatusInfo(newInfo);

  }, [trackStatus, raceControlMessages, isSafetyCarEnding]);

  return statusInfo;
};

const TrackStatusBanner: React.FC<{ info: ReturnType<typeof useTrackStatusInfo> }> = ({ info }) => {
    if (!info.visible) {
        return null;
    }
    return (
        <div className={`track-status-banner ${info.className}`}>
            {info.text}
        </div>
    );
};

export type ConnectionStatus = 'connecting' | 'connected' | 'error' | 'not-configured';

const AppContent: React.FC = () => {
  const settings = useStore((state) => state.settings);
  const activeView = useStore((state) => state.activeView);
  const isSidebarCollapsed = useStore((state) => state.isSidebarCollapsed);
  const setActiveView = useStore((state) => state.setActiveView);
  
  const queryClient = useQueryClient();
  const { width } = useWindowSize();
  const isTabletSize = width > 768 && width <= 1024;
  const isMobileSize = width <= 768;

  const applyTabletMode = settings.displayMode === 'tablet' || (settings.displayMode === 'auto' && isTabletSize);
  const applyMobileMode = settings.displayMode === 'mobile' || (settings.displayMode === 'auto' && isMobileSize);
  const isEffectivelyCollapsed = isSidebarCollapsed || applyMobileMode;

  const multiviewerUrl = useMemo(() => getApiUrl(settings), [settings]);

  const { 
    data: staticData, 
    status: staticStatus, 
    error: staticError 
  } = useStaticData(multiviewerUrl);
  
  const { 
    data: dynamicData, 
    isError: isDynamicError, 
    error: dynamicError 
  } = useDynamicData(multiviewerUrl, settings.refreshDuration, staticStatus === 'success');

  const connectionStatus = useMemo<ConnectionStatus>(() => {
    if (!multiviewerUrl) return 'not-configured';
    if (staticStatus === 'pending') return 'connecting';
    if (staticStatus === 'error' || (staticStatus === 'success' && isDynamicError)) return 'error';
    return 'connected';
  }, [staticStatus, isDynamicError, multiviewerUrl]);

  const apiData: ApiData = useMemo(() => {
    const now = new Date();
    return {
      subscription: {
        data: staticData?.activeSubscriptions?.[0] || null,
        error: staticError?.message || null,
        lastUpdated: staticStatus === 'success' ? now : null
      },
      systemInfo: {
        data: staticData?.systemInfo || null,
        error: staticError?.message || null,
        lastUpdated: staticStatus === 'success' ? now : null
      },
      version: {
        data: staticData?.version || null,
        error: staticError?.message || null,
        lastUpdated: staticStatus === 'success' ? now : null
      },
      players: {
        data: dynamicData?.players || [],
        error: dynamicError?.message || null,
        lastUpdated: !isDynamicError ? now : null
      },
      f1LiveTimingState: {
        data: dynamicData?.f1LiveTimingState || null,
        error: dynamicError?.message || null,
        lastUpdated: !isDynamicError ? now : null
      },
    };
  }, [staticData, dynamicData, staticStatus, staticError, isDynamicError, dynamicError]);

  const trackStatusInfo = useTrackStatusInfo(
    apiData.f1LiveTimingState.data?.TrackStatus,
    apiData.f1LiveTimingState.data?.RaceControlMessages?.Messages
  );
  
  const drsStatus = useMemo(() => {
    // DRS was removed from F1 starting in 2026
    const startDate = apiData.f1LiveTimingState.data?.SessionInfo?.StartDate;
    if (startDate && new Date(startDate).getFullYear() >= 2026) return null;

    const allMessages = apiData.f1LiveTimingState.data?.RaceControlMessages?.Messages || [];
    if (allMessages.length === 0) return 'ENABLED';

    const lastDrsMessage = allMessages.filter(msg => msg.Category === 'Drs').pop();
    const lastScDeployedMessage = allMessages.filter(
        msg => msg.Category === 'SafetyCar' && msg.Status === 'DEPLOYED'
    ).pop();

    if (!lastDrsMessage && !lastScDeployedMessage) return 'ENABLED';
    if (lastDrsMessage && !lastScDeployedMessage) return lastDrsMessage.Status || 'DISABLED';
    if (!lastDrsMessage && lastScDeployedMessage) return 'DISABLED';

    if (lastDrsMessage && lastScDeployedMessage) {
        const drsTime = new Date(lastDrsMessage.Utc).getTime();
        const scTime = new Date(lastScDeployedMessage.Utc).getTime();
        if (scTime > drsTime) return 'DISABLED';
        return lastDrsMessage.Status || 'DISABLED';
    }
    return 'ENABLED';
  }, [apiData.f1LiveTimingState.data?.RaceControlMessages, apiData.f1LiveTimingState.data?.SessionInfo?.StartDate]);


  React.useEffect(() => {
    const restrictedViews = ['controller', 'race', 'position', 'debug', 'tires', 'race-control', 'tire-stats', 'leaderboard', 'standings', 'pitstops', 'weather'];
    if (connectionStatus !== 'connected' && restrictedViews.includes(activeView)) {
      setActiveView('home');
    }
  }, [connectionStatus, activeView, setActiveView]);

  const handleRetry = () => {
    queryClient.refetchQueries({ predicate: query => query.state.status === 'error' });
  };

  const renderActiveView = () => {
    const mobileProps = {
        lapCount: apiData.f1LiveTimingState.data?.LapCount || null,
        trackStatusInfo: trackStatusInfo,
        drsStatus,
        sessionType: apiData.f1LiveTimingState.data?.SessionInfo?.Type,
        sessionName: apiData.f1LiveTimingState.data?.SessionInfo?.Name,
        sessionStatus: apiData.f1LiveTimingState.data?.SessionStatus?.Status,
        viewName: activeView,
        multiviewerUrl, // Pass the final URL for mutations
    };

    switch (activeView) {
      case 'home':
        return <HomeScreen
          connectionStatus={connectionStatus}
          multiviewerUrl={multiviewerUrl}
          subscriptionData={{data: apiData.subscription.data, error: apiData.subscription.error, lastUpdated: apiData.subscription.lastUpdated}}
          systemInfoData={apiData.systemInfo}
          versionData={apiData.version}
        />;
      case 'controller': {
         // Precompute a short-team-name → current-championship-position map. The keys in
         // ChampionshipPrediction.Teams are the long constructor names (e.g. "McLaren Mercedes")
         // while driver.TeamName is the short name (e.g. "McLaren"), so we have to match via
         // the inner TeamName field.
         const teams = apiData.f1LiveTimingState.data?.ChampionshipPrediction?.Teams;
         let teamStandings: Record<string, number> | null = null;
         if (teams) {
            teamStandings = {};
            Object.values(teams).forEach(t => {
                teamStandings![t.TeamName] = t.CurrentPosition;
            });
         }
         const controllerProps = {
            ...mobileProps,
            playersData: apiData.players.data || [],
            driverListData: apiData.f1LiveTimingState.data?.DriverList || {},
            timingData: apiData.f1LiveTimingState.data?.TimingData,
            teamStandings,
        };
        return applyMobileMode ? <ControllerScreenMobile {...controllerProps} /> : <ControllerScreen {...controllerProps} />;
      }
      case 'race':
        const raceProps = {
          ...mobileProps,
          raceData: apiData.f1LiveTimingState,
        };
        return applyMobileMode
            ? <RaceScreenMobile {...raceProps} />
            : <RaceScreen {...raceProps} />;
      case 'position':
        const positionProps = {
            ...mobileProps,
            f1LiveTimingState: apiData.f1LiveTimingState,
        };
        return applyMobileMode
            ? <PositionScreenMobile {...positionProps} />
            : <PositionScreen {...positionProps} />;
      case 'leaderboard':
        const leaderboardProps = {
            ...mobileProps,
            f1LiveTimingState: apiData.f1LiveTimingState,
        };
        return applyMobileMode
            ? <LeaderboardScreenMobile {...leaderboardProps} />
            : <LeaderboardScreen {...leaderboardProps} />;
      case 'standings':
        return <StandingsScreen f1LiveTimingState={apiData.f1LiveTimingState} />;
      case 'tires':
        const tiresProps = {
            ...mobileProps,
            f1LiveTimingState: apiData.f1LiveTimingState,
        };
        return applyMobileMode 
            ? <TiresScreenMobile {...tiresProps} />
            : <TiresScreen {...tiresProps} />;
      case 'tire-stats':
        const tireStatsProps = {
            ...mobileProps,
            f1LiveTimingState: apiData.f1LiveTimingState,
        };
        return applyMobileMode 
            ? <TireStatsScreenMobile {...tireStatsProps} />
            : <TireStatsScreen {...tireStatsProps} />;
      case 'pitstops':
        const pitstopsProps = {
            ...mobileProps,
            f1LiveTimingState: apiData.f1LiveTimingState,
        };
        return applyMobileMode 
            ? <PitstopsScreenMobile {...pitstopsProps} />
            : <PitstopsScreen {...pitstopsProps} />;
      case 'race-control':
         const raceControlProps = {
            ...mobileProps,
            f1LiveTimingState: apiData.f1LiveTimingState,
        };
        return applyMobileMode 
            ? <RaceControlScreenMobile {...raceControlProps} /> 
            : <RaceControlScreen {...raceControlProps} />;
      case 'weather':
        const weatherProps = {
            ...mobileProps,
            f1LiveTimingState: apiData.f1LiveTimingState,
        };
        return applyMobileMode
            ? <WeatherScreenMobile {...weatherProps} />
            : <WeatherScreen {...weatherProps} />;
      case 'debug':
        return settings.debugMode ? <DebugScreen apiData={apiData} /> : <div>Debug mode not enabled.</div>;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <HomeScreen
          connectionStatus={connectionStatus}
          multiviewerUrl={multiviewerUrl}
          subscriptionData={{data: apiData.subscription.data, error: apiData.subscription.error, lastUpdated: apiData.subscription.lastUpdated}}
          systemInfoData={apiData.systemInfo}
          versionData={apiData.version}
        />;
    }
  };

  return (
    <div className={`app-container ${isEffectivelyCollapsed ? 'sidebar-collapsed' : ''} ${applyTabletMode ? 'tablet-mode' : ''} ${applyMobileMode ? 'mobile-mode' : ''}`}>
      <Sidebar
        connectionStatus={connectionStatus}
        onRetry={handleRetry}
        isEffectivelyCollapsed={isEffectivelyCollapsed}
      />
      <main className="main-content">
        {renderActiveView()}
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <AppContent />
  </QueryClientProvider>
);

export default App;