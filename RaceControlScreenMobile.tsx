import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FetchedData, RaceControlMessage, F1LiveTimingState, LapCount, DriverList, F1Driver } from './types';
import SimpleHeader from './components/SimpleHeader';
import Modal from './components/Modal';

type RaceControlScreenMobileProps = {
  f1LiveTimingState: FetchedData<F1LiveTimingState | null>;
  lapCount: LapCount | null;
  trackStatusInfo: { className: string; text: string; visible: boolean };
  drsStatus: 'ENABLED' | 'DISABLED' | string | null;
  viewName: string;
};

type Penalty = {
  key: string;
  driverTla: string;
  description: string;
  reason: string;
  lap: number;
  served: boolean;
};

type DriverWithStartPos = F1Driver & { startingPosition: number };

const getLocalTimeFromUtc = (utcString: string, gmtOffset: string | undefined): string => {
    const utcDate = new Date(utcString.endsWith('Z') ? utcString : utcString + 'Z');
    if (!gmtOffset) return utcDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });
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
        return utcDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });
    }
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


const DriverFilterModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    drivers: F1Driver[];
    selectedDrivers: string[];
    onDriverSelect: (tla: string) => void;
    onReset: () => void;
}> = ({ isOpen, onClose, drivers, selectedDrivers, onDriverSelect, onReset }) => {
    if (!isOpen) return null;

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="race-control-mobile-modal-overlay" onClick={onClose}>
            <div className="race-control-mobile-modal-content" onClick={e => e.stopPropagation()}>
                <div className="race-control-mobile-modal-header">
                    <h2>Filter by Driver</h2>
                    <button className="race-control-mobile-modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="race-control-mobile-modal-grid">
                    {drivers.map(driver => {
                        const isActive = selectedDrivers.includes(driver.Tla);
                        const textColor = getTextColorForBackground(driver.TeamColour);
                        return (
                            <button
                                key={driver.Tla}
                                className={`race-control-mobile-modal-driver ${isActive ? 'active' : ''}`}
                                style={{ backgroundColor: `#${driver.TeamColour}`, color: textColor }}
                                onClick={() => onDriverSelect(driver.Tla)}
                            >
                                {driver.Tla}
                            </button>
                        );
                    })}
                </div>
                <div className="race-control-mobile-modal-footer">
                    <button onClick={onReset} disabled={selectedDrivers.length === 0}>Reset Filters</button>
                </div>
            </div>
        </div>
    );
};

const MessagesView: React.FC<{ messages: RaceControlMessage[], gmtOffset: string | undefined }> = ({ messages, gmtOffset }) => {
    if (messages.length === 0) return <p className="status">No messages match the current filter.</p>;
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

const TrackLimitsView: React.FC<{ trackLimitDetails: Record<string, { count: number; laps: number[] }>, baseSortedDrivers: DriverWithStartPos[] }> = ({ trackLimitDetails, baseSortedDrivers }) => {
    const driversSortedByTrackLimits = useMemo(() => {
        return [...baseSortedDrivers].sort((a, b) => {
            const countA = trackLimitDetails[a.Tla]?.count || 0;
            const countB = trackLimitDetails[b.Tla]?.count || 0;
            return countB !== countA ? countB - countA : a.startingPosition - b.startingPosition;
        });
    }, [baseSortedDrivers, trackLimitDetails]);

    return (
        <div className="track-limits__list">
            {driversSortedByTrackLimits.map(driver => {
                const details = trackLimitDetails[driver.Tla];
                const count = details?.count || 0;
                let countClassName = 'track-limits__count';
                if (count === 3) countClassName += ' track-limits__count--warning';
                if (count >= 4) countClassName += ' track-limits__count--danger';

                return (
                    <div key={driver.Tla} className="track-limits__item">
                        <span className="track-limits__driver-info" style={{ color: `#${driver.TeamColour}` }}>{driver.Tla}</span>
                        <span className={countClassName}>{count}</span>
                    </div>
                );
            })}
        </div>
    );
};

const PenaltiesView: React.FC<{ penalties: Penalty[], driverListData: DriverList }> = ({ penalties, driverListData }) => {
    if (penalties.length === 0) return <p className="status">No penalties have been issued in this session.</p>;
    return (
        <div className="penalties__list">
            {penalties.map(penalty => {
                const driver = (Object.values(driverListData) as F1Driver[]).find(d => d.Tla === penalty.driverTla);
                const statusClass = penalty.served ? 'penalties__status--served' : 'penalties__status--outstanding';

                return (
                    <div key={penalty.key} className="race-control-mobile-penalty-item">
                        <div className="penalties__driver-info">
                            <span className="penalties__driver-tla" style={{ color: `#${driver?.TeamColour}` }}>{penalty.driverTla}</span>
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

const RaceControlScreenMobile: React.FC<RaceControlScreenMobileProps> = ({ f1LiveTimingState, lapCount, trackStatusInfo, drsStatus, viewName }) => {
    const [activeTab, setActiveTab] = useState('messages');
    const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

    const { data: timingState, error } = f1LiveTimingState;
    const { RaceControlMessages: raceControlMessages, DriverList: driverListData, LapSeries: lapSeriesData, SessionInfo: sessionInfo } = timingState || {};

    const sortedDriversByGrid: DriverWithStartPos[] = useMemo(() => {
        if (!lapSeriesData || !driverListData) return [];
        return (Object.values(driverListData) as F1Driver[])
            .map(driver => {
                const startPosStr = lapSeriesData[driver.RacingNumber]?.LapPosition?.[0];
                return { ...driver, startingPosition: startPosStr ? parseInt(startPosStr, 10) : Infinity };
            })
            .sort((a, b) => a.startingPosition - b.startingPosition);
    }, [driverListData, lapSeriesData]);
    
    const handleDriverSelect = (tla: string) => {
        setSelectedDrivers(prev => prev.includes(tla) ? prev.filter(d => d !== tla) : [...prev, tla]);
    };
    
    const trackLimitDetails = useMemo(() => {
        const details: Record<string, { count: number; laps: number[] }> = {};
        if (!raceControlMessages?.Messages) return details;

        const tlaAndCarRegex = /CAR\s+\d+\s+\((\w{3})\)/;
        const timeRegex = /TIME\s+([\d:.]+)/;
        const reinstatedKeys = new Set<string>();
        raceControlMessages.Messages.forEach(msg => {
            if (msg.Message.includes("WILL BE REINSTATED")) {
                const tlaMatch = msg.Message.match(tlaAndCarRegex);
                const timeMatch = msg.Message.match(timeRegex);
                if (tlaMatch && timeMatch) reinstatedKeys.add(`${tlaMatch[1]}-${timeMatch[1]}`);
            }
        });

        raceControlMessages.Messages.forEach(msg => {
            if (msg.Message.includes("TRACK LIMITS AT TURN") && msg.Message.includes("DELETED")) {
                const tlaMatch = msg.Message.match(tlaAndCarRegex);
                const timeMatch = msg.Message.match(timeRegex);
                if (tlaMatch && timeMatch) {
                    const tla = tlaMatch[1];
                    const key = `${tla}-${timeMatch[1]}`;
                    if (!reinstatedKeys.has(key)) {
                        if (!details[tla]) details[tla] = { count: 0, laps: [] };
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
        const penaltyMessages = raceControlMessages.Messages.filter(msg => msg.Message.startsWith('FIA STEWARDS:') && msg.Message.includes('PENALTY'));
        const servedMessages = penaltyMessages.filter(msg => msg.Message.includes('PENALTY SERVED'));
        const assignedMessages = penaltyMessages.filter(msg => !msg.Message.includes('PENALTY SERVED'));
        const driverRegex = /CAR\s+(\d+)\s+\((\w{3})\)/;
        
        const parseMessage = (message: string) => {
            const driverMatch = message.match(driverRegex);
            if (!driverMatch) return null;
            const [, , driverTla] = driverMatch;
            const coreMessage = message.replace('FIA STEWARDS: ', '').replace('PENALTY SERVED - ', '');
            const parts = coreMessage.split(`FOR CAR ${driverMatch[1]} (${driverTla})`);
            return { driverTla, description: parts[0]?.trim() || 'Unknown', reason: (parts[1] || '').replace(/^[\s-]+/, '').trim() };
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
        return assignedMessages.map((msg, index) => {
            const parsed = parseMessage(msg.Message);
            if (!parsed) return null;
            const key = `${parsed.driverTla}-${parsed.description}`;
            const instanceCount = (penaltyInstances.get(key) || 0) + 1;
            penaltyInstances.set(key, instanceCount);
            return { ...parsed, key: `${key}-${index}`, lap: msg.Lap, served: instanceCount <= (servedCounts.get(key) || 0) };
        }).filter((p): p is Penalty => p !== null).sort((a, b) => b.lap - a.lap);
    }, [raceControlMessages]);

    const trackLimitsCount = useMemo(() => (Object.values(trackLimitDetails) as { count: number }[]).reduce((sum, d) => sum + d.count, 0), [trackLimitDetails]);
    const penaltiesCount = useMemo(() => penaltyDetails.length, [penaltyDetails]);
    
    const raceControlHelpContent = (
        <>
            <p>
                This screen provides a direct feed of all official messages from Race Control, along with summarized views for track limits and penalties.
            </p>
            <h3>Messages Tab</h3>
            <p>
                This tab displays a chronological list of all messages. To focus on specific drivers, tap the <strong>Filter</strong> button to open a selection modal.
            </p>

            <h3>Track Limits Tab</h3>
            <p>
                This tab provides a live-updating summary of track limit violations for each driver. The app intelligently counts violations and removes any that are later reinstated by the stewards, ensuring the count is always accurate.
            </p>

            <h3>Penalties Tab</h3>
            <p>
                This tab summarizes all official penalties. The app automatically cross-references penalty messages with "PENALTY SERVED" messages to show which are still <strong>Outstanding</strong> and which have been <strong>Served</strong>.
            </p>
        </>
    );

    const renderContent = () => {
        if (error) return <p className="error">Error fetching race control data: {error}</p>;
        if (!raceControlMessages?.Messages || !driverListData) return <p className="status">Loading race control messages...</p>;
        
        const filteredMessages = useMemo(() => {
            if (selectedDrivers.length === 0) return raceControlMessages.Messages;
            return raceControlMessages.Messages.filter(msg => selectedDrivers.some(tla => msg.Message.includes(`(${tla})`)));
        }, [raceControlMessages.Messages, selectedDrivers]);

        return (
            <>
                <div className="race-control-screen__tabs">
                    <button className={`race-control-screen__tab-button ${activeTab === 'messages' ? 'active' : ''}`} onClick={() => setActiveTab('messages')}>Messages</button>
                    <button className={`race-control-screen__tab-button ${activeTab === 'track-limits' ? 'active' : ''}`} onClick={() => setActiveTab('track-limits')}>
                        Track Limits {trackLimitsCount > 0 && <span className="race-control-screen__tab-count">{trackLimitsCount}</span>}
                    </button>
                    <button className={`race-control-screen__tab-button ${activeTab === 'penalties' ? 'active' : ''}`} onClick={() => setActiveTab('penalties')}>
                        Penalties {penaltiesCount > 0 && <span className="race-control-screen__tab-count">{penaltiesCount}</span>}
                    </button>
                </div>
                {activeTab === 'messages' && (
                    <>
                        <div className="race-control-mobile-filter-bar">
                            <button className="race-control-mobile-filter-button" onClick={() => setIsFilterModalOpen(true)}>
                                Filter {selectedDrivers.length > 0 && `(${selectedDrivers.length})`}
                            </button>
                        </div>
                        <MessagesView messages={filteredMessages} gmtOffset={sessionInfo?.GmtOffset} />
                    </>
                )}
                {activeTab === 'track-limits' && <TrackLimitsView trackLimitDetails={trackLimitDetails} baseSortedDrivers={sortedDriversByGrid} />}
                {activeTab === 'penalties' && <PenaltiesView penalties={penaltyDetails} driverListData={driverListData as DriverList} />}
            </>
        );
    };

    return (
        <div className="race-control-mobile-container">
            <SimpleHeader
                lapCount={lapCount}
                sessionType={sessionInfo?.Type}
                sessionName={sessionInfo?.Name}
                sessionStatus={timingState?.SessionStatus?.Status}
                trackStatusInfo={trackStatusInfo}
                drsStatus={drsStatus}
                viewName={viewName}
                onInfoClick={() => setIsInfoModalOpen(true)}
            />
            <div className="card race-control-mobile-card">
                {renderContent()}
            </div>
            <DriverFilterModal
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                drivers={sortedDriversByGrid}
                selectedDrivers={selectedDrivers}
                onDriverSelect={handleDriverSelect}
                onReset={() => {
                    setSelectedDrivers([]);
                    setIsFilterModalOpen(false);
                }}
            />
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

export default RaceControlScreenMobile;