import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Player, DriverList, LapCount, F1Driver, TimingData } from './types';
import { postMutation, postMutationWithRetry } from './api';
import { useStore } from './store';
import { EnterFullscreenIcon, ExitFullscreenIcon, MutedIcon, UnmutedIcon, UserPlaceholderIcon, SyncIcon, PauseIcon, PlayIcon } from './components/controller/icons';
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
  timingData?: TimingData | null;
  teamStandings?: Record<string, number> | null;
  lapCount: LapCount | null;
  trackStatusInfo: { className: string; text: string; visible: boolean };
  drsStatus: 'ENABLED' | 'DISABLED' | string | null;
  sessionType?: string;
  sessionName?: string;
  sessionStatus?: string;
  viewName: string;
  multiviewerUrl: string;
};

const ControllerScreenMobile: React.FC<ControllerScreenMobileProps> = ({ playersData, driverListData, timingData, teamStandings, lapCount, trackStatusInfo, drsStatus, sessionType, sessionName, sessionStatus, viewName, multiviewerUrl }) => {
    const { isSpeedometerVisible, driverHeaderMode } = useStore();
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
        // Fail-closed: when no main feed is open we can't determine live vs. replay, so assume
        // live and keep seek / master pause/play disabled.
        return mainFeed ? mainFeed.state.live : true;
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
        mutationFn: async (options?: { enforceObcSettings?: boolean }) => {
            const enforceObcSettings = options?.enforceObcSettings ?? true;
            const players = playersDataRef.current;
            const mainFeed = players.find(p => p.streamData.title === 'F1 LIVE' || p.streamData.title === 'INTERNATIONAL');
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

            if (enforceObcSettings) {
                const obcPlayers = players.filter(p => p.type === 'OBC');
                if (obcPlayers.length > 0) {
                    const idArgs = obcPlayers.map((_, i) => `$id${i}: ID!`).join(', ');
                    const fields = obcPlayers.map((_, i) =>
                        `s${i}: playerSetSpeedometerVisibility(id: $id${i}, visible: $visible)\n  h${i}: playerSetDriverHeaderMode(id: $id${i}, mode: $mode)`
                    ).join('\n  ');
                    const mutation = `mutation BulkEnforceObc($visible: Boolean!, $mode: DriverHeaderMode!, ${idArgs}) {\n  ${fields}\n}`;
                    const variables: Record<string, unknown> = { visible: isSpeedometerVisible, mode: driverHeaderMode };
                    obcPlayers.forEach((p, i) => { variables[`id${i}`] = p.id; });
                    await postMutation(mutation, 'BulkEnforceObc', multiviewerUrl, variables);
                }
            }

            return result;
        },
        onSuccess: invalidateDynamicData,
        onError: (error) => console.error('Sync failed:', error),
    });

    const handleToggleMasterPause = async () => {
        const players = playersDataRef.current;
        const shouldPause = !isGloballyPaused;

        const mainFeed = players.find(p => p.streamData.title === 'F1 LIVE' || p.streamData.title === 'INTERNATIONAL');
        const tracker = players.find(p => p.type === 'TRACKER' || p.streamData.title === 'TRACKER');
        const obcs = players.filter(p => p.type === 'OBC');

        const bulkPauseAndSync = async (orderedPlayers: Player[], syncToId: string) => {
            if (orderedPlayers.length === 0) return;
            const idArgs = orderedPlayers.map((_, i) => `$id${i}: ID!`).join(', ');
            const fields = orderedPlayers.map((_, i) =>
                `p${i}: playerSetPaused(id: $id${i}, paused: $paused)`
            ).join('\n  ');
            const mutation = `mutation BulkPauseAndSync($paused: Boolean!, $syncId: ID!, ${idArgs}) {\n  ${fields}\n  sync: playerSync(id: $syncId)\n}`;
            const variables: Record<string, unknown> = { paused: true, syncId: syncToId };
            orderedPlayers.forEach((p, i) => { variables[`id${i}`] = p.id; });
            await postMutation(mutation, 'BulkPauseAndSync', multiviewerUrl, variables);
        };

        const bulkPlayAndSync = async (
            orderedPlayers: Player[],
            obcCount: number,
            syncToId: string,
            visible: boolean,
            mode: 'OBC_LIVE_TIMING' | 'DRIVER_HEADER'
        ) => {
            if (orderedPlayers.length === 0) return;
            const idArgs = orderedPlayers.map((_, i) => `$id${i}: ID!`).join(', ');
            const playFields = orderedPlayers.map((_, i) =>
                `p${i}: playerSetPaused(id: $id${i}, paused: $paused)`
            ).join('\n  ');
            const enforceFields = Array.from({ length: obcCount }, (_, i) =>
                `s${i}: playerSetSpeedometerVisibility(id: $id${i}, visible: $visible)\n  h${i}: playerSetDriverHeaderMode(id: $id${i}, mode: $mode)`
            ).join('\n  ');
            const enforceBlock = enforceFields ? `\n  ${enforceFields}` : '';
            const mutation = `mutation BulkPlayAndSync($paused: Boolean!, $syncId: ID!, $visible: Boolean!, $mode: DriverHeaderMode!, ${idArgs}) {\n  ${playFields}\n  sync: playerSync(id: $syncId)${enforceBlock}\n}`;
            const variables: Record<string, unknown> = { paused: false, syncId: syncToId, visible, mode };
            orderedPlayers.forEach((p, i) => { variables[`id${i}`] = p.id; });
            await postMutation(mutation, 'BulkPlayAndSync', multiviewerUrl, variables);
        };

        try {
            if (!mainFeed) throw new Error("Main feed not found to sync to.");
            if (shouldPause) {
                const pauseOrder = [mainFeed, tracker, ...obcs].filter(Boolean) as Player[];
                await bulkPauseAndSync(pauseOrder, mainFeed.id);
            } else {
                const playOrder = [...obcs, tracker, mainFeed].filter(Boolean) as Player[];
                await bulkPlayAndSync(playOrder, obcs.length, mainFeed.id, isSpeedometerVisible, driverHeaderMode);
            }
        } catch (error) {
            console.error('Master pause/play sequence failed:', error);
        } finally {
            invalidateDynamicData();
        }
    };
    
    const filteredPlayersData = useMemo(() => {
        const playersByBounds = playersData.reduce((acc, player) => {
            if (!player.bounds) return acc;
            const key = `${player.bounds.x},${player.bounds.y},${player.bounds.width},${player.bounds.height}`;
            (acc[key] = acc[key] || []).push(player);
            return acc;
        }, {} as Record<string, Player[]>);

        const resolvedPlayers: Player[] = [];
        (Object.values(playersByBounds) as Player[][]).forEach(group => {
            if (group.length === 1) {
                resolvedPlayers.push(group[0]);
            } else {
                // Prefer alwaysOnTop, then the most recently created (last in API response).
                // Picking group[0] before would surface the OLDEST player at the bounds, which
                // causes a lag-by-one stale display after a driver switch when MV briefly
                // returns both old and new players at the same coordinates.
                const onTopPlayer = group.find(p => p.alwaysOnTop);
                resolvedPlayers.push(onTopPlayer || group[group.length - 1]);
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
        const syncId = playersDataRef.current.find(p => p.streamData.title === 'F1 LIVE' || p.streamData.title === 'INTERNATIONAL')?.id;
        try {
            if (syncId) {
                await postMutation(
                    `mutation SeekAndSync($id: ID!, $relative: Float, $syncId: ID!) {\n  seek: playerSeekTo(id: $id, relative: $relative)\n  sync: playerSync(id: $syncId)\n}`,
                    'SeekAndSync',
                    multiviewerUrl,
                    { id: playerId, relative: relativeSeconds, syncId }
                );
            } else {
                await postMutation(
                    `mutation PlayerSeekTo($id: ID!, $relative: Float) { playerSeekTo(id: $id, relative: $relative) }`,
                    'PlayerSeekTo',
                    multiviewerUrl,
                    { id: playerId, relative: relativeSeconds }
                );
            }
            invalidateDynamicData();
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

            // Source-load warmup. PrepareDriverSwitch's `unpause` step calls MV's play()
            // which errors with SOURCE_INVALID if load() hasn't resolved yet — so this can't
            // safely drop below ~1000ms.
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Bundled prep: speedo + header + unpause(new) + sync + repause(new). The
            // unpause/repause around the sync is the key to making this work when the session
            // is paused — a freshly created paused player doesn't seem to receive playerSync
            // properly in MultiViewer, so we briefly put it into a "playable" state, sync, and
            // then restore the pause state to match the main feed.
            const mainFeedSnapshot = playersDataRef.current.find(p => p.streamData.title === 'F1 LIVE' || p.streamData.title === 'INTERNATIONAL');
            const syncId = mainFeedSnapshot?.id;
            const finalPaused = mainFeedSnapshot?.state.paused ?? false;
            if (newPlayerId && syncId) {
                await postMutationWithRetry(
                    `mutation PrepareDriverSwitch($newId: ID!, $visible: Boolean!, $mode: DriverHeaderMode!, $syncId: ID!, $finalPaused: Boolean!) {\n  speedo: playerSetSpeedometerVisibility(id: $newId, visible: $visible)\n  header: playerSetDriverHeaderMode(id: $newId, mode: $mode)\n  unpause: playerSetPaused(id: $newId, paused: false)\n  sync: playerSync(id: $syncId)\n  repause: playerSetPaused(id: $newId, paused: $finalPaused)\n}`,
                    'PrepareDriverSwitch',
                    multiviewerUrl,
                    {
                        newId: newPlayerId,
                        visible: isSpeedometerVisible,
                        mode: driverHeaderMode,
                        syncId,
                        finalPaused,
                    }
                );
            } else if (newPlayerId) {
                await postMutationWithRetry(
                    `mutation PrepareDriverSwitchNoSync($newId: ID!, $visible: Boolean!, $mode: DriverHeaderMode!) {\n  speedo: playerSetSpeedometerVisibility(id: $newId, visible: $visible)\n  header: playerSetDriverHeaderMode(id: $newId, mode: $mode)\n}`,
                    'PrepareDriverSwitchNoSync',
                    multiviewerUrl,
                    { newId: newPlayerId, visible: isSpeedometerVisible, mode: driverHeaderMode }
                );
            }

            // Lengthened settle window: lets MV's media pipeline finish rendering the synced
            // frame on the new player before it's foregrounded by the delete.
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Reset alwaysOnTop:false first, then delete — both in one document so the order
            // is guaranteed. Without this, MV refuses to delete a player that still has
            // alwaysOnTop:true and the player accumulates in the players list, causing the
            // controller grid to show a stale driver after a switch.
            await postMutation(
                `mutation FinishDriverSwitch($oldId: ID!) {\n  resetTop: playerSetAlwaysOnTop(id: $oldId, alwaysOnTop: false)\n  delete: playerDelete(id: $oldId)\n}`,
                'FinishDriverSwitch',
                multiviewerUrl,
                { oldId: oldPlayer.id }
            );
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
                <li><strong>Seek (-10s / -5s / +5s / +10s):</strong> Jump the main feed backward or forward. Disabled during live sessions.</li>
                <li><strong>Pause/Play:</strong> Pauses or plays all video feeds simultaneously. Disabled during live sessions.</li>
            </ul>
            <p>The default Speedometer and Onboard Header behavior for all Onboard Cameras can be set in the <strong>Settings</strong> page; those defaults are applied whenever Sync is pressed.</p>
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
                                        {/* Sort by team's current championship position, then by TLA within team — mirrors desktop. */}
                                        {(Object.values(driverListData) as F1Driver[])
                                            .sort((a, b) => {
                                                const aPos = teamStandings?.[a.TeamName] ?? Number.MAX_SAFE_INTEGER;
                                                const bPos = teamStandings?.[b.TeamName] ?? Number.MAX_SAFE_INTEGER;
                                                if (aPos !== bPos) return aPos - bPos;
                                                if (aPos === Number.MAX_SAFE_INTEGER) {
                                                    const teamCmp = a.TeamName.localeCompare(b.TeamName);
                                                    if (teamCmp !== 0) return teamCmp;
                                                }
                                                return a.Tla.localeCompare(b.Tla);
                                            })
                                            .map((d) => {
                                                const isCurrent = selectedPlayer.driverData?.tla === d.Tla;
                                                const line = timingData?.Lines?.[d.RacingNumber];
                                                const isRetired = Boolean(line?.Retired || line?.Stopped);
                                                const isDisabled = isCurrent || isRetired;
                                                return (
                                                    <div
                                                        key={d.Tla}
                                                        className={`controller-mobile-modal-driver-item ${isDisabled ? 'active' : ''}`}
                                                        onClick={() => {
                                                            if (!isDisabled) {
                                                                driverSwitchMutation.mutate(d.Tla);
                                                            }
                                                        }}
                                                        title={isRetired ? `${d.Tla} — out of session` : undefined}
                                                    >
                                                        <img src={d.HeadshotUrl} alt={d.Tla} />
                                                        <span>{d.Tla}</span>
                                                    </div>
                                                );
                                            })}
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

            {(() => {
                const mainFeedId = playersData.find(p => p.streamData.title === 'F1 LIVE' || p.streamData.title === 'INTERNATIONAL')?.id;
                const seekDisabled = isLive || !mainFeedId;
                const seek = (relative: number) => { if (mainFeedId) handleSeek(mainFeedId, relative); };
                return (
                    <div className="controller-mobile-master-controls">
                        <button className="controller-mobile-master-button" onClick={() => syncMutation.mutate()} aria-label="Sync">
                            <SyncIcon />
                        </button>
                        <button className="controller-mobile-master-button controller-mobile-seek-button" onClick={() => seek(-10)} disabled={seekDisabled}>-10s</button>
                        <button className="controller-mobile-master-button controller-mobile-seek-button" onClick={() => seek(-5)} disabled={seekDisabled}>-5s</button>
                        <button className="controller-mobile-master-button" onClick={handleToggleMasterPause} disabled={isLive} aria-label={isGloballyPaused ? 'Play' : 'Pause'}>
                            {isGloballyPaused ? <PlayIcon /> : <PauseIcon />}
                        </button>
                        <button className="controller-mobile-master-button controller-mobile-seek-button" onClick={() => seek(5)} disabled={seekDisabled}>+5s</button>
                        <button className="controller-mobile-master-button controller-mobile-seek-button" onClick={() => seek(10)} disabled={seekDisabled}>+10s</button>
                    </div>
                );
            })()}
            
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