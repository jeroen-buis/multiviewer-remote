import React, { useMemo, useState, useEffect, useRef } from 'react';
import { FetchedData, F1LiveTimingState, LapCount, PitstopData, DriverList, TimingData, F1Driver, TimingDataLine } from './types';
import SimpleHeader from './components/SimpleHeader';
import Modal from './components/Modal';
import { useStore } from './store';

// --- Data Types ---

interface EnrichedDriver {
    tla: string;
    teamColour: string;
    position: number;
    gapSeconds: number;
    interval: string | null;
    isRetired: boolean;
    isStopped: boolean;
    inPit: boolean;
    pitOut: boolean;
    numberOfPitStops: number;
    simulatedPosition?: number;
    simulatedGapSeconds?: number;
    // Data from snapshot
    snapshotPosition?: number;
    snapshotGapSeconds?: number;
    snapshotInterval?: string | null;
}

type PitEntrySnapshotData = {
    position: number;
    gapSeconds: number;
    interval: string | null;
};

// --- Simulation Modal Component ---

interface SimulationModalProps {
    isOpen: boolean;
    onClose: () => void;
    pittingDriver?: EnrichedDriver | null;
    battleground: { ahead: { tla: string; teamColour: string; delta: number }[], behind: { tla: string; teamColour: string; delta: number }[] };
    allDrivers: EnrichedDriver[];
    simulationMap: Map<string, { simPosition: number; simGap: number; }> | null;
}

const SimulationModal: React.FC<SimulationModalProps> = ({ isOpen, onClose, pittingDriver, battleground, allDrivers, simulationMap }) => {
    if (!isOpen || !pittingDriver || !simulationMap) return null;

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);
    
    const battlegroundDrivers = [...battleground.ahead, ...battleground.behind];
    const allBattleDrivers = allDrivers.filter(d => battlegroundDrivers.some(b => b.tla === d.tla) && !d.isRetired);

    const fullContextList = [
        ...allBattleDrivers,
        pittingDriver
    ].map(d => {
        const simData = simulationMap.get(d.tla);
        return {
            tla: d.tla,
            teamColour: d.teamColour,
            simPosition: simData?.simPosition || 99,
            isPittingDriver: d.tla === pittingDriver.tla
        }
    }).sort((a, b) => a.simPosition - b.simPosition);
    
    const isSnapshotActive = pittingDriver.snapshotPosition !== undefined;
    const currentInfo = {
        position: isSnapshotActive ? pittingDriver.snapshotPosition : pittingDriver.position,
        gap: isSnapshotActive ? pittingDriver.snapshotGapSeconds : pittingDriver.gapSeconds,
        interval: isSnapshotActive ? pittingDriver.snapshotInterval : pittingDriver.interval,
    };

    const predictedInfo = {
        position: pittingDriver.simulatedPosition,
        gap: pittingDriver.simulatedGapSeconds,
    };

    return (
        <div className="pitstops-mobile-sim-modal-overlay" onClick={onClose}>
            <div className="pitstops-mobile-sim-modal-content" onClick={e => e.stopPropagation()}>
                <div className="pitstops-mobile-sim-modal-header">
                    <h2>Pitstop Simulation: {pittingDriver.tla}</h2>
                    <button className="pitstops-mobile-sim-modal-close" onClick={onClose}>&times;</button>
                </div>

                <div className="pitstops-mobile-sim-modal-section">
                    <h3 className="pitstops-mobile-sim-modal-subheader">Current Status</h3>
                    <div className="pitstops-mobile-sim-modal-stats">
                        <div><span>Position</span> <span>P{currentInfo.position}</span></div>
                        <div><span>Gap to Leader</span> <span>{currentInfo.gap?.toFixed(3)}s</span></div>
                        <div><span>Interval</span> <span>{currentInfo.interval || 'N/A'}</span></div>
                    </div>
                </div>

                <div className="pitstops-mobile-sim-modal-section">
                    <h3 className="pitstops-mobile-sim-modal-subheader">Prediction</h3>
                    <div className="pitstops-mobile-sim-modal-stats pitstops-mobile-sim-modal-stats--prediction">
                        <div><span>Rejoin Position</span> <span>P{predictedInfo.position}</span></div>
                        <div><span>Gap to Leader</span> <span>{predictedInfo.gap?.toFixed(3)}s</span></div>
                    </div>
                </div>

                <div className="pitstops-mobile-sim-modal-section">
                    <h3 className="pitstops-mobile-sim-modal-subheader">Battleground</h3>
                    <ul className="pitstops-mobile-sim-modal-battle-list">
                        {fullContextList.map(d => {
                            if (d.isPittingDriver) {
                                return (
                                    <li key={d.tla} className="pitstops-mobile-sim-modal-battle-item pitstops-mobile-sim-modal-battle-item--pitting">
                                        <span className="tla">(P{d.simPosition}) <span style={{ color: `#${d.teamColour}` }}>{d.tla}</span></span>
                                        <span className="delta">PIT</span>
                                    </li>
                                );
                            }
                            const battleData = battlegroundDrivers.find(b => b.tla === d.tla)!;
                            const deltaSign = battleData.delta < 0 ? '' : '+';
                            return (
                                <li key={d.tla} className="pitstops-mobile-sim-modal-battle-item">
                                    <span className="tla">(P{d.simPosition}) <span style={{ color: `#${d.teamColour}` }}>{d.tla}</span></span>
                                    <span className="delta">{deltaSign}{battleData.delta.toFixed(3)}s</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>

            </div>
        </div>
    );
};


// --- Data Processing Hook ---

const usePitstopSimulation = (
    timingData: TimingData | undefined,
    driverList: DriverList | undefined,
    pitstopDelta: number | null,
    selectedDriverTla: string | null,
    pitEntrySnapshot: Map<string, PitEntrySnapshotData> | null
): { enrichedDrivers: EnrichedDriver[], simulationMap: Map<string, { simPosition: number; simGap: number; }> | null } => {
    return useMemo(() => {
        if (!timingData?.Lines || !driverList) {
            return { enrichedDrivers: [], simulationMap: null };
        }
        
        const liveDrivers = Object.values(timingData.Lines)
            .map((line: TimingDataLine) => {
                const driverInfo = driverList[line.RacingNumber];
                if (!driverInfo || !line.Position) return null;
                const position = parseInt(line.Position, 10);
                const isLeader = position === 1;
                const isRetired = !!line.Retired;
                const isStopped = !!line.Stopped;
                const gapToLeaderStr = line.GapToLeader;
                const interval = line.IntervalToPositionAhead?.Value;
                const gapSeconds: number | null = isLeader || isRetired || isStopped ? 0 : (gapToLeaderStr && !/[a-zA-Z]/.test(gapToLeaderStr) ? parseFloat(gapToLeaderStr) : null);
                return {
                    tla: driverInfo.Tla,
                    teamColour: driverInfo.TeamColour,
                    position,
                    gapSeconds,
                    interval: interval || null,
                    isRetired,
                    isStopped,
                    inPit: !!line.InPit,
                    pitOut: !!line.PitOut,
                    numberOfPitStops: line.NumberOfPitStops ? parseInt(String(line.NumberOfPitStops), 10) : 0,
                    racingNumber: line.RacingNumber,
                };
            })
            .filter((d): d is NonNullable<typeof d> => d !== null)
            .sort((a, b) => a.position - b.position);

        for (let i = 0; i < liveDrivers.length; i++) {
            const driver = liveDrivers[i];
            if (driver.gapSeconds === null && !driver.isRetired && !driver.isStopped) {
                let anchorDriver = null;
                let anchorIndex = -1;
                for (let j = i - 1; j >= 0; j--) {
                    if (liveDrivers[j].gapSeconds !== null && !liveDrivers[j].isRetired && !liveDrivers[j].isStopped) {
                        anchorDriver = liveDrivers[j];
                        anchorIndex = j;
                        break;
                    }
                }
                if (anchorDriver) {
                    let calculatedGap = anchorDriver.gapSeconds;
                    for (let k = anchorIndex + 1; k <= i; k++) {
                        const driverInChain = liveDrivers[k];
                        const lineData = timingData.Lines[driverInChain.racingNumber];
                        const intervalStr = lineData?.IntervalToPositionAhead?.Value;
                        if (intervalStr && !/[a-zA-Z]/.test(intervalStr)) {
                            calculatedGap += parseFloat(intervalStr);
                        }
                    }
                    driver.gapSeconds = calculatedGap;
                } else {
                    const lineData = timingData.Lines[driver.racingNumber];
                    const intervalStr = lineData?.IntervalToPositionAhead?.Value;
                    if (intervalStr && !/[a-zA-Z]/.test(intervalStr)) {
                        driver.gapSeconds = parseFloat(intervalStr);
                    }
                }
            }
        }
        liveDrivers.forEach(d => {
            if (d.gapSeconds === null) {
                d.gapSeconds = (d.isRetired || d.isStopped) ? 0 : 999;
            }
        });
        
        let simulationMap: Map<string, { simPosition: number; simGap: number; }> | null = null;
        if (selectedDriverTla && pitstopDelta !== null) {
            const currentlyRacingTlas = new Set(liveDrivers.filter(d => !d.isRetired && !d.isStopped).map(d => d.tla));
            const baseData = pitEntrySnapshot ? Array.from(pitEntrySnapshot.entries()).filter(([tla]) => currentlyRacingTlas.has(tla)).map(([tla, data]) => ({ tla, gapSeconds: data.gapSeconds })) : liveDrivers.filter(d => !d.isRetired && !d.isStopped).map(d => ({ tla: d.tla, gapSeconds: d.gapSeconds! }));
            
            if (baseData.length > 0) {
                const simData = baseData.map(d => ({ tla: d.tla, simGap: d.gapSeconds + (d.tla === selectedDriverTla ? pitstopDelta : 0) }));
                const sortedSim = [...simData].sort((a, b) => a.simGap - b.simGap);
                const leaderGap = sortedSim[0]?.simGap || 0;
                simulationMap = new Map();
                simData.forEach(d => simulationMap!.set(d.tla, { simPosition: sortedSim.findIndex(s => s.tla === d.tla) + 1, simGap: d.simGap - leaderGap }));
            }
        }
        
        const enrichedDrivers: EnrichedDriver[] = liveDrivers.map(driver => {
            const simData = simulationMap?.get(driver.tla);
            const snapshotData = pitEntrySnapshot?.get(driver.tla);
            return {
                ...driver,
                gapSeconds: driver.gapSeconds!,
                simulatedPosition: simData?.simPosition,
                simulatedGapSeconds: simData?.simGap,
                snapshotPosition: snapshotData?.position,
                snapshotGapSeconds: snapshotData?.gapSeconds,
                snapshotInterval: snapshotData?.interval,
            };
        });
        return { enrichedDrivers, simulationMap };
    }, [timingData, driverList, pitstopDelta, selectedDriverTla, pitEntrySnapshot]);
};


// --- Main Screen Component ---

type PitstopsScreenProps = {
  f1LiveTimingState: FetchedData<F1LiveTimingState | null>;
  lapCount: LapCount | null;
  trackStatusInfo: { className: string; text: string; visible: boolean };
  drsStatus: 'ENABLED' | 'DISABLED' | string | null;
  viewName: string;
};

type PrevDriverState = { inPit: boolean; pitOut: boolean; gapSeconds: number };

const PitstopsScreenMobile: React.FC<PitstopsScreenProps> = ({ f1LiveTimingState, lapCount, trackStatusInfo, drsStatus, viewName }) => {
    const settings = useStore((state) => state.settings);
    const [selectedDriverTla, setSelectedDriverTla] = useState<string | null>(null);
    const [isSimModalOpen, setIsSimModalOpen] = useState(false);
    const [pitstopData, setPitstopData] = useState<PitstopData[] | null>(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const prevDriverStatusRef = useRef<Map<string, PrevDriverState>>(new Map());
    const pitEntrySnapshotsRef = useRef<Map<string, Map<string, PitEntrySnapshotData>>>(new Map());

    useEffect(() => {
        fetch('/pitstopdata.json')
            .then(res => res.ok ? res.json() : Promise.reject(`HTTP error! status: ${res.status}`))
            .then(setPitstopData)
            .catch(error => console.error("Error loading pitstop data:", error));
    }, []);
    
    const pitstopDurations = useMemo(() => {
        if (!pitstopData || !f1LiveTimingState.data?.SessionInfo?.Meeting?.Circuit?.Key) {
            return { pitstop: null, effective: null };
        }
        const circuitKey = String(f1LiveTimingState.data.SessionInfo.Meeting.Circuit.Key);
        const trackData = pitstopData.find(track => track.Key === circuitKey);
        
        if (!trackData) {
            return { pitstop: null, effective: null };
        }
        
        return {
            pitstop: trackData.PitstopDuration,
            effective: trackData.EffectivePitDuration
        };
    }, [pitstopData, f1LiveTimingState.data]);

    const { data: timingState } = f1LiveTimingState;
    const { TimingData: timingData, DriverList: driverList } = timingState || {};

    const activeSnapshot = useMemo(() => {
        if (!selectedDriverTla || !timingData || !driverList) return null;

        const driverInfo = (Object.values(driverList) as F1Driver[]).find(d => d.Tla === selectedDriverTla);
        if (!driverInfo) return null;

        const driverLine = timingData.Lines[driverInfo.RacingNumber];
        if (!driverLine) return null;

        if (driverLine.InPit || driverLine.PitOut) {
            return pitEntrySnapshotsRef.current.get(selectedDriverTla) || null;
        }
        
        return null;
    }, [selectedDriverTla, timingData, driverList]);

    const { enrichedDrivers, simulationMap } = usePitstopSimulation(
        f1LiveTimingState.data?.TimingData,
        f1LiveTimingState.data?.DriverList,
        pitstopDurations.effective,
        selectedDriverTla,
        activeSnapshot
    );

    const handleCloseModal = () => {
        setIsSimModalOpen(false);
        setSelectedDriverTla(null);
    };

    useEffect(() => {
        const prevStatuses = prevDriverStatusRef.current;
        const currentSnapshots = pitEntrySnapshotsRef.current;
    
        enrichedDrivers.forEach(driver => {
            const prevStatus = prevStatuses.get(driver.tla);
            
            if (driver.inPit && !prevStatus?.inPit) {
                const snapshot = new Map<string, PitEntrySnapshotData>();
                enrichedDrivers.forEach(d => {
                    if (!d.isRetired && !d.isStopped) {
                        snapshot.set(d.tla, { 
                            gapSeconds: d.gapSeconds, 
                            position: d.position, 
                            interval: d.interval 
                        });
                    }
                });
                currentSnapshots.set(driver.tla, snapshot);
            }
    
            const wasPitting = prevStatus?.inPit || prevStatus?.pitOut || false;
            const isNowPitting = driver.inPit || driver.pitOut;
            const pitstopCompleted = (wasPitting && !isNowPitting) || 
                                     (prevStatus?.pitOut && driver.pitOut && prevStatus.gapSeconds !== driver.gapSeconds);
    
            if (pitstopCompleted) {
                currentSnapshots.delete(driver.tla);
                if (driver.tla === selectedDriverTla) {
                    handleCloseModal();
                }
            }
        });
    
        const newPrevStatus = new Map<string, PrevDriverState>();
        enrichedDrivers.forEach(d => newPrevStatus.set(d.tla, { 
            inPit: d.inPit, 
            pitOut: d.pitOut,
            gapSeconds: d.gapSeconds
        }));
        prevDriverStatusRef.current = newPrevStatus;
        
    }, [enrichedDrivers, selectedDriverTla]);

    const battlegroundData = useMemo(() => {
        const battleground = { ahead: [], behind: [] };
        if (!selectedDriverTla || !settings.pitstopBattlegroundDuration || !simulationMap) return battleground;
        const pittingDriverSim = simulationMap.get(selectedDriverTla);
        if (!pittingDriverSim) return battleground;

        const duration = settings.pitstopBattlegroundDuration;
        const pittingGap = pittingDriverSim.simGap;
        const [lowerBound, upperBound] = [pittingGap - duration, pittingGap + duration];

        enrichedDrivers.forEach(other => {
            if (other.isRetired || other.isStopped || other.tla === selectedDriverTla) return;
            const otherSim = simulationMap.get(other.tla);
            if (otherSim && otherSim.simGap >= lowerBound && otherSim.simGap <= upperBound) {
                const delta = otherSim.simGap - pittingGap;
                const info = { tla: other.tla, teamColour: other.teamColour, delta };
                if (delta < 0) battleground.ahead.push(info);
                else battleground.behind.push(info);
            }
        });
        battleground.ahead.sort((a, b) => b.delta - a.delta); 
        battleground.behind.sort((a, b) => a.delta - b.delta);
        return battleground;
    }, [enrichedDrivers, selectedDriverTla, settings.pitstopBattlegroundDuration, simulationMap]);

    const handleDriverRowClick = (tla: string) => {
        if (selectedDriverTla === tla) {
            handleCloseModal();
        } else {
            setSelectedDriverTla(tla);
            setIsSimModalOpen(true);
        }
    };

    const pitstopsHelpContent = (
        <>
            <p>
                This screen provides a live, scrollable list of all drivers, ordered by their current race position. Its main feature is to simulate a pitstop for any driver to predict their new track position and the battles they will face when they rejoin.
            </p>
            <h3>Understanding the Display</h3>
            <p>Each row in the list shows a driver's position, TLA, number of pitstops (e.g., <code>1P</code>), interval to the car ahead, gap to the leader, and their current pit status.</p>
            <ul>
                <li>Rows for drivers who are currently in the pits (<code>IN PIT</code> or <code>PIT OUT</code>) are highlighted with a subtle gradient to draw attention.</li>
            </ul>
            <h3>How to Simulate a Pitstop</h3>
            <p>
                To start a simulation, simply <strong>tap on any driver's row</strong>.
            </p>
            <p>
                A modal will appear from the bottom of the screen, showing you the predicted outcome of the pitstop.
            </p>
            <h3>Understanding the Simulation Modal</h3>
            <ul>
                <li><strong>Current Status:</strong> Shows the driver's position, gap, and interval at the moment they entered the pits.</li>
                <li><strong>Prediction:</strong> Shows the driver's predicted new position and gap to leader after the stop.</li>
                <li><strong>Battleground:</strong> The main list shows the driver you selected and all the nearby cars they will be racing against for position when they rejoin.
                    <ul>
                        <li>The list is sorted in the new predicted race order.</li>
                        <li>The delta time (e.g., <code>+0.543s</code>) shows how far ahead or behind the other cars will be.</li>
                    </ul>
                </li>
            </ul>
            <hr />
            <h3>Pitstop Delta Explained</h3>
            <p>At the bottom of the screen, you'll see the pitstop delta used for the simulation. On some tracks, two values may be displayed:</p>
            <ul>
                <li><strong>Pitstop Delta (PD):</strong> This is the standard, official time lost during a pitstop. It includes the time spent driving through the pit lane and the duration of the stop itself.</li>
                <li><strong>Effective Pitstop Delta (EPD):</strong> This is a more precise value used for simulations on certain tracks. It accounts for track-specific characteristics of the pit entry and exit. For example, a shorter or faster pit entry/exit path might result in an "effective" time loss that is different from the standard delta.</li>
            </ul>
            <p>
                When both values are available and different, the simulation will always use the <strong>Effective Pitstop Delta</strong> for the most accurate prediction. The UI displays both for transparency, using abbreviations in portrait mode to save space.
            </p>
        </>
    );

    const renderContent = () => {
        const { data, error } = f1LiveTimingState;
        if (error) return <p className="error">Error: {error}</p>;

        const sessionType = data?.SessionInfo?.Type;
        if (sessionType && (sessionType.toLowerCase().includes('practice') || sessionType.toLowerCase().includes('qualifying'))) {
            return <p className="status">The pitstop simulation is only available for race sessions. This feature is disabled for Practice and Qualifying.</p>;
        }
        
        if (enrichedDrivers.length === 0) return <p className="status">Waiting for session data...</p>;
        
        return (
            <div className="pitstops-mobile-list-container">
                <div className="pitstops-mobile-list-header">
                    <span>Pos</span>
                    <span className="driver">Driver</span>
                    <span>Pits</span>
                    <span>Interval</span>
                    <span>Gap</span>
                    <span className="status">Status</span>
                </div>
                <div className="pitstops-mobile-driver-list">
                    {enrichedDrivers.map(driver => {
                        const rowClasses = ['pitstops-mobile-list-row'];
                        if (driver.tla === selectedDriverTla) rowClasses.push('active');
                        if (driver.inPit || driver.pitOut) rowClasses.push('pitstops-mobile-list-row--pitting');

                        return (
                            <div
                                key={driver.tla}
                                className={rowClasses.join(' ')}
                                onClick={() => !(driver.isRetired || driver.isStopped) && handleDriverRowClick(driver.tla)}
                                style={{ opacity: (driver.isRetired || driver.isStopped) ? 0.5 : 1, cursor: (driver.isRetired || driver.isStopped) ? 'default' : 'pointer' }}
                            >
                                <span className="pos">{driver.position}.</span>
                                <span className="driver">
                                    <span className="tla" style={{ color: `#${driver.teamColour}` }}>{driver.tla}</span>
                                </span>
                                <span className="pits">{driver.numberOfPitStops}P</span>
                                <span className="interval">{driver.interval || '-'}</span>
                                <span className="gap">{(driver.isRetired || driver.isStopped) ? '-' : (driver.gapSeconds > 0 ? driver.gapSeconds.toFixed(3) : 'Leader')}</span>
                                <span className="status">
                                    {(() => {
                                        if (driver.isStopped) {
                                            return <span className="pit-status-pill pit-status-pill--stopped">STOPPED</span>;
                                        }
                                        if (driver.isRetired) {
                                            return <span className="pit-status-pill pit-status-pill--retired">RETIRED</span>;
                                        }
                                        if (driver.inPit) {
                                            return <span className="pit-status-pill pit-status-pill--in-pit">IN PIT</span>;
                                        }
                                        if (driver.pitOut) {
                                            return <span className="pit-status-pill pit-status-pill--pit-out">PIT OUT</span>;
                                        }
                                        return null;
                                    })()}
                                </span>
                            </div>
                        );
                    })}
                </div>
                 {pitstopDurations.pitstop !== null && pitstopDurations.effective !== null && (
                    <div className="pitstops-mobile-delta-info">
                        {pitstopDurations.pitstop === pitstopDurations.effective ? (
                            <div>
                                <span className="label-portrait">PD:</span>
                                <span className="label-landscape">Pitstop Delta:</span>
                                <span>{pitstopDurations.pitstop}s</span>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <span className="label-portrait">PD:</span>
                                    <span className="label-landscape">Pitstop Delta:</span>
                                    <span>{pitstopDurations.pitstop}s</span>
                                </div>
                                <div>
                                    <span className="label-portrait">EPD:</span>
                                    <span className="label-landscape">Effective Pitstop Delta:</span>
                                    <span>{pitstopDurations.effective}s</span>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="pitstops-mobile-container">
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
            <div className="card pitstops-mobile-card">
                {renderContent()}
            </div>
            <SimulationModal
                isOpen={isSimModalOpen}
                onClose={handleCloseModal}
                pittingDriver={enrichedDrivers.find(d => d.tla === selectedDriverTla)}
                battleground={battlegroundData}
                allDrivers={enrichedDrivers}
                simulationMap={simulationMap}
            />
             <Modal
                isOpen={isInfoModalOpen}
                onClose={() => setIsInfoModalOpen(false)}
                title="About the Pitstops Screen"
            >
                {pitstopsHelpContent}
            </Modal>
        </div>
    );
};

export default PitstopsScreenMobile;