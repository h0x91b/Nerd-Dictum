export type HoldToRecordKey =
  | 'LeftControl'
  | 'RightControl'
  | 'LeftAlt'
  | 'RightAlt'
  | 'LeftMeta'
  | 'RightMeta'
  | 'LeftShift'
  | 'RightShift';

export type TranscriptionMode = 'live' | 'classic';

export const LIVE_VOICES = [
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda',
  'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus',
  'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi',
  'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima',
  'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat',
] as const;

export const LIVE_VOICE_DESCRIPTIONS: Record<string, string> = {
  Zephyr: 'Bright', Puck: 'Upbeat', Charon: 'Informative',
  Kore: 'Firm', Fenrir: 'Excitable', Leda: 'Youthful',
  Orus: 'Firm', Aoede: 'Breezy', Callirrhoe: 'Easy-going',
  Autonoe: 'Bright', Enceladus: 'Breathy', Iapetus: 'Clear',
  Umbriel: 'Easy-going', Algieba: 'Smooth', Despina: 'Smooth',
  Erinome: 'Clear', Algenib: 'Gravelly', Rasalgethi: 'Informative',
  Laomedeia: 'Upbeat', Achernar: 'Soft', Alnilam: 'Firm',
  Schedar: 'Even', Gacrux: 'Mature', Pulcherrima: 'Forward',
  Achird: 'Friendly', Zubenelgenubi: 'Casual', Vindemiatrix: 'Gentle',
  Sadachbia: 'Lively', Sadaltager: 'Knowledgeable', Sulafat: 'Warm',
};

export interface AppSettings {
  apiKey: string;
  model: string;
  transcriptionMode: TranscriptionMode;
  liveModel: string;
  liveVoice: string;
  livePlaybackVolume: number; // 0-100, proportion of system volume
  liveSkipPlayback: boolean;
  languages: string[];
  speechDomain: string;
  customDomainHint: string;
  customKeywords: string;
  microphoneDeviceId: string;
  silenceDetectionEnabled: boolean;
  silenceDurationMs: number;
  launchAtStartup: boolean;
  clarificationEnabled: boolean;
  previousTranscriptContextEnabled: boolean;
  soundEnabled: boolean;
  hotkey: string;
  widgetHidden: boolean;
  holdToRecordEnabled: boolean;
  holdToRecordKey: HoldToRecordKey;
}

export interface DailyStats {
  date: string; // ISO format: "2025-01-15"
  transcriptions: number;
  words: number;
  characters: number;
  recordingTimeMs: number;
}

export interface StatsData {
  totalTranscriptions: number;
  totalWords: number;
  totalCharacters: number;
  totalRecordingTimeMs: number;
  firstUseDate: string; // ISO date
  lastUseDate: string; // ISO date
  dailyStats: DailyStats[];
}

export interface DerivedStats {
  averageWordsPerTranscription: number;
  mostActiveDay: string;
  timeSavedSeconds: number;
}

export type StatsWithDerived = StatsData & DerivedStats;
