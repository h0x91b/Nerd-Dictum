import { useState, useEffect } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { StatsWithDerived, DailyStats } from '../types/electron';
import './StatsPage.css';

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m`;
  }
  if (minutes > 0) {
    const remainingSecs = seconds % 60;
    return `${minutes}m ${remainingSecs}s`;
  }
  return `${seconds}s`;
}

function formatTimeSaved(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatFirstUseDate(dateStr: string): string {
  if (!dateStr) return 'Today';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function StatsPage() {
  const [stats, setStats] = useState<StatsWithDerived | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showResetDialog, setShowResetDialog] = useState(false);

  useEffect(() => {
    loadStats();

    // Auto-refresh every 3 seconds
    const interval = setInterval(() => {
      loadStats();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  async function loadStats() {
    try {
      const data = await window.electronAPI.getStats();
      setStats(data);
    } catch (error) {
      console.error('[Stats] Failed to load:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleReset = async () => {
    await window.electronAPI.resetStats();
    setShowResetDialog(false);
    loadStats();
  };

  const handleClose = () => {
    window.electronAPI.closeStatsWindow();
  };

  if (isLoading) {
    return (
      <div className="stats-page">
        <div className="stats-loading">Loading...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="stats-page">
        <div className="stats-loading">Failed to load statistics</div>
      </div>
    );
  }

  // Calculate max for chart scaling
  const maxDailyTranscriptions = Math.max(...stats.dailyStats.map(d => d.transcriptions), 1);

  // Get last 30 days for chart (filling in missing days with zeros)
  const chartData: Array<{ date: string; transcriptions: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayStats = stats.dailyStats.find((d: DailyStats) => d.date === dateStr);
    chartData.push({
      date: dateStr,
      transcriptions: dayStats?.transcriptions || 0,
    });
  }

  return (
    <div className="stats-page">
      <h1>Statistics</h1>

      {/* Big Numbers */}
      <div className="stats-grid">
        <div className="stats-card">
          <div className="stats-value">{stats.totalTranscriptions.toLocaleString()}</div>
          <div className="stats-label">Transcriptions</div>
        </div>
        <div className="stats-card">
          <div className="stats-value">{stats.totalWords.toLocaleString()}</div>
          <div className="stats-label">Words</div>
        </div>
        <div className="stats-card">
          <div className="stats-value">{formatDuration(stats.totalRecordingTimeMs)}</div>
          <div className="stats-label">Recording Time</div>
        </div>
        <div className="stats-card">
          <div className="stats-value">{formatTimeSaved(stats.timeSavedSeconds)}</div>
          <div className="stats-label">Time Saved</div>
        </div>
      </div>

      {/* Activity Chart */}
      <div className="stats-section">
        <h2>30-Day Activity</h2>
        <div className="stats-chart">
          {chartData.map((day) => (
            <div
              key={day.date}
              className="stats-chart-bar"
              style={{
                height: `${(day.transcriptions / maxDailyTranscriptions) * 100}%`,
                minHeight: day.transcriptions > 0 ? '4px' : '1px',
              }}
              title={`${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: ${day.transcriptions} transcriptions`}
            />
          ))}
        </div>
        <div className="stats-chart-labels">
          <span>30 days ago</span>
          <span>Today</span>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="stats-section">
        <div className="stats-row">
          <span className="stats-row-label">Average words/transcription</span>
          <span className="stats-row-value">{stats.averageWordsPerTranscription}</span>
        </div>
        <div className="stats-row">
          <span className="stats-row-label">Most active day</span>
          <span className="stats-row-value">{stats.mostActiveDay}</span>
        </div>
        <div className="stats-row">
          <span className="stats-row-label">Using since</span>
          <span className="stats-row-value">{formatFirstUseDate(stats.firstUseDate)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="stats-actions">
        <button className="stats-btn stats-btn-secondary" onClick={() => setShowResetDialog(true)}>
          Reset Statistics
        </button>
        <button className="stats-btn stats-btn-primary" onClick={handleClose}>
          Close
        </button>
      </div>

      <ConfirmDialog
        isOpen={showResetDialog}
        title="Reset Statistics"
        message="Are you sure you want to reset all statistics? This cannot be undone."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        onConfirm={handleReset}
        onCancel={() => setShowResetDialog(false)}
      />
    </div>
  );
}
