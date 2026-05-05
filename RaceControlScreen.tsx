import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FetchedData, RaceControlMessage, F1LiveTimingState, LapCount, DriverList, F1Driver } from './types';
import RaceStatusControl from './components/RaceStatusControl';
import Modal from './components/Modal';

type TooltipData = {
  content: React.ReactNode;
  x: number;
  y: number;
  pinnedForTla: string | null;
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
  return <div style={style}>{data.content}</div>;
};


type RaceControlScreenProps = {
  f1LiveTimingState: FetchedData<F1LiveTimingState | null>;
  lapCount: LapCount | null;
  trackStatusInfo: { className: string; text: string; visible: boolean };
  drsStatus: 'ENABLED' | 'DISABLED' | string | null;
};

// Define Penalty type
type Penalty = {
  key: string;
  driverTla: string;
  driverNumber: string;
  description: string;
  reason: string;
  lap: number;
  served: boolean;
};

// FIX: Added a type for a driver object that includes a startingPosition property.
type DriverWithStartPos = F1Driver & { startingPosition: number };

const getLocalTimeFromUtc = (utcString: string, gmtOffset: string | undefined): string => {
    // Append 'Z' to ensure the string is parsed as UTC, not local time.
    const utcDate = new Date(utcString.endsWith('Z') ? utcString : utcString + 'Z');

    if (!gmtOffset) {
        return utcDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });
    }
    try {
        const sign = gmtOffset.startsWith('-') ? -1 : 1;
        const parts = gmtOffset.replace(/[-+]/, '').split(':').map(Number);
        const offsetMilliseconds = (parts[0] * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)) * 1000 * sign;
        const localDate = new Date(utcDate.getTime() + offsetMilliseconds);
        
        const hours = localDate.getUTCHours().toString().padStart(2, '0');
        const minutes = localDate.getUTCMinutes().toString().padStart(2, '0');
        const seconds = localDate.getUTCSeconds().toString().padStart(2, '0');
        
        return `${hours}:${minutes}:${seconds}`;
    } catch (e) {
        console.error("Error parsing date or offset", e);
        return utcDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });
    }
};

const MessagesView: React.FC<{ messages: RaceControlMessage[], gmtOffset: string | undefined }> = ({ messages, gmtOffset }) => {
    if (messages.length === 0) {
        return <p className="status">No messages match the current filter.</p>;
    }
    
    const reversedMessages = [...messages].reverse();

    return (
        <div className="race-control-screen__list">
            {reversedMessages.map((msg, index) => (
                <div key={index} className="race-control-screen__item">
                    <div className="race-control-screen__item-meta">
                        <span>Lap {msg.Lap}</span>
                        <span>{getLocalTimeFromUtc(msg.Utc, gmtOffset)}</span>
                    </div>
                    <p className="race-control-screen__item-message">{msg.Message}</p>
                </div>
            ))}
        </div>
    );
};

const TrackLimitsView: React.FC<{ 
    trackLimitDetails: Record<string, { count: number; laps: number[] }>;
    // FIX: Replaced `any[]` with a specific type for improved type safety.
    baseSortedDrivers: DriverWithStartPos[];
    onDriverMouseEnter: (event: React.MouseEvent, laps: number[]) => void;
    onDriverMouseLeave: () => void;
    onDriverClick: (event: React.MouseEvent, tla: string, laps: number[]) => void;
}> = ({ trackLimitDetails, baseSortedDrivers, onDriverMouseEnter, onDriverMouseLeave, onDriverClick }) => {
    
    const driversSortedByTrackLimits = useMemo(() => {
        return [...baseSortedDrivers].sort((a, b) => {
            const countA = trackLimitDetails[a.Tla]?.count || 0;
            const countB = trackLimitDetails[b.Tla]?.count || 0;

            if (countB !== countA) {
                return countB - countA;
            }

            return a.startingPosition - b.startingPosition;
        });
    }, [baseSortedDrivers, trackLimitDetails]);

    if (driversSortedByTrackLimits.length === 0) {
        return <p className="status">Loading driver data...</p>;
    }

    return (
        <div className="track-limits__list">
            {driversSortedByTrackLimits.map(driver => {
                const details = trackLimitDetails[driver.Tla];
                const count = details?.count || 0;
                const laps = details?.laps || [];
                const hasViolations = count > 0;

                let countClassName = 'track-limits__count';
                if (count === 3) countClassName += ' track-limits__count--warning';
                if (count >= 4) countClassName += ' track-limits__count--danger';

                return (
                    <div 
                        key={driver.Tla} 
                        className="track-limits__item"
                        style={hasViolations ? { cursor: 'pointer' } : {}}
                        onMouseEnter={hasViolations ? (e) => onDriverMouseEnter(e, laps) : undefined}
                        onMouseLeave={hasViolations ? onDriverMouseLeave : undefined}
                        onClick={hasViolations ? (e) => onDriverClick(e, driver.Tla, laps) : undefined}
                    >
                        <span className="track-limits__driver-info" style={{ color: `#${driver.TeamColour}` }}>
                            {driver.Tla}
                        </span>
                        <span className={countClassName}>{count}</span>
                    </div>
                );
            })}
        </div>
    );
};

const PenaltiesView: React.FC<{ penalties: Penalty[], driverListData: DriverList }> = ({ penalties, driverListData }) => {
    if (penalties.length === 0) {
        return <p className="status">No penalties have been issued in this session.</p>;
    }

    return (
        <div className="penalties__list">
            {penalties.map(penalty => {
                // FIX: Explicitly type 'd' to resolve property access error on 'unknown'.
                const driver = (Object.values(driverListData) as F1Driver[]).find(d => d.Tla === penalty.driverTla);
                const statusClass = penalty.served ? 'penalties__status--served' : 'penalties__status--outstanding';

                return (
                    <div key={penalty.key} className="penalties__item">
                        <div className="penalties__driver-info">
                            <span className="penalties__driver-tla" style={{ color: `#${driver?.TeamColour}` }}>
                                {penalty.driverTla}
                            </span>
                            <span className="penalties__lap">Lap {penalty.lap}</span>
                        </div>
                        <div className="penalties__details">
                            <p className="penalties__description">{penalty.description}</p>
                            <p className="penalties__reason">{penalty.reason}</p>
                        </div>
                        <div className={`penalties__status ${statusClass}`}>
                            {penalty.served ? 'Served' : 'Outstanding'}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const getTextColorForBackground = (hexColor: string): 'white' | 'black' => {
    if (!hexColor || hexColor.length !== 6) return 'white';
    try {
        const r = parseInt(hexColor.substring(0, 2), 16);
        const g = parseInt(hexColor.substring(2, 4), 16);
        const b = parseInt(hexColor.substring(4, 6), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? 'black' : 'white';
    } catch (e) {
        return 'white';
    }
};


const RaceControlScreen: React.FC<RaceControlScreenProps> = ({ f1LiveTimingState, lapCount, trackStatusInfo, drsStatus }) => {
    const [activeTab, setActiveTab] = useState('messages');
    const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
    const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    const { data: timingState, error } = f1LiveTimingState;
    const raceControlMessages = timingState?.RaceControlMessages;
    const driverListData = timingState?.DriverList || {};
    const lapSeriesData = timingState?.LapSeries;
    const sessionInfo = timingState?.SessionInfo;

    const sortedDriversByGrid: DriverWithStartPos[] = useMemo(() => {
        if (!lapSeriesData || Object.keys(driverListData).length === 0) return [];
        // FIX: Cast Object.values to F1Driver[] to resolve property access and spread errors.
        return (Object.values(driverListData) as F1Driver[])
            .map(driver => {
                const lapData = lapSeriesData[driver.RacingNumber];
                const startPosStr = lapData?.LapPosition?.[0];
                const startingPosition = startPosStr ? parseInt(startPosStr, 10) : Infinity;
                return { ...driver, startingPosition };
            })
            .sort((a, b) => a.startingPosition - b.startingPosition);
    }, [driverListData, lapSeriesData]);
    
    const handleDriverSelect = (tla: string) => {
        setSelectedDrivers(prev => 
            prev.includes(tla)
                ? prev.filter(d => d !== tla)
                : [...prev, tla]
        );
    };
    
    const trackLimitDetails = useMemo(() => {
        const details: Record<string, { count: number; laps: number[] }> = {};
        if (!raceControlMessages?.Messages) return details;

        const tlaAndCarRegex = /CAR\s+\d+\s+\((\w{3})\)/;
        const timeRegex = /TIME\s+([\d:.]+)/;

        // Step 1: Find all reinstatement keys. A reinstatement message links a driver (TLA) and a specific lap time.
        const reinstatedKeys = new Set<string>();
        raceControlMessages.Messages.forEach(msg => {
            if (msg.Message.includes("WILL BE REINSTATED")) {
                const tlaMatch = msg.Message.match(tlaAndCarRegex);
                const timeMatch = msg.Message.match(timeRegex);
                if (tlaMatch && timeMatch) {
                    const tla = tlaMatch[1];
                    const time = timeMatch[1];
                    reinstatedKeys.add(`${tla}-${time}`);
                }
            }
        });

        // Step 2: Find all track limit violations and filter out any that have been reinstated.
        raceControlMessages.Messages.forEach(msg => {
            // A typical violation message includes "TRACK LIMITS" and "DELETED".
            if (msg.Message.includes("TRACK LIMITS AT TURN") && msg.Message.includes("DELETED")) {
                const tlaMatch = msg.Message.match(tlaAndCarRegex);
                const timeMatch = msg.Message.match(timeRegex);
                
                if (tlaMatch && timeMatch) {
                    const tla = tlaMatch[1];
                    const time = timeMatch[1];
                    const key = `${tla}-${time}`;

                    // Only count the violation if its key is not in the reinstated set.
                    if (!reinstatedKeys.has(key)) {
                        if (!details[tla]) {
                            details[tla] = { count: 0, laps: [] };
                        }
                        details[tla].count++;
                        details[tla].laps.push(msg.Lap);
                    }
                }
            }
        });

        return details;
    }, [raceControlMessages]);
    
    const penaltyDetails = useMemo(() => {
        if (!raceControlMessages?.Messages) return [];

        const messages = raceControlMessages.Messages;
        const penaltyMessages = messages.filter(msg =>
            msg.Message.startsWith('FIA STEWARDS:') && msg.Message.includes('PENALTY')
        );

        const servedMessages = penaltyMessages.filter(msg => msg.Message.includes('PENALTY SERVED'));
        const assignedMessages = penaltyMessages.filter(msg => !msg.Message.includes('PENALTY SERVED'));

        const driverRegex = /CAR\s+(\d+)\s+\((\w{3})\)/;
        
        const parseMessage = (message: string) => {
            const driverMatch = message.match(driverRegex);
            if (!driverMatch) return null;

            const [, driverNumber, driverTla] = driverMatch;
            
            const coreMessage = message
                .replace('FIA STEWARDS: ', '')
                .replace('PENALTY SERVED - ', '');
            
            const parts = coreMessage.split(`FOR CAR ${driverNumber} (${driverTla})`);
            const description = parts[0]?.trim() || 'Unknown Penalty';
            const reason = (parts[1] || '').replace(/^[\s-]+/, '').trim();

            return { driverTla, driverNumber, description, reason };
        };

        const servedCounts = new Map<string, number>();
        servedMessages.forEach(msg => {
            const parsed = parseMessage(msg.Message);
            if (parsed) {
                const key = `${parsed.driverTla}-${parsed.description}`;
                servedCounts.set(key, (servedCounts.get(key) || 0) + 1);
            }
        });

        const penaltyInstances = new Map<string, number>();
        const allPenalties: Penalty[] = [];

        assignedMessages.forEach(msg => {
            const parsed = parseMessage(msg.Message);
            if (parsed) {
                const key = `${parsed.driverTla}-${parsed.description}`;
                
                const instanceCount = (penaltyInstances.get(key) || 0) + 1;
                penaltyInstances.set(key, instanceCount);
                
                const isServed = instanceCount <= (servedCounts.get(key) || 0);

                allPenalties.push({
                    key: `${key}-${instanceCount}`,
                    driverTla: parsed.driverTla,
                    driverNumber: parsed.driverNumber,
                    description: parsed.description,
                    reason: parsed.reason,
                    lap: msg.Lap,
                    served: isServed,
                });
            }
        });

        return allPenalties.sort((a, b) => b.lap - a.lap);

    }, [raceControlMessages]);

    // FIX: Cast object values to an array of objects with a 'count' property to fix reduce error.
    const trackLimitsCount = useMemo(() => (Object.values(trackLimitDetails) as { count: number }[]).reduce((sum, d) => sum + d.count, 0), [trackLimitDetails]);
    const penaltiesCount = useMemo(() => penaltyDetails.length, [penaltyDetails]);
    
    const createTooltip = (event: React.MouseEvent, content: React.ReactNode, pinnedForTla: string | null = null) => {
        if (!cardRef.current) return;
        const cardRect = cardRef.current.getBoundingClientRect();
        const targetRect = event.currentTarget.getBoundingClientRect();
        const x = targetRect.left - cardRect.left + targetRect.width / 2;
        const y = targetRect.top - cardRect.top;
        setTooltipData({ content, x, y, pinnedForTla });
    };

    const handleDriverMouseEnter = (event: React.MouseEvent, laps: number[]) => {
      if (tooltipData?.pinnedForTla) return;
      createTooltip(event, `Laps: ${laps.join(', ')}`);
    };

    const handleDriverMouseLeave = () => {
      if (tooltipData && !tooltipData.pinnedForTla) {
        setTooltipData(null);
      }
    };

    const handleDriverClick = (event: React.MouseEvent, tla: string, laps: number[]) => {
      event.stopPropagation();
      if (tooltipData?.pinnedForTla === tla) {
        setTooltipData(null);
      } else {
        createTooltip(event, `Laps: ${laps.join(', ')}`, tla);
      }
    };

    const infoIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
    );

    const raceControlHelpContent = (
        <>
            <p>
                This screen provides a direct feed of all official messages from Race Control, along with summarized views for track limits and penalties.
            </p>
            <h3>Messages Tab</h3>
            <p>
                This tab displays a chronological list of all messages issued during the session. You can use the filter bar at the top to focus on specific drivers. Click a driver's TLA to see only messages relevant to them, or select multiple drivers to see combined messages. Click "Reset" to clear the filter.
            </p>

            <h3>Track Limits Tab</h3>
            <p>
                This tab provides a live-updating summary of track limit violations for each driver.
            </p>
            <ul>
                <li><strong>How it works:</strong> The app automatically scans all race control messages. It counts every message where a driver's lap time was deleted for exceeding track limits. Crucially, it also detects messages where a lap time is later reinstated by the stewards and <strong>removes that violation</strong> from the driver's total, ensuring the count is always accurate.</li>
                <li>The list is sorted to show drivers with the most violations at the top. The count is color-coded to warn when a driver is approaching a penalty.</li>
                <li>Click on any driver with violations to see a tooltip showing the exact laps on which the infringements occurred.</li>
            </ul>

            <h3>Penalties Tab</h3>
            <p>
                This tab summarizes all official penalties issued by the FIA Stewards.
            </p>
            <ul>
                <li>Each entry shows the driver, the penalty description (e.g., "5 SECOND TIME PENALTY"), the reason for the penalty, and the lap on which it was issued.</li>
                <li><strong>Status:</strong> The app intelligently cross-references penalty assignment messages with "PENALTY SERVED" messages. This allows it to automatically update the status of each penalty, clearly showing which are still <strong>Outstanding</strong> and which have been <strong>Served</strong>.</li>
            </ul>
        </>
    );

    const renderContent = () => {
        if (error) {
            return <p className="error">Error fetching race control data: {error}</p>;
        }

        const messages = raceControlMessages?.Messages;
        if (!messages) {
            return <p className="status">Loading race control messages...</p>;
        }
        
        const filteredMessages = useMemo(() => {
            if (selectedDrivers.length === 0) {
                return messages;
            }
            return messages.filter(msg => 
                selectedDrivers.some(tla => msg.Message.includes(`(${tla})`))
            );
        }, [messages, selectedDrivers]);

        return (
            <>
                <div className="race-control-screen__tabs">
                    <button
                        className={`race-control-screen__tab-button ${activeTab === 'messages' ? 'active' : ''}`}
                        onClick={() => setActiveTab('messages')}
                    >
                        Messages
                    </button>
                    <button
                        className={`race-control-screen__tab-button ${activeTab === 'track-limits' ? 'active' : ''}`}
                        onClick={() => setActiveTab('track-limits')}
                    >
                        Track Limits
                        {trackLimitsCount > 0 && <span className="race-control-screen__tab-count">{trackLimitsCount}</span>}
                    </button>
                    <button
                        className={`race-control-screen__tab-button ${activeTab === 'penalties' ? 'active' : ''}`}
                        onClick={() => setActiveTab('penalties')}
                    >
                        Penalties
                        {penaltiesCount > 0 && <span className="race-control-screen__tab-count">{penaltiesCount}</span>}
                    </button>
                </div>
                {activeTab === 'messages' && (
                    <>
                        <div className="race-control__filter-bar">
                            {sortedDriversByGrid.map(driver => {
                                const isActive = selectedDrivers.includes(driver.Tla);
                                const textColor = getTextColorForBackground(driver.TeamColour);
                                
                                return (
                                    <button
                                        key={driver.Tla}
                                        className={`race-control__filter-button ${isActive ? 'active' : ''}`}
                                        style={{ 
                                            backgroundColor: `#${driver.TeamColour}`,
                                            color: textColor,
                                        }}
                                        onClick={() => handleDriverSelect(driver.Tla)}
                                    >
                                        {driver.Tla}
                                    </button>
                                );
                            })}
                            {selectedDrivers.length > 0 && (
                                <button
                                    className="race-control__filter-reset-button"
                                    onClick={() => setSelectedDrivers([])}
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                        <MessagesView messages={filteredMessages} gmtOffset={sessionInfo?.GmtOffset} />
                    </>
                )}
                {activeTab === 'track-limits' && 
                    <TrackLimitsView 
                        trackLimitDetails={trackLimitDetails} 
                        baseSortedDrivers={sortedDriversByGrid}
                        onDriverMouseEnter={handleDriverMouseEnter}
                        onDriverMouseLeave={handleDriverMouseLeave}
                        onDriverClick={handleDriverClick}
                    />
                }
                {activeTab === 'penalties' && 
                    <PenaltiesView 
                        penalties={penaltyDetails} 
                        driverListData={driverListData}
                    />
                }
            </>
        );
    };

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <h1 style={{ margin: 0 }}>Race Control</h1>
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
                title="About the Race Control Screen"
            >
                {raceControlHelpContent}
            </Modal>
        </div>
    );
};

export default RaceControlScreen;