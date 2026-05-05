import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Player, DriverList, LapCount, F1Driver, TimingData } from './types';
import PlayerBox from './components/controller/PlayerBox';
import MasterControls from './components/controller/MasterControls';
import PlayerModal from './components/controller/PlayerModal';
import Modal from './components/Modal';
import { postMutation, postMutationWithRetry } from './api';
import { useStore } from './store';
import RaceStatusControl from './components/RaceStatusControl';

type ControllerScreenProps = {
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
  multiviewerUrl: string;
};

const ControllerScreen: React.FC<ControllerScreenProps> = ({ playersData, driverListData, timingData, teamStandings, lapCount, trackStatusInfo, drsStatus, sessionType, sessionName, sessionStatus, multiviewerUrl }) => {
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

    const mainFeed = useMemo(
        () => filteredPlayersData.find(p =>
            p.streamData.title === 'F1 LIVE' || p.streamData.title === 'INTERNATIONAL'
        ),
        [filteredPlayersData]
    );
    // Fail-closed: when we can't determine state (no main feed open), assume live so the
    // seek and master pause/play controls stay disabled rather than silently allowing
    // actions that the API will reject during a real live session.
    const isLive = mainFeed ? mainFeed.state.live : true;

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

    // Track each player's most recent non-fullscreen bounds. We use these "stable bounds"
    // to keep the layout coordinate system anchored when fullscreen toggles, and to size
    // the fullscreen tile to the area its same-monitor companions used to occupy (rather
    // than its raw monitor-sized bounds, which would overflow the layout container and
    // get its border clipped).
    const stableBoundsRef = useRef<Map<string, NonNullable<Player['bounds']>>>(new Map());
    filteredPlayersData.forEach(p => {
        if (!p.fullscreen && p.bounds) {
            stableBoundsRef.current.set(p.id, p.bounds);
        }
    });

    // When a player is fullscreen, its expanded bounds tell us its monitor — any other
    // player whose bounds intersect is on the same monitor (visually obscured) and we
    // filter it out. Cross-monitor players keep rendering at their stable positions.
    // The fullscreen tile itself is rendered at the union of its same-monitor companions'
    // stable bounds, so it visibly occupies that monitor's portion of the layout while
    // staying inside the container.
    const playersToRender = useMemo(() => {
        const fullscreenPlayer = filteredPlayersData.find(p => p.fullscreen);
        if (!fullscreenPlayer?.bounds) return filteredPlayersData;

        const fs = fullscreenPlayer.bounds;
        const intersectsFullscreen = (p: Player) => {
            if (!p.bounds) return false;
            const b = p.bounds;
            return !(
                b.x + b.width <= fs.x ||
                b.x >= fs.x + fs.width ||
                b.y + b.height <= fs.y ||
                b.y >= fs.y + fs.height
            );
        };

        // Compute the "monitor area" from the union of same-monitor players' stable bounds.
        const sameMonitorPlayers = filteredPlayersData.filter(intersectsFullscreen);
        let mMinX = Infinity, mMinY = Infinity, mMaxX = -Infinity, mMaxY = -Infinity;
        sameMonitorPlayers.forEach(p => {
            const stable = stableBoundsRef.current.get(p.id) ?? p.bounds;
            if (!stable) return;
            if (stable.x < mMinX) mMinX = stable.x;
            if (stable.y < mMinY) mMinY = stable.y;
            if (stable.x + stable.width > mMaxX) mMaxX = stable.x + stable.width;
            if (stable.y + stable.height > mMaxY) mMaxY = stable.y + stable.height;
        });

        const monitorBounds = isFinite(mMinX)
            ? { x: mMinX, y: mMinY, width: mMaxX - mMinX, height: mMaxY - mMinY }
            : fullscreenPlayer.bounds;

        const fullscreenForRender = { ...fullscreenPlayer, bounds: monitorBounds };

        return [
            fullscreenForRender,
            ...filteredPlayersData.filter(p => p.id !== fullscreenPlayer.id && !intersectsFullscreen(p)),
        ];
    }, [filteredPlayersData]);

    // playersToRender uses stable bounds for the fullscreen tile (sized to its monitor area
    // rather than the raw expanded bounds), so the bounding box stays stable across toggles
    // — no layout freezing needed.
    const layoutDimensions = useMemo(() => {
        if (playersToRender.length === 0) {
            return { totalWidth: 1920, totalHeight: 1080, minX: 0, minY: 0 };
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        playersToRender.forEach(p => {
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
            minY,
        };
    }, [playersToRender]);

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

            // The MultiViewer API doesn't expose per-player speedometer/header state, so we
            // re-apply the toggle values on every sync to keep all OBCs aligned with the UI.
            // Skipped when pausing — the toggles haven't changed and the extra round-trips add latency.
            // Bundled into a single aliased GraphQL document — one HTTP request instead of 2*N.
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

    useEffect(() => {
        if (syncMutation.status === 'success') {
            const timer = setTimeout(() => {
                syncMutation.reset();
            }, 1000);
    
            return () => clearTimeout(timer);
        }
    }, [syncMutation.status, syncMutation.reset]);

    const handleSeek = async (playerId: string, relativeSeconds: number) => {
        const syncId = mainFeed?.id;
        try {
            // Seek + sync in one document. GraphQL serial execution guarantees the sync runs
            // after the seek resolver has fully committed, replacing the old 500ms settle window.
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
    
    const handleToggleSpeedometer = () => {
        const newVisibility = !isSpeedometerVisible;
        const obcPlayers = playersDataRef.current.filter(p => p.type === 'OBC');
        if (obcPlayers.length === 0) {
            setIsSpeedometerVisible(newVisibility);
            return;
        }
        // Bundle all per-OBC mutations into a single aliased GraphQL document — one round-trip
        // instead of N. The shared $visible variable means each field references the same value.
        const idArgs = obcPlayers.map((_, i) => `$id${i}: ID!`).join(', ');
        const fields = obcPlayers.map((_, i) =>
            `s${i}: playerSetSpeedometerVisibility(id: $id${i}, visible: $visible)`
        ).join('\n  ');
        const mutation = `mutation BulkSetSpeedometer($visible: Boolean!, ${idArgs}) {\n  ${fields}\n}`;
        const variables: Record<string, unknown> = { visible: newVisibility };
        obcPlayers.forEach((p, i) => { variables[`id${i}`] = p.id; });

        playerMutation.mutateAsync({ mutation, operationName: 'BulkSetSpeedometer', variables })
            .then(() => setIsSpeedometerVisible(newVisibility))
            .catch((error) => console.error('Failed to toggle speedometer:', error));
    };

    const handleToggleDriverHeaderMode = () => {
        const newMode = driverHeaderMode === 'OBC_LIVE_TIMING' ? 'DRIVER_HEADER' : 'OBC_LIVE_TIMING';
        const obcPlayers = playersDataRef.current.filter(p => p.type === 'OBC');
        if (obcPlayers.length === 0) {
            setDriverHeaderMode(newMode);
            return;
        }
        const idArgs = obcPlayers.map((_, i) => `$id${i}: ID!`).join(', ');
        const fields = obcPlayers.map((_, i) =>
            `h${i}: playerSetDriverHeaderMode(id: $id${i}, mode: $mode)`
        ).join('\n  ');
        const mutation = `mutation BulkSetDriverHeaderMode($mode: DriverHeaderMode!, ${idArgs}) {\n  ${fields}\n}`;
        const variables: Record<string, unknown> = { mode: newMode };
        obcPlayers.forEach((p, i) => { variables[`id${i}`] = p.id; });

        playerMutation.mutateAsync({ mutation, operationName: 'BulkSetDriverHeaderMode', variables })
            .then(() => setDriverHeaderMode(newMode))
            .catch((error) => console.error('Failed to toggle driver header mode:', error));
    };

    const handleToggleMasterPause = async () => {
        const players = playersDataRef.current;
        const shouldPause = !isGloballyPaused;

        const mainFeed = players.find(p => p.streamData.title === 'F1 LIVE' || p.streamData.title === 'INTERNATIONAL');
        const tracker = players.find(p => p.type === 'TRACKER' || p.streamData.title === 'TRACKER');
        const obcs = players.filter(p => p.type === 'OBC');

        // Pause + sync in a single document. GraphQL runs mutation fields serially in document
        // order, so playerSync only fires after every playerSetPaused has resolved.
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

        // Play + sync + OBC enforcement, all in one document. orderedPlayers must list OBCs first
        // (indices 0..obcCount-1) so the enforcement aliases can re-use the same $idN variables.
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
    
    const driverSwitchMutation = useMutation({
        mutationFn: async (newDriverTla: string) => {
            const oldPlayer = selectedPlayer;
            if (!oldPlayer) throw new Error("No player selected to switch.");
            
            setSelectedPlayer(null);
            
            await postMutation(`mutation PlayerSetAlwaysOnTop($id: ID!, $alwaysOnTop: Boolean) { playerSetAlwaysOnTop(id: $id, alwaysOnTop: $alwaysOnTop) }`, 'PlayerSetAlwaysOnTop', multiviewerUrl, { id: oldPlayer.id, alwaysOnTop: true });
            
            const createInput = { maintainAspectRatio: true, fullscreen: false, bounds: oldPlayer.bounds, alwaysOnTop: false, contentId: parseInt(oldPlayer.streamData.contentId, 10), driverTla: newDriverTla };
            const createResult = await postMutation(`mutation PlayerCreate($input: PlayerCreateInput!) { playerCreate(input: $input) }`, 'PlayerCreate', multiviewerUrl, { input: createInput });
            const newPlayerId = createResult.playerCreate;

            // Give MultiViewer time to fully load the new player's source before we touch it.
            // Critical: PrepareDriverSwitch's `unpause` step calls MV's internal play(), which
            // errors with SOURCE_INVALID if load() hasn't resolved yet. 500ms was too short.
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Bundled prep: speedo + header + unpause(new) + sync + repause(new). The
            // unpause/repause around the sync is the key to making this work when the session
            // is paused — a freshly created paused player doesn't seem to receive playerSync
            // properly in MultiViewer, so we briefly put it into a "playable" state, sync, and
            // then restore the pause state to match the main feed.
            const syncId = mainFeed?.id;
            const finalPaused = mainFeed?.state.paused ?? false;
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
                // No main feed to sync against — at least set the attrs.
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

            // Reset alwaysOnTop:false first, then delete — bundled so MV won't refuse to
            // delete a still-flagged-on-top player. Without this the old player accumulates
            // in MV's players list, surfacing as a stale tile in the mobile controller grid
            // (desktop's bounds-dedup happens to pick the newer player so the bug is hidden).
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
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
                            {mainFeedExists && playersToRender.map(player => (
                                <PlayerBox
                                    key={player.id}
                                    player={player}
                                    driver={player.driverData ? findDriverByTla(player.driverData.tla) : undefined}
                                    totalWidth={totalWidth}
                                    totalHeight={totalHeight}
                                    minX={minX}
                                    minY={minY}
                                    onSelect={setSelectedPlayer}
                                    onToggleFullscreen={handleToggleFullscreen}
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
                            mainFeedId={mainFeed?.id ?? null}
                            onSync={() => syncMutation.mutate()}
                            onToggleMasterPause={handleToggleMasterPause}
                            onToggleSpeedometer={handleToggleSpeedometer}
                            onToggleDriverHeaderMode={handleToggleDriverHeaderMode}
                            onSeek={handleSeek}
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
                timingData={timingData}
                teamStandings={teamStandings}
                onClose={() => setSelectedPlayer(null)}
                onToggleFullscreen={handleToggleFullscreen}
                onToggleMute={handleToggleMute}
                onVolumeChange={handleVolumeChange}
                onDriverSwitch={(tla) => driverSwitchMutation.mutate(tla)}
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