import React, { useState, useEffect } from 'react';
import { FetchedData, F1LiveTimingState, LapCount } from './types';
import RaceStatusControl from './components/RaceStatusControl';
import Modal from './components/Modal';
import { useStore } from './store';
import { convertTemp, convertWindSpeed, tempUnit, windUnit } from './utils';

type RaceScreenProps = {
  raceData: FetchedData<F1LiveTimingState>;
  lapCount: LapCount | null;
  trackStatusInfo: { className: string; text: string; visible: boolean };
  drsStatus: 'ENABLED' | 'DISABLED' | string | null;
};

const WeatherItem: React.FC<{ icon: React.ReactElement; label: string; value: string | number | null; unit?: string }> = ({ icon, label, value, unit }) => (
  <div className="race-screen__weather-item">
    {icon}
    <div>
      <div className="label">{label}</div>
      <div className="value">{value ?? 'N/A'}{unit}</div>
    </div>
  </div>
);

const TrackLayout: React.FC<{ circuitKey: string | number }> = ({ circuitKey }) => {
  const [imageStatus, setImageStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const imageUrl = `/${circuitKey}.avif`;

  useEffect(() => {
    if (!circuitKey) {
      setImageStatus('error');
      return;
    }
    setImageStatus('loading');
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => setImageStatus('success');
    img.onerror = () => setImageStatus('error');
  }, [circuitKey, imageUrl]);

  if (imageStatus !== 'success') {
    return null;
  }

  return (
    <div className="race-screen__track-layout">
      <h3>Track Layout</h3>
      <img src={imageUrl} alt="Track Layout" className="race-screen__track-image" />
    </div>
  );
};


const RaceScreen: React.FC<RaceScreenProps> = ({ raceData, lapCount, trackStatusInfo, drsStatus }) => {
  const units = useStore((state) => state.settings.units);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const { data, error } = raceData;
  const { SessionInfo, WeatherData, LapCount: lapCountFromData, SessionStatus } = data || {};
  const circuitKey = SessionInfo?.Meeting?.Circuit?.Key;

  const weatherIcons = {
    airTemp: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>,
    trackTemp: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0Z"/></svg>,
    humidity: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>,
    rainfall: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>,
    pressure: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>,
    windSpeed: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>,
  };
  
  const infoIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  );

  const raceHelpContent = (
    <>
        <p>
            This screen provides a high-level overview of the current session, displaying key information at a glance.
        </p>
        <h3>Key Information</h3>
        <ul>
            <li><strong>Session Details:</strong> Shows the official event name, circuit, location, session type (e.g., Race, Qualifying), and current status.</li>
            <li><strong>Lap Count:</strong> Displays the current lap relative to the total number of laps in a race session.</li>
            <li><strong>Weather Conditions:</strong> Provides real-time data for air and track temperature, humidity, pressure, rainfall, and wind speed.</li>
            <li><strong>Track Layout:</strong> A visual representation of the current circuit.</li>
        </ul>
        <hr />
        <p>
            It serves as a central summary page before diving into more detailed views like the Leaderboard or Tire Strategy.
        </p>
    </>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0 }}>Race</h1>
          <span onClick={() => setIsInfoModalOpen(true)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Learn more about this screen">
              {infoIcon}
          </span>
      </div>
      <RaceStatusControl 
        lapCount={lapCount}
        trackStatusInfo={trackStatusInfo}
        drsStatus={drsStatus}
        sessionType={SessionInfo?.Type}
        sessionName={SessionInfo?.Name}
        sessionStatus={SessionStatus?.Status}
      />
      <div className="card">
        {error && <p className="error">Error fetching race data: {error}</p>}
        {!data && !error && <p className="status">Loading race data...</p>}
        {data && (
          <>
            {SessionInfo?.Meeting.OfficialName && <h2>{SessionInfo.Meeting.OfficialName}</h2>}

            <div className="race-screen__session-details">
              <p><strong>Circuit Name:</strong> {SessionInfo?.Meeting.Circuit.ShortName}</p>
              <p><strong>Location:</strong> {SessionInfo?.Meeting.Location}, {SessionInfo?.Meeting.Country.Name}</p>
              <p><strong>Session:</strong> {SessionInfo?.Type}</p>
              <p><strong>Status:</strong> {SessionStatus?.Status}</p>
              <p><strong>Current Lap:</strong> {lapCountFromData?.CurrentLap ?? 'N/A'} of {lapCountFromData?.TotalLaps ?? 'N/A'}</p>
              <p><strong>Start Time:</strong> {SessionInfo?.StartDate ? new Date(SessionInfo.StartDate).toLocaleString() : 'N/A'}</p>
              <p><strong>End Time:</strong> {SessionInfo?.EndDate ? new Date(SessionInfo.EndDate).toLocaleString() : 'N/A'}</p>
            </div>

            <div className="race-screen__weather-details">
              <h3>Weather Conditions</h3>
              <div className="race-screen__weather-grid">
                  <WeatherItem icon={weatherIcons.airTemp} label="Air Temp" value={WeatherData?.AirTemp != null ? convertTemp(Number(WeatherData.AirTemp), units).toFixed(1) : null} unit={tempUnit(units)} />
                  <WeatherItem icon={weatherIcons.trackTemp} label="Track Temp" value={WeatherData?.TrackTemp != null ? convertTemp(Number(WeatherData.TrackTemp), units).toFixed(1) : null} unit={tempUnit(units)} />
                  <WeatherItem icon={weatherIcons.humidity} label="Humidity" value={WeatherData?.Humidity} unit="%" />
                  <WeatherItem icon={weatherIcons.pressure} label="Pressure" value={WeatherData?.Pressure} unit=" hPa" />
                  <WeatherItem icon={weatherIcons.rainfall} label="Rainfall" value={WeatherData?.Rainfall === '0' ? 'No' : 'Yes'} />
                  <WeatherItem icon={weatherIcons.windSpeed} label="Wind Speed" value={WeatherData?.WindSpeed != null ? convertWindSpeed(Number(WeatherData.WindSpeed), units).toFixed(1) : null} unit={` ${windUnit(units)}`} />
              </div>
            </div>

            {circuitKey && <TrackLayout circuitKey={circuitKey} />}
          </>
        )}
      </div>
       <Modal
          isOpen={isInfoModalOpen}
          onClose={() => setIsInfoModalOpen(false)}
          title="About the Race Screen"
      >
          {raceHelpContent}
      </Modal>
    </div>
  );
};

export default RaceScreen;