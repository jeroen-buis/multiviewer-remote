import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Player, DriverList, LapCount, F1Driver } from './types';
import PlayerBox from './components/controller/PlayerBox';
import MasterControls from './components/controller/MasterControls';
import PlayerModal from './components/controller/PlayerModal';
import Modal from './components/Modal';
import { postMutation } from './api';
import { useStore } from './store';
import RaceStatusControl from './components/RaceStatusControl';

type ControllerScreenProps = {
  playersData: Player[];
  driverListData: DriverList;
  lapCount: LapCount | null;
  trackStatusInfo: { className: string; text: string; visible: boolean };
  drsStatus: 'ENABLED' | 'DISABLED' | string | null;
  sessionType?: string;
  sessionName?: string;
  sessionStatus?: string;
  multiviewerUrl: string;
};

const ControllerScreen: React.FC<ControllerScreenProps> = ({ playersData, driverListData, lapCount, trackStatusInfo, drsStatus, sessionType, sessionName, sessionStatus, multiviewerUrl }) => {
    const isSpeedometerVisible = useStore((state) => state.isSpeedometerVisible);
    const setIsSpeedometerVisible = useStore((state) => state.setIsSpeedometerVisible);
    const driverHeaderMode = useStore((state) => state.driverHeaderMode);
    const setDriverHeaderMode = useStore((state) => state.setDriverHeaderMode);

    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [isGloballyPaused, setIsGloballyPaused] = useState(false);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    
    const deferredPlayersData = React.useDeferredValue(playersData);

    const filteredPlayersData = useMemo(() => {
        const playersWithBounds: Player[] = [];
        const playersWithoutBounds: Player[] = [];

        // Separate players with and without bounds
        deferredPlayersData.forEach(player => {
            if (player.bounds) {
                playersWithBounds.push(player);
            } else {
                playersWithoutBounds.push(player);
            }
        });

        // Deduplicate stacked players (same position) — round to integers
        // to avoid floating-point mismatches from the API
        const playersByBounds = playersWithBounds.reduce((acc, player) => {
            const b = player.bounds!;
            const key = `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.width)},${Math.round(b.height)}`;
            (acc[key] = acc[key] || []).push(player);
            return acc;
        }, {} as Record<string, Player[]>);

        const resolvedPlayers: Player[] = [];
        (Object.values(playersByBounds) as Player[][]).forEach(group => {
            if (group.length === 1) {
                resolvedPlayers.push(group[0]);
            } else {
                // Prefer the alwaysOnTop player, then the last in the group
                // (last is most likely the topmost in the stack)
                const onTopPlayer = group.find(p => p.alwaysOnTop);
                resolvedPlayers.push(onTopPlayer || group[group.length - 1]);
            }
        });

        return resolvedPlayers;
    }, [deferredPlayersData]);

    const queryClient = useQueryClient();
    const playersDataRef = useRef(playersData);

    useEffect(() => {
        playersDataRef.current = playersData;
    }, [playersData]);

    const isLive = useMemo(() => {
        const mainFeed = filteredPlayersData.find(p => 
            p.streamData.title === 'F1 LIVE' || p.streamData.title === 'INTERNATIONAL'
        );
        return mainFeed ? mainFeed.state.live : false;
    }, [filteredPlayersData]);

    useEffect(() => {
        const mainFeed = filteredPlayersData.find(p => p.streamData.title === 'F1 LIVE' || p.streamData.title === 'INTERNATIONAL');
        setIsGloballyPaused(mainFeed ? mainFeed.state.paused : false);
    }, [filteredPlayersData]);

    useEffect(() => {
        if (selectedPlayer) {
            const updatedPlayer = filteredPlayersData.find(p => p.id === selectedPlayer.id);
            if (updatedPlayer) {
                if (selectedPlayer.id !== updatedPlayer.id ||
                    selectedPlayer.state.paused !== updatedPlayer.state.paused ||
                    selectedPlayer.state.muted !== updatedPlayer.state.muted ||
                    selectedPlayer.state.volume !== updatedPlayer.state.volume ||
                    selectedPlayer.state.currentTime !== updatedPlayer.state.currentTime ||
                    selectedPlayer.state.live !== updatedPlayer.state.live ||
                    selectedPlayer.fullscreen !== updatedPlayer.fullscreen) {
                    setSelectedPlayer(updatedPlayer);
                }
            } else {
                setSelectedPlayer(null);
            }
        }
    }, [filteredPlayersData, selectedPlayer]);

    const invalidateDynamicData = () => {
        queryClient.invalidateQueries({ queryKey: ['dynamicData'] });
    };
    
    const playerMutation = useMutation({
        mutationFn: ({ mutation, operationName, variables }: { mutation: string; operationName: string; variables: Record<string, unknown> }) => 
            postMutation(mutation, operationName, multiviewerUrl, variables),
        onSuccess: invalidateDynamicData,
        onError: (error: Error, variables) => {
            console.error(`Mutation ${variables.operationName} failed:`, error);
        },
    });

    const layoutDimensions = useMemo(() => {
        if (filteredPlayersData.length === 0) {
            return { totalWidth: 1920, totalHeight: 1080, minX: 0, minY: 0 };
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        filteredPlayersData.forEach(p => {
            const b = p.bounds!;
            if (b.x < minX) minX = b.x;
            if (b.y < minY) minY = b.y;
            if (b.x + b.width > maxX) maxX = b.x + b.width;
            if (b.y + b.height > maxY) maxY = b.y + b.height;
        });

        const totalWidth = maxX - minX;
        const totalHeight = maxY - minY;

        return {
            totalWidth: totalWidth > 0 ? totalWidth : 1920,
            totalHeight: totalHeight > 0 ? totalHeight : 1080,
            minX,
            minY
        };
    }, [filteredPlayersData]);

    const { totalWidth, totalHeight, minX, minY } = layoutDimensions;

    const mainFeedExists = useMemo(() => {
        return filteredPlayersData.some(p => 
            p.streamData.title === 'F1 LIVE' || p.streamData.title === 'INTERNATIONAL'
        );
    }, [filteredPlayersData]);

    const findDriverByTla = (tla: string) => {
        // FIX: Explicitly type 'driver' to avoid property access error on 'unknown'.
        return (Object.values(driverListData) as F1Driver[]).find(driver => driver.Tla === tla);
    };

    const handleToggleFullscreen = (playerId: string, currentFullscreenState: boolean) => {
        playerMutation.mutate({
            mutation: `
                mutation PlayerSetFullscreen($id: ID!, $fullscreen: Boolean) {
                    playerSetFullscreen(id: $id, fullscreen: $fullscreen)
                }
            `,
            operationName: 'PlayerSetFullscreen',
            variables: { id: playerId, fullscreen: !currentFullscreenState }
        });
    };

    const handleToggleMute = (playerId: string, currentMuteState: boolean) => {
        playerMutation.mutate({
            mutation: `
                mutation PlayerSetMuted($id: ID!, $muted: Boolean) {
                    playerSetMuted(id: $id, muted: $muted)
                }
            `,
            operationName: 'PlayerSetMuted',
            variables: { id: playerId, muted: !currentMuteState }
        });
    };
    
    const handleVolumeChange = async (playerId: string, newVolume: number, isCurrentlyMuted: boolean) => {
        const player = playersDataRef.current.find(p => p.id === playerId);
        if (!player) return;

        const { volume: currentVolume } = player.state;
        const volumeHasChanged = newVolume !== currentVolume;
        const shouldMute = newVolume === 0 && !isCurrentlyMuted;
        const shouldUnmute = newVolume > 0 && isCurrentlyMuted;

        if (volumeHasChanged) {
            playerMutation.mutate({
                mutation: `mutation PlayerSetVolume($id: ID!, $volume: Float!) { playerSetVolume(id: $id, volume: $volume) }`,
                operationName: 'PlayerSetVolume',
                variables: { id: playerId, volume: newVolume }
            });
        }
        if (shouldMute || shouldUnmute) {
            handleToggleMute(playerId, isCurrentlyMuted);
        }
    };
    
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

    useEffect(() => {
        if (syncMutation.status === 'success') {
            const timer = setTimeout(() => {
                syncMutation.reset();
            }, 1000);
    
            return () => clearTimeout(timer);
        }
    }, [syncMutation.status, syncMutation.reset]);

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
        }).catch((error) => {
            console.error('Failed to toggle speedometer:', error);
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
        }).catch((error) => {
            console.error('Failed to toggle driver header mode:', error);
        });
    };

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
    
    const driverSwitchMutation = useMutation({
        mutationFn: async (newDriverTla: string) => {
            const oldPlayer = selectedPlayer;
            if (!oldPlayer) throw new Error("No player selected to switch.");
            
            setSelectedPlayer(null);
            
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
            alert(`An error occurred while switching drivers. Please check the console.`);
            invalidateDynamicData();
        },
    });

    const infoIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
    );

    const controllerHelpContent = (
        <>
            <p>
                The Controller screen mirrors your current MultiViewer layout, allowing you to manage video players and switch onboard cameras directly from this remote app.
            </p>
            <h3>Initial Setup in MultiViewer</h3>
            <p>
                Before using the Controller, you must set up your desired screen layout within the main MultiViewer application. This can be done manually by adding and arranging players, or by using the "Setup" feature.
            </p>
            <ul>
                <li>The layout you see here is a direct reflection of what's on your main screen.</li>
                <li><strong>Important:</strong> This remote app cannot create or arrange the initial layout. It can only control players that are already open in MultiViewer.</li>
            </ul>

            <h3>Interacting with Players</h3>
            <p>Simply click on any player box to open a detailed control modal for that specific feed.</p>
            <ul>
                <li><strong>Main Feeds (F1 Live, International, Tracker):</strong> In the modal, you can seek the feed backward or forward in time. Seeking is disabled during live sessions.</li>
                <li><strong>Onboard Cameras (OBCs):</strong> Clicking an OBC player allows you to switch to any other driver. Select a new driver from the grid, and the remote will seamlessly replace the old feed with the new one.</li>
                <li><strong>All Players:</strong> You can toggle fullscreen mode and mute/unmute the audio for any player from its control modal.</li>
            </ul>
             <p><em>Note: Data feeds like Live Timing may appear in the layout if they are open in MultiViewer, but they are not interactive within this remote app.</em></p>

            <h3>Master Controls</h3>
            <p>The buttons at the bottom of the screen provide global control over all players:</p>
            <ul>
                <li><strong>Sync:</strong> Resynchronizes all video feeds to the main F1 Live feed's timestamp.</li>
                <li><strong>Pause/Play:</strong> Pauses or plays all video feeds simultaneously. This is disabled during live sessions.</li>
                <li><strong>Speedometer:</strong> Toggles the visibility of the speedometer graphic on all Onboard Cameras.</li>
                <li><strong>Onboard Header:</strong> Switches the header style on all Onboard Cameras between the compact timing bar and the full driver information header.</li>
            </ul>
        </>
    );

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <h1 style={{ margin: 0 }}>Controller</h1>
                <span onClick={() => setIsInfoModalOpen(true)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Learn more about this screen">
                    {infoIcon}
                </span>
            </div>
            <RaceStatusControl
                lapCount={lapCount}
                trackStatusInfo={trackStatusInfo}
                drsStatus={drsStatus}
                sessionType={sessionType}
                sessionName={sessionName}
                sessionStatus={sessionStatus}
            />
            <div className="card">
                {playersData && playersData.length > 0 ? (
                    <>
                        <div className="screen-layout-container" style={{ aspectRatio: `${totalWidth} / ${totalHeight}` }}>
                            {mainFeedExists && filteredPlayersData.map(player => (
                                <PlayerBox
                                    key={player.id}
                                    player={player}
                                    driver={player.driverData ? findDriverByTla(player.driverData.tla) : undefined}
                                    totalWidth={totalWidth}
                                    totalHeight={totalHeight}
                                    minX={minX}
                                    minY={minY}
                                    onSelect={setSelectedPlayer}
                                    lapCount={lapCount}
                                />
                            ))}
                        </div>
                        <MasterControls
                            syncStatus={syncMutation.status === 'success' ? 'success' : syncMutation.status === 'error' ? 'error' : 'idle'}
                            isGloballyPaused={isGloballyPaused}
                            isSpeedometerVisible={isSpeedometerVisible}
                            driverHeaderMode={driverHeaderMode}
                            isLive={isLive}
                            onSync={() => syncMutation.mutate()}
                            onToggleMasterPause={handleToggleMasterPause}
                            onToggleSpeedometer={handleToggleSpeedometer}
                            onToggleDriverHeaderMode={handleToggleDriverHeaderMode}
                        />
                    </>
                ) : (
                    <div style={{ padding: '1rem' }}>
                        <p>
                            No players data found. Please use <strong>MultiViewer</strong> directly to configure and set up the way you prefer to watch the race. Once you have configured all the players you can use <strong>MultiViewer Remote</strong> to control them and, for example, switch OBCs.
                        </p>
                    </div>
                )}
            </div>
            <PlayerModal
                player={selectedPlayer}
                driverList={driverListData}
                isLive={isLive}
                onClose={() => setSelectedPlayer(null)}
                onToggleFullscreen={handleToggleFullscreen}
                onToggleMute={handleToggleMute}
                onVolumeChange={handleVolumeChange}
                onDriverSwitch={(tla) => driverSwitchMutation.mutate(tla)}
                onSeek={handleSeek}
            />
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

export default ControllerScreen;