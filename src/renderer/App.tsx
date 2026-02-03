import { useState, useRef, useEffect, useCallback } from 'react';
import './styles/App.css';
import { AudioRecorder, AudioRecorderOptions, DEFAULT_SILENCE_DURATION_MS } from '../lib/audio';
import { transcribeAudio, TranscribeOptions, TranscriptionCancelledError } from '../lib/gemini';
import { classifyError, ClassifiedError } from '../lib/errors';
import { playSuccessSound, playErrorSound } from '../lib/sounds';
import { SettingsButton } from './components/Settings';
import { InfoButton } from './components/InfoButton';
import { HideButton } from './components/HideButton';
import { StatsButton } from './components/StatsButton';
import { AudioLevelRing } from './components/AudioLevelRing';
import type { AppSettings, HoldToRecordKey } from './types/electron';

const MESSAGE_TIMEOUT_MS = 2000;
const RETRY_MESSAGE_TIMEOUT_MS = 4000;
const SUCCESS_STATE_TIMEOUT_MS = 5000;
const HINT_DISPLAY_MS = 10000; // How long to show each hint before sliding
const HINT_SLIDE_MS = 400; // Slide transition duration

// Audio level smoothing
const AUDIO_LEVEL_LERP_UP = 0.8;   // Very fast rise

// Hold-to-record key display symbols (R/L prefix = right/left)
const HOLD_KEY_SYMBOLS: Record<HoldToRecordKey, string> = {
  RightMeta: 'R⌘',
  LeftMeta: 'L⌘',
  RightAlt: 'R⌥',
  LeftAlt: 'L⌥',
  RightControl: 'R⌃',
  LeftControl: 'L⌃',
  RightShift: 'R⇧',
  LeftShift: 'L⇧',
};

// Format Electron accelerator to compact symbol form for hint display
function formatHotkeyCompact(accelerator: string): string {
  return accelerator
    .replace(/CommandOrControl\+/g, '⌘')
    .replace(/Command\+/g, '⌘')
    .replace(/Control\+/g, '⌃')
    .replace(/Alt\+/g, '⌥')
    .replace(/Shift\+/g, '⇧')
    .replace(/\+/g, '');
}

function buildTranscribeOptions(settings: AppSettings, previousTranscripts?: string[]): TranscribeOptions {
  const options: TranscribeOptions = {};
  if (settings.languages && settings.languages.length > 0) {
    options.languages = settings.languages;
  }
  if (settings.speechDomain) {
    options.speechDomain = settings.speechDomain;
  }
  if (settings.customDomainHint) {
    options.customDomainHint = settings.customDomainHint;
  }
  if (settings.customKeywords) {
    options.customKeywords = settings.customKeywords;
  }
  options.clarificationEnabled = settings.clarificationEnabled ?? true;
  // Add previous transcripts as context if enabled and available
  if ((settings.previousTranscriptContextEnabled ?? true) && previousTranscripts && previousTranscripts.length > 0) {
    options.previousTranscripts = previousTranscripts;
  }
  return options;
}

function buildRecorderOptions(settings: AppSettings): AudioRecorderOptions {
  return {
    deviceId: settings.microphoneDeviceId || undefined,
    silenceDetectionEnabled: settings.silenceDetectionEnabled ?? true,
    silenceDurationMs: settings.silenceDurationMs || DEFAULT_SILENCE_DURATION_MS,
  };
}

type AppState = 'idle' | 'recording' | 'transcribing' | 'success';
type MessageType = 'success' | 'error';

interface FlashMessage {
  text: string;
  type: MessageType;
  isRetryable: boolean;
}

export function App() {
  const [state, setState] = useState<AppState>('idle');
  const [message, setMessage] = useState<FlashMessage | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [appVersion, setAppVersion] = useState<string>('');
  const [hotkey, setHotkey] = useState<string>('CommandOrControl+Shift+R');
  const [holdToRecordEnabled, setHoldToRecordEnabled] = useState<boolean>(true);
  const [holdToRecordKey, setHoldToRecordKey] = useState<HoldToRecordKey>('RightMeta');
  const [hintIndex, setHintIndex] = useState<number>(0);
  const [hintSliding, setHintSliding] = useState<boolean>(false);
  const audioLevelRef = useRef<number>(0); // For lerp smoothing
  const recorderRef = useRef<AudioRecorder | null>(null);
  const lastAudioRef = useRef<string | null>(null);
  const lastRecordingDurationRef = useRef<number>(0); // For stats tracking
  const recordingStartTimeRef = useRef<number>(0); // For tracking recording duration
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcribeAbortRef = useRef<AbortController | null>(null);
  const transcribeRequestIdRef = useRef(0);

  const showMessage = useCallback((text: string, type: MessageType = 'success', isRetryable = false) => {
    // Clear any existing timeout
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    setMessage({ text, type, isRetryable });
    // Error messages with retry stay longer
    const duration = type === 'error' && isRetryable ? RETRY_MESSAGE_TIMEOUT_MS : MESSAGE_TIMEOUT_MS;
    messageTimeoutRef.current = setTimeout(() => setMessage(null), duration);
  }, []);

  const showError = useCallback((error: unknown) => {
    const classified: ClassifiedError = classifyError(error);
    showMessage(classified.message, 'error', classified.isRetryable);
    return classified;
  }, [showMessage]);

  const transcribeWithRetry = useCallback(async (audioBase64: string) => {
    // Increment first, atomically determine our ID
    transcribeRequestIdRef.current += 1;
    const requestId = transcribeRequestIdRef.current;

    // Cancel any existing transcription before starting new one
    if (transcribeAbortRef.current) {
      transcribeAbortRef.current.abort();
    }

    setState('transcribing');
    const controller = new AbortController();
    transcribeAbortRef.current = controller;

    // Track soundEnabled for use in both success and error paths
    let soundEnabled = true;

    try {
      // Get settings from main process
      const settings = await window.electronAPI.getSettings();
      soundEnabled = settings.soundEnabled ?? true;

      if (requestId !== transcribeRequestIdRef.current) {
        return;
      }

      if (!settings.apiKey) {
        showMessage('Set API key in settings', 'error', true);
        window.electronAPI.openSettingsWindow();
        // Save audio for retry after setting API key
        lastAudioRef.current = audioBase64;
        setState('idle');
        return;
      }

      // Get previous transcripts for context if enabled
      let previousTranscripts: string[] = [];
      if (settings.previousTranscriptContextEnabled ?? true) {
        previousTranscripts = await window.electronAPI.getRecentTranscripts();
      }

      const options = buildTranscribeOptions(settings, previousTranscripts);
      // Transcribe audio
      const transcript = await transcribeAudio(audioBase64, settings.apiKey, settings.model, {
        ...options,
        signal: controller.signal,
      });

      if (requestId !== transcribeRequestIdRef.current) {
        return;
      }

      console.log('[Transcript]', transcript);

      // Copy to clipboard
      await window.electronAPI.copyToClipboard(transcript);
      if (requestId !== transcribeRequestIdRef.current) {
        return;
      }
      showMessage('Copied to clipboard', 'success');
      window.electronAPI.trackEvent('transcription_success', { transcript_length: transcript.length });

      // Record stats for this transcription
      await window.electronAPI.recordTranscriptionStats(transcript, lastRecordingDurationRef.current);

      // Play success sound if enabled
      if (soundEnabled) {
        playSuccessSound();
      }

      // Clear saved audio on success
      lastAudioRef.current = null;

      // Show success state for 5 seconds, then fade to idle
      setState('success');
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setState('idle');
      }, SUCCESS_STATE_TIMEOUT_MS);
    } catch (error) {
      if (requestId !== transcribeRequestIdRef.current || error instanceof TranscriptionCancelledError) {
        return;
      }

      const classified = showError(error);
      window.electronAPI.trackEvent('transcription_error', { error_type: classified.type });

      // Play error sound if enabled
      if (soundEnabled) {
        playErrorSound();
      }

      // Save audio for retry only if error is retryable
      if (classified.isRetryable) {
        lastAudioRef.current = audioBase64;
      } else {
        lastAudioRef.current = null;
      }
      setState('idle');
    } finally {
      if (transcribeAbortRef.current === controller) {
        transcribeAbortRef.current = null;
      }
    }
  }, [showError, showMessage]);

  const handleRetry = useCallback(async () => {
    if (lastAudioRef.current && state === 'idle') {
      await transcribeWithRetry(lastAudioRef.current);
    }
  }, [state, transcribeWithRetry]);

  const stopRecordingAndTranscribe = useCallback(async () => {
    // Use recorder's internal state to avoid stale closure issues
    if (!recorderRef.current || !recorderRef.current.getIsRecording()) return;

    // Reset audio level visualization
    audioLevelRef.current = 0;
    setAudioLevel(0);

    try {
      const audioBase64 = await recorderRef.current.stop();
      const recordingDuration = Date.now() - recordingStartTimeRef.current;
      lastRecordingDurationRef.current = recordingDuration; // Save for stats
      console.log('[Recording] Stopped');
      window.electronAPI.trackEvent('recording_stop', { duration_ms: recordingDuration });
      // Resume media playback immediately after recording stops (before transcription)
      window.electronAPI.resumeMedia();
      await transcribeWithRetry(audioBase64);
    } catch (error) {
      // Recording stop error (too short, etc.)
      showError(error);
      // Resume media playback on recording error
      window.electronAPI.resumeMedia();
      setState('idle');
    }
  }, [transcribeWithRetry, showError]);

  const cancelTranscription = useCallback(() => {
    if (state !== 'transcribing') return;

    const controller = transcribeAbortRef.current;
    transcribeAbortRef.current = null;
    transcribeRequestIdRef.current += 1;
    lastAudioRef.current = null;

    if (controller) {
      controller.abort();
    }

    console.log('[TEST] Transcription cancelled by user');
    setState('idle');
  }, [state]);

  // Start recording (extracted for hold-to-record)
  const startRecording = useCallback(async () => {
    if (state !== 'idle' && state !== 'success') return;

    // Clear any pending retry audio when starting new recording
    lastAudioRef.current = null;
    // Clear success timeout if transitioning from success state
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }

    // Pause any playing media
    window.electronAPI.pauseMedia();

    try {
      // Check and request microphone permission on macOS
      const permissionStatus = await window.electronAPI.getMicrophonePermissionStatus();
      console.log('[Permission] Microphone status:', permissionStatus);

      if (permissionStatus === 'denied' || permissionStatus === 'restricted') {
        showMessage('Microphone access denied. Enable in System Preferences.', 'error', false);
        window.electronAPI.resumeMedia();
        return;
      }

      if (permissionStatus === 'not-determined') {
        const granted = await window.electronAPI.requestMicrophonePermission();
        if (!granted) {
          showMessage('Microphone permission required', 'error', false);
          window.electronAPI.resumeMedia();
          return;
        }
      }

      // Get audio settings
      const settings = await window.electronAPI.getSettings();
      const recorderOptions = buildRecorderOptions(settings);
      recorderRef.current = new AudioRecorder(undefined, recorderOptions);
      // Set up silence detection callback for auto-stop
      recorderRef.current.setOnSilenceStop(() => {
        stopRecordingAndTranscribe();
      });
      // Set up audio level callback for visualization with smoothing
      recorderRef.current.setOnAudioLevel((level) => {
        const current = audioLevelRef.current;
        let smoothed: number;

        if (level > current) {
          // Rising: simple lerp, fast
          smoothed = current + (level - current) * AUDIO_LEVEL_LERP_UP;
        } else {
          // Falling: easeOut - faster at start, slower at end
          const diff = current - level;
          const easeOutFactor = 0.3 + diff * 0.6; // 0.3 base + up to 0.6 more based on distance
          smoothed = current - diff * Math.min(easeOutFactor, 0.85);
        }

        audioLevelRef.current = smoothed;
        setAudioLevel(smoothed);
      });
      await recorderRef.current.start();
      console.log('[Recording] Started');
      recordingStartTimeRef.current = Date.now();
      window.electronAPI.trackEvent('recording_start');
      setState('recording');
    } catch (error) {
      showError(error);
      window.electronAPI.resumeMedia();
    }
  }, [state, showError, showMessage, stopRecordingAndTranscribe]);

  const handleToggleRecording = useCallback(async () => {
    if (state === 'idle' || state === 'success') {
      await startRecording();
    } else if (state === 'recording') {
      await stopRecordingAndTranscribe();
    } else if (state === 'transcribing') {
      cancelTranscription();
    }
  }, [state, startRecording, stopRecordingAndTranscribe, cancelTranscription]);

  // Listen for global keyboard shortcut (toggle mode)
  useEffect(() => {
    const unsubscribe = window.electronAPI.onToggleRecording(() => {
      handleToggleRecording();
    });
    return () => {
      unsubscribe();
    };
  }, [handleToggleRecording, state]);

  // Listen for hold-to-record start event
  useEffect(() => {
    const unsubscribe = window.electronAPI.onStartRecording(() => {
      startRecording();
    });
    return () => {
      unsubscribe();
    };
  }, [startRecording]);

  // Listen for hold-to-record stop event
  useEffect(() => {
    const unsubscribe = window.electronAPI.onStopRecording(() => {
      if (recorderRef.current?.getIsRecording()) {
        stopRecordingAndTranscribe();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [stopRecordingAndTranscribe]);

  // Load app version on mount
  useEffect(() => {
    window.electronAPI.getAppVersion().then(setAppVersion);
  }, []);

  // Load hotkey settings for hint display
  useEffect(() => {
    window.electronAPI.getSettings().then((settings) => {
      setHotkey(settings.hotkey || 'CommandOrControl+Shift+R');
      setHoldToRecordEnabled(settings.holdToRecordEnabled ?? true);
      setHoldToRecordKey(settings.holdToRecordKey || 'RightMeta');
    });
  }, []);

  // Build hints array based on settings
  const hints = holdToRecordEnabled
    ? [formatHotkeyCompact(hotkey), `Hold ${HOLD_KEY_SYMBOLS[holdToRecordKey]}`]
    : [formatHotkeyCompact(hotkey)];

  // Slide between hints with pause
  useEffect(() => {
    if (hints.length <= 1) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNextSlide = () => {
      // Wait for display duration, then slide out
      timeoutId = setTimeout(() => {
        setHintSliding(true);
        // After slide completes, change hint and reset position
        timeoutId = setTimeout(() => {
          setHintIndex((prev) => (prev + 1) % hints.length);
          setHintSliding(false);
          // Schedule next slide
          scheduleNextSlide();
        }, HINT_SLIDE_MS);
      }, HINT_DISPLAY_MS);
    };

    scheduleNextSlide();

    return () => clearTimeout(timeoutId);
  }, [hints.length]);

  // Cleanup recorder on unmount or window close to release microphone
  useEffect(() => {
    const cleanup = () => {
      if (recorderRef.current?.getIsRecording()) {
        recorderRef.current.cancel();
        recorderRef.current = null;
      }
    };

    window.addEventListener('beforeunload', cleanup);
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, []);

  return (
    <div className="widget">
      {appVersion && <span className="version-hint">{appVersion === 'dev' ? 'dev' : `v${appVersion}`}</span>}
      <StatsButton />
      <HideButton />
      <InfoButton />
      <SettingsButton />
      <div className="shortcut-hint-container">
        <span className={`shortcut-hint${hintSliding ? ' sliding' : ''}`}>
          {hints[hintIndex]}
        </span>
      </div>
      <div className="drag-handle">
        <span className="grip-dots"></span>
      </div>
      <div className="mic-button-container">
        {state === 'recording' && <AudioLevelRing level={audioLevel} />}
        <button
          className={`mic-button ${state}`}
          onClick={handleToggleRecording}
          aria-label={
            state === 'idle' || state === 'success'
              ? 'Start recording'
              : state === 'recording'
                ? 'Stop recording'
                : 'Cancel transcription'
          }
          title={state === 'transcribing' ? 'Click to cancel' : undefined}
        >
          {state === 'transcribing' ? (
            <>
              <span className="spinner" />
              <span className="cancel-icon" aria-hidden="true">✕</span>
            </>
          ) : state === 'success' ? (
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              width="32"
              height="32"
              className="checkmark-icon"
            >
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              width="32"
              height="32"
            >
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          )}
        </button>
      </div>
      {message && (
        <div
          className={`flash-message ${message.type}${message.isRetryable ? ' retryable' : ''}`}
          onClick={message.isRetryable ? handleRetry : undefined}
          role={message.isRetryable ? 'button' : undefined}
          tabIndex={message.isRetryable ? 0 : undefined}
          onKeyDown={message.isRetryable ? (e) => e.key === 'Enter' && handleRetry() : undefined}
        >
          {message.text}
          {message.isRetryable && <span className="retry-hint">(tap to retry)</span>}
        </div>
      )}
    </div>
  );
}
