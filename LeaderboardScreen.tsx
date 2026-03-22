import React, { useState, useRef, useEffect } from 'react';
import { FetchedData, F1LiveTimingState, LapCount, Stint, TimingDataLine } from './types';
import RaceStatusControl from './components/RaceStatusControl';
import TireIcon from './components/TireIcon';
import Modal from './components/Modal';
import { lapTimeToSeconds } from './utils';

type LeaderboardScreenProps = {
  f1LiveTimingState: FetchedData<F1LiveTimingState | null>;
  lapCount: LapCount | null;
  trackStatusInfo: { className: string; text: string; visible: boolean };
  drsStatus: 'ENABLED' | 'DISABLED' | string | null;
};

interface LeaderboardDriver {
  position: number;
  tla: string;
  racingNumber: string;
  teamColour: string;
  lastLapTimeValue: string;
  bestLapTimeValue: string;
  bestLapLap: number | undefined;
  lapHighlight: 'overall' | 'personal' | null;
  interval: string;
  gap: string;
  status: string;
  isRetiredOrStopped: boolean;
  stints: Stint[];
  isOverallBestLap: boolean;
  isCatching: boolean;
  netChange: number | null;
}

type TooltipData = {
  content: React.ReactNode;
  x: number;
  y: number;
  pinnedForTla: string | null;
  type: 'driver' | 'tires';
  position: 'top' | 'bottom';
};

const Tooltip: React.FC<{ data: TooltipData | null }> = ({ data }) => {
  if (!data) return null;
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${data.x}px`,
    top: `${data.y}px`,
    backgroundColor: '#333',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '0.85rem',
    zIndex: 1000,
    pointerEvents: 'none',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    transform: 'translate(-50%, -100%) translateY(-10px)',
  };

  if (data.position === 'bottom') {
    // 24px is an estimate for row/icon height
    style.transform = `translate(-50%, 24px)`;
  }

  return <div style={style}>{data.content}</div>;
};

const TireTooltipContent: React.FC<{ stints: Stint[] }> = ({ stints }) => (
    <div className="tire-tooltip-content">
        <div className="tire-tooltip-header">Tire History</div>
        {stints.map((stint, index) => {
            const isCurrent = index === stints.length - 1;
            const stintLaps = stint.TotalLaps - (stint.StartLaps || 0);
            const compoundName = stint.Compound.charAt(0).toUpperCase() + stint.Compound.slice(1).toLowerCase();

            return (
                <div key={index} className="tire-tooltip-stint">
                    <TireIcon compound={stint.Compound} size={24} />
                    <div className="tire-tooltip-stint-info">
                        <div className="compound-status">
                            <span className="compound-name">{compoundName}</span>
                            <span className="compound-new-used">({stint.New === 'true' ? 'New' : 'Used'})</span>
                        </div>
                        <span className="lap-count">{stintLaps} Lap{stintLaps !== 1 ? 's' : ''}</span>
                    </div>
                    {isCurrent && <span className="tire-tooltip-stint-current-badge">Current</span>}
                </div>
            );
        })}
    </div>
);


const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({ f1LiveTimingState, lapCount, trackStatusInfo, drsStatus }) => {
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const createTooltip = (event: React.MouseEvent, content: React.ReactNode, pinnedForTla: string | null = null, type: TooltipData['type']) => {
    if (!cardRef.current) return;
    const cardRect = cardRef.current.getBoundingClientRect();
    const targetRect = event.currentTarget.getBoundingClientRect();
    
    const x = targetRect.left - cardRect.left + targetRect.width / 2;
    const y = targetRect.top - cardRect.top;

    const tooltipThreshold = 120; // Estimated height of tooltip + buffer
    const position = y < tooltipThreshold ? 'bottom' : 'top';

    setTooltipData({ content, x, y, pinnedForTla, type, position });
  };

  const handleDriverMouseEnter = (event: React.MouseEvent, racingNumber: string) => {
    if (tooltipData?.pinnedForTla) return;
    createTooltip(event, `Race Number: ${racingNumber}`, null, 'driver');
  };

  const handleDriverMouseLeave = () => {
    if (tooltipData && !tooltipData.pinnedForTla) {
      setTooltipData(null);
    }
  };

  const handleDriverClick = (event: React.MouseEvent, tla: string, racingNumber: string) => {
    event.stopPropagation();
    if (tooltipData?.pinnedForTla === tla && tooltipData.type === 'driver') {
      setTooltipData(null);
    } else {
      createTooltip(event, `Race Number: ${racingNumber}`, tla, 'driver');
    }
  };
  
  const handleTiresClick = (event: React.MouseEvent, driver: LeaderboardDriver) => {
      event.stopPropagation();
      if (tooltipData?.pinnedForTla === driver.tla && tooltipData.type === 'tires') {
          setTooltipData(null);
      } else {
          createTooltip(event, <TireTooltipContent stints={driver.stints} />, driver.tla, 'tires');
      }
  };

  const infoIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  );

  const leaderboardHelpContent = (
    <>
        <p>
            The Leaderboard screen provides a real-time overview of the race standings, showing each driver's position and critical timing data.
        </p>
        <h3>Understanding the Data</h3>
        <ul>
            <li>
                <strong>Driver:</strong> Shows the driver's three-letter code. Click or hover over this code to see their full racing number in a tooltip.
            </li>
            <li>
                <strong>Last Lap:</strong> The time of the driver's most recently completed lap. A <strong><span style={{ color: 'var(--success-color)' }}>green</span></strong> pill indicates a personal best lap, while a <strong><span style={{ color: '#9c27b0' }}>purple</span></strong> pill indicates the fastest lap of the entire race so far.
            </li>
            <li>
                <strong>Best Lap:</strong> The driver's personal best lap time in the session. A <strong><span style={{ color: '#9c27b0' }}>purple</span></strong> pill here indicates this is also the fastest lap overall. The lap number on which this time was set is shown in parentheses.
            </li>
            <li>
                <strong>Interval:</strong> The time gap to the driver directly ahead. A <strong>green border</strong> around this value means the driver is currently catching the car in front.
            </li>
            <li>
                <strong>Gap:</strong> The time gap to the race leader. For the leader, this shows the current lap count.
            </li>
            <li>
                <strong>Gain (Race Only):</strong> The number of positions gained (<span style={{ color: 'var(--success-color)' }}>green</span>) or lost (<span style={{ color: 'var(--error-color)' }}>red</span>) compared to their starting grid position.
            </li>
            <li>
                <strong>Tires:</strong> A sequence of tire icons representing the compounds used during the session. Click on the icons to open a tooltip with a detailed history of each tire set, including stint length and whether it was new or used.
            </li>
            <li>
                <strong>Status:</strong> Shows if a driver is in the pits, has retired, or has finished the race.
            </li>
        </ul>
    </>
  );
  
  const renderContent = () => {
    const { data, error } = f1LiveTimingState;

    if (error) {
      return <p className="error">Error fetching leaderboard data: {error}</p>;
    }

    const timingData = data?.TimingData;
    const driverList = data?.DriverList;
    const lapSeries = data?.LapSeries;

    if (!timingData || !driverList || Object.keys(timingData.Lines).length === 0) {
      return <p className="status">Loading leaderboard data...</p>;
    }
    
    const isRaceSession = data?.SessionInfo?.Type?.toLowerCase() === 'race';
    
    // Calculate overall best lap time
    let overallBestLapSecs = Infinity;
    // FIX: Explicitly type 'line' to resolve property access error on 'unknown'.
    Object.values(timingData.Lines).forEach((line: TimingDataLine) => {
      if (line.BestLapTime?.Value) {
        const timeSecs = lapTimeToSeconds(line.BestLapTime.Value);
        if (timeSecs !== null && timeSecs < overallBestLapSecs) {
          overallBestLapSecs = timeSecs;
        }
      }
    });
    
    // FIX: Explicitly type 'line' to resolve multiple property access errors on 'unknown'.
    const leaderboardData: LeaderboardDriver[] = Object.values(timingData.Lines)
      .map((line: TimingDataLine) => {
        const driverInfo = driverList[line.RacingNumber];
        if (!driverInfo) return null;

        let status = '';
        if (line.MVStatus?.TakenChequered) {
          status = 'Chequered';
        } else if (line.Retired) {
          status = 'Retired';
        } else if (line.Stopped) {
          status = 'Stopped';
        } else if (line.InPit) {
          status = 'In Pit';
        } else if (line.PitOut) {
          status = 'Pit Out';
        }
        
        const isRetiredOrStopped = line.Retired || line.Stopped;
        const isLeader = parseInt(line.Position, 10) === 1;

        let lapHighlight: 'overall' | 'personal' | null = null;
        if (line.LastLapTime?.OverallFastest) {
          lapHighlight = 'overall';
        } else if (line.LastLapTime?.PersonalFastest) {
          lapHighlight = 'personal';
        }

        const bestLapTimeValue = line.BestLapTime?.Value || 'N/A';
        const bestLapTimeSecs = lapTimeToSeconds(bestLapTimeValue);
        const isOverallBestLap = bestLapTimeSecs !== null && overallBestLapSecs !== Infinity && Math.abs(bestLapTimeSecs - overallBestLapSecs) < 0.001;
        
        const timingAppData = data?.TimingAppData;
        const originalStints = timingAppData?.Lines[line.RacingNumber]?.Stints || [];
        const driverStints = originalStints.filter((currentStint, i, allStints) => {
            const nextStint = allStints[i + 1];
            if (!nextStint) return true;

            const isRedundant = (
                currentStint.Compound === nextStint.Compound &&
                currentStint.New === nextStint.New &&
                currentStint.TotalLaps === nextStint.TotalLaps &&
                currentStint.StartLaps === nextStint.StartLaps &&
                !currentStint.LapTime
            );

            return !isRedundant;
        });
        
        let netChange: number | null = null;
        if (isRaceSession && lapSeries) {
            const driverSeries = lapSeries[line.RacingNumber];
            const startPosStr = driverSeries?.LapPosition?.[0];
            if (startPosStr) {
                const startPos = parseInt(startPosStr, 10);
                const currentPos = parseInt(line.Position, 10);
                if (!isNaN(startPos) && !isNaN(currentPos)) {
                    netChange = startPos - currentPos;
                }
            }
        }

        return {
          position: parseInt(line.Position, 10),
          tla: driverInfo.Tla,
          racingNumber: line.RacingNumber,
          teamColour: driverInfo.TeamColour,
          lastLapTimeValue: line.LastLapTime?.Value || 'N/A',
          bestLapTimeValue,
          bestLapLap: line.BestLapTime?.Lap,
          lapHighlight,
          interval: isLeader ? '' : (line.IntervalToPositionAhead?.Value || ''),
          gap: isLeader 
            ? (lapCount ? `Lap ${lapCount.CurrentLap}` : '')
            : (line.GapToLeader || ''),
          status,
          isRetiredOrStopped,
          stints: driverStints,
          isOverallBestLap,
          isCatching: !!line.IntervalToPositionAhead?.Catching,
          netChange,
        };
      })
      .filter((driver): driver is LeaderboardDriver => driver !== null)
      .sort((a, b) => a.position - b.position);

    const getStatusBadge = (status: string) => {
      if (!status) return null;
      const lowerStatus = status.toLowerCase().replace(' ', '-');
      const className = `leaderboard-status-badge leaderboard-status-badge--${lowerStatus}`;
      return <span className={className}>{status}</span>;
    };
    
    const renderNetChange = (netChange: number | null) => {
        if (netChange === null) return null;
        
        let className = 'gain-indicator';
        if (netChange > 0) className += ' gain';
        if (netChange < 0) className += ' loss';

        return (
            <span className={className}>
                {netChange > 0 ? `+${netChange}` : netChange}
            </span>
        );
    };

    return (
      <div className="leaderboard-screen__table-container">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th className="pos-cell">Pos</th>
              <th>Driver</th>
              <th className="time-cell">Last Lap</th>
              <th className="time-cell">Best Lap</th>
              <th className="time-cell">Interval</th>
              <th className="time-cell">Gap</th>
              {isRaceSession && <th className="gain-cell">Gain</th>}
              <th className="tires-cell">Tires</th>
              <th className="status-cell">Status</th>
            </tr>
          </thead>
          <tbody>
            {leaderboardData.map(driver => (
              <tr key={driver.tla} style={{ opacity: driver.isRetiredOrStopped ? 0.6 : 1 }}>
                <td className="pos-cell">{driver.position}</td>
                <td className="tla-cell">
                  <span className="tla-indicator" style={{ backgroundColor: `#${driver.teamColour}` }}></span>
                  <span 
                    className="tla-name"
                    onMouseEnter={(e) => handleDriverMouseEnter(e, driver.racingNumber)}
                    onMouseLeave={handleDriverMouseLeave}
                    onClick={(e) => handleDriverClick(e, driver.tla, driver.racingNumber)}
                  >
                    {driver.tla}
                  </span>
                </td>
                <td className="time-cell">
                    <span className={`time-cell-value ${driver.lapHighlight ? `lap-time-pill lap-time-pill--${driver.lapHighlight}` : ''}`}>
                        {driver.lastLapTimeValue}
                    </span>
                </td>
                <td className="time-cell">
                  <div className="best-lap-wrapper">
                    <span className={`time-cell-value ${driver.isOverallBestLap ? 'lap-time-pill lap-time-pill--overall' : ''}`}>
                        {driver.bestLapTimeValue}
                    </span>
                    <span className="lap-time-lap-number">
                      {driver.bestLapLap !== undefined ? `(L${driver.bestLapLap})` : ''}
                    </span>
                  </div>
                </td>
                <td className="time-cell">
                    <span className={`time-cell-value ${driver.isCatching ? 'interval-catching' : ''}`}>
                        {driver.interval}
                    </span>
                </td>
                <td className="time-cell">
                    <span className="time-cell-value">{driver.gap}</span>
                </td>
                {isRaceSession && <td className="gain-cell">{renderNetChange(driver.netChange)}</td>}
                <td className="tires-cell">
                  <div
                    className="tires-cell__icons"
                    onClick={(e) => handleTiresClick(e, driver)}
                  >
                    {driver.stints.map((stint, index) => (
                        <TireIcon key={index} compound={stint.Compound} size={20} />
                    ))}
                  </div>
                </td>
                <td className="status-cell">{getStatusBadge(driver.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  
  return (
    <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <h1 style={{ margin: 0 }}>Leaderboard</h1>
            <span onClick={() => setIsInfoModalOpen(true)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Learn more about this screen">
                {infoIcon}
            </span>
        </div>
      <RaceStatusControl
        lapCount={lapCount}
        trackStatusInfo={trackStatusInfo}
        drsStatus={drsStatus}
        sessionType={f1LiveTimingState.data?.SessionInfo?.Type}
        sessionName={f1LiveTimingState.data?.SessionInfo?.Name}
        sessionStatus={f1LiveTimingState.data?.SessionStatus?.Status}
      />
      <div 
        className="card" 
        ref={cardRef} 
        onClick={() => setTooltipData(null)}
        style={{ position: 'relative' }}
      >
        <Tooltip data={tooltipData} />
        {renderContent()}
      </div>
      <Modal
          isOpen={isInfoModalOpen}
          onClose={() => setIsInfoModalOpen(false)}
          title="About the Leaderboard Screen"
      >
          {leaderboardHelpContent}
      </Modal>
    </div>
  );
};

export default LeaderboardScreen;