import React, { useMemo, useState } from 'react';
import { FetchedData, F1LiveTimingState, LapCount, Stint, DriverList, F1Driver } from './types';
import RaceStatusControl from './components/RaceStatusControl';
import TireIcon from './components/TireIcon';
import Modal from './components/Modal';
import useWindowSize from './hooks/useWindowSize';
import { useStore } from './store';

type TireStatsScreenProps = {
  f1LiveTimingState: FetchedData<F1LiveTimingState | null>;
  lapCount: LapCount | null;
  trackStatusInfo: { className: string; text: string; visible: boolean };
  drsStatus: 'ENABLED' | 'DISABLED' | string | null;
};

interface TopTime {
  driverTla: string;
  lapTime: string;
  timeMs: number;
}

interface CompoundStat {
  compound: string;
  topTimes: TopTime[];
  totalLaps: number;
  setsUsed: number;
  fastestLapMs: number | null;
  startersCount: number;
}

const lapTimeToMilliseconds = (time: string): number => {
    try {
        const parts = time.split(':');
        const minutes = parseInt(parts[0], 10);
        const seconds = parseFloat(parts[1]);
        if (isNaN(minutes) || isNaN(seconds)) return Infinity;
        return (minutes * 60 + seconds) * 1000;
    } catch {
        return Infinity;
    }
};

const TireStatsScreen: React.FC<TireStatsScreenProps> = ({ f1LiveTimingState, lapCount, trackStatusInfo, drsStatus }) => {
  const settings = useStore((state) => state.settings);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const { width } = useWindowSize();
  const isTabletSize = width <= 1024;
  const applyTabletMode = settings.displayMode === 'tablet' || (settings.displayMode === 'auto' && isTabletSize);
  const tireIconSize = applyTabletMode ? 90 : 120;

  const processedStats = useMemo(() => {
    const timingAppData = f1LiveTimingState.data?.TimingAppData;
    const driverList = f1LiveTimingState.data?.DriverList;

    if (!timingAppData || !driverList) {
      return null;
    }

    const compoundStatsMap: Record<string, CompoundStat> = {};
    
    const ensureCompound = (compound: string) => {
        if (!compoundStatsMap[compound]) {
            compoundStatsMap[compound] = {
                compound,
                topTimes: [],
                totalLaps: 0,
                setsUsed: 0,
                fastestLapMs: null,
                startersCount: 0,
            };
        }
    };

    // FIX: Explicitly type 'lineData' to resolve property access error on 'Stints'.
    (Object.entries(timingAppData.Lines) as [string, { Stints: Stint[] }][]).forEach(([racingNumber, lineData]) => {
      // FIX: Explicitly type items from Object.values to avoid 'unknown' type errors.
      const driver = (Object.values(driverList) as F1Driver[]).find((d) => d.RacingNumber === racingNumber);
      if (!driver || !lineData.Stints || lineData.Stints.length === 0) return;

      // Identify and count starting compound
      const startingCompound = lineData.Stints[0].Compound;
      if (startingCompound) {
          ensureCompound(startingCompound);
          compoundStatsMap[startingCompound].startersCount++;
      }

      // Aggregate all stint data for this driver
      lineData.Stints.forEach(stint => {
        if (!stint.Compound) return;

        ensureCompound(stint.Compound);
        const stats = compoundStatsMap[stint.Compound];
        stats.totalLaps += stint.TotalLaps - (stint.StartLaps || 0);
        stats.setsUsed += 1;

        if (stint.LapTime) {
          stats.topTimes.push({
            driverTla: driver.Tla,
            lapTime: stint.LapTime,
            timeMs: lapTimeToMilliseconds(stint.LapTime),
          });
        }
      });
    });

    let overallFastestLapMs = Infinity;

    Object.values(compoundStatsMap).forEach(stats => {
      stats.topTimes.sort((a, b) => a.timeMs - b.timeMs);
      stats.topTimes = stats.topTimes.slice(0, 5);
      if (stats.topTimes.length > 0) {
        stats.fastestLapMs = stats.topTimes[0].timeMs;
        if (stats.fastestLapMs < overallFastestLapMs) {
          overallFastestLapMs = stats.fastestLapMs;
        }
      }
    });
    
    const sortedCompounds = Object.values(compoundStatsMap).sort((a, b) => {
        const timeA = a.fastestLapMs ?? Infinity;
        const timeB = b.fastestLapMs ?? Infinity;
        return timeA - timeB;
    });

    return { sortedCompounds, overallFastestLapMs };
  }, [f1LiveTimingState.data]);

  const renderDelta = (fastestLapMs: number | null, overallFastestLapMs: number) => {
    if (fastestLapMs === null || overallFastestLapMs === Infinity) {
      return <span className="tire-stats-screen__delta-badge" style={{ backgroundColor: '#555' }}>N/A</span>;
    }

    const delta = fastestLapMs - overallFastestLapMs;

    if (delta === 0) {
      return <span className="tire-stats-screen__delta-badge tire-stats-screen__delta-badge--fastest">FASTEST</span>;
    }
    
    const deltaSeconds = (delta / 1000).toFixed(3);
    let className = 'tire-stats-screen__delta-badge ';
    if (delta / 1000 < 1.1) className += 'tire-stats-screen__delta-badge--level-1';
    else if (delta / 1000 < 2.0) className += 'tire-stats-screen__delta-badge--level-2';
    else className += 'tire-stats-screen__delta-badge--level-3';

    return <span className={className}>+{deltaSeconds}</span>;
  };
  
  const infoIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  );

  const tireStatsHelpContent = (
    <>
        <p>
            This screen provides a detailed performance analysis for each tire compound used during the session. It helps in understanding which tires are faster and how they are being utilized.
        </p>
        <h3>Understanding the Columns</h3>
        <p>Each column is dedicated to a specific tire compound (e.g., SOFT, MEDIUM, HARD).</p>
        <ul>
            <li>
                <strong>Top Times:</strong> Displays the top 5 fastest lap times achieved on that compound, along with the driver who set the time.
            </li>
            <li>
                <strong>Stats:</strong>
                <ul>
                    <li><strong>Started with:</strong> The number of drivers who started the race on this tire.</li>
                    <li><strong>Laps Driven:</strong> The cumulative total number of laps driven on this compound across all drivers.</li>
                    <li><strong>Sets Used:</strong> The total number of times this compound has been fitted onto a car during the session.</li>
                </ul>
            </li>
            <li>
                <strong>Delta:</strong> This shows the time difference between the fastest lap on this compound and the overall fastest lap of the session.
                <ul>
                    <li>A <code>FASTEST</code> badge indicates this compound holds the current fastest lap.</li>
                    <li>A time value (e.g., <code>+1.234</code>) shows how much slower its best lap is compared to the overall fastest. The color of the badge indicates how close the time is.</li>
                </ul>
            </li>
        </ul>
    </>
  );

  const renderContent = () => {
    if (f1LiveTimingState.error) {
      return <p className="error">Error fetching tire data: {f1LiveTimingState.error}</p>;
    }

    if (!processedStats || processedStats.sortedCompounds.length === 0) {
      return <p className="status">Waiting for tire data...</p>;
    }
    
    const { sortedCompounds, overallFastestLapMs } = processedStats;

    return (
        <div className="tire-stats-screen__grid">
            {sortedCompounds.map(stats => {
                const compoundName = stats.compound === 'TEST' ? 'TEST' : stats.compound; // Handle TEST explicitly if needed
                const driverList = f1LiveTimingState.data?.DriverList || {};

                return (
                    <div key={stats.compound} className="tire-stats-screen__column">
                        <div className="tire-stats-screen__tire-image-container">
                            <TireIcon compound={stats.compound} size={tireIconSize} />
                        </div>
                        <h2 className={`tire-stats-screen__compound-name tire-stats-screen__compound-name--${compoundName}`}>
                            {stats.compound}
                        </h2>

                        <div className="tire-stats-screen__section">
                            <h3 className="tire-stats-screen__section-title">Top Times</h3>
                            <ul className="tire-stats-screen__list">
                                {stats.topTimes.map((time, index) => {
                                    // FIX: Explicitly type items from Object.values to avoid 'unknown' type errors.
                                    const driver = (Object.values(driverList) as F1Driver[]).find((d) => d.Tla === time.driverTla);
                                    return (
                                        <li key={index} className="tire-stats-screen__list-item tire-stats-screen__list-item--top-time">
                                            <span className="driver-tla" style={{ color: driver ? `#${driver.TeamColour}` : 'var(--text-primary)' }}>
                                                {time.driverTla}
                                            </span>
                                            <span>{time.lapTime}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>

                        <div className="tire-stats-screen__section">
                            <h3 className="tire-stats-screen__section-title">Stats</h3>
                            <ul className="tire-stats-screen__list">
                                <li className="tire-stats-screen__list-item">
                                    <span>Started with</span>
                                    <span>{stats.startersCount}</span>
                                </li>
                                <li className="tire-stats-screen__list-item">
                                    <span>Laps Driven</span>
                                    <span>{stats.totalLaps}</span>
                                </li>
                                <li className="tire-stats-screen__list-item">
                                    <span>Sets Used</span>
                                    <span>{stats.setsUsed}</span>
                                </li>
                            </ul>
                        </div>

                        <div className="tire-stats-screen__section">
                            <h3 className="tire-stats-screen__section-title">Delta</h3>
                            {renderDelta(stats.fastestLapMs, overallFastestLapMs)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0 }}>Tire Statistics</h1>
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
      <div className="card">
        {renderContent()}
      </div>
      <Modal
          isOpen={isInfoModalOpen}
          onClose={() => setIsInfoModalOpen(false)}
          title="About the Tire Stats Screen"
      >
          {tireStatsHelpContent}
      </Modal>
    </div>
  );
};

export default TireStatsScreen;