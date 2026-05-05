import React, { useState, useEffect, useRef } from 'react';
import { Player, DriverList, F1Driver, TimingData } from '../../types';
import { EnterFullscreenIcon, ExitFullscreenIcon, MutedIcon, UnmutedIcon, UserPlaceholderIcon } from './icons';

type PlayerModalProps = {
    player: Player | null;
    driverList: DriverList;
    timingData?: TimingData | null;
    teamStandings?: Record<string, number> | null;
    onClose: () => void;
    onToggleFullscreen: (playerId: string, currentFullscreenState: boolean) => void;
    onToggleMute: (playerId: string, currentMuteState: boolean) => void;
    onVolumeChange: (playerId: string, newVolume: number, isMuted: boolean) => Promise<void>;
    onDriverSwitch: (newDriverTla: string) => void;
};

const PlayerModal: React.FC<PlayerModalProps> = ({ player, driverList, timingData, teamStandings, onClose, onToggleFullscreen, onToggleMute, onVolumeChange, onDriverSwitch }) => {
    const [isVolumeSliderActive, setIsVolumeSliderActive] = useState(false);
    const [modalVolume, setModalVolume] = useState(0);
    const volumeChangeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Effect to close modal on Escape key press
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    // Effect to sync modal state with player state
    useEffect(() => {
        if (player) {
            if (!isVolumeSliderActive) {
                setModalVolume(player.state.volume);
            }
        } else {
            setIsVolumeSliderActive(false);
            if (volumeChangeTimeout.current) {
                clearTimeout(volumeChangeTimeout.current);
            }
        }
    }, [player, isVolumeSliderActive]);

    // Debounced effect for handling volume changes from the slider
    useEffect(() => {
        if (!isVolumeSliderActive || !player) {
            return;
        }

        if (volumeChangeTimeout.current) {
            clearTimeout(volumeChangeTimeout.current);
        }

        volumeChangeTimeout.current = setTimeout(() => {
            onVolumeChange(player.id, modalVolume, player.state.muted).finally(() => {
                setIsVolumeSliderActive(false); // Release lock
            });
        }, 250);

        return () => {
            if (volumeChangeTimeout.current) {
                clearTimeout(volumeChangeTimeout.current);
            }
        };
    }, [modalVolume, isVolumeSliderActive, player, onVolumeChange]);

    if (!player) return null;

    const isOBC = player.type === 'OBC';
    // FIX: Explicitly type items from Object.values to avoid 'unknown' type errors.
    const driver = player.driverData ? (Object.values(driverList) as F1Driver[]).find(d => d.Tla === player.driverData!.tla) : null;
    // Sort by team's current championship position (e.g. Mercedes drivers first if Mercedes is P1).
    // Within a team, alphabetical TLA — stable across data refreshes. Falls back to TeamName order
    // if the championship feed isn't broadcasting yet.
    const allDriversSorted = (Object.values(driverList) as F1Driver[])
        .sort((a, b) => {
            const aPos = teamStandings?.[a.TeamName] ?? Number.MAX_SAFE_INTEGER;
            const bPos = teamStandings?.[b.TeamName] ?? Number.MAX_SAFE_INTEGER;
            if (aPos !== bPos) return aPos - bPos;
            if (aPos === Number.MAX_SAFE_INTEGER) {
                const teamCmp = a.TeamName.localeCompare(b.TeamName);
                if (teamCmp !== 0) return teamCmp;
            }
            return a.Tla.localeCompare(b.Tla);
        });

    const isDriverRetired = (racingNumber: string) => {
        const line = timingData?.Lines?.[racingNumber];
        return Boolean(line?.Retired || line?.Stopped);
    };

    return (
        <div className="player-modal-overlay" onClick={onClose}>
            <div className="player-modal" onClick={(e) => e.stopPropagation()}>
                <div className="player-modal-header">
                    <div className="player-modal-info">
                        {isOBC && driver?.HeadshotUrl && <img src={driver.HeadshotUrl} alt={driver.Tla} className="player-modal-headshot" />}
                        {isOBC && !driver?.HeadshotUrl && (
                            <div className="player-modal-driver-headshot-placeholder"><UserPlaceholderIcon /></div>
                        )}
                        <h2>{isOBC ? player.driverData?.tla : player.streamData.title}</h2>
                    </div>
                    <button className="player-modal-close-button" onClick={onClose}>&times;</button>
                </div>
                
                <div className="player-modal-divider" />

                <div className="player-modal-control-box">
                    <div className="player-modal-controls">
                        <button
                            className="control-button icon-only"
                            title={player.fullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                            onClick={() => onToggleFullscreen(player.id, player.fullscreen)}
                        >
                            {player.fullscreen ? <ExitFullscreenIcon /> : <EnterFullscreenIcon />}
                        </button>
                        <div className="player-modal-control-group">
                            <button className="player-modal-icon-button" onClick={() => onToggleMute(player.id, player.state.muted)}>
                                {player.state.muted ? <MutedIcon className="muted-icon" /> : <UnmutedIcon />}
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={modalVolume}
                                onMouseDown={() => setIsVolumeSliderActive(true)}
                                onChange={(e) => setModalVolume(parseInt(e.target.value, 10))}
                            />
                        </div>
                    </div>
                </div>

                {isOBC && (
                    <>
                        <div className="player-modal-divider" />
                        <div className="player-modal-driver-list">
                            <h3>Switch Driver</h3>
                            <div className="player-modal-driver-grid">
                                {allDriversSorted.map((d) => {
                                    const isCurrentDriver = d.Tla === driver?.Tla;
                                    const isRetired = isDriverRetired(d.RacingNumber);
                                    const isDisabled = isCurrentDriver || isRetired;
                                    return (
                                        <div
                                            key={d.Tla}
                                            className={`player-modal-driver-grid-item ${isDisabled ? 'disabled' : ''}`}
                                            onClick={() => !isDisabled && onDriverSwitch(d.Tla)}
                                            title={isRetired ? `${d.Tla} — out of session` : undefined}
                                        >
                                            {d.HeadshotUrl ? (
                                                <img src={d.HeadshotUrl} alt={d.Tla} />
                                            ) : (
                                                <div className="player-modal-driver-headshot-placeholder">
                                                    <UserPlaceholderIcon />
                                                </div>
                                            )}
                                            <span>{d.Tla}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PlayerModal;