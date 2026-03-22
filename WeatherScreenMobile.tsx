import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FetchedData, F1LiveTimingState, LapCount, WeatherDataSeriesEntry } from './types';
import SimpleHeader from './components/SimpleHeader';
import Modal from './components/Modal';
import { useStore } from './store';
import { convertTemp, convertWindSpeed, tempUnit, windUnit } from './utils';

type WeatherScreenMobileProps = {
  f1LiveTimingState: FetchedData<F1LiveTimingState | null>;
  lapCount: LapCount | null;
  trackStatusInfo: { className: string; text: string; visible: boolean };
  drsStatus: 'ENABLED' | 'DISABLED' | string | null;
  sessionType?: string;
  sessionName?: string;
  sessionStatus?: string;
  viewName: string;
};

interface ChartConfig {
  key: keyof WeatherDataSeriesEntry['Weather'];
  label: string;
  unit: string;
  color: string;
  isBinary?: boolean;
}

const CHARTS: ChartConfig[] = [
  { key: 'WindSpeed', label: 'Wind', unit: 'km/h', color: '#5ac8fa' },
  { key: 'Rainfall', label: 'Rainfall', unit: '', color: '#ff3b30', isBinary: true },
  { key: 'Humidity', label: 'Humidity', unit: '%', color: '#34c759' },
  { key: 'Pressure', label: 'Pressure', unit: 'hPa', color: '#af52de' },
];

const CHART_HEIGHT = 120;
const CHART_PADDING = { top: 16, right: 12, bottom: 24, left: 40 };

const parseGmtOffset = (offset: string): number => {
  if (!offset) return 0;
  const sign = offset.startsWith('-') ? -1 : 1;
  const clean = offset.replace(/^[+-]/, '');
  const parts = clean.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return sign * (hours * 3600000 + minutes * 60000);
};

const formatCircuitTime = (utc: string, gmtOffsetMs: number): string => {
  try {
    const d = new Date(new Date(utc).getTime() + gmtOffsetMs);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  } catch {
    return '';
  }
};

const MobileRaceStartMarker: React.FC<{
  raceStartTime: number | null;
  data: WeatherDataSeriesEntry[];
  chartWidth: number;
  chartHeight: number;
}> = ({ raceStartTime, data, chartWidth, chartHeight }) => {
  if (raceStartTime === null || data.length < 2) return null;
  const firstTs = new Date(data[0].Timestamp).getTime();
  const lastTs = new Date(data[data.length - 1].Timestamp).getTime();
  if (raceStartTime < firstTs || raceStartTime > lastTs) return null;
  const fraction = (raceStartTime - firstTs) / (lastTs - firstTs);
  const x = CHART_PADDING.left + fraction * chartWidth;
  return (
    <line
      x1={x} x2={x}
      y1={CHART_PADDING.top}
      y2={CHART_PADDING.top + chartHeight}
      stroke="var(--text-secondary)"
      strokeWidth="1"
      strokeDasharray="3 2"
    />
  );
};

const CombinedTempChart: React.FC<{
  data: WeatherDataSeriesEntry[];
  width: number;
  gmtOffsetMs: number;
  raceStartTime: number | null;
  units: 'metric' | 'imperial';
}> = ({ data, width, gmtOffsetMs, raceStartTime, units }) => {
  const airValues = useMemo(() =>
    data.map(d => convertTemp(parseFloat(d.Weather.AirTemp) || 0, units)),
  [data, units]);

  const trackValues = useMemo(() =>
    data.map(d => convertTemp(parseFloat(d.Weather.TrackTemp) || 0, units)),
  [data, units]);

  const { minVal, maxVal, yTicks } = useMemo(() => {
    const all = [...airValues, ...trackValues];
    if (all.length === 0) return { minVal: 0, maxVal: 1, yTicks: [0, 1] };

    const rawMin = Math.min(...all);
    const rawMax = Math.max(...all);
    const rawRange = rawMax - rawMin || 1;

    const niceMin = Math.floor(rawMin - rawRange * 0.1);
    const niceMax = Math.ceil(rawMax + rawRange * 0.1);
    const tickCount = 3;
    const rawStep = (niceMax - niceMin) / tickCount;
    const step = Math.max(1, Math.ceil(rawStep));
    const min = niceMin;
    const max = min + step * tickCount;

    const ticks: number[] = [];
    for (let i = 0; i <= tickCount; i++) ticks.push(min + step * i);
    return { minVal: min, maxVal: max, yTicks: ticks };
  }, [airValues, trackValues]);

  const chartWidth = width - CHART_PADDING.left - CHART_PADDING.right;
  const chartHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  const unit = tempUnit(units);
  const currentAir = airValues.length > 0 ? airValues[airValues.length - 1] : null;
  const currentTrack = trackValues.length > 0 ? trackValues[trackValues.length - 1] : null;

  if (data.length < 2 || chartWidth <= 0) {
    return (
      <div className="weather-mobile__chart">
        <div className="weather-mobile__chart-header">
          <span className="weather-mobile__chart-label">Temp</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {currentAir !== null && <span className="weather-mobile__chart-value" style={{ color: '#3478f6' }}>{currentAir.toFixed(1)}{unit}</span>}
            {currentTrack !== null && <span className="weather-mobile__chart-value" style={{ color: '#ff9500' }}>{currentTrack.toFixed(1)}{unit}</span>}
          </div>
        </div>
      </div>
    );
  }

  const xScale = (i: number) => CHART_PADDING.left + (i / (data.length - 1)) * chartWidth;
  const yScale = (v: number) => CHART_PADDING.top + (1 - (v - minVal) / (maxVal - minVal)) * chartHeight;

  const buildPath = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`).join(' ');

  const buildArea = (values: number[]) => {
    const line = buildPath(values);
    return line +
      ` L ${xScale(values.length - 1).toFixed(1)},${(CHART_PADDING.top + chartHeight).toFixed(1)}` +
      ` L ${xScale(0).toFixed(1)},${(CHART_PADDING.top + chartHeight).toFixed(1)} Z`;
  };

  const timeLabels: { x: number; label: string }[] = [];
  const labelCount = Math.min(3, data.length);
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.round((i / (labelCount - 1)) * (data.length - 1));
    timeLabels.push({ x: xScale(idx), label: formatCircuitTime(data[idx].Timestamp, gmtOffsetMs) });
  }

  return (
    <div className="weather-mobile__chart">
      <div className="weather-mobile__chart-header">
        <div>
          <span className="weather-mobile__chart-label">Temp</span>
          <div className="weather-mobile__chart-legend">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <span style={{ width: 12, height: 2, background: '#3478f6', display: 'inline-block' }} />
              <span>Air</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <span style={{ width: 12, height: 2, background: '#ff9500', display: 'inline-block' }} />
              <span>Track</span>
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="weather-mobile__chart-value" style={{ color: '#3478f6' }}>{currentAir!.toFixed(1)}{unit}</span>
          <span className="weather-mobile__chart-value" style={{ color: '#ff9500' }}>{currentTrack!.toFixed(1)}{unit}</span>
        </div>
      </div>
      <svg width={width} height={CHART_HEIGHT} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="gradient-mobile-air-temp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3478f6" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#3478f6" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="gradient-mobile-track-temp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff9500" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#ff9500" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={CHART_PADDING.left}
              x2={width - CHART_PADDING.right}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="var(--border-color)"
              strokeWidth="0.5"
              strokeDasharray={i === 0 || i === yTicks.length - 1 ? 'none' : '3 3'}
            />
            <text x={CHART_PADDING.left - 4} y={yScale(tick) + 3} textAnchor="end" fontSize="9" fill="var(--text-secondary)">
              {tick.toFixed(0)}
            </text>
          </g>
        ))}

        <path d={buildArea(trackValues)} fill="url(#gradient-mobile-track-temp)" />
        <path d={buildArea(airValues)} fill="url(#gradient-mobile-air-temp)" />
        <path d={buildPath(trackValues)} fill="none" stroke="#ff9500" strokeWidth="1.5" strokeLinejoin="round" />
        <path d={buildPath(airValues)} fill="none" stroke="#3478f6" strokeWidth="1.5" strokeLinejoin="round" />

        <MobileRaceStartMarker raceStartTime={raceStartTime} data={data} chartWidth={chartWidth} chartHeight={chartHeight} />

        {timeLabels.map((t, i) => (
          <text key={i} x={t.x} y={CHART_HEIGHT - 4} textAnchor="middle" fontSize="9" fill="var(--text-secondary)">
            {t.label}
          </text>
        ))}
      </svg>
    </div>
  );
};

const WeatherChart: React.FC<{
  data: WeatherDataSeriesEntry[];
  config: ChartConfig;
  width: number;
  gmtOffsetMs: number;
  raceStartTime: number | null;
  units: 'metric' | 'imperial';
}> = ({ data, config, width, gmtOffsetMs, raceStartTime, units }) => {
  const { key, label, color, isBinary } = config;

  const displayUnit = key === 'WindSpeed' ? windUnit(units) : config.unit;

  const values = useMemo(() => {
    const raw = data.map(d => parseFloat(d.Weather[key]) || 0);
    if (key === 'WindSpeed') return raw.map(v => convertWindSpeed(v, units));
    return raw;
  }, [data, key, units]);

  const { minVal, maxVal, yTicks } = useMemo(() => {
    if (values.length === 0) return { minVal: 0, maxVal: 1, yTicks: [0, 1] };
    if (isBinary) return { minVal: 0, maxVal: 1, yTicks: [0, 1] };

    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const rawRange = rawMax - rawMin || 1;

    const niceMin = Math.floor(rawMin - rawRange * 0.1);
    const niceMax = Math.ceil(rawMax + rawRange * 0.1);
    const tickCount = 3;
    const rawStep = (niceMax - niceMin) / tickCount;
    const step = Math.max(1, Math.ceil(rawStep));
    const min = niceMin;
    const max = min + step * tickCount;

    const ticks: number[] = [];
    for (let i = 0; i <= tickCount; i++) ticks.push(min + step * i);
    return { minVal: min, maxVal: max, yTicks: ticks };
  }, [values, isBinary]);

  const chartWidth = width - CHART_PADDING.left - CHART_PADDING.right;
  const chartHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  const currentValue = values.length > 0 ? values[values.length - 1] : null;
  const currentDisplay = currentValue !== null
    ? (isBinary ? (currentValue === 1 ? 'Yes' : 'No') : `${currentValue.toFixed(1)} ${displayUnit}`)
    : '';

  if (data.length < 2 || chartWidth <= 0) {
    return (
      <div className="weather-mobile__chart">
        <div className="weather-mobile__chart-header">
          <span className="weather-mobile__chart-label">{label}</span>
          <span className="weather-mobile__chart-value" style={{ color }}>{currentDisplay}</span>
        </div>
      </div>
    );
  }

  const xScale = (i: number) => CHART_PADDING.left + (i / (data.length - 1)) * chartWidth;
  const yScale = (v: number) => CHART_PADDING.top + (1 - (v - minVal) / (maxVal - minVal)) * chartHeight;

  const linePath = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`)
    .join(' ');

  const areaPath = linePath +
    ` L ${xScale(values.length - 1).toFixed(1)},${(CHART_PADDING.top + chartHeight).toFixed(1)}` +
    ` L ${xScale(0).toFixed(1)},${(CHART_PADDING.top + chartHeight).toFixed(1)} Z`;

  const timeLabels: { x: number; label: string }[] = [];
  const labelCount = Math.min(3, data.length);
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.round((i / (labelCount - 1)) * (data.length - 1));
    timeLabels.push({ x: xScale(idx), label: formatCircuitTime(data[idx].Timestamp, gmtOffsetMs) });
  }

  const gradientId = `gradient-mobile-${key}`;

  return (
    <div className="weather-mobile__chart">
      <div className="weather-mobile__chart-header">
        <span className="weather-mobile__chart-label">{label}</span>
        <span className="weather-mobile__chart-value" style={{ color }}>{currentDisplay}</span>
      </div>
      <svg width={width} height={CHART_HEIGHT} style={{ display: 'block' }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={CHART_PADDING.left}
              x2={width - CHART_PADDING.right}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="var(--border-color)"
              strokeWidth="0.5"
              strokeDasharray={i === 0 || i === yTicks.length - 1 ? 'none' : '3 3'}
            />
            <text x={CHART_PADDING.left - 4} y={yScale(tick) + 3} textAnchor="end" fontSize="9" fill="var(--text-secondary)">
              {isBinary ? (tick === 0 ? 'No' : 'Yes') : tick.toFixed(0)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />

        <MobileRaceStartMarker raceStartTime={raceStartTime} data={data} chartWidth={chartWidth} chartHeight={chartHeight} />

        {timeLabels.map((t, i) => (
          <text key={i} x={t.x} y={CHART_HEIGHT - 4} textAnchor="middle" fontSize="9" fill="var(--text-secondary)">
            {t.label}
          </text>
        ))}
      </svg>
    </div>
  );
};

const WeatherScreenMobile: React.FC<WeatherScreenMobileProps> = ({
  f1LiveTimingState,
  lapCount,
  trackStatusInfo,
  drsStatus,
  sessionType,
  sessionName,
  sessionStatus,
  viewName,
}) => {
  const units = useStore((state) => state.settings.units);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [chartWidth, setChartWidth] = useState(300);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setChartWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const currentWeather = f1LiveTimingState.data?.WeatherData;
  const weatherSeries = f1LiveTimingState.data?.WeatherDataSeries?.Series;
  const hasSeriesData = weatherSeries && weatherSeries.length > 0;

  const gmtOffsetMs = parseGmtOffset(f1LiveTimingState.data?.SessionInfo?.GmtOffset || '');

  const raceStartTime = useMemo(() => {
    const startDate = f1LiveTimingState.data?.SessionInfo?.StartDate;
    if (!startDate) return null;
    const asUTC = startDate.endsWith('Z') ? startDate : startDate + 'Z';
    const ms = new Date(asUTC).getTime();
    if (isNaN(ms)) return null;
    return ms - gmtOffsetMs;
  }, [f1LiveTimingState.data?.SessionInfo?.StartDate, gmtOffsetMs]);

  const helpContent = (
    <>
      <p>Weather conditions throughout the session. Each chart shows a metric over time.</p>
      <p>The current value is shown in the top-right of each chart. A dashed line marks the race start time.</p>
    </>
  );

  return (
    <div className="weather-mobile-container">
      <SimpleHeader
        lapCount={lapCount}
        trackStatusInfo={trackStatusInfo}
        drsStatus={drsStatus}
        sessionType={sessionType}
        sessionName={sessionName}
        sessionStatus={sessionStatus}
        viewName={viewName}
        onInfoClick={() => setIsInfoModalOpen(true)}
      />

      {currentWeather && (
        <div className="card weather-mobile-card">
          <div className="weather-mobile__current-grid">
            <div className="weather-mobile__current-item">
              <span className="weather-mobile__current-label">Air</span>
              <span className="weather-mobile__current-value">{convertTemp(Number(currentWeather.AirTemp), units).toFixed(1)}{tempUnit(units)}</span>
            </div>
            <div className="weather-mobile__current-item">
              <span className="weather-mobile__current-label">Track</span>
              <span className="weather-mobile__current-value">{convertTemp(Number(currentWeather.TrackTemp), units).toFixed(1)}{tempUnit(units)}</span>
            </div>
            <div className="weather-mobile__current-item">
              <span className="weather-mobile__current-label">Humid</span>
              <span className="weather-mobile__current-value">{currentWeather.Humidity}%</span>
            </div>
            <div className="weather-mobile__current-item">
              <span className="weather-mobile__current-label">Rain</span>
              <span className="weather-mobile__current-value">{currentWeather.Rainfall === '0' ? 'No' : 'Yes'}</span>
            </div>
            <div className="weather-mobile__current-item">
              <span className="weather-mobile__current-label">Wind</span>
              <span className="weather-mobile__current-value">{convertWindSpeed(Number(currentWeather.WindSpeed), units).toFixed(1)} {windUnit(units)}</span>
            </div>
            <div className="weather-mobile__current-item">
              <span className="weather-mobile__current-label">Press</span>
              <span className="weather-mobile__current-value">{currentWeather.Pressure}</span>
            </div>
          </div>
        </div>
      )}

      <div className="card weather-mobile-card" ref={containerRef}>
        {!hasSeriesData ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Weather data will appear once the session produces updates.
          </p>
        ) : (
          <div className="weather-mobile__charts">
            <CombinedTempChart
              data={weatherSeries}
              width={chartWidth}
              gmtOffsetMs={gmtOffsetMs}
              raceStartTime={raceStartTime}
              units={units}
            />
            {CHARTS.map(config => (
              <WeatherChart
                key={config.key}
                data={weatherSeries}
                config={config}
                width={chartWidth}
                gmtOffsetMs={gmtOffsetMs}
                raceStartTime={raceStartTime}
                units={units}
              />
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title="Weather">
        {helpContent}
      </Modal>
    </div>
  );
};

export default WeatherScreenMobile;
