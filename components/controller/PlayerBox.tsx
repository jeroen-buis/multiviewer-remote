import React, { useEffect, useState } from 'react';
import { Player, F1Driver, LapCount } from '../../types';
import { MutedIcon, UnmutedIcon, EnterFullscreenIcon, ExitFullscreenIcon } from './icons';

type PlayerBoxProps = {
    player: Player;
    driver: F1Driver | undefined;
    totalWidth: number;
    totalHeight: number;
    minX: number;
    minY: number;
    onSelect: (player: Player) => void;
    onToggleFullscreen: (playerId: string, currentFullscreenState: boolean) => void;
    lapCount: LapCount | null;
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

const PlayerBox: React.FC<PlayerBoxProps> = ({ player, driver, totalWidth, totalHeight, minX, minY, onSelect, onToggleFullscreen, lapCount }) => {
    const { state } = player;
    const isMainFeed = player.streamData.title === 'F1 LIVE' || player.streamData.title === 'INTERNATIONAL';

    // Local clock for the main feed time — the API only refreshes every refreshDuration ms,
    // so without this the displayed seconds appear to jump rather than tick smoothly. We
    // re-anchor to interpolatedCurrentTime whenever fresh data arrives, and advance +1/s
    // locally while the player is playing.
    const [displayTime, setDisplayTime] = useState(state.interpolatedCurrentTime);
    useEffect(() => {
        if (!isMainFeed) return;
        setDisplayTime(state.interpolatedCurrentTime);
        if (state.paused) return;
        const interval = setInterval(() => {
            setDisplayTime((prev) => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [isMainFeed, state.interpolatedCurrentTime, state.paused]);

    if (!player.bounds) {
        return null;
    }

    return (
        <div
            className={`player-box ${player.fullscreen ? 'player-box--fullscreen' : ''}`}
            style={{
                left: `${((player.bounds.x - minX) / totalWidth) * 100}%`,
                top: `${((player.bounds.y - minY) / totalHeight) * 100}%`,
                width: `${(player.bounds.width / totalWidth) * 100}%`,
                height: `${(player.bounds.height / totalHeight) * 100}%`,
            }}
            onClick={() => onSelect(player)}
        >
            <div className="player-box__info">
                {player.type === 'OBC' && driver?.HeadshotUrl && <img src={driver.HeadshotUrl} alt={driver.Tla} className="player-box__headshot" />}
                <span>{player.type === 'OBC' ? player.driverData?.tla : player.streamData.title}</span>
            </div>
            <div className="player-box__status-icons">
                {state.muted || state.volume === 0 ? (
                    <span title="Muted">
                        <MutedIcon className="player-box__muted-icon" />
                    </span>
                ) : (
                    <span title="Audio Playing">
                        <UnmutedIcon />
                    </span>
                )}
            </div>
            <button
                type="button"
                className="player-box__fullscreen-toggle"
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleFullscreen(player.id, player.fullscreen);
                }}
                aria-label={player.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                title={player.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
                {player.fullscreen ? <ExitFullscreenIcon /> : <EnterFullscreenIcon />}
            </button>
            {isMainFeed && (
                <div className="player-box__main-feed-info">
                    {lapCount && (
                        <div className="player-box__main-feed-lap-count">
                            Lap {lapCount.CurrentLap} / {lapCount.TotalLaps}
                        </div>
                    )}
                    <div className="player-box__main-feed-time">
                        {formatTime(displayTime)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlayerBox;