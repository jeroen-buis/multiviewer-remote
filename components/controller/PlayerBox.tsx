import React from 'react';
import { Player, F1Driver, LapCount } from '../../types';
import { MutedIcon, UnmutedIcon } from './icons';

type PlayerBoxProps = {
    player: Player;
    driver: F1Driver | undefined;
    totalWidth: number;
    totalHeight: number;
    minX: number;
    minY: number;
    onSelect: (player: Player) => void;
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

const PlayerBox: React.FC<PlayerBoxProps> = ({ player, driver, totalWidth, totalHeight, minX, minY, onSelect, lapCount }) => {
    if (!player.bounds) {
        return null;
    }

    const { state } = player;
    const isMainFeed = player.streamData.title === 'F1 LIVE' || player.streamData.title === 'INTERNATIONAL';

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
            {isMainFeed && (
                <div className="player-box__main-feed-info">
                    {lapCount && (
                        <div className="player-box__main-feed-lap-count">
                            Lap {lapCount.CurrentLap} / {lapCount.TotalLaps}
                        </div>
                    )}
                    <div className="player-box__main-feed-time">
                        {formatTime(state.interpolatedCurrentTime)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlayerBox;