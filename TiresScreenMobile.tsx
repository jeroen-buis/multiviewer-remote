import React, { useState, useRef, useEffect } from 'react';
import { FetchedData, F1LiveTimingState, Stint, LapCount, F1Driver } from './types';
import TireIcon from './components/TireIcon';
import SimpleHeader from './components/SimpleHeader';
import Modal from './components/Modal';

type TiresScreenMobileProps = {
  f1LiveTimingState: FetchedData<F1LiveTimingState | null>;
  lapCount: LapCount | null;
  trackStatusInfo: { className: string; text: string; visible: boolean };
  drsStatus: 'ENABLED' | 'DISABLED' | string | null;
  viewName: string;
};

const TIRE_COMPOUND_CLASSES: Record<string, string> = {
    SOFT: 'stint--SOFT',
    MEDIUM: 'stint--MEDIUM',
    HARD: 'stint--HARD',
    INTERMEDIATE: 'stint--INTERMEDIATE',
    WET: 'stint--WET',
};

type TooltipData = {
  content: React.ReactNode;
  x: number;
  y: number;
  id: string;
  position: 'top' | 'bottom';
};

const Tooltip: React.FC<{ data: TooltipData | null }> = ({ data }) => {
  if (!data) return null;
  
  const style: React.CSSProperties = {
    left: data.x,
    top: data.y,
  };

  if (data.position === 'bottom') {
    // Override default transform to show below the element. 24px is row height.
    style.transform = `translate(-50%, 24px)`;
  }

  return (
    <div className="tires-screen__tooltip" style={style}>
      {data.content}
    </div>
  );
};

const getStintTooltipContent = (stint: Stint, tla: string): React.ReactNode => {
    const stintLaps = stint.TotalLaps - (stint.StartLaps || 0);
    const tireStatus = stint.New === 'true' ? 'New' : 'Used';
    const usedTireInfo = stint.New === 'false' && stint.StartLaps > 0 ? ` (${stint.StartLaps} Laps)` : '';

    return (
        <div className="tires-screen__tooltip-content">
            <div className="tooltip-header">{tla} - {stint.Compound}</div>
            <div className="tooltip-line">
                <strong>Status:</strong> {tireStatus}{usedTireInfo}
            </div>
            <div className="tooltip-line">
                <strong>Stint Laps:</strong> {stintLaps}
            </div>
            {stint.LapTime && stint.LapNumber && (
                <div className="tooltip-line">
                    <strong>Fastest:</strong> {stint.LapTime} (Lap {stint.LapNumber})
                </div>
            )}
        </div>
    );
};


const TiresScreenMobile: React.FC<TiresScreenMobileProps> = ({ f1LiveTimingState, lapCount, trackStatusInfo, drsStatus, viewName }) => {
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const chartBodyRef = useRef<HTMLDivElement>(null);
    
  const showTooltip = (event: React.MouseEvent<HTMLDivElement>, content: React.ReactNode, id: string) => {
    if (!chartBodyRef.current) return;
    
    if (tooltipData && event.type === 'mouseenter' && !tooltipData.id.startsWith('hover-')) {
      return;
    }

    const chartRect = chartBodyRef.current.getBoundingClientRect();
    const targetRect = event.currentTarget.getBoundingClientRect();
    const x = targetRect.left - chartRect.left + targetRect.width / 2;
    const y = targetRect.top - chartRect.top;
    
    // If the tooltip target is near the top of its container, show the tooltip below it
    // to prevent it from being clipped. This applies to both portrait and landscape.
    const tooltipThreshold = 80; // Estimated height of the tooltip.
    const position = (y < tooltipThreshold) ? 'bottom' : 'top';

    setTooltipData({ content, x, y, id, position });
  };
    
  const handleStintClick = (event: React.MouseEvent<HTMLDivElement>, stint: Stint, tla: string, id: string) => {
    event.stopPropagation();
    if (tooltipData?.id === id) {
      setTooltipData(null);
    } else {
      showTooltip(event, getStintTooltipContent(stint, tla), id);
    }
  };

  const handleCurrentTireClick = (event: React.MouseEvent<HTMLDivElement>, id: string) => {
    event.stopPropagation();
    if (tooltipData?.id === id) {
        setTooltipData(null);
    } else {
        showTooltip(event, <div style={{padding: '4px 8px'}}>Current</div>, id);
    }
  };

  const handleMouseLeave = () => {
    if (tooltipData && tooltipData.id.startsWith('hover-')) {
      setTooltipData(null);
    }
  };

  const tiresHelpContent = (
    <>
        <p>
            This screen provides a visual overview of each driver's tire strategy, showing which compounds they have used and for how many laps. The timeline is horizontally scrollable.
        </p>
        <h3>Understanding the Chart</h3>
        <ul>
            <li>The <strong>horizontal axis</strong> represents the race laps, with markers indicating lap numbers. The length of each colored bar corresponds to the number of laps a driver completed on that tire set.</li>
            <li>Each row represents a driver, sorted by their current position in the race.</li>
        </ul>
        <h3>Tire Compounds &amp; Colors</h3>
        <p>The color of each bar indicates the tire compound used.</p>
        <h3>Interactive Features</h3>
        <ul>
            <li>
                <strong>Current Tire:</strong> The tire icon on the far right of each row shows the compound the driver is currently using.
            </li>
            <li>
                <strong>Stint Details:</strong> Tap on any colored bar (a "stint") to see more details, including the exact number of laps completed and the fastest lap time set on that specific tire set.
            </li>
            <li>
                <strong>New vs. Used Tires:</strong> A solid colored bar indicates a <strong>new</strong> set of tires was used for that stint. A bar with a striped pattern indicates a <strong>used</strong> set.
            </li>
        </ul>
    </>
  );

  const renderContent = () => {
    const { data, error } = f1LiveTimingState;

    if (error) {
      return <p className="error">Error fetching tire data: {error}</p>;
    }
    
    const timingData = data?.TimingData;
    const driverListData = data?.DriverList || {};
    const linesData = data?.TimingAppData?.Lines;

    if (!linesData || !timingData || Object.keys(driverListData).length === 0) {
      return <p className="status">Loading tire strategy data...</p>;
    }
    
    const sessionType = data?.SessionInfo?.Type;
    const lapCountData = data?.LapCount || null;
    const isPracticeOrQualifying = sessionType && (sessionType.toLowerCase().includes('practice') || sessionType.toLowerCase().includes('qualifying'));

    let totalLaps: number;

    if (isPracticeOrQualifying) {
        totalLaps = 30;
    } else {
        if (!lapCountData || lapCountData.TotalLaps <= 0) {
             return <p className="status">Waiting for session to start to show tire strategy.</p>;
        }
        totalLaps = lapCountData.TotalLaps;
    }

    const sortedDrivers = (Object.values(driverListData) as F1Driver[])
        .sort((a, b) => a.Line - b.Line);
        
    const lapMarkers: number[] = [];
    const interval = totalLaps > 60 ? 10 : 5;
    for (let i = interval; i < totalLaps; i += interval) {
        lapMarkers.push(i);
    }

    const renderTimelineAxis = () => {
        return (
            <div className="tires-screen__timeline-axis">
                <div className="tires-screen__driver-info" />
                <div className="tires-screen__timeline-container">
                    {lapMarkers.map(lap => (
                        <div
                            key={`lap-marker-${lap}`}
                            className="tires-screen__lap-marker"
                            style={{ left: `${(lap / totalLaps) * 100}%` }}
                        >
                            <span className="tires-screen__lap-marker-label">{lap}</span>
                            <div className="tires-screen__lap-marker-tick" />
                        </div>
                    ))}
                </div>
                <div className="tires-screen__current-tire-spacer" />
            </div>
        );
    };

    return (
      <div className="tires-mobile-chart-wrapper" onClick={() => setTooltipData(null)}>
        <div className="tires-screen__chart-container">
            {renderTimelineAxis()}
            <div className="tires-screen__chart-body" ref={chartBodyRef}>
                <Tooltip data={tooltipData} />
                <div className="tires-screen__grid-lines-area">
                    <div className="tires-screen__driver-info-spacer" />
                    <div className="tires-screen__timeline-container-spacer">
                        {lapMarkers.map(lap => (
                            <div
                                key={`grid-line-${lap}`}
                                className="tires-screen__vertical-grid-line"
                                style={{ left: `${(lap / totalLaps) * 100}%` }}
                            />
                        ))}
                    </div>
                    <div className="tires-screen__current-tire-spacer" />
                </div>
                {sortedDrivers.map(driver => {
                    const originalStints = linesData[driver.RacingNumber]?.Stints || [];

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
                    
                    let cumulativeLaps = 0;
                    
                    const driverTimingData = timingData?.Lines?.[driver.RacingNumber];
                    const isRetired = driverTimingData?.Retired || driverTimingData?.Stopped;
                    const rowClassName = `tires-screen__driver-row ${isRetired ? 'tires-screen__driver-row--retired' : ''}`;

                    const currentStint = driverStints.length > 0 ? driverStints[driverStints.length - 1] : null;
                    const currentCompound = currentStint?.Compound;
                    const currentTireId = `current-tire-${driver.RacingNumber}`;

                    return (
                        <div key={driver.RacingNumber} className={rowClassName}>
                            <div className="tires-screen__driver-info">
                                <span className="tires-screen__driver-pos">{driver.Line}.</span>
                                <span className="tires-screen__driver-tla" style={{ color: `#${driver.TeamColour}` }}>
                                    {driver.Tla}
                                </span>
                            </div>
                            <div className="tires-screen__timeline-container">
                                <div className="tires-screen__timeline-track" />
                                {driverStints.map((stint, index) => {
                                    const stintLaps = stint.TotalLaps - (stint.StartLaps || 0);
                                    
                                    const width = (stintLaps / totalLaps) * 100;
                                    const left = (cumulativeLaps / totalLaps) * 100;

                                    cumulativeLaps += stintLaps;
                                    
                                    const compoundClass = TIRE_COMPOUND_CLASSES[stint.Compound] || 'stint--UNKNOWN';
                                    const usedClass = stint.New === 'false' ? 'tires-screen__stint--used' : '';
                                    const stintId = `${driver.RacingNumber}-${index}`;

                                    return (
                                        <div
                                            key={stintId}
                                            className={`tires-screen__stint ${compoundClass} ${usedClass}`}
                                            style={{
                                                left: `${left}%`,
                                                width: `${width}%`,
                                            }}
                                            onMouseEnter={(e) => showTooltip(e, getStintTooltipContent(stint, driver.Tla), `hover-${stintId}`)}
                                            onMouseLeave={handleMouseLeave}
                                            onClick={(e) => handleStintClick(e, stint, driver.Tla, stintId)}
                                        />
                                    );
                                })}
                            </div>
                            <div 
                                className="tires-screen__current-tire"
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={(e) => showTooltip(e, <div style={{padding: '4px 8px'}}>Current</div>, `hover-${currentTireId}`)}
                                onMouseLeave={handleMouseLeave}
                                onClick={(e) => handleCurrentTireClick(e, currentTireId)}
                            >
                                {currentCompound && <TireIcon compound={currentCompound} size={22} />}
                            </div>
                        </div>
                    );
                })}
            </div>
            {renderTimelineAxis()}
        </div>
      </div>
    );
  };

  return (
    <div className="tires-mobile-container">
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
        <div className="card tires-mobile-card">
            {renderContent()}
        </div>
        <Modal
            isOpen={isInfoModalOpen}
            onClose={() => setIsInfoModalOpen(false)}
            title="About the Tires Screen"
        >
            {tiresHelpContent}
        </Modal>
    </div>
  );
};

export default TiresScreenMobile;