import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { FetchedData, F1LiveTimingState, LapCount, PitstopData, DriverList, TimingData, F1Driver, TimingDataLine } from './types';
import RaceStatusControl from './components/RaceStatusControl';
import Modal from './components/Modal';
import { useStore } from './store';

interface BattleDriver {
    tla: string;
    teamColour: string;
    delta: number;
}

// --- Components ---

type TooltipInfo = {
  tla: string;
  type: 'live' | 'ghost-info' | 'ghost-battleground';
  x: number;
  y: number;
  pinned: boolean;
};

const Tooltip: React.FC<{ info: TooltipInfo | null; children: React.ReactNode }> = ({ info, children }) => {
  if (!info) return null;
  return (
    <div className="pitstops-screen__tooltip" style={{ left: info.x, top: info.y }}>
      {children}
    </div>
  );
};


// --- Data Processing Hook ---

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
    // Data from snapshot
    snapshotPosition?: number;
    snapshotGapSeconds?: number;
    snapshotInterval?: string | null;
    // Simulation results
    simulatedPosition?: number;
    simulatedGapSeconds?: number;
}

// Snapshot entry type
type PitEntrySnapshotData = {
    position: number;
    gapSeconds: number;
    interval: string | null;
};

const usePitstopSimulation = (
    timingData: TimingData | undefined,
    driverList: DriverList | undefined,
    pitstopDelta: number | null,
    selectedDriverTla: string | null,
    pitEntrySnapshot: Map<string, PitEntrySnapshotData> | null
): { enrichedDrivers: EnrichedDriver[], timeScale: number, simulationMap: Map<string, { simPosition: number; simGap: number; }> | null } => {
    return useMemo(() => {
        if (!timingData?.Lines || !driverList) {
            return { enrichedDrivers: [], timeScale: 30, simulationMap: null };
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

                const gapSeconds: number | null = isLeader || isRetired || isStopped
                    ? 0 
                    : (gapToLeaderStr && !/[a-zA-Z]/.test(gapToLeaderStr) ? parseFloat(gapToLeaderStr) : null);

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
        
        liveDrivers.forEach(driver => {
            if (driver.gapSeconds === null) {
                driver.gapSeconds = (driver.isRetired || driver.isStopped) ? 0 : 999;
            }
        });
        
        // --- Simulation Logic ---
        let simulationMap: Map<string, { simPosition: number; simGap: number }> | null = null;
        if (selectedDriverTla && pitstopDelta !== null) {
            const currentlyRacingTlas = new Set(liveDrivers.filter(d => !d.isRetired && !d.isStopped).map(d => d.tla));

            const simulationBaseData = pitEntrySnapshot
                ? Array.from(pitEntrySnapshot.entries())
                    .filter(([tla]) => currentlyRacingTlas.has(tla))
                    .map(([tla, data]) => ({ tla, gapSeconds: data.gapSeconds }))
                : liveDrivers.filter(d => !d.isRetired && !d.isStopped).map(d => ({ tla: d.tla, gapSeconds: d.gapSeconds! }));


            if (simulationBaseData.length > 0) {
                const unnormalizedSimData = simulationBaseData
                    .map(d => ({
                        tla: d.tla,
                        simGapSeconds: d.gapSeconds + (d.tla === selectedDriverTla ? pitstopDelta : 0)
                    }));
                
                const sortedSimulatedRaceOrder = [...unnormalizedSimData]
                    .sort((a, b) => a.simGapSeconds - b.simGapSeconds);
                
                const newLeaderSimGap = sortedSimulatedRaceOrder[0]?.simGapSeconds || 0;

                simulationMap = new Map();
                unnormalizedSimData.forEach(driverData => {
                    const sortedIndex = sortedSimulatedRaceOrder.findIndex(d => d.tla === driverData.tla);
                    simulationMap!.set(driverData.tla, {
                        simPosition: sortedIndex + 1,
                        // Re-normalize gaps relative to the new leader to show relative changes.
                        simGap: driverData.simGapSeconds - newLeaderSimGap,
                    });
                });
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
                // Attach snapshot data if we are in a pitstop for tooltip use
                snapshotPosition: snapshotData?.position,
                snapshotGapSeconds: snapshotData?.gapSeconds,
                snapshotInterval: snapshotData?.interval,
            };
        });

        const activeDrivers = liveDrivers.filter(d => !d.isRetired && !d.isStopped);
        const maxLiveGap = Math.max(0, ...activeDrivers.map(d => d.gapSeconds!));
        const maxSimulatedGap = simulationMap 
            ? Math.max(0, ...Array.from(simulationMap.values()).map(d => d.simGap))
            : 0;
            
        const finalMaxGap = Math.max(maxLiveGap, maxSimulatedGap);
        const timeScale = Math.max(20, Math.ceil((finalMaxGap + 5) / 5) * 5);

        return { enrichedDrivers, timeScale, simulationMap };

    }, [timingData, driverList, pitstopDelta, selectedDriverTla, pitEntrySnapshot]);
};

// --- Helper Functions ---

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

// --- Rendering Components ---

const UnifiedTooltipContent: React.FC<{
    pittingDriver: EnrichedDriver;
    allDrivers: EnrichedDriver[];
    simulationMap: Map<string, { simPosition: number; simGap: number; }>;
    battleground: { ahead: BattleDriver[]; behind: BattleDriver[] };
}> = ({ pittingDriver, allDrivers, simulationMap, battleground }) => {
    
    // A snapshot is active if snapshot data is present on the driver object.
    const isSnapshotActive = pittingDriver.snapshotPosition !== undefined;

    const liveInfo = {
        position: isSnapshotActive ? pittingDriver.snapshotPosition : pittingDriver.position,
        gap: isSnapshotActive ? pittingDriver.snapshotGapSeconds : pittingDriver.gapSeconds,
        interval: isSnapshotActive ? pittingDriver.snapshotInterval : pittingDriver.interval,
    };

    let pitStatusIndicator = null;
    if (pittingDriver.inPit) {
        pitStatusIndicator = <span style={{ color: 'var(--orange-color)', marginLeft: '8px' }}>In Pit</span>;
    } else if (isSnapshotActive && pittingDriver.pitOut) {
        // We are showing snapshot data, and the driver is in the "Pit Out" phase
        pitStatusIndicator = <span style={{ color: 'var(--yellow-color)', marginLeft: '8px' }}>Pit Out</span>;
    }

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

    const predictedLeaderGap = useMemo(() => {
        const leader = fullContextList.find(d => d.simPosition === 1);
        if (!leader) return 0;
        const leaderSimData = simulationMap.get(leader.tla);
        return leaderSimData ? leaderSimData.simGap : 0;
    }, [fullContextList, simulationMap]);
    

    return (
        <div className="pitstops-screen__battleground-tooltip-content">
            <div className="pitstops-screen__tooltip-header">
                {pittingDriver.tla} (P{liveInfo.position})
                {pitStatusIndicator}
            </div>

            <div className="pitstops-screen__tooltip-line">
                <strong>Gap:</strong> {liveInfo.gap?.toFixed(3)}s
                <strong style={{ marginLeft: '12px' }}>Interval:</strong> {liveInfo.interval || 'N/A'}
            </div>

            <>
                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '6px 0' }}/>
                <div className="pitstops-screen__tooltip-line">
                    <strong>Predicted Rejoin:</strong> P{pittingDriver.simulatedPosition} ({(pittingDriver.simulatedGapSeconds! - predictedLeaderGap).toFixed(3)}s to leader)
                </div>
                <ul className="pitstops-screen__battleground-list">
                    {fullContextList.map(d => {
                         if (d.isPittingDriver) {
                            return (
                                <li key={d.tla} className="pitstops-screen__battleground-item pitstops-screen__battleground-item--pitting">
                                    <span className="pitstops-screen__battleground-tla">(P{d.simPosition}) <span style={{ color: `#${d.teamColour}` }}>{d.tla}</span></span>
                                    <span className="pitstops-screen__battleground-delta">PIT</span>
                                </li>
                            );
                        }
                        const battleData = battlegroundDrivers.find(b => b.tla === d.tla)!;
                        const deltaSign = battleData.delta < 0 ? '' : '+';
                        return (
                            <li key={d.tla} className="pitstops-screen__battleground-item">
                                <span className="pitstops-screen__battleground-tla">(P{d.simPosition}) <span style={{ color: `#${d.teamColour}` }}>{d.tla}</span></span>
                                <span className="pitstops-screen__battleground-delta">{deltaSign}{battleData.delta.toFixed(3)}s</span>
                            </li>
                        );
                    })}
                </ul>
            </>
        </div>
    );
};

const PredictionVisualizer: React.FC<{
    timeScale: number;
    selectedDriverSimulatedGap?: number;
    rangeStartSeconds?: number;
    rangeEndSeconds?: number;
}> = ({ timeScale, selectedDriverSimulatedGap, rangeStartSeconds, rangeEndSeconds }) => {
    if (selectedDriverSimulatedGap === undefined) {
        return null;
    }

    const linePosPercent = (selectedDriverSimulatedGap / timeScale) * 100;
    
    const showRange = rangeStartSeconds !== undefined && rangeEndSeconds !== undefined && rangeEndSeconds > rangeStartSeconds;
    
    const rangeStartPercent = showRange ? (rangeStartSeconds! / timeScale) * 100 : 0;
    const rangeWidthPercent = showRange ? ((rangeEndSeconds! - rangeStartSeconds!) / timeScale) * 100 : 0;

    return (
        <div className="pitstops-screen__prediction-visualizer">
            {showRange && (
                <div 
                    className="pitstops-screen__prediction-range"
                    style={{
                        left: `${rangeStartPercent}%`,
                        width: `${rangeWidthPercent}%`
                    }}
                    title="Predicted battleground for position"
                />
            )}
            <div 
                className="pitstops-screen__prediction-line-vertical"
                style={{ left: `${linePosPercent}%` }}
            />
        </div>
    );
};

const TimelineAxis: React.FC<{ timeScale: number; markers: number[] }> = ({ timeScale, markers }) => {
    return (
        <div className="pitstops-screen__timeline-axis">
            {markers.map(time => (
                <div 
                    key={time} 
                    className="pitstops-screen__axis-marker"
                    style={{ left: `${(time / timeScale) * 100}%` }}
                >
                    <div className="pitstops-screen__axis-marker-tick" />
                    <div className="pitstops-screen__axis-marker-label">{time}s</div>
                </div>
            ))}
        </div>
    );
};

type PitstopAnimation = { tla: string; startGap: number; endGap: number } | null;

const DriverRow: React.FC<{
    driver: EnrichedDriver;
    timeScale: number;
    isSimulationActive: boolean;
    isSimulatedDriver: boolean;
    onMarkerEnter: (event: React.MouseEvent, driver: EnrichedDriver) => void;
    onMarkerLeave: (event: React.MouseEvent) => void;
    onMarkerClick: (event: React.MouseEvent, driver: EnrichedDriver) => void;
    onGhostMarkerClick: (event: React.MouseEvent, driver: EnrichedDriver) => void;
    pitstopAnimation: PitstopAnimation;
    onAnimationComplete: (timestamp: number) => void;
    onDriverSelect: (tla: string) => void;
    isHighlighted: boolean;
}> = ({ driver, timeScale, isSimulationActive, isSimulatedDriver, onMarkerEnter, onMarkerLeave, onMarkerClick, onGhostMarkerClick, pitstopAnimation, onAnimationComplete, onDriverSelect, isHighlighted }) => {
    const [animatedGap, setAnimatedGap] = useState<number | null>(null);
    const animationFrameId = useRef<number | null>(null);
    const animationStartTime = useRef<number | null>(null);

    const isAnimating = pitstopAnimation?.tla === driver.tla;

    useEffect(() => {
        if (isAnimating) {
            const { startGap, endGap } = pitstopAnimation;
            const animationDuration = 1000;

            animationStartTime.current = performance.now();

            const animate = (currentTime: number) => {
                const elapsed = currentTime - (animationStartTime.current || currentTime);
                const progress = Math.min(elapsed / animationDuration, 1);
                const easedProgress = 1 - Math.pow(1 - progress, 3);
                const currentGap = startGap + (endGap - startGap) * easedProgress;
                setAnimatedGap(currentGap);

                if (progress < 1) {
                    animationFrameId.current = requestAnimationFrame(animate);
                } else {
                    setAnimatedGap(null);
                    onAnimationComplete(currentTime);
                }
            };

            animationFrameId.current = requestAnimationFrame(animate);

            return () => {
                if (animationFrameId.current) {
                    cancelAnimationFrame(animationFrameId.current);
                }
            };
        }
    }, [isAnimating, pitstopAnimation, onAnimationComplete]);
    
    const currentDisplayGap = animatedGap ?? driver.gapSeconds;
    const livePosPercent = (currentDisplayGap / timeScale) * 100;
    
    const showSimulation = !(driver.isRetired || driver.isStopped) && driver.simulatedGapSeconds !== undefined && driver.simulatedPosition !== undefined;
    
    let lineProps = null;
    if (isAnimating) {
        const { startGap, endGap } = pitstopAnimation!;
        const startPercent = (Math.min(startGap, endGap) / timeScale) * 100;
        const widthPercent = (Math.abs(startGap - endGap) / timeScale) * 100;
        lineProps = { left: `${startPercent}%`, width: `${widthPercent}%`, color: `#${driver.teamColour}` };
    } else if (showSimulation) {
        const ghostPosPercent = (driver.simulatedGapSeconds! / timeScale) * 100;
        const startPercent = Math.min(livePosPercent, ghostPosPercent);
        const widthPercent = Math.abs(livePosPercent - ghostPosPercent);
        lineProps = { left: `${startPercent}%`, width: `${widthPercent}%`, color: `#${driver.teamColour}` };
    }

    const isInPits = driver.inPit || driver.pitOut;
    const rowClasses = [
        'pitstops-screen__driver-row',
        (driver.isRetired || driver.isStopped) ? 'pitstops-screen__driver-row--retired' : '',
        isInPits ? 'pitstops-screen__driver-row--in-pit' : ''
    ].join(' ');
    
    const liveMarkerClasses = [
        'pitstops-screen__live-marker',
        isAnimating ? 'pitstops-screen__live-marker--animating' : '',
        isHighlighted ? 'pitstops-screen__live-marker--highlight' : ''
    ].join(' ');

    const ghostMarkerClasses = [
        'pitstops-screen__ghost-marker',
        isSimulatedDriver ? 'pitstops-screen__ghost-marker--active-simulation' : ''
    ].join(' ');

    return (
        <div className={rowClasses}>
            <div
                className="pitstops-screen__driver-info"
                style={{ cursor: (driver.isRetired || driver.isStopped) ? 'default' : 'pointer' }}
                onClick={(event: React.MouseEvent<HTMLDivElement>) => !(driver.isRetired || driver.isStopped) && onDriverSelect(driver.tla)}
            >
                <span className="pitstops-screen__driver-info-pos">{driver.position}.</span>
                <span style={{ color: `#${driver.teamColour}` }}>{driver.tla}</span>
                {(() => {
                    if (driver.isStopped) return <span className="pit-status-pill pit-status-pill--stopped">STOPPED</span>;
                    if (driver.isRetired) return <span className="pit-status-pill pit-status-pill--retired">RETIRED</span>;
                    if (driver.inPit) return <span className="pit-status-pill pit-status-pill--in-pit">IN PIT</span>;
                    if (driver.pitOut) return <span className="pit-status-pill pit-status-pill--pit-out">PIT OUT</span>;
                    return null;
                })()}
            </div>
            <div className="pitstops-screen__pit-stop-info">
                <span>{driver.numberOfPitStops}P</span>
            </div>
            <div className="pitstops-screen__timeline-track">
                {!(driver.isRetired || driver.isStopped) && (
                    <>
                        <div 
                            className={liveMarkerClasses}
                            style={{ 
                                left: `${livePosPercent}%`, 
                                backgroundColor: `#${driver.teamColour}`,
                                cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => onMarkerEnter(e, driver)}
                            onMouseLeave={onMarkerLeave}
                            onClick={(event: React.MouseEvent<HTMLDivElement>) => onMarkerClick(event, driver)}
                        />
                        {lineProps && (
                            <div className="pitstops-screen__ghost-visuals">
                                <div className="pitstops-screen__prediction-line" style={lineProps} />
                            </div>
                        )}
                        {showSimulation && (
                            <>
                                <div className="pitstops-screen__ghost-visuals">
                                    <div 
                                        className="pitstops-screen__prediction-label"
                                        style={{ left: `calc(${(driver.simulatedGapSeconds! / timeScale) * 100}% + 12px)` }}
                                    >
                                        P{driver.simulatedPosition}
                                    </div>
                                </div>
                                <div 
                                    className={ghostMarkerClasses}
                                    style={{
                                        left: `${(driver.simulatedGapSeconds! / timeScale) * 100}%`,
                                        cursor: 'pointer',
                                        backgroundColor: `#${driver.teamColour}`,
                                        filter: 'saturate(0.5) opacity(0.85)',
                                    }}
                                    onClick={(e) => onGhostMarkerClick(e, driver)}
                                />
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};


// --- Main Screen Component ---

type PitstopsScreenProps = {
  f1LiveTimingState: FetchedData<F1LiveTimingState | null>;
  lapCount: LapCount | null;
  trackStatusInfo: { className: string; text: string; visible: boolean };
  drsStatus: 'ENABLED' | 'DISABLED' | string | null;
};

type PrevDriverState = {
    inPit: boolean;
    pitOut: boolean;
    gapSeconds: number;
};

const PitstopsScreen: React.FC<PitstopsScreenProps> = ({ f1LiveTimingState, lapCount, trackStatusInfo, drsStatus }) => {
    const settings = useStore((state) => state.settings);
    const [selectedDriverTla, setSelectedDriverTla] = useState<string | null>(null);
    const [highlightedDriverTla, setHighlightedDriverTla] = useState<string | null>(null);
    const [pitstopData, setPitstopData] = useState<PitstopData[] | null>(null);
    const [tooltipInfo, setTooltipInfo] = useState<TooltipInfo | null>(null);
    const [pitstopAnimation, setPitstopAnimation] = useState<PitstopAnimation>(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const prevDriverStatusRef = useRef<Map<string, PrevDriverState>>(new Map());
    const pitEntrySnapshotsRef = useRef<Map<string, Map<string, PitEntrySnapshotData>>>(new Map());
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch('/pitstopdata.json')
            .then(response => response.ok ? response.json() : Promise.reject(`HTTP error! status: ${response.status}`))
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

    const liveDriversForSnapshot = useMemo(() => {
        const timingData = f1LiveTimingState.data?.TimingData;
        const driverList = f1LiveTimingState.data?.DriverList;
        if (!timingData?.Lines || !driverList) {
            return [];
        }
        return Object.values(timingData.Lines)
            .map((line: TimingDataLine) => {
                const driverInfo = driverList[line.RacingNumber];
                if (!driverInfo || !line.Position) return null;
                return {
                    tla: driverInfo.Tla,
                    inPit: !!line.InPit,
                    pitOut: !!line.PitOut,
                };
            })
            .filter((d): d is NonNullable<typeof d> => d !== null);
    }, [f1LiveTimingState.data]);

    const activeSnapshot = useMemo(() => {
        if (!selectedDriverTla) return null;

        const driver = liveDriversForSnapshot.find(d => d.tla === selectedDriverTla);
        if (driver && (driver.inPit || driver.pitOut)) {
            return pitEntrySnapshotsRef.current.get(selectedDriverTla) || null;
        }

        return null;
    }, [selectedDriverTla, liveDriversForSnapshot]);

    const { enrichedDrivers, timeScale, simulationMap } = usePitstopSimulation(
        f1LiveTimingState.data?.TimingData,
        f1LiveTimingState.data?.DriverList,
        pitstopDurations.effective,
        selectedDriverTla,
        activeSnapshot
    );

    useEffect(() => {
        const prevStatuses = prevDriverStatusRef.current;
        const currentSnapshots = pitEntrySnapshotsRef.current;
    
        enrichedDrivers.forEach(driver => {
            const prevStatus = prevStatuses.get(driver.tla);
            
            // Entry conditions
            const isNowInPit = driver.inPit;
            const wasInPit = prevStatus?.inPit || false;
            
            if (isNowInPit && !wasInPit) {
                const snapshot = new Map<string, PitEntrySnapshotData>();
                enrichedDrivers.forEach(d => {
                    if (!d.isRetired) {
                        snapshot.set(d.tla, {
                            gapSeconds: d.gapSeconds,
                            position: d.position,
                            interval: d.interval
                        });
                    }
                });
                currentSnapshots.set(driver.tla, snapshot);
            }
    
            // Exit conditions
            const wasPitting = prevStatus?.inPit || prevStatus?.pitOut || false;
            const isNowPitting = driver.inPit || driver.pitOut;
            
            const pitstopCompleted = 
                // Condition 1: Driver was pitting, now they are not. (e.g., PitOut flag disappears)
                (wasPitting && !isNowPitting) || 
                // Condition 2: Driver was in PitOut, is still in PitOut, but their gap has updated.
                // This means they've crossed the timing line and are fully back in the race.
                (prevStatus?.pitOut && driver.pitOut && prevStatus.gapSeconds !== driver.gapSeconds);
    
            if (pitstopCompleted) {
                currentSnapshots.delete(driver.tla);
                if (driver.tla === selectedDriverTla) {
                    setSelectedDriverTla(null);
                }
                setHighlightedDriverTla(driver.tla);
                setTimeout(() => {
                    setHighlightedDriverTla(prev => prev === driver.tla ? null : prev);
                }, 3000);
            }
        });
    
        // Update the ref with current state for the next render cycle.
        const newPrevStatus = new Map<string, PrevDriverState>();
        enrichedDrivers.forEach(d => newPrevStatus.set(d.tla, { 
            inPit: d.inPit, 
            pitOut: d.pitOut,
            gapSeconds: d.gapSeconds,
        }));
        prevDriverStatusRef.current = newPrevStatus;
        
    }, [enrichedDrivers, selectedDriverTla]);

    const onAnimationComplete = useCallback((_timestamp: number) => {
        setPitstopAnimation(null);
    }, []);
    
    const driverDataForFilterBar = useMemo(() => {
        const driverList = f1LiveTimingState.data?.DriverList;
        if (!driverList) return [];
        const timingData = f1LiveTimingState.data?.TimingData;
        
        return Object.values(driverList)
            .map((driver: F1Driver) => {
                const line = timingData?.Lines[driver.RacingNumber];
                return {
                    ...driver,
                    position: line?.Position ? parseInt(line.Position, 10) : Infinity,
                    isRetired: !!(line?.Retired || line?.Stopped)
                };
            })
            .sort((a, b) => a.position - b.position);
    }, [f1LiveTimingState.data]);

    const axisMarkers = useMemo(() => {
        if (timeScale <= 0) return [];
        const interval = timeScale > 60 ? 10 : (timeScale > 30 ? 5 : 2.5);
        const count = Math.floor(timeScale / interval);
        return Array.from({ length: count + 1 }, (_, i) => i * interval);
    }, [timeScale]);

    const battlegroundData = useMemo(() => {
        const battleground = { ahead: [], behind: [] };
        if (!selectedDriverTla || !settings.pitstopBattlegroundDuration || !simulationMap) {
            return battleground;
        }
    
        const pittingDriverSimData = simulationMap.get(selectedDriverTla);
        if (!pittingDriverSimData) {
            return battleground;
        }
    
        const duration = settings.pitstopBattlegroundDuration;
        const pittingDriverSimGap = pittingDriverSimData.simGap;
        const lowerBound = pittingDriverSimGap - duration;
        const upperBound = pittingDriverSimGap + duration;
    
        const ahead: { tla: string; teamColour: string; delta: number }[] = [];
        const behind: { tla: string; teamColour: string; delta: number }[] = [];
    
        enrichedDrivers.forEach(otherDriver => {
            if (otherDriver.isRetired || otherDriver.tla === selectedDriverTla) {
                return;
            }
            
            const otherDriverSimData = simulationMap.get(otherDriver.tla);
            if (otherDriverSimData && otherDriverSimData.simGap >= lowerBound && otherDriverSimData.simGap <= upperBound) {
                const delta = otherDriverSimData.simGap - pittingDriverSimGap;
                const driverInfo = {
                    tla: otherDriver.tla,
                    teamColour: otherDriver.teamColour,
                    delta: delta
                };
                if (delta < 0) {
                    ahead.push(driverInfo);
                } else {
                    behind.push(driverInfo);
                }
            }
        });
    
        ahead.sort((a, b) => b.delta - a.delta); 
        behind.sort((a, b) => a.delta - b.delta);
    
        return { ahead, behind };
    }, [enrichedDrivers, selectedDriverTla, settings.pitstopBattlegroundDuration, simulationMap]);

    const predictionVizData = useMemo(() => {
        if (!selectedDriverTla) {
            return { selectedDriverSimulatedGap: undefined };
        }
        const selectedDriver = enrichedDrivers.find(d => d.tla === selectedDriverTla);
        if (!selectedDriver || selectedDriver.isRetired || selectedDriver.simulatedGapSeconds === undefined) {
            return { selectedDriverSimulatedGap: undefined };
        }
        
        const battlegroundDuration = settings.pitstopBattlegroundDuration;
        const rangeStartSeconds = Math.max(0, selectedDriver.simulatedGapSeconds - battlegroundDuration);
        const rangeEndSeconds = selectedDriver.simulatedGapSeconds + battlegroundDuration;

        return {
            selectedDriverSimulatedGap: selectedDriver.simulatedGapSeconds,
            rangeStartSeconds: rangeStartSeconds,
            rangeEndSeconds: rangeEndSeconds,
        };
    }, [selectedDriverTla, enrichedDrivers, settings.pitstopBattlegroundDuration]);

    useEffect(() => {
        setTooltipInfo(null);
    }, [selectedDriverTla]);


    const handleDriverSelect = (tla: string) => {
        setSelectedDriverTla(prev => 
            prev === tla ? null : tla
        );
    };
    
    const createTooltip = (event: React.MouseEvent, tla: string, type: TooltipInfo['type'], pinned: boolean) => {
        if (!cardRef.current) return;
        const cardRect = cardRef.current.getBoundingClientRect();
        const targetRect = event.currentTarget.getBoundingClientRect();
        const x = targetRect.left - cardRect.left + targetRect.width / 2;
        const y = targetRect.top - cardRect.top;
        setTooltipInfo({ tla, type, x, y, pinned });
    };

    const getLiveTooltipContent = (driver: EnrichedDriver) => (
        <div className="pitstops-screen__tooltip-content">
            <div className="pitstops-screen__tooltip-header">{driver.tla} - Live (P{driver.position})</div>
            <div className="pitstops-screen__tooltip-line"><strong>Gap to Leader:</strong> {driver.gapSeconds?.toFixed(3)}s</div>
            {driver.interval && <div className="pitstops-screen__tooltip-line"><strong>Interval Ahead:</strong> {driver.interval}</div>}
        </div>
    );

    const getSimulatedTooltipContent = (driver: EnrichedDriver) => {
        const position = driver.simulatedPosition;
        const gap = driver.simulatedGapSeconds;
        let interval = 'N/A';
        if (position && position > 1) {
            const driversSortedBySim = enrichedDrivers.filter(d => d.simulatedPosition !== undefined).sort((a, b) => a.simulatedPosition! - b.simulatedPosition!);
            const driverAhead = driversSortedBySim.find(d => d.simulatedPosition === position - 1);
            if (driverAhead && driverAhead.simulatedGapSeconds !== undefined && gap !== undefined) {
                interval = `${(gap - driverAhead.simulatedGapSeconds).toFixed(3)}s`;
            }
        }
        return (
            <div className="pitstops-screen__tooltip-content">
                <div className="pitstops-screen__tooltip-header">{driver.tla} - Predicted (P{position})</div>
                <div className="pitstops-screen__tooltip-line"><strong>Gap to Leader:</strong> {gap?.toFixed(3)}s</div>
                {position !== 1 && <div className="pitstops-screen__tooltip-line"><strong>Interval Ahead:</strong> {interval}</div>}
            </div>
        );
    };
    
    const handleMarkerClick = (event: React.MouseEvent, driver: EnrichedDriver) => {
        event.stopPropagation();
        if (selectedDriverTla) return;
        if (tooltipInfo?.tla === driver.tla && tooltipInfo.type === 'live' && tooltipInfo.pinned) {
            setTooltipInfo(null);
        } else {
            createTooltip(event, driver.tla, 'live', true);
        }
    };

    const handleGhostMarkerClick = (event: React.MouseEvent, driver: EnrichedDriver) => {
        event.stopPropagation();
        const type = driver.tla === selectedDriverTla ? 'ghost-battleground' : 'ghost-info';
        if (tooltipInfo?.tla === driver.tla && tooltipInfo.type === type) {
            setTooltipInfo(null);
        } else {
            createTooltip(event, driver.tla, type, true);
        }
    };

    const infoIcon = (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
    );

    const pitstopsHelpContent = (
        <>
            <p>
                This screen provides a live, visual timeline of the race, showing each driver's gap to the leader. Its main feature is the ability to <strong>simulate a pitstop</strong> for any driver to predict their track position and the outcome of battles when they rejoin the race.
            </p>
            <h3>Understanding the Display</h3>
            <p>The main part of the screen is a timeline that represents the race based on time, not physical distance. This means all drivers, including lapped cars, are positioned according to their time gap to the leader, providing a more accurate view of the strategic situation.</p>
            <p>In addition to the timeline, the driver list on the left includes key pitstop information:</p>
            <ul>
                <li><strong>Pit Status:</strong> Next to the driver's name, a status pill will appear if they are currently in the pits (<code>IN PIT</code>) or have just exited (<code>PIT OUT</code>).</li>
                <li><strong>Pit Count:</strong> The column between the driver's name and the timeline shows how many pitstops a driver has completed (e.g., <code>0P</code>, <code>1P</code>, <code>2P</code>).</li>
            </ul>
            <h3>How to Simulate a Pitstop</h3>
            <p>
                To start a simulation, select a driver using one of two methods:
            </p>
            <ul>
                <li><strong>Filter Bar:</strong> Click a driver's TLA button in the "Simulate Pitstop For" bar at the top of the content area.</li>
                <li><strong>Driver List:</strong> Click on any driver's information panel on the left side of the timeline.</li>
            </ul>
            <p>
                Once a driver is selected, the timeline will update to show a prediction.
            </p>
            <h3>Understanding the Simulation</h3>
            <p>
                A desaturated 'ghost' marker will appear on the timeline, showing the driver's predicted position after their pitstop. A dotted line connects their current position to their predicted position. Alongside the ghost markers, black labels will show the predicted race position for each driver after the pitstop is complete.
            </p>
            <p>
                To see a detailed breakdown of the pitstop battleground, <strong>click on the ghost marker</strong> of the pitting driver. A tooltip will appear, showing the predicted gaps to the cars they will be racing against when they rejoin the track.
            </p>
            <p>
                <strong>Important:</strong> The simulation is based on a single driver making a pitstop and does not take into account multiple drivers entering the pits at once.
            </p>
            <p>
                You can deselect the driver by clicking their button again or using the "Reset" button.
            </p>
            <hr />
            <h3>Pitstop Delta Explained</h3>
            <p>At the bottom of the screen, you'll see the pitstop delta used for the simulation. On some tracks, two values may be displayed:</p>
            <ul>
                <li><strong>Pitstop Delta:</strong> This is the standard, official time lost during a pitstop. It includes the time spent driving through the pit lane and the duration of the stop itself.</li>
                <li><strong>Effective Pitstop Delta:</strong> This is a more precise value used for simulations on certain tracks. It accounts for track-specific characteristics of the pit entry and exit. For example, a shorter or faster pit entry/exit path might result in an "effective" time loss that is different from the standard delta.</li>
            </ul>
            <p>
                When both values are available and different, the simulation will always use the <strong>Effective Pitstop Delta</strong> for the most accurate prediction. The UI displays both for transparency.
            </p>
        </>
    );

    const renderTooltipContent = () => {
        if (!tooltipInfo) return null;
        
        const driver = enrichedDrivers.find(d => d.tla === tooltipInfo.tla);
        if (!driver) return null;

        switch (tooltipInfo.type) {
            case 'live':
                return getLiveTooltipContent(driver);
            case 'ghost-info':
                return getSimulatedTooltipContent(driver);
            case 'ghost-battleground':
                const pittingDriver = enrichedDrivers.find(d => d.tla === selectedDriverTla);
                if (!pittingDriver || !simulationMap) return null;
                return (
                    <UnifiedTooltipContent
                        pittingDriver={pittingDriver}
                        allDrivers={enrichedDrivers}
                        simulationMap={simulationMap}
                        battleground={battlegroundData}
                    />
                );
            default:
                return null;
        }
    };

    const renderContent = () => {
        const { data, error } = f1LiveTimingState;

        if (error) return <p className="error">Error fetching data: {error}</p>;

        const sessionType = data?.SessionInfo?.Type;
        if (sessionType && (sessionType.toLowerCase().includes('practice') || sessionType.toLowerCase().includes('qualifying'))) {
            return <p className="status">The pitstop simulation is only available for race sessions. This feature is disabled for Practice and Qualifying.</p>;
        }
        
        if (enrichedDrivers.length === 0) return <p className="status">Waiting for valid session data...</p>;
        
        return (
            <>
                <div className="race-control__filter-bar">
                    <span style={{ fontWeight: 'bold', marginRight: '0.5rem' }}>Simulate Pitstop For:</span>
                    {driverDataForFilterBar.map(driver => {
                        const isActive = selectedDriverTla === driver.Tla;
                        const textColor = getTextColorForBackground(driver.TeamColour);
                        return (
                            <button
                                key={driver.Tla}
                                className={`race-control__filter-button ${isActive ? 'active' : ''}`}
                                style={{ backgroundColor: `#${driver.TeamColour}`, color: textColor }}
                                onClick={() => handleDriverSelect(driver.Tla)}
                                disabled={driver.isRetired}
                            >{driver.Tla}</button>
                        );
                    })}
                    {selectedDriverTla !== null && <button className="race-control__filter-reset-button" onClick={() => setSelectedDriverTla(null)}>Reset</button>}
                </div>
                <div className="pitstops-screen__chart-container">
                    <div className="pitstops-screen__grid-lines">
                        {axisMarkers.map(time => (
                            time > 0 && (
                                <div
                                    key={`grid-line-${time}`}
                                    className="pitstops-screen__grid-line"
                                    style={{ left: `${(time / timeScale) * 100}%` }}
                                />
                            )
                        ))}
                    </div>
                    <PredictionVisualizer 
                        timeScale={timeScale}
                        {...predictionVizData}
                    />
                    <TimelineAxis timeScale={timeScale} markers={axisMarkers} />
                    {enrichedDrivers.map(driver => (
                        <DriverRow 
                          key={driver.tla} 
                          driver={driver} 
                          timeScale={timeScale}
                          isSimulationActive={!!selectedDriverTla}
                          isSimulatedDriver={driver.tla === selectedDriverTla}
                          onMarkerEnter={(e, d) => {
                                if (!selectedDriverTla && (!tooltipInfo || !tooltipInfo.pinned)) {
                                    createTooltip(e, d.tla, 'live', false);
                                }
                          }}
                          onMarkerLeave={() => {
                                if (tooltipInfo && !tooltipInfo.pinned) {
                                    setTooltipInfo(null);
                                }
                          }}
                          onMarkerClick={handleMarkerClick}
                          onGhostMarkerClick={handleGhostMarkerClick}
                          pitstopAnimation={pitstopAnimation}
                          onAnimationComplete={onAnimationComplete}
                          onDriverSelect={(tla) => handleDriverSelect(tla)}
                          isHighlighted={driver.tla === highlightedDriverTla}
                        />
                    ))}
                </div>
                 {pitstopDurations.pitstop !== null && pitstopDurations.effective !== null && (
                    <div className="pitstops-screen__delta-info">
                        {pitstopDurations.pitstop === pitstopDurations.effective ? (
                            <div>
                                <strong>Pitstop Delta for {f1LiveTimingState.data?.SessionInfo?.Meeting?.Circuit?.ShortName}:</strong> {pitstopDurations.pitstop}s
                            </div>
                        ) : (
                            <>
                                <div>
                                    <strong>Pitstop Delta:</strong> {pitstopDurations.pitstop}s
                                </div>
                                <div>
                                    <strong>Effective Pitstop Delta:</strong> {pitstopDurations.effective}s
                                </div>
                            </>
                        )}
                    </div>
                )}
            </>
        );
    };

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <h1 style={{ margin: 0 }}>Pitstops</h1>
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
            <div className="card" ref={cardRef} onClick={() => setTooltipInfo(null)} style={{ position: 'relative' }}>
                <Tooltip info={tooltipInfo}>
                    {renderTooltipContent()}
                </Tooltip>
                {renderContent()}
            </div>
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

export default PitstopsScreen;