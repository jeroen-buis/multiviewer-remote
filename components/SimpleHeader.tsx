import React from 'react';
import { LapCount } from '../types';

type SimpleHeaderProps = {
  lapCount: LapCount | null;
  sessionType?: string;
  sessionName?: string;
  sessionStatus?: string;
  trackStatusInfo: { className: string; text: string; visible: boolean };
  drsStatus: 'ENABLED' | 'DISABLED' | string | null;
  viewName: string;
  onInfoClick?: () => void;
};

const viewNameMap: Record<string, string> = {
    'home': 'Home',
    'race': 'Race',
    'leaderboard': 'Leaderboard',
    'position': 'Position',
    'tires': 'Tires',
    'tire-stats': 'Tire Stats',
    'pitstops': 'Pitstops',
    'race-control': 'Race Control',
    'controller': 'Controller',
    'debug': 'Debug',
    'settings': 'Settings',
};

const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
);


const SimpleHeader: React.FC<SimpleHeaderProps> = ({ lapCount, sessionType, sessionName, sessionStatus, trackStatusInfo, drsStatus, viewName, onInfoClick }) => {
    const viewTitle = viewNameMap[viewName] || 'Remote';

    const renderLapInfo = () => {
        if (sessionStatus === 'Finished') {
            return <span>Finished</span>;
        }
        if (lapCount && lapCount.TotalLaps > 0) {
            return <span>Lap {lapCount.CurrentLap} / {lapCount.TotalLaps}</span>;
        }
        if (sessionType) {
            const lowerSessionType = sessionType.toLowerCase();
            if (lowerSessionType.includes('practice') || lowerSessionType.includes('qualifying')) {
                return <span>{sessionName || sessionType}</span>;
            }
        }
        return <span>Formation Lap</span>;
    };

    const simplifyTrackStatus = (text: string, forLandscape: boolean = false) => {
        const simplified = text
            .replace('Virtual Safety Car', 'VSC')
            .replace('Safety Car', 'SC')
            .replace(' Ending', ' Ends');
        
        if (text.includes('Yellow') || text.includes('Red')) {
            // In portrait, the color is enough, so we hide the text.
            // In landscape, we show the simplified text for clarity.
            return forLandscape ? simplified.replace(' Flag', '') : '';
        }
        return simplified.replace('Track ', '');
    };

    const simplifiedTrackStatusTextPortrait = simplifyTrackStatus(trackStatusInfo.text);
    const simplifiedTrackStatusTextLandscape = simplifyTrackStatus(trackStatusInfo.text, true);
    const simplifiedDrsStatusText = drsStatus === null ? null : drsStatus === 'ENABLED' ? 'DRS' : 'No DRS';
    const lapInfoNode = renderLapInfo();

    return (
        <div className="controller-mobile-simple-header">
            {/* Portrait Layout - managed by default CSS */}
            <div className="simple-header-portrait">
                <div className="simple-header-view-title">
                    <span>{viewTitle}</span>
                    {onInfoClick && (
                        <button className="simple-header-info-button" onClick={onInfoClick} title={`About the ${viewTitle} screen`}>
                            <InfoIcon />
                        </button>
                    )}
                </div>
                <div className="simple-header-status-row">
                    <div className={`controller-mobile-track-status ${trackStatusInfo.className}`}>
                        <span className="status-text">{trackStatusInfo.visible ? simplifiedTrackStatusTextPortrait : '---'}</span>
                    </div>
                    <div className="controller-mobile-lap-info">{lapInfoNode}</div>
                    {simplifiedDrsStatusText !== null && (
                        <div className={`controller-mobile-drs-status ${drsStatus === 'ENABLED' ? 'drs-enabled' : 'drs-disabled'}`}>{simplifiedDrsStatusText}</div>
                    )}
                </div>
            </div>

            {/* Landscape Layout - managed by media query */}
            <div className="simple-header-landscape">
                <div className="simple-header-view-title">
                     <span>{viewTitle}</span>
                    {onInfoClick && (
                        <button className="simple-header-info-button" onClick={onInfoClick} title={`About the ${viewTitle} screen`}>
                            <InfoIcon />
                        </button>
                    )}
                </div>
                <div className="simple-header-status-row">
                     <div className={`controller-mobile-track-status ${trackStatusInfo.className}`}>
                        <span className="status-text">{trackStatusInfo.visible ? simplifiedTrackStatusTextLandscape : '---'}</span>
                    </div>
                    <div className="controller-mobile-lap-info">{lapInfoNode}</div>
                    {simplifiedDrsStatusText !== null && (
                        <div className={`controller-mobile-drs-status ${drsStatus === 'ENABLED' ? 'drs-enabled' : 'drs-disabled'}`}>{simplifiedDrsStatusText}</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SimpleHeader;