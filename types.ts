// FIX: Replaced the entire file content to define and export all necessary types for the application.
// This resolves the circular dependency and missing type export errors across multiple files.

export interface Settings {
  multiviewerHost: string;
  refreshDuration: number;
  debugMode: boolean;
  displayMode: 'auto' | 'desktop' | 'tablet' | 'mobile';
  pitstopBattlegroundDuration: number;
  developerMode: boolean;
  apiOverrideUrl: string;
  units: 'metric' | 'imperial';
  defaultSpeedometerVisible: boolean;
  defaultDriverHeaderMode: 'OBC_LIVE_TIMING' | 'DRIVER_HEADER';
}

export interface FetchedData<T> {
  data: T;
  error: string | null;
  lastUpdated: Date | null;
}

export interface Subscription {
  subscriptionType: string;
  expiresAt: number;
}

export interface SystemInfo {
  platform: string;
  arch: string;
}

export interface PlayerState {
    ts: number;
    paused: boolean;
    muted: boolean;
    volume: number;
    live: boolean;
    currentTime: number;
    interpolatedCurrentTime: number;
}

export interface PlayerDriverData {
    driverNumber: string;
    tla: string;
    firstName: string;
    lastName: string;
    teamName: string;
}

export interface PlayerStreamData {
    contentId: string;
    meetingKey: string;
    sessionKey: string;
    channelId: string;
    title: string;
}

export interface PlayerBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Player {
    id: string;
    type: string;
    state: PlayerState;
    driverData: PlayerDriverData | null;
    streamData: PlayerStreamData;
    bounds: PlayerBounds | null;
    fullscreen: boolean;
    alwaysOnTop: boolean;
    maintainAspectRatio: boolean;
}

export interface F1Driver {
  RacingNumber: string;
  Tla: string;
  TeamName: string;
  TeamColour: string;
  FirstName: string;
  LastName: string;
  HeadshotUrl: string;
  Line: number;
}

export type DriverList = Record<string, F1Driver>;

export interface LapCount {
  CurrentLap: number;
  TotalLaps: number;
}

export interface TrackStatus {
  Status: string;
  Message: string;
}

export interface RaceControlMessage {
  Category: string;
  Message: string;
  Utc: string;
  Lap: number;
  Status?: string; // Optional for some messages like SafetyCar
}

export interface Stint {
  Compound: string;
  New: string;
  StartLaps: number;
  TotalLaps: number;
  LapTime?: string; // Optional
  LapNumber?: number; // Optional
}

export interface LapTime {
  Value: string;
  PersonalFastest: boolean;
  OverallFastest: boolean;
  Lap?: number;
}

export interface TimingDataLine {
  RacingNumber: string;
  Position: string;
  Retired: boolean;
  Stopped: boolean;
  InPit: boolean;
  PitOut: boolean;
  LastLapTime?: LapTime;
  BestLapTime?: LapTime;
  GapToLeader?: string;
  IntervalToPositionAhead?: {
      Value: string;
      Catching: boolean;
  };
  NumberOfPitStops?: number | string;
  MVStatus?: {
    TakenChequered: boolean;
  }
}

export type TimingData = {
  Lines: Record<string, TimingDataLine>;
};

export interface LapSeriesData {
  LapPosition: (string | null)[];
}

export interface F1LiveTimingState {
  SessionInfo: {
    Name: string;
    Type: string;
    StartDate: string;
    EndDate: string;
    GmtOffset: string;
    Meeting: {
      OfficialName: string;
      Location: string;
      Circuit: {
        Key: string | number;
        ShortName: string;
      };
      Country: {
        Name: string;
      }
    }
  };
  SessionStatus: {
    Status: string;
  };
  WeatherData: {
    AirTemp: number;
    TrackTemp: number;
    Humidity: number;
    Pressure: number;
    Rainfall: string; // '0' or '1'
    WindSpeed: number;
  };
  LapCount: LapCount;
  DriverList: DriverList;
  TrackStatus: TrackStatus;
  TimingData: TimingData;
  LapSeries: Record<string, LapSeriesData>;
  TimingAppData: {
    Lines: Record<string, { Stints: Stint[] }>
  };
  RaceControlMessages: {
    Messages: RaceControlMessage[];
  };
  WeatherDataSeries: {
    Series: WeatherDataSeriesEntry[];
  };
  ChampionshipPrediction?: ChampionshipPrediction | null;
}

export interface ChampionshipDriverPrediction {
  RacingNumber: string;
  CurrentPosition: number;
  PredictedPosition: number;
  CurrentPoints: number;
  PredictedPoints: number;
}

export interface ChampionshipTeamPrediction {
  TeamName: string;
  CurrentPosition: number;
  PredictedPosition: number;
  CurrentPoints: number;
  PredictedPoints: number;
}

export interface ChampionshipPrediction {
  Drivers: Record<string, ChampionshipDriverPrediction>;
  Teams: Record<string, ChampionshipTeamPrediction>;
}

export interface WeatherDataSeriesEntry {
  Timestamp: string;
  Weather: {
    AirTemp: string;
    TrackTemp: string;
    Humidity: string;
    Pressure: string;
    Rainfall: string;
    WindSpeed: string;
    WindDirection: string;
  };
}

export interface ApiData {
  subscription: FetchedData<Subscription | null>;
  systemInfo: FetchedData<SystemInfo | null>;
  version: FetchedData<string | null>;
  players: FetchedData<Player[]>;
  f1LiveTimingState: FetchedData<F1LiveTimingState | null>;
}

export interface PitstopData {
  Key: string;
  Name: string;
  PitstopDuration: number;
  EffectivePitDuration: number;
}

declare global {
  const __APP_VERSION__: string;
}

