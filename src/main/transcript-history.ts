/**
 * Transcript history storage for providing context to Gemini API
 * Stores the most recent transcript to help improve transcription accuracy
 */

import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import electronLog from 'electron-log';

function log(...args: unknown[]): void {
  electronLog.info(...args);
}

interface TranscriptEntry {
  text: string;
  timestamp: number;
}

const MAX_TRANSCRIPTS_STORED = 10;
let transcriptHistory: TranscriptEntry[] = [];

function getTranscriptHistoryPath(): string {
  return path.join(app.getPath('userData'), 'transcript-history.json');
}

export function loadTranscriptHistory(): void {
  try {
    const historyPath = getTranscriptHistoryPath();
    if (fs.existsSync(historyPath)) {
      const data = fs.readFileSync(historyPath, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        transcriptHistory = parsed.slice(0, MAX_TRANSCRIPTS_STORED);
        log('[TranscriptHistory] Loaded', transcriptHistory.length, 'entries');
      }
    }
  } catch (error) {
    log('[TranscriptHistory] Failed to load:', error);
    transcriptHistory = [];
  }
}

function saveTranscriptHistory(): void {
  try {
    const historyPath = getTranscriptHistoryPath();
    fs.writeFileSync(historyPath, JSON.stringify(transcriptHistory, null, 2), 'utf-8');
  } catch (error) {
    log('[TranscriptHistory] Failed to save:', error);
  }
}

export function addTranscriptToHistory(text: string): void {
  if (!text || text.trim().length === 0) {
    return;
  }

  const entry: TranscriptEntry = {
    text: text.trim(),
    timestamp: Date.now(),
  };

  // Add to beginning (most recent first)
  transcriptHistory.unshift(entry);

  // Trim to max size
  if (transcriptHistory.length > MAX_TRANSCRIPTS_STORED) {
    transcriptHistory = transcriptHistory.slice(0, MAX_TRANSCRIPTS_STORED);
  }

  saveTranscriptHistory();
  log('[TranscriptHistory] Added entry, total:', transcriptHistory.length);
}

export function getRecentTranscript(): string | null {
  if (transcriptHistory.length === 0) {
    return null;
  }
  return transcriptHistory[0].text;
}
