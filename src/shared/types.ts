export interface AppSettings {
  apiKey: string;
  model: string;
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
}
