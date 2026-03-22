import React, { useState, useEffect, useRef } from 'react';
import { Player, DriverList, F1Driver } from '../../types';
import { EnterFullscreenIcon, ExitFullscreenIcon, MutedIcon, UnmutedIcon, UserPlaceholderIcon } from './icons';

type PlayerModalProps = {
    player: Player | null;
    driverList: DriverList;
    isLive: boolean;
    onClose: () => void;
    onToggleFullscreen: (playerId: string, currentFullscreenState: boolean) => void;
    onToggleMute: (playerId: string, currentMuteState: boolean) => void;
    onVolumeChange: (playerId: string, newVolume: number, isMuted: boolean) => Promise<void>;
    onDriverSwitch: (newDriverTla: string) => void;
    onSeek: (playerId: string, relativeSeconds: number) => void;
};

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

const PlayerModal: React.FC<PlayerModalProps> = ({ player, driverList, isLive, onClose, onToggleFullscreen, onToggleMute, onVolumeChange, onDriverSwitch, onSeek }) => {
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

    const [displayTime, setDisplayTime] = useState(0);

    useEffect(() => {
        if (!player || player.state.paused) {
            if (player) setDisplayTime(player.state.interpolatedCurrentTime);
            return;
        }

        // Initialize from the player's interpolated time
        setDisplayTime(player.state.interpolatedCurrentTime);

        // Tick forward every second while playing
        const interval = setInterval(() => {
            setDisplayTime(prev => prev + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [player?.id, player?.state.interpolatedCurrentTime, player?.state.paused]);

    if (!player) return null;

    const isOBC = player.type === 'OBC';
    // FIX: Explicitly type items from Object.values to avoid 'unknown' type errors.
    const driver = player.driverData ? (Object.values(driverList) as F1Driver[]).find(d => d.Tla === player.driverData!.tla) : null;
    const allDriversSorted = (Object.values(driverList) as F1Driver[])
        .sort((a, b) => a.TeamName.localeCompare(b.TeamName) || a.Tla.localeCompare(b.Tla));

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

                {!isOBC && (
                    <>
                        <div className="player-modal-divider" />
                        <div 
                            className={`player-modal-seek-controls ${isLive ? 'disabled' : ''}`}
                            title={isLive ? "Seeking is disabled during a live session" : ""}
                        >
                            <h3>Seek Feed</h3>
                            <div className="player-modal-seek-buttons">
                                <button className="control-button" onClick={() => onSeek(player.id, -300)} disabled={isLive}>-5m</button>
                                <button className="control-button" onClick={() => onSeek(player.id, -30)} disabled={isLive}>-30s</button>
                                <button className="control-button" onClick={() => onSeek(player.id, -10)} disabled={isLive}>-10s</button>
                                <div className="player-modal-current-time">
                                    {formatTime(displayTime)}
                                </div>
                                <button className="control-button" onClick={() => onSeek(player.id, 10)} disabled={isLive}>+10s</button>
                                <button className="control-button" onClick={() => onSeek(player.id, 30)} disabled={isLive}>+30s</button>
                                <button className="control-button" onClick={() => onSeek(player.id, 300)} disabled={isLive}>+5m</button>
                            </div>
                        </div>
                    </>
                )}

                {isOBC && (
                    <>
                        <div className="player-modal-divider" />
                        <div className="player-modal-driver-list">
                            <h3>Switch Driver</h3>
                            <div className="player-modal-driver-grid">
                                {allDriversSorted.map((d) => {
                                    const isCurrentDriver = d.Tla === driver?.Tla;
                                    return (
                                        <div
                                            key={d.Tla}
                                            className={`player-modal-driver-grid-item ${isCurrentDriver ? 'disabled' : ''}`}
                                            onClick={() => !isCurrentDriver && onDriverSwitch(d.Tla)}
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