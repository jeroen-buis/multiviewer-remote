import React from 'react';
import { SyncIcon, PauseIcon, PlayIcon } from './icons';

type MasterControlsProps = {
    syncStatus: 'idle' | 'success' | 'error';
    isGloballyPaused: boolean;
    isSpeedometerVisible: boolean;
    driverHeaderMode: 'OBC_LIVE_TIMING' | 'DRIVER_HEADER';
    isLive: boolean;
    onSync: () => void;
    onToggleMasterPause: () => void;
    onToggleSpeedometer: () => void;
    onToggleDriverHeaderMode: () => void;
};

const MasterControls: React.FC<MasterControlsProps> = ({
    syncStatus,
    isGloballyPaused,
    isSpeedometerVisible,
    driverHeaderMode,
    isLive,
    onSync,
    onToggleMasterPause,
    onToggleSpeedometer,
    onToggleDriverHeaderMode
}) => {
    const syncClasses = [
        'control-button',
        syncStatus === 'success' ? 'success' : '',
        syncStatus === 'error' ? 'error' : ''
    ].join(' ');

    return (
        <div className="master-controls">
            <button className={syncClasses} onClick={onSync}>
                <SyncIcon />
                <span>Sync</span>
            </button>
            <button
                className="control-button"
                onClick={onToggleMasterPause}
                disabled={isLive}
                title={isLive ? "Pause/Play is disabled during a live session" : ""}
            >
                {isGloballyPaused ? <PlayIcon /> : <PauseIcon />}
                <span>{isGloballyPaused ? 'Play' : 'Pause'}</span>
            </button>
            <div className="control-button master-controls__toggle-control">
                <span>Speedometer</span>
                <label className="toggle-switch">
                    <input
                        type="checkbox"
                        checked={isSpeedometerVisible}
                        onChange={onToggleSpeedometer}
                    />
                    <span className="slider"></span>
                </label>
            </div>
            <div className="control-button master-controls__toggle-control">
                <span>Onboard Header</span>
                <label className="toggle-switch">
                    <input
                        type="checkbox"
                        checked={driverHeaderMode === 'DRIVER_HEADER'}
                        onChange={onToggleDriverHeaderMode}
                    />
                    <span className="slider"></span>
                </label>
            </div>
        </div>
    );
};

export default MasterControls;