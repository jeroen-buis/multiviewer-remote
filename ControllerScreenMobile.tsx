import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Player, DriverList, LapCount, F1Driver } from './types';
import { postMutation } from './api';
import { useStore } from './store';
import { EnterFullscreenIcon, ExitFullscreenIcon, MutedIcon, UnmutedIcon, UserPlaceholderIcon, SyncIcon, PauseIcon, PlayIcon, SpeedometerIcon, HeaderIcon } from './components/controller/icons';
import SimpleHeader from './components/SimpleHeader';
import Modal from './components/Modal';

const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) {
        return '00:00';
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const pad = (num: number) => num.toString().padStart(2, '0');

    if (h > 0) {
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }
    return `${pad(m)}:${pad(s)}`;
};

type ControllerScreenMobileProps = {
  playersData: Player[];
  driverListData: DriverList;
  lapCount: LapCount | null;
  trackStatusInfo: { className: string; text: string; visible: boolean };
  drsStatus: 'ENABLED' | 'DISABLED' | string | null;
  sessionType?: string;
  sessionName?: string;
  sessionStatus?: string;
  viewName: string;
  multiviewerUrl: string;
};

const ControllerScreenMobile: React.FC<ControllerScreenMobileProps> = ({ playersData, driverListData, lapCount, trackStatusInfo, drsStatus, sessionType, sessionName, sessionStatus, viewName, multiviewerUrl }) => {
    const { isSpeedometerVisible, setIsSpeedometerVisible, driverHeaderMode, setDriverHeaderMode } = useStore();
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [isGloballyPaused, setIsGloballyPaused] = useState(false);
    const [activeOBCModalTab, setActiveOBCModalTab] = useState<'switch' | 'controls'>('switch');
    const [activeFeedModalTab, setActiveFeedModalTab] = useState<'seek' | 'settings'>('seek');
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    
    // State for debounced volume control
    const [modalVolume, setModalVolume] = useState(0);
    const [isVolumeSliderActive, setIsVolumeSliderActive] = useState(false);
    const volumeChangeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const queryClient = useQueryClient();
    const playersDataRef = useRef(playersData);

    useEffect(() => {
        playersDataRef.current = playersData;
    }, [playersData]);

    const isLive = useMemo(() => {
        const mainFeed = playersData.find(p => p.streamData.title === 'F1 LIVE' || p.streamData.title === 'INTERNATIONAL');
        return mainFeed ? mainFeed.state.live : false;
    }, [playersData]);

    useEffect(() => {
        const mainFeed = playersData.find(p => p.streamData.title === 'F1 LIVE' || p.streamData.title === 'INTERNATIONAL');
        setIsGloballyPaused(mainFeed ? mainFeed.state.paused : false);
    }, [playersData]);

    useEffect(() => {
        if (selectedPlayer) {
            const updatedPlayer = playersData.find(p => p.id === selectedPlayer.id);
            if (updatedPlayer) {
                if (JSON.stringify(selectedPlayer) !== JSON.stringify(updatedPlayer)) {
                    setSelectedPlayer(updatedPlayer);
                }
            } else {
                setSelectedPlayer(null);
            }
        }
    }, [playersData, selectedPlayer]);

    const invalidateDynamicData = () => {
        queryClient.invalidateQueries({ queryKey: ['dynamicData'] });
    };

    const playerMutation = useMutation({
        mutationFn: ({ mutation, operationName, variables }: { mutation: string; operationName: string; variables: Record<string, unknown> }) => 
            postMutation(mutation, operationName, multiviewerUrl, variables),
        onSuccess: invalidateDynamicData,
    });
    
    const handleToggleMute = (playerId: string, currentMuteState: boolean) => playerMutation.mutate({ mutation: `mutation PlayerSetMuted($id: ID!, $muted: Boolean) { playerSetMuted(id: $id, muted: $muted) }`, operationName: 'PlayerSetMuted', variables: { id: playerId, muted: !currentMuteState } });
    const handleToggleFullscreen = (playerId: string, currentFullscreenState: boolean) => playerMutation.mutate({ mutation: `mutation PlayerSetFullscreen($id: ID!, $fullscreen: Boolean) { playerSetFullscreen(id: $id, fullscreen: $fullscreen) }`, operationName: 'PlayerSetFullscreen', variables: { id: playerId, fullscreen: !currentFullscreenState } });
    
    // Debounced Volume Control Effects
    useEffect(() => {
        if (selectedPlayer && !isVolumeSliderActive) {
            setModalVolume(selectedPlayer.state.volume);
        }
    }, [selectedPlayer, isVolumeSliderActive]);

    useEffect(() => {
        if (!isVolumeSliderActive || !selectedPlayer) return;

        if (volumeChangeTimeout.current) {
            clearTimeout(volumeChangeTimeout.current);
        }

        volumeChangeTimeout.current = setTimeout(() => {
            const isCurrentlyMuted = selectedPlayer.state.muted;
            const currentVolume = selectedPlayer.state.volume;
            const volumeHasChanged = modalVolume !== currentVolume;
            const shouldMute = modalVolume === 0 && !isCurrentlyMuted;
            const shouldUnmute = modalVolume > 0 && isCurrentlyMuted;
            
            const mutations = [];
            if (volumeHasChanged) {
                mutations.push(playerMutation.mutateAsync({
                    mutation: `mutation PlayerSetVolume($id: ID!, $volume: Float!) { playerSetVolume(id: $id, volume: $volume) }`,
                    operationName: 'PlayerSetVolume',
                    variables: { id: selectedPlayer.id, volume: modalVolume },
                }));
            }
            if (shouldMute || shouldUnmute) {
                 mutations.push(playerMutation.mutateAsync({
                    mutation: `mutation PlayerSetMuted($id: ID!, $muted: Boolean) { playerSetMuted(id: $id, muted: $muted) }`,
                    operationName: 'PlayerSetMuted',
                    variables: { id: selectedPlayer.id, muted: !isCurrentlyMuted },
                }));
            }
            
            if (mutations.length > 0) {
                Promise.all(mutations).finally(() => setIsVolumeSliderActive(false));
            } else {
                setIsVolumeSliderActive(false);
            }

        }, 250);

        return () => {
            if (volumeChangeTimeout.current) {
                clearTimeout(volumeChangeTimeout.current);
            }
        };
    }, [modalVolume, isVolumeSliderActive, selectedPlayer, playerMutation]);

    const syncMutation = useMutation({
        mutationFn: async () => {
            const mainFeed = playersDataRef.current.find(p => p.streamData.title === 'F1 LIVE' || p.streamData.title === 'INTERNATIONAL');
            if (!mainFeed) throw new Error("Main feed not found to sync to.");

            const result = await postMutation(
                `mutation PlayerSync($id: ID!) { playerSync(id: $id) }`,
                'PlayerSync',
                multiviewerUrl,
                { id: mainFeed.id }
            );
            if (!result.playerSync) {
                throw new Error('Sync operation failed, API returned false.');
            }
            return result;
        },
        onSuccess: invalidateDynamicData,
        onError: (error) => console.error('Sync failed:', error),
    });

    const setPausedMutation = useMutation({
        mutationFn: ({ playerId, paused }: { playerId: string; paused: boolean }) => postMutation(
            `mutation PlayerSetPaused($id: ID!, $paused: Boolean) { playerSetPaused(id: $id, paused: $paused) }`,
            'PlayerSetPaused',
            multiviewerUrl,
            { id: playerId, paused }
        )
    });

    const handleToggleMasterPause = async () => {
        const players = playersDataRef.current;
        const shouldPause = !isGloballyPaused;

        const mainFeed = players.find(p => p.streamData.title === 'F1 LIVE' || p.streamData.title === 'INTERNATIONAL');
        const tracker = players.find(p => p.type === 'TRACKER' || p.streamData.title === 'TRACKER');
        const obcs = players.filter(p => p.type === 'OBC');
        
        const setPlayerPaused = (id: string, paused: boolean) => setPausedMutation.mutateAsync({ playerId: id, paused });
        
        try {
            if (shouldPause) {
                const pauseOrder = [mainFeed, tracker, ...obcs].filter(Boolean) as Player[];
                for (const player of pauseOrder) await setPlayerPaused(player.id, true);
            } else {
                const playOrder = [...obcs, tracker, mainFeed].filter(Boolean) as Player[];
                for (const player of playOrder) await setPlayerPaused(player.id, false);
                await syncMutation.mutateAsync();
            }
        } catch (error) {
            console.error('Master pause/play sequence failed:', error);
        } finally {
            invalidateDynamicData();
        }
    };
    
    const handleToggleSpeedometer = () => {
        const newVisibility = !isSpeedometerVisible;
        const obcPlayers = playersDataRef.current.filter(p => p.type === 'OBC');
        const promises = obcPlayers.map(p => playerMutation.mutateAsync({
            mutation: `mutation PlayerSetSpeedometerVisibility($id: ID!, $visible: Boolean!) { playerSetSpeedometerVisibility(id: $id, visible: $visible) }`,
            operationName: 'PlayerSetSpeedometerVisibility',
            variables: { id: p.id, visible: newVisibility },
        }));
        Promise.all(promises).then(() => {
            setIsSpeedometerVisible(newVisibility);
        });
    };

    const handleToggleDriverHeaderMode = () => {
        const newMode = driverHeaderMode === 'OBC_LIVE_TIMING' ? 'DRIVER_HEADER' : 'OBC_LIVE_TIMING';
        const obcPlayers = playersDataRef.current.filter(p => p.type === 'OBC');
        const promises = obcPlayers.map(p => playerMutation.mutateAsync({
            mutation: `mutation PlayerSetDriverHeaderMode($id: ID!, $mode: DriverHeaderMode!) { playerSetDriverHeaderMode(id: $id, mode: $mode) }`,
            operationName: 'PlayerSetDriverHeaderMode',
            variables: { id: p.id, mode: newMode },
        }));
        Promise.all(promises).then(() => {
            setDriverHeaderMode(newMode);
        });
    };
    
    const filteredPlayersData = useMemo(() => {
        const playersByBounds = playersData.reduce((acc, player) => {
            if (!player.bounds) return acc;
            const key = `${player.bounds.x},${player.bounds.y},${player.bounds.width},${player.bounds.height}`;
            (acc[key] = acc[key] || []).push(player);
            return acc;
        }, {} as Record<string, Player[]>);

        const resolvedPlayers: Player[] = [];
        // FIX: Cast Object.values to Player[][] to fix type inference on `group`.
        (Object.values(playersByBounds) as Player[][]).forEach(group => {
            if (group.length === 1) {
                resolvedPlayers.push(group[0]);
            } else {
                const onTopPlayer = group.find(p => p.alwaysOnTop);
                if (onTopPlayer) {
                    resolvedPlayers.push(onTopPlayer);
                } else {
                    resolvedPlayers.push(group[0]);
                }
            }
        });

        const playersWithBoundsIds = new Set(resolvedPlayers.map(p => p.id));
        const playersWithoutBounds = playersData.filter(p => !p.bounds && !playersWithBoundsIds.has(p.id));

        return [...resolvedPlayers, ...playersWithoutBounds];
    }, [playersData]);

    const obcPlayers = useMemo(() => 
        filteredPlayersData
            .filter(p => p.type === 'OBC')
            .sort((a, b) => {
                if (!a.bounds || !b.bounds) return 0;
                if (a.bounds.y !== b.bounds.y) {
                    return a.bounds.y - b.bounds.y;
                }
                return a.bounds.x - b.bounds.x;
            }), 
        [filteredPlayersData]
    );

    const mainFeedPlayers = useMemo(() => filteredPlayersData.filter(p => p.streamData.title === 'F1 LIVE' || p.streamData.title === 'INTERNATIONAL'), [filteredPlayersData]);
    const trackerPlayer = useMemo(() => filteredPlayersData.find(p => p.type === 'TRACKER' || p.streamData.title === 'TRACKER'), [filteredPlayersData]);

    const findDriverByTla = (tla: string) => {
        return (Object.values(driverListData) as F1Driver[]).find(driver => driver.Tla === tla);
    };

    const handleSeek = async (playerId: string, relativeSeconds: number) => {
        try {
            await postMutation(
                `mutation PlayerSeekTo($id: ID!, $relative: Float) { playerSeekTo(id: $id, relative: $relative) }`,
                'PlayerSeekTo',
                multiviewerUrl,
                { id: playerId, relative: relativeSeconds }
            );
            await new Promise(resolve => setTimeout(resolve, 500));
            syncMutation.mutate();
        } catch (error) {
            console.error('Seek failed:', error);
        }
    };

    const driverSwitchMutation = useMutation({
        mutationFn: async (newDriverTla: string) => {
            const oldPlayer = selectedPlayer;
            if (!oldPlayer) throw new Error("No player selected to switch.");
            
            setSelectedPlayer(null);

            // Set the old player to be always on top to hide the transition, just like on desktop.
            await postMutation(`mutation PlayerSetAlwaysOnTop($id: ID!, $alwaysOnTop: Boolean) { playerSetAlwaysOnTop(id: $id, alwaysOnTop: $alwaysOnTop) }`, 'PlayerSetAlwaysOnTop', multiviewerUrl, { id: oldPlayer.id, alwaysOnTop: true });
            
            const createInput = { maintainAspectRatio: true, fullscreen: false, bounds: oldPlayer.bounds, alwaysOnTop: false, contentId: parseInt(oldPlayer.streamData.contentId, 10), driverTla: newDriverTla };
            const createResult = await postMutation(`mutation PlayerCreate($input: PlayerCreateInput!) { playerCreate(input: $input) }`, 'PlayerCreate', multiviewerUrl, { input: createInput });
            const newPlayerId = createResult.playerCreate;
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (newPlayerId) {
                if (isSpeedometerVisible) {
                    await postMutation(`mutation PlayerSetSpeedometerVisibility($id: ID!, $visible: Boolean!) { playerSetSpeedometerVisibility(id: $id, visible: $visible) }`, 'PlayerSetSpeedometerVisibility', multiviewerUrl, { id: newPlayerId, visible: true });
                }
                await postMutation(`mutation PlayerSetDriverHeaderMode($id: ID!, $mode: DriverHeaderMode!) { playerSetDriverHeaderMode(id: $id, mode: $mode) }`, 'PlayerSetDriverHeaderMode', multiviewerUrl, { id: newPlayerId, mode: driverHeaderMode });
            }
            
            await syncMutation.mutateAsync();
            await new Promise(resolve => setTimeout(resolve, 500));
            
            await postMutation(`mutation PlayerDelete($id: ID!) { playerDelete(id: $id) }`, 'PlayerDelete', multiviewerUrl, { id: oldPlayer.id });
        },
        onSuccess: invalidateDynamicData,
        onError: (error) => {
            console.error("Failed to switch driver:", error);
            invalidateDynamicData();
        },
    });

    const controllerHelpContent = (
        <>
            <p>
                The Controller screen is designed for quick access to onboard cameras and master controls on a mobile device.
            </p>
            <h3>How It Works</h3>
            <p>
                This screen displays a grid of all drivers currently in the session, along with main feeds like F1 Live and the Tracker if they are open in MultiViewer.
            </p>
            <ul>
                <li><strong>Switching Drivers:</strong> Tap any driver's button to open a modal where you can switch to any other driver's onboard camera.</li>
                <li><strong>Feed Controls:</strong> Tap a main feed button (e.g., "F1 LIVE") to open a modal with seek controls. Seeking is disabled during live sessions.</li>
                <li><strong>Team Colors:</strong> The colored bar at the bottom of each driver's button represents their team color for easy identification.</li>
            </ul>

            <h3>Master Controls (Bottom Bar)</h3>
            <p>The buttons at the bottom of the screen provide global control over all players:</p>
            <ul>
                <li><strong>Sync:</strong> Resynchronizes all video feeds.</li>
                <li><strong>Pause/Play:</strong> Pauses or plays all video feeds simultaneously. Disabled during live sessions.</li>
                <li><strong>Speedo:</strong> Toggles the speedometer graphic on all Onboard Cameras.</li>
                <li><strong>Header:</strong> Switches the header style on all Onboard Cameras.</li>
            </ul>
        </>
    );
    
    const renderPlayerModal = () => {
        if (!selectedPlayer) return null;
        
        const isOBC = selectedPlayer.type === 'OBC';
        const modalTitle = isOBC 
            ? selectedPlayer.driverData?.tla 
            : (selectedPlayer.streamData.title === 'INTERNATIONAL' ? 'MAIN' : selectedPlayer.streamData.title);

        return (
             <div className="controller-mobile-modal-overlay" onClick={() => setSelectedPlayer(null)}>
                <div className="controller-mobile-modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="controller-mobile-modal-header">
                        <h2>{modalTitle}</h2>
                        <button className="controller-mobile-modal-close" onClick={() => setSelectedPlayer(null)}>&times;</button>
                    </div>

                    {isOBC ? (
                        <>
                            <div className="controller-mobile-modal-tabs">
                                <button className={`controller-mobile-modal-tab-button ${activeOBCModalTab === 'switch' ? 'active' : ''}`} onClick={() => setActiveOBCModalTab('switch')}>
                                    Switch Driver
                                </button>
                                <button className={`controller-mobile-modal-tab-button ${activeOBCModalTab === 'controls' ? 'active' : ''}`} onClick={() => setActiveOBCModalTab('controls')}>
                                    Controls
                                </button>
                            </div>
                            
                            <div className="controller-mobile-modal-tab-content">
                                {activeOBCModalTab === 'switch' && (
                                    <div className="controller-mobile-modal-driver-list">
                                        {/* FIX: Add type assertion to Object.values to fix property access errors on 'd'. */}
                                        {(Object.values(driverListData) as F1Driver[]).map((d) => (
                                            <div
                                                key={d.Tla}
                                                className={`controller-mobile-modal-driver-item ${selectedPlayer.driverData?.tla === d.Tla ? 'active' : ''}`}
                                                onClick={() => {
                                                    if (selectedPlayer.driverData?.tla !== d.Tla) {
                                                        driverSwitchMutation.mutate(d.Tla);
                                                    }
                                                }}
                                            >
                                                <img src={d.HeadshotUrl} alt={d.Tla} />
                                                <span>{d.Tla}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeOBCModalTab === 'controls' && (
                                    <div className="controller-mobile-modal-controls">
                                        <div className="controller-mobile-modal-control-item">
                                            <label>Fullscreen</label>
                                            <button className="control-button icon-only" onClick={() => handleToggleFullscreen(selectedPlayer.id, selectedPlayer.fullscreen)}>
                                                {selectedPlayer.fullscreen ? <ExitFullscreenIcon /> : <EnterFullscreenIcon />}
                                            </button>
                                        </div>
                                        <div className="controller-mobile-modal-control-item">
                                            <label>Mute</label>
                                            <label className="toggle-switch">
                                              <input
                                                type="checkbox"
                                                checked={selectedPlayer.state.muted}
                                                onChange={() => handleToggleMute(selectedPlayer.id, selectedPlayer.state.muted)}
                                              />
                                              <span className="slider"></span>
                                            </label>
                                        </div>
                                        <div className="controller-mobile-modal-control-item">
                                            <label>Volume</label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={modalVolume}
                                                className="controller-mobile-volume-slider"
                                                onMouseDown={() => setIsVolumeSliderActive(true)}
                                                onChange={(e) => setModalVolume(parseInt(e.target.value, 10))}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        // Modal for Main Feeds and Tracker
                        <>
                            <div className="controller-mobile-modal-tabs">
                                <button className={`controller-mobile-modal-tab-button ${activeFeedModalTab === 'seek' ? 'active' : ''}`} onClick={() => setActiveFeedModalTab('seek')}>
                                    Seek
                                </button>
                                <button className={`controller-mobile-modal-tab-button ${activeFeedModalTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveFeedModalTab('settings')}>
                                    Settings
                                </button>
                            </div>
                            <div className="controller-mobile-modal-tab-content">
                                {activeFeedModalTab === 'seek' && (
                                     <div 
                                        className={`controller-mobile-modal-seek-controls ${isLive ? 'disabled' : ''}`}
                                        title={isLive ? "Seeking is disabled during a live session" : ""}
                                    >
                                        <div className="controller-mobile-modal-current-time-large">
                                            {formatTime(selectedPlayer.state.interpolatedCurrentTime)}
                                        </div>
                                        <div className="controller-mobile-modal-seek-grid">
                                            <div className="seek-row">
                                                <button className="control-button" onClick={() => handleSeek(selectedPlayer.id, -10)} disabled={isLive}>-10s</button>
                                                <button className="control-button" onClick={() => handleSeek(selectedPlayer.id, 10)} disabled={isLive}>+10s</button>
                                            </div>
                                             <div className="seek-row">
                                                <button className="control-button" onClick={() => handleSeek(selectedPlayer.id, -30)} disabled={isLive}>-30s</button>
                                                <button className="control-button" onClick={() => handleSeek(selectedPlayer.id, 30)} disabled={isLive}>+30s</button>
                                            </div>
                                            <div className="seek-row">
                                                <button className="control-button" onClick={() => handleSeek(selectedPlayer.id, -300)} disabled={isLive}>-5m</button>
                                                <button className="control-button" onClick={() => handleSeek(selectedPlayer.id, 300)} disabled={isLive}>+5m</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {activeFeedModalTab === 'settings' && (
                                    <div className="controller-mobile-modal-controls">
                                        <div className="controller-mobile-modal-control-item">
                                            <label>Fullscreen</label>
                                            <button className="control-button icon-only" onClick={() => handleToggleFullscreen(selectedPlayer.id, selectedPlayer.fullscreen)}>
                                                {selectedPlayer.fullscreen ? <ExitFullscreenIcon /> : <EnterFullscreenIcon />}
                                            </button>
                                        </div>
                                        <div className="controller-mobile-modal-control-item">
                                            <label>Mute</label>
                                            <label className="toggle-switch">
                                              <input
                                                type="checkbox"
                                                checked={selectedPlayer.state.muted}
                                                onChange={() => handleToggleMute(selectedPlayer.id, selectedPlayer.state.muted)}
                                              />
                                              <span className="slider"></span>
                                            </label>
                                        </div>
                                        <div className="controller-mobile-modal-control-item">
                                            <label>Volume</label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={modalVolume}
                                                className="controller-mobile-volume-slider"
                                                onMouseDown={() => setIsVolumeSliderActive(true)}
                                                onChange={(e) => setModalVolume(parseInt(e.target.value, 10))}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="controller-mobile-container">
            <SimpleHeader
                lapCount={lapCount}
                sessionType={sessionType}
                sessionName={sessionName}
                sessionStatus={sessionStatus}
                trackStatusInfo={trackStatusInfo}
                drsStatus={drsStatus}
                viewName={viewName}
                onInfoClick={() => setIsInfoModalOpen(true)}
            />

            <div className="card controller-mobile-card">
                {playersData && playersData.length > 0 ? (
                    <div className="controller-mobile-grid">
                        {obcPlayers.map(player => {
                            const driver = player.driverData ? findDriverByTla(player.driverData.tla) : undefined;
                            return (
                                <button key={player.id} className="controller-mobile-driver-button" onClick={() => { setSelectedPlayer(player); setActiveOBCModalTab('switch'); }}>
                                    {driver?.HeadshotUrl ? (
                                        <img src={driver.HeadshotUrl} alt={driver.Tla} className="controller-mobile-headshot" />
                                    ) : (
                                        <div className="controller-mobile-headshot controller-mobile-headshot-placeholder"><UserPlaceholderIcon /></div>
                                    )}
                                    <span className="controller-mobile-tla">{player.driverData?.tla}</span>
                                    {driver && <div className="controller-mobile-team-bar" style={{ backgroundColor: `#${driver.TeamColour}` }} />}
                                </button>
                            );
                        })}
                        {mainFeedPlayers.map(player => {
                            const title = player.streamData.title === 'INTERNATIONAL' ? 'MAIN' : player.streamData.title;
                            return (
                                <button key={player.id} className="controller-mobile-feed-button" onClick={() => { setSelectedPlayer(player); setActiveFeedModalTab('seek'); }}>
                                    <span className="controller-mobile-tla">{title}</span>
                                </button>
                            );
                        })}
                        {trackerPlayer && (
                            <button key={trackerPlayer.id} className="controller-mobile-feed-button" onClick={() => { setSelectedPlayer(trackerPlayer); setActiveFeedModalTab('seek'); }}>
                                <span className="controller-mobile-tla">{trackerPlayer.streamData.title}</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{ padding: '1rem' }}>
                        <p>
                            No players data found. Please use <strong>MultiViewer</strong> directly to configure and set up the way you prefer to watch the race. Once you have configured all the players you can use <strong>MultiViewer Remote</strong> to control them and, for example, switch OBCs.
                        </p>
                    </div>
                )}
            </div>

            <div className="controller-mobile-master-controls">
                <button className="controller-mobile-master-button" onClick={() => syncMutation.mutate()}>
                    <SyncIcon />
                    <span>Sync</span>
                </button>
                <button className="controller-mobile-master-button" onClick={handleToggleMasterPause} disabled={isLive}>
                    {isGloballyPaused ? <PlayIcon /> : <PauseIcon />}
                    <span>{isGloballyPaused ? 'Play' : 'Pause'}</span>
                </button>
                <button 
                    className={`controller-mobile-master-button ${isSpeedometerVisible ? 'active' : ''}`} 
                    onClick={handleToggleSpeedometer}
                >
                    <SpeedometerIcon />
                    <span>Speedo</span>
                </button>
                <button 
                    className={`controller-mobile-master-button ${driverHeaderMode === 'DRIVER_HEADER' ? 'active' : ''}`} 
                    onClick={handleToggleDriverHeaderMode}
                >
                    <HeaderIcon />
                    <span>Header</span>
                </button>
            </div>
            
            {renderPlayerModal()}

             <Modal
                isOpen={isInfoModalOpen}
                onClose={() => setIsInfoModalOpen(false)}
                title="About the Controller Screen"
            >
                {controllerHelpContent}
            </Modal>
        </div>
    );
};

export default ControllerScreenMobile;