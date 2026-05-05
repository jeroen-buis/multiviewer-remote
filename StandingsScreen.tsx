import React, { useMemo, useState } from 'react';
import { F1LiveTimingState, FetchedData, F1Driver, ChampionshipDriverPrediction, ChampionshipTeamPrediction } from './types';
import Modal from './components/Modal';

type StandingsScreenProps = {
  f1LiveTimingState: FetchedData<F1LiveTimingState | null>;
};

type Tab = 'drivers' | 'teams';

const PositionChange: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  if (from === to) {
    return <span className="standings__pos-change standings__pos-change--same">—</span>;
  }
  const diff = from - to; // positive = gained positions
  const direction = diff > 0 ? 'up' : 'down';
  const arrow = diff > 0 ? '▲' : '▼';
  return (
    <span className={`standings__pos-change standings__pos-change--${direction}`}>
      {arrow} {Math.abs(diff)}
    </span>
  );
};

const PointsDelta: React.FC<{ current: number; predicted: number }> = ({ current, predicted }) => {
  const delta = predicted - current;
  if (delta === 0) return <span className="standings__points-delta">—</span>;
  return (
    <span className="standings__points-delta standings__points-delta--gain">+{delta}</span>
  );
};

const StandingsScreen: React.FC<StandingsScreenProps> = ({ f1LiveTimingState }) => {
  const [activeTab, setActiveTab] = useState<Tab>('drivers');
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const prediction = f1LiveTimingState.data?.ChampionshipPrediction;
  const driverList = f1LiveTimingState.data?.DriverList;
  const error = f1LiveTimingState.error;

  const driversSorted = useMemo<ChampionshipDriverPrediction[]>(() => {
    if (!prediction?.Drivers) return [];
    return Object.values(prediction.Drivers).sort((a, b) => a.PredictedPosition - b.PredictedPosition);
  }, [prediction]);

  const teamsSorted = useMemo<ChampionshipTeamPrediction[]>(() => {
    if (!prediction?.Teams) return [];
    return Object.values(prediction.Teams).sort((a, b) => a.PredictedPosition - b.PredictedPosition);
  }, [prediction]);

  const driverByNumber = useMemo<Record<string, F1Driver>>(() => {
    const map: Record<string, F1Driver> = {};
    if (driverList) {
      Object.values(driverList).forEach((d) => {
        if (d?.RacingNumber) map[d.RacingNumber] = d;
      });
    }
    return map;
  }, [driverList]);

  const infoIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  );

  const helpContent = (
    <>
      <p>
        The Standings screen shows the live championship picture, both as it stands right now and as MultiViewer predicts it will end after the current race weekend.
      </p>
      <h3>Drivers / Teams</h3>
      <ul>
        <li><strong>Pos:</strong> Predicted final position after the current session.</li>
        <li><strong>Δ:</strong> Position change from the current standing — green up arrow means moving up, red down arrow means losing places, dash means unchanged.</li>
        <li><strong>Points (now → predicted):</strong> Current points and the predicted total. The chip on the right shows the points the driver / team is on track to gain.</li>
      </ul>
      <p>
        The prediction comes directly from MultiViewer's live timing feed; if the championship feed isn't broadcasting yet (e.g., before a race starts), the screen will show a placeholder.
      </p>
    </>
  );

  const renderDrivers = () => (
    <div className="standings-table">
      <div className="standings-table__head">
        <div className="standings-table__cell standings-table__cell--pos">Pos</div>
        <div className="standings-table__cell standings-table__cell--delta">Δ</div>
        <div className="standings-table__cell standings-table__cell--name">Driver</div>
        <div className="standings-table__cell standings-table__cell--num">Current</div>
        <div className="standings-table__cell standings-table__cell--num">Predicted</div>
        <div className="standings-table__cell standings-table__cell--num">Gain</div>
      </div>
      {driversSorted.map((d) => {
        const driver = driverByNumber[d.RacingNumber];
        const teamColor = driver?.TeamColour ? `#${driver.TeamColour}` : 'var(--border-color)';
        return (
          <div key={d.RacingNumber} className="standings-table__row">
            <div className="standings-table__cell standings-table__cell--pos">{d.PredictedPosition}</div>
            <div className="standings-table__cell standings-table__cell--delta">
              <PositionChange from={d.CurrentPosition} to={d.PredictedPosition} />
            </div>
            <div className="standings-table__cell standings-table__cell--name">
              <span className="standings-table__team-bar" style={{ backgroundColor: teamColor }} />
              <span className="standings-table__driver-num">#{d.RacingNumber}</span>
              <span className="standings-table__driver-tla">{driver?.Tla ?? d.RacingNumber}</span>
              <span className="standings-table__driver-fullname">
                {driver ? `${driver.FirstName} ${driver.LastName}` : ''}
              </span>
            </div>
            <div className="standings-table__cell standings-table__cell--num">{d.CurrentPoints}</div>
            <div className="standings-table__cell standings-table__cell--num">{d.PredictedPoints}</div>
            <div className="standings-table__cell standings-table__cell--num">
              <PointsDelta current={d.CurrentPoints} predicted={d.PredictedPoints} />
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderTeams = () => (
    <div className="standings-table">
      <div className="standings-table__head">
        <div className="standings-table__cell standings-table__cell--pos">Pos</div>
        <div className="standings-table__cell standings-table__cell--delta">Δ</div>
        <div className="standings-table__cell standings-table__cell--name">Team</div>
        <div className="standings-table__cell standings-table__cell--num">Current</div>
        <div className="standings-table__cell standings-table__cell--num">Predicted</div>
        <div className="standings-table__cell standings-table__cell--num">Gain</div>
      </div>
      {teamsSorted.map((t) => (
        <div key={t.TeamName} className="standings-table__row">
          <div className="standings-table__cell standings-table__cell--pos">{t.PredictedPosition}</div>
          <div className="standings-table__cell standings-table__cell--delta">
            <PositionChange from={t.CurrentPosition} to={t.PredictedPosition} />
          </div>
          <div className="standings-table__cell standings-table__cell--name">
            <span className="standings-table__team-name">{t.TeamName}</span>
          </div>
          <div className="standings-table__cell standings-table__cell--num">{t.CurrentPoints}</div>
          <div className="standings-table__cell standings-table__cell--num">{t.PredictedPoints}</div>
          <div className="standings-table__cell standings-table__cell--num">
            <PointsDelta current={t.CurrentPoints} predicted={t.PredictedPoints} />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <h1 style={{ margin: 0 }}>Standings</h1>
        <span onClick={() => setIsInfoModalOpen(true)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Learn more about this screen">
          {infoIcon}
        </span>
      </div>

      <div className="card">
        <div className="standings__tabs">
          <button
            className={`standings__tab-button ${activeTab === 'drivers' ? 'active' : ''}`}
            onClick={() => setActiveTab('drivers')}
          >
            Drivers
          </button>
          <button
            className={`standings__tab-button ${activeTab === 'teams' ? 'active' : ''}`}
            onClick={() => setActiveTab('teams')}
          >
            Teams
          </button>
        </div>

        {error && <p className="error">Error fetching standings: {error}</p>}
        {!prediction && !error && (
          <p className="status">
            Championship prediction data isn't available yet. It is broadcast during a race weekend
            and will appear here once MultiViewer starts publishing it.
          </p>
        )}
        {prediction && activeTab === 'drivers' && renderDrivers()}
        {prediction && activeTab === 'teams' && renderTeams()}
      </div>

      <Modal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        title="About the Standings Screen"
      >
        {helpContent}
      </Modal>
    </div>
  );
};

export default StandingsScreen;
