import React from 'react';
import { LapCount } from '../types';

type RaceStatusControlProps = {
  lapCount: LapCount | null;
  trackStatusInfo: { className: string; text: string; visible: boolean };
  drsStatus: 'ENABLED' | 'DISABLED' | string | null;
  sessionType?: string;
  sessionName?: string;
  sessionStatus?: string;
};

const RaceStatusControl: React.FC<RaceStatusControlProps> = ({ lapCount, trackStatusInfo, drsStatus, sessionType, sessionName, sessionStatus }) => {
  
  const renderLapInfo = () => {
    // If session is Finished, display "Finished". This takes top priority.
    if (sessionStatus === 'Finished') {
        return <span className="laps-current">Finished</span>;
    }

    // If we have lap data for a race (TotalLaps > 0), display it. This is a strong indicator of a race session.
    if (lapCount && lapCount.TotalLaps > 0) {
      const lapsLeft = lapCount.TotalLaps - lapCount.CurrentLap + 1;
      return (
        <>
          <span className="laps-current">
            Lap {lapCount.CurrentLap} / {lapCount.TotalLaps}
          </span>
          <span className="laps-remaining">
            {lapsLeft > 1 ? `${lapsLeft} Laps Remaining` : 'Final Lap'}
          </span>
        </>
      );
    }
    
    // For non-race sessions, or race sessions before lap data is available.
    if (sessionType) {
        const lowerSessionType = sessionType.toLowerCase();
        // For practice or qualifying, display the specific session name.
        if (lowerSessionType.includes('practice') || lowerSessionType.includes('qualifying')) {
            // Use sessionName if available, otherwise fallback to sessionType
            return <span className="laps-current">{sessionName || sessionType}</span>;
        }
    }
    
    // Default for race sessions before lap data is available.
    return <span className="laps-current">Formation Lap</span>;
  };

  return (
    <div className="race-status-control">
      <div className={`race-status-control__track-status ${trackStatusInfo.visible ? trackStatusInfo.className : ''}`}>
        {trackStatusInfo.visible ? trackStatusInfo.text : '---'}
      </div>
      
      <div className="race-status-control__lap-info">
        {renderLapInfo()}
      </div>

      {drsStatus !== null && (
        <div className={`race-status-control__drs-status ${drsStatus === 'ENABLED' ? 'race-status-control__drs-status--enabled' : 'race-status-control__drs-status--disabled'}`}>
          DRS {drsStatus}
        </div>
      )}
    </div>
  );
};

export default RaceStatusControl;