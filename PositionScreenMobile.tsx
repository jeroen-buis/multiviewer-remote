import React, { useState, useEffect } from 'react';
import { FetchedData, F1LiveTimingState, LapCount, F1Driver } from './types';
import SimpleHeader from './components/SimpleHeader';
import TireIcon from './components/TireIcon';
import Modal from './components/Modal';

type PositionScreenMobileProps = {
  f1LiveTimingState: FetchedData<F1LiveTimingState | null>;
  lapCount: LapCount | null;
  trackStatusInfo: { className: string; text: string; visible: boolean };
  drsStatus: 'ENABLED' | 'DISABLED' | string | null;
  viewName: string;
};

// Helper function to generate a smooth path from a series of points using Catmull-Rom splines
const generateSvgPath = (points: [number, number][]): string => {
  if (points.length < 2) {
    if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;
    return '';
  }

  let path = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    // Catmull-Rom to Cubic Bezier conversion
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
  }
  return path;
};


const PositionScreenMobile: React.FC<PositionScreenMobileProps> = ({ f1LiveTimingState, lapCount, trackStatusInfo, drsStatus, viewName }) => {
  const [selectedDriverTla, setSelectedDriverTla] = useState<string | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedDriverTla(null);
      }
    };

    if (selectedDriverTla) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedDriverTla]);

  const handleTlaClick = (tla: string) => {
    setSelectedDriverTla(current => (current === tla ? null : tla));
  };
  
  const positionHelpContent = (
    <>
        <p>
            This screen provides a visual representation of each driver's race progression, lap by lap. The chart is horizontally scrollable.
        </p>
        <h3>Understanding the Chart</h3>
        <ul>
            <li>The <strong>vertical axis</strong> shows the race positions (1st at the top, last at the bottom).</li>
            <li>The <strong>horizontal axis</strong> represents the race laps.</li>
            <li>Each colored line traces a driver's position throughout the race.</li>
        </ul>

        <h3>Interactive Features</h3>
        <ul>
            <li>
                <strong>Highlighting a Driver:</strong> To focus on a specific driver, tap on their three-letter abbreviation (TLA) on either side of the chart. This will highlight their line and dim all others.
            </li>
            <li>
                <strong>Positions Gained/Lost:</strong> At the end of each driver's line, a number (e.g., <code>(+1)</code>, <code>(-3)</code>) shows the net positions gained or lost compared to their starting grid position.
            </li>
            <li>
                <strong>Tire Changes:</strong> When a driver makes a pitstop, a tire icon will appear on their line. This icon represents the new tire compound they switched to and helps explain sudden drops in position.
            </li>
        </ul>
        <h3>Understanding Pitstop Data</h3>
        <p>
            You may notice that a driver's position sometimes drops a few places on the lap *before* the tire icon appears. This is a normal data artifact related to how pitstops are timed. The position drop is registered when the driver crosses the start/finish line in the pit lane, but the tire change data is associated with the lap number on which the stop occurred. This can create a slight visual offset.
        </p>
    </>
  );

  const renderContent = () => {
    const { data, error } = f1LiveTimingState;

    if (error) {
      return <p className="error">Error fetching position data: {error}</p>;
    }

    const sessionType = data?.SessionInfo?.Type;
    if (sessionType && (sessionType.toLowerCase().includes('practice') || sessionType.toLowerCase().includes('qualifying'))) {
        return <p className="status">The position chart is only available for race sessions. This feature is disabled for Practice and Qualifying.</p>;
    }

    const lapSeriesData = data?.LapSeries;
    const timingData = data?.TimingData;
    const timingAppData = data?.TimingAppData;
    const driverListData = data?.DriverList || {};
    const lapCountData = data?.LapCount || null;
    const sessionStatus = data?.SessionStatus?.Status;

    if (!lapSeriesData || !timingData || !lapCountData || Object.keys(driverListData).length === 0 || Object.keys(driverListData).length !== Object.keys(timingData.Lines).length) {
      return <p className="status">Loading position data...</p>;
    }
    
    // Constants for SVG dimensions & layout
    const numDrivers = Object.keys(driverListData).length;
    const totalLaps = lapCountData.TotalLaps;
    const currentLap = lapCountData.CurrentLap || 0;
    const displayLaps = Math.max(totalLaps, currentLap, 1);

    const Y_STEP = 25;
    const X_STEP = 25;
    const MARGIN = { top: 20, right: 140, bottom: 40, left: 80 };
    const LINE_EXTENSION = 60; // How far to extend grid lines
    const CHART_WIDTH = (displayLaps + 1) * X_STEP;
    const CHART_HEIGHT = numDrivers * Y_STEP;
    const SVG_WIDTH = CHART_WIDTH + MARGIN.left + MARGIN.right;
    const SVG_HEIGHT = CHART_HEIGHT + MARGIN.top + MARGIN.bottom;

    // Sort drivers by their starting grid position for labeling the Y-axis
    const sortedDriversByGrid = React.useMemo(() => {
        // FIX: Cast Object.values to F1Driver[] and type driver to avoid property access errors.
        return (Object.values(driverListData) as F1Driver[])
            .map(driver => {
                const lapData = lapSeriesData?.[driver.RacingNumber];
                const startPosStr = lapData?.LapPosition?.[0];
                const startingPosition = startPosStr ? parseInt(startPosStr, 10) : Infinity;
                return { ...driver, startingPosition };
            })
            .sort((a, b) => a.startingPosition - b.startingPosition);
    }, [driverListData, lapSeriesData]);
    
    const teammateDashStatus = new Map<string, boolean>();

    return (
      <>
        <div className="position-chart-container">
          <svg width={SVG_WIDTH} height={SVG_HEIGHT} className="position-chart">
            <defs>
                <pattern id="checkered-flag" patternUnits="userSpaceOnUse" width="8" height="8">
                    <rect width="4" height="4" fill="black" />
                    <rect x="4" y="4" width="4" height="4" fill="black" />
                    <rect x="4" width="4" height="4" fill="white" />
                    <rect y="4" width="4" height="4" fill="white" />
                </pattern>
            </defs>
            <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
              {/* Grid Lines */}
              {Array.from({ length: numDrivers }).map((_, i) => (
                <line key={`h-grid-${i}`} x1="0" y1={(i + 0.5) * Y_STEP} x2={CHART_WIDTH + LINE_EXTENSION} y2={(i + 0.5) * Y_STEP} className="grid-line" />
              ))}
              {Array.from({ length: displayLaps + 2 }).map((_, i) => (
                <line key={`v-grid-${i}`} x1={i * X_STEP} y1="0" x2={i * X_STEP} y2={CHART_HEIGHT} className="grid-line" />
              ))}

              {/* Y-Axis Labels (Left and Right) */}
              {sortedDriversByGrid.map((driver, index) => {
                const y = (index + 1 - 0.5) * Y_STEP;
                const isRetired = timingData?.Lines[driver.RacingNumber]?.Retired || timingData?.Lines[driver.RacingNumber]?.Stopped;
                const isSelected = selectedDriverTla === driver.Tla;
                const isDimmed = selectedDriverTla !== null && !isSelected;

                const classNames = [];
                if (isDimmed) {
                    classNames.push('driver-line-group--dimmed');
                } else if (isRetired && selectedDriverTla === null) {
                    classNames.push('driver-retired');
                }
                const groupClassName = classNames.join(' ');


                return (
                  <React.Fragment key={driver.RacingNumber}>
                    <g className={groupClassName}>
                      <text x="-55" y={y} dy="0.32em" className="y-axis-start-pos">{index + 1}.</text>
                      <text
                        x="-45"
                        y={y}
                        dy="0.32em"
                        fill={`#${driver.TeamColour}`}
                        className="y-axis-tla"
                        onClick={() => handleTlaClick(driver.Tla)}
                      >
                        {driver.Tla}
                      </text>
                       <text x={CHART_WIDTH + LINE_EXTENSION + 50} y={y} dy="0.32em" className="y-axis-end-pos">{index + 1}</text>
                    </g>
                  </React.Fragment>
                );
              })}
              
              {/* X-Axis Labels */}
              <text x={0} y={CHART_HEIGHT + 20} textAnchor="middle" className="axis-label">Grid</text>
              {Array.from({ length: displayLaps + 1 }).map((_, i) => (
                (i + 1) === 1 || (i + 1) % 5 === 0 || displayLaps <= 10 ?
                <text key={`lap-${i}`} x={(i + 1) * X_STEP} y={CHART_HEIGHT + 20} textAnchor="middle" className="axis-label">{i + 1}</text>
                : null
              ))}

              {/* Checkered Flag */}
              {totalLaps > 0 && (
                  <g transform={`translate(${(totalLaps + 1) * X_STEP - 10}, ${CHART_HEIGHT + 25})`}>
                      <title>Finish Line</title>
                      <rect width="20" height="12" fill="url(#checkered-flag)" stroke="black" strokeWidth="1"/>
                  </g>
              )}

              {/* Driver Position Lines */}
              {/* FIX: Cast Object.values to F1Driver[] to resolve property access errors on 'driver'. */}
              {(Object.values(driverListData) as F1Driver[]).map(driver => {
                const driverTimingData = timingData?.Lines[driver.RacingNumber];
                const isRetired = driverTimingData?.Retired || driverTimingData?.Stopped;
                const isSelected = selectedDriverTla === driver.Tla;
                const isDimmed = selectedDriverTla !== null && !isSelected;
                const showFinalDot = driverTimingData?.Retired || driverTimingData?.Stopped || driverTimingData?.MVStatus?.TakenChequered;

                const classNames = ['driver-line-group'];
                if (isDimmed) {
                    classNames.push('driver-line-group--dimmed');
                } else if (isRetired && selectedDriverTla === null) {
                    classNames.push('driver-retired');
                }
                const groupClassName = classNames.join(' ');

                const driverSeries = lapSeriesData?.[driver.RacingNumber];
                if (!driverSeries?.LapPosition) return null;

                const driverStints = timingAppData?.Lines?.[driver.RacingNumber]?.Stints;
                const pitstops: { lap: number, compound: string }[] = [];
                if (driverStints && driverStints.length > 1) {
                    let cumulativeLaps = 0;
                    for (let i = 0; i < driverStints.length - 1; i++) {
                        const stint = driverStints[i];
                        const stintLaps = stint.TotalLaps - (stint.StartLaps || 0);
                        cumulativeLaps += stintLaps;
                        pitstops.push({
                            lap: cumulativeLaps,
                            compound: driverStints[i + 1].Compound,
                        });
                    }
                }
                
                const points: { x: number; y: number }[] = [];
                
                // Add starting grid point explicitly at x=0.
                if (driverSeries.LapPosition.length > 0 && driverSeries.LapPosition[0] !== null) {
                    const gridPos = parseInt(driverSeries.LapPosition[0], 10);
                    points.push({ x: 0, y: (gridPos - 0.5) * Y_STEP });
                }

                driverSeries.LapPosition.forEach((posStr, lapNum) => {
                    if (posStr === null) return;
                    const pos = parseInt(posStr, 10);
                    // Plot historical data, shifted by 1 lap. LapPosition[0] is plotted at x=1.
                    points.push({ x: (lapNum + 1) * X_STEP, y: (pos - 0.5) * Y_STEP });
                });
                
                const lastRecordedLapInSeries = driverSeries.LapPosition.length - 1;
                const hasFinishedRace = lastRecordedLapInSeries >= totalLaps;

                // Project if the driver is not retired, hasn't finished the race yet,
                // and the session is either Started or Finished.
                const shouldProject = !isRetired && !hasFinishedRace && (sessionStatus === 'Started' || sessionStatus === 'Finished');

                if (shouldProject && driverTimingData?.Position) {
                    const livePos = parseInt(driverTimingData.Position, 10);
                    
                    // During the race, project to the next lap line.
                    // On the final lap or once the race is finished, project everyone still running to the finish line.
                    const targetLapForProjection = (sessionStatus === 'Started' && currentLap < totalLaps)
                        ? currentLap + 1
                        : totalLaps + 1;
                    
                    const targetX = targetLapForProjection * X_STEP;
                    
                    points.push({ x: targetX, y: (livePos - 0.5) * Y_STEP });
                }

                // If the driver is retired, add a point to drop the line to their final position.
                if (isRetired && driverTimingData?.Position && points.length > 0) {
                    const lastPoint = points[points.length - 1];
                    const finalPosition = parseInt(driverTimingData.Position, 10);
                    // Add a new point at the same lap (x) but at the final position (y).
                    // This creates the vertical drop.
                    points.push({ x: lastPoint.x, y: (finalPosition - 0.5) * Y_STEP });
                }

                if (points.length === 0) return null;
                
                const endOfLinePoint = points[points.length - 1];
                const finalPosition = driverTimingData?.Position;
                
                const pathD = generateSvgPath(points.map(p => [p.x, p.y]));
                
                const isDashed = teammateDashStatus.get(driver.TeamName) ?? false;
                if (!teammateDashStatus.has(driver.TeamName)) {
                  teammateDashStatus.set(driver.TeamName, true);
                }
                
                // FIX: Define startPositionStr within the map's scope.
                const startPositionStr = driverSeries?.LapPosition?.[0];
                const startPosition = startPositionStr ? parseInt(startPositionStr, 10) : 0;
                
                const currentPositionStr = finalPosition || driverSeries.LapPosition[driverSeries.LapPosition.length - 1];
                const currentPosition = currentPositionStr ? parseInt(currentPositionStr, 10) : startPosition;
                const netChange = startPosition - currentPosition;
                
                return (
                  <g key={`path-${driver.RacingNumber}`} className={groupClassName}>
                    <circle cx={points[0].x} cy={points[0].y} r="4" fill={`#${driver.TeamColour}`} />
                    {points.length > 1 &&
                      <path
                        d={pathD}
                        fill="none"
                        stroke={`#${driver.TeamColour}`}
                        strokeWidth={isSelected ? "4" : "2.5"}
                        strokeDasharray={isDashed ? '6, 4' : 'none'}
                        style={{ transition: 'stroke-width 0.3s ease' }}
                      />
                    }
                    {pitstops.map((pitstop, index) => {
                        const lapIndexForPos = pitstop.lap;
                        const posStr = driverSeries.LapPosition[lapIndexForPos];
                        if (!posStr) return null;

                        const x = (lapIndexForPos + 1) * X_STEP;
                        const y = (parseInt(posStr, 10) - 0.5) * Y_STEP;
                        
                        return (
                            <g key={`pitstop-${driver.RacingNumber}-${index}`}>
                                <circle cx={x} cy={y} r="9" fill="white" />
                                <TireIcon 
                                    compound={pitstop.compound} 
                                    size={16}
                                    x={x - 8}
                                    y={y - 8}
                                />
                            </g>
                        );
                    })}
                    {endOfLinePoint && showFinalDot && (
                        <circle 
                            cx={endOfLinePoint.x} 
                            cy={endOfLinePoint.y} 
                            r={isSelected ? 5 : 4} 
                            fill={`#${driver.TeamColour}`}
                            stroke="white"
                            strokeWidth="1"
                            style={{ transition: 'r 0.3s ease' }}
                        />
                    )}
                    <text
                      x={endOfLinePoint.x + 8}
                      y={endOfLinePoint.y}
                      dy="0.32em"
                      fill={`#${driver.TeamColour}`}
                      className="end-of-line-label"
                      onClick={() => handleTlaClick(driver.Tla)}
                      style={{ fontWeight: isSelected ? 900 : 'bold' }}
                    >
                      {isRetired ? `${driver.Tla} (P${finalPosition})` : `${driver.Tla} (${netChange > 0 ? `+${netChange}` : netChange === 0 ? '0' : netChange})`}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </>
    );
  };

  return (
    <div className="position-mobile-container">
        <SimpleHeader
            lapCount={lapCount}
            trackStatusInfo={trackStatusInfo}
            drsStatus={drsStatus}
            sessionType={f1LiveTimingState.data?.SessionInfo?.Type}
            sessionName={f1LiveTimingState.data?.SessionInfo?.Name}
            sessionStatus={f1LiveTimingState.data?.SessionStatus?.Status}
            viewName={viewName}
            onInfoClick={() => setIsInfoModalOpen(true)}
        />
        <div 
            className="card position-mobile-card"
            onClick={(e) => {
            // Deselect if clicking the card's background, not its children
            if (e.target === e.currentTarget) {
                setSelectedDriverTla(null);
            }
            }}
        >
            {renderContent()}
        </div>
        <Modal
            isOpen={isInfoModalOpen}
            onClose={() => setIsInfoModalOpen(false)}
            title="About the Position Screen"
        >
            {positionHelpContent}
        </Modal>
    </div>
  );
};

export default PositionScreenMobile;
