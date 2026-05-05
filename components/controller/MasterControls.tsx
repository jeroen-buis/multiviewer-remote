import React from 'react';
import { SyncIcon, PauseIcon, PlayIcon, SpeedometerIcon, HeaderIcon } from './icons';

type MasterControlsProps = {
    syncStatus: 'idle' | 'success' | 'error';
    isGloballyPaused: boolean;
    isSpeedometerVisible: boolean;
    driverHeaderMode: 'OBC_LIVE_TIMING' | 'DRIVER_HEADER';
    isLive: boolean;
    mainFeedId: string | null;
    onSync: () => void;
    onToggleMasterPause: () => void;
    onToggleSpeedometer: () => void;
    onToggleDriverHeaderMode: () => void;
    onSeek: (playerId: string, relativeSeconds: number) => void;
};

// Bare labels — direction is conveyed by the button's position relative to the play button.
const SEEK_OFFSETS: { label: string; seconds: number }[] = [
    { label: '5m', seconds: -300 },
    { label: '30s', seconds: -30 },
    { label: '10s', seconds: -10 },
    { label: '5s', seconds: -5 },
];

const SEEK_OFFSETS_FORWARD: { label: string; seconds: number }[] = [
    { label: '5s', seconds: 5 },
    { label: '10s', seconds: 10 },
    { label: '30s', seconds: 30 },
    { label: '5m', seconds: 300 },
];

const MasterControls: React.FC<MasterControlsProps> = ({
    syncStatus,
    isGloballyPaused,
    isSpeedometerVisible,
    driverHeaderMode,
    isLive,
    mainFeedId,
    onSync,
    onToggleMasterPause,
    onToggleSpeedometer,
    onToggleDriverHeaderMode,
    onSeek,
}) => {
    const syncClasses = [
        'control-button',
        syncStatus === 'success' ? 'success' : '',
        syncStatus === 'error' ? 'error' : '',
    ].join(' ');

    const transportDisabled = isLive || !mainFeedId;
    const seekTitle = isLive
        ? 'Seeking is disabled during a live session'
        : !mainFeedId
            ? 'Seeking requires the F1 Live or International feed to be open'
            : '';

    const handleSeek = (seconds: number) => {
        if (mainFeedId) onSeek(mainFeedId, seconds);
    };

    return (
        <div className="master-controls">
            <button className={syncClasses} onClick={onSync}>
                <SyncIcon />
                <span>Sync</span>
            </button>
            <div className="master-controls__transport">
                {SEEK_OFFSETS.map(({ label, seconds }) => (
                    <button
                        key={label}
                        type="button"
                        className="control-button master-controls__seek-button"
                        onClick={() => handleSeek(seconds)}
                        disabled={transportDisabled}
                        title={seekTitle}
                    >
                        {label}
                    </button>
                ))}
                <button
                    type="button"
                    className="control-button master-controls__play-button"
                    onClick={onToggleMasterPause}
                    disabled={isLive}
                    title={isLive ? 'Pause/Play is disabled during a live session' : ''}
                    aria-label={isGloballyPaused ? 'Play' : 'Pause'}
                >
                    {isGloballyPaused ? <PlayIcon /> : <PauseIcon />}
                </button>
                {SEEK_OFFSETS_FORWARD.map(({ label, seconds }) => (
                    <button
                        key={label}
                        type="button"
                        className="control-button master-controls__seek-button"
                        onClick={() => handleSeek(seconds)}
                        disabled={transportDisabled}
                        title={seekTitle}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div className="master-controls__right">
                <button
                    type="button"
                    className={`control-button master-controls__toggle-button ${isSpeedometerVisible ? 'is-active' : ''}`}
                    onClick={onToggleSpeedometer}
                    aria-pressed={isSpeedometerVisible}
                    aria-label="Speedometer (all Onboard Cameras)"
                    data-tooltip="Speedometer"
                >
                    <SpeedometerIcon />
                </button>
                <button
                    type="button"
                    className={`control-button master-controls__toggle-button ${driverHeaderMode === 'DRIVER_HEADER' ? 'is-active' : ''}`}
                    onClick={onToggleDriverHeaderMode}
                    aria-pressed={driverHeaderMode === 'DRIVER_HEADER'}
                    aria-label="Onboard Header (full driver header vs. compact timing)"
                    data-tooltip="Onboard Header"
                >
                    <HeaderIcon />
                </button>
            </div>
        </div>
    );
};

export default MasterControls;
