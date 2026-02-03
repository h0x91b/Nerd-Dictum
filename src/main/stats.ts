/**
 * Statistics storage and management for tracking usage metrics
 */

import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import electronLog from 'electron-log';
import type { StatsData, DailyStats, DerivedStats, StatsWithDerived } from '../shared/types';

function log(...args: unknown[]): void {
  electronLog.info(...args);
}

const DEFAULT_STATS: StatsData = {
  totalTranscriptions: 0,
  totalWords: 0,
  totalCharacters: 0,
  totalRecordingTimeMs: 0,
  firstUseDate: '',
  lastUseDate: '',
  dailyStats: [],
};

const MAX_DAILY_STATS_DAYS = 30;
let statsData: StatsData = { ...DEFAULT_STATS };

function getStatsPath(): string {
  return path.join(app.getPath('userData'), 'stats.json');
}

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function pruneOldDailyStats(): void {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - MAX_DAILY_STATS_DAYS);
  const cutoffString = cutoffDate.toISOString().split('T')[0];

  statsData.dailyStats = statsData.dailyStats.filter(day => day.date >= cutoffString);
}

function getOrCreateTodayStats(): DailyStats {
  const today = getTodayDateString();
  let todayStats = statsData.dailyStats.find(d => d.date === today);

  if (!todayStats) {
    todayStats = {
      date: today,
      transcriptions: 0,
      words: 0,
      characters: 0,
      recordingTimeMs: 0,
    };
    statsData.dailyStats.push(todayStats);
    // Keep sorted by date descending (newest first)
    statsData.dailyStats.sort((a, b) => b.date.localeCompare(a.date));
  }

  return todayStats;
}

export function loadStats(): void {
  try {
    const statsPath = getStatsPath();
    if (fs.existsSync(statsPath)) {
      const data = fs.readFileSync(statsPath, 'utf-8');
      const parsed = JSON.parse(data);
      statsData = { ...DEFAULT_STATS, ...parsed };
      // Ensure dailyStats is an array
      if (!Array.isArray(statsData.dailyStats)) {
        statsData.dailyStats = [];
      }
      pruneOldDailyStats();
      log('[Stats] Loaded stats:', {
        totalTranscriptions: statsData.totalTranscriptions,
        dailyStatsCount: statsData.dailyStats.length,
      });
    }
  } catch (error) {
    log('[Stats] Failed to load:', error);
    statsData = { ...DEFAULT_STATS };
  }
}

function saveStats(): void {
  try {
    const statsPath = getStatsPath();
    fs.writeFileSync(statsPath, JSON.stringify(statsData, null, 2), 'utf-8');
    log('[Stats] Saved');
  } catch (error) {
    log('[Stats] Failed to save:', error);
  }
}

export function recordTranscription(transcript: string, recordingDurationMs: number): void {
  if (!transcript || transcript.trim().length === 0) {
    return;
  }

  const today = getTodayDateString();

  // Set first use date if not set
  if (!statsData.firstUseDate) {
    statsData.firstUseDate = today;
    log('[Stats] First use date set:', today);
  }

  // Update last use date
  statsData.lastUseDate = today;

  // Calculate metrics
  const wordCount = transcript
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0).length;
  const charCount = transcript.length;

  // Update totals
  statsData.totalTranscriptions += 1;
  statsData.totalWords += wordCount;
  statsData.totalCharacters += charCount;
  statsData.totalRecordingTimeMs += recordingDurationMs;

  // Update daily stats
  const todayStats = getOrCreateTodayStats();
  todayStats.transcriptions += 1;
  todayStats.words += wordCount;
  todayStats.characters += charCount;
  todayStats.recordingTimeMs += recordingDurationMs;

  // Prune old data
  pruneOldDailyStats();

  // Save to disk
  saveStats();

  log('[Stats] Recorded transcription:', {
    words: wordCount,
    chars: charCount,
    durationMs: recordingDurationMs,
    totalTranscriptions: statsData.totalTranscriptions,
  });
}

export function getStats(): StatsData {
  return { ...statsData, dailyStats: [...statsData.dailyStats] };
}

export function resetStats(): void {
  statsData = { ...DEFAULT_STATS, dailyStats: [] };
  saveStats();
  log('[Stats] Reset');
}

export function calculateDerivedStats(stats: StatsData): DerivedStats {
  // Average words per transcription
  const avgWords =
    stats.totalTranscriptions > 0 ? Math.round(stats.totalWords / stats.totalTranscriptions) : 0;

  // Most active day of week
  const dayTotals: Record<string, number> = {
    Sunday: 0,
    Monday: 0,
    Tuesday: 0,
    Wednesday: 0,
    Thursday: 0,
    Friday: 0,
    Saturday: 0,
  };
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (const day of stats.dailyStats) {
    const date = new Date(day.date);
    const dayName = dayNames[date.getDay()];
    dayTotals[dayName] += day.transcriptions;
  }

  let mostActiveDay = 'N/A';
  let maxTranscriptions = 0;
  for (const [day, count] of Object.entries(dayTotals)) {
    if (count > maxTranscriptions) {
      maxTranscriptions = count;
      mostActiveDay = day;
    }
  }

  // Time saved estimate (assume 40 WPM typing speed = 40/60 words per second)
  const TYPING_WPM = 40;
  const timeSavedSeconds = Math.round((stats.totalWords / TYPING_WPM) * 60);

  return {
    averageWordsPerTranscription: avgWords,
    mostActiveDay,
    timeSavedSeconds,
  };
}

export function getStatsWithDerived(): StatsWithDerived {
  const stats = getStats();
  const derived = calculateDerivedStats(stats);
  return { ...stats, ...derived };
}
