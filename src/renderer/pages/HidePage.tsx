import { useState } from 'react';
import './HidePage.css';

// Logarithmic slider: 10 minutes to 48 hours
const MIN_MINUTES = 10;
const MAX_MINUTES = 48 * 60; // 2880 minutes = 48 hours

// Convert slider position (0-100) to minutes using logarithmic scale
function sliderToMinutes(sliderValue: number): number {
  const minLog = Math.log(MIN_MINUTES);
  const maxLog = Math.log(MAX_MINUTES);
  const scale = (maxLog - minLog) / 100;
  const rawMinutes = Math.exp(minLog + scale * sliderValue);
  return snapToNiceValue(rawMinutes);
}

// Snap to nice round values based on the magnitude
function snapToNiceValue(minutes: number): number {
  if (minutes < 30) {
    // Under 30 min: snap to 5-minute increments (10, 15, 20, 25)
    return Math.round(minutes / 5) * 5;
  } else if (minutes < 60) {
    // 30-60 min: snap to 10-minute increments (30, 40, 50)
    return Math.round(minutes / 10) * 10;
  } else if (minutes < 180) {
    // 1-3 hours: snap to 30-minute increments (1h, 1.5h, 2h, 2.5h, 3h)
    return Math.round(minutes / 30) * 30;
  } else if (minutes < 360) {
    // 3-6 hours: snap to 1-hour increments
    return Math.round(minutes / 60) * 60;
  } else {
    // 6+ hours: snap to 2-hour increments
    return Math.round(minutes / 120) * 120;
  }
}

// Convert minutes to slider position (0-100)
function minutesToSlider(minutes: number): number {
  const minLog = Math.log(MIN_MINUTES);
  const maxLog = Math.log(MAX_MINUTES);
  const scale = (maxLog - minLog) / 100;
  return (Math.log(minutes) - minLog) / scale;
}

// Format minutes to human-readable string
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  return `${hours}h ${mins}m`;
}

export function HidePage() {
  // Default to 1 hour
  const [sliderValue, setSliderValue] = useState(() => minutesToSlider(60));

  const minutes = sliderToMinutes(sliderValue);
  const durationMs = minutes * 60 * 1000;

  const handleHide = () => {
    window.electronAPI.hideForDuration(durationMs);
  };

  const handleCancel = () => {
    window.electronAPI.closeHideWindow();
  };

  return (
    <div className="hide-page">
      <h1>Hide Widget</h1>
      <p className="hide-description">Temporarily hide the voice widget.</p>

      <div className="hide-slider-container">
        <div className="hide-duration-display">{formatDuration(minutes)}</div>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={sliderValue}
          onChange={(e) => setSliderValue(Number(e.target.value))}
          className="hide-slider"
        />
        <div className="hide-slider-labels">
          <span>10 min</span>
          <span>48 hours</span>
        </div>
      </div>

      <div className="hide-actions">
        <button className="hide-cancel-btn" onClick={handleCancel}>
          Cancel
        </button>
        <button className="hide-confirm-btn" onClick={handleHide}>
          Hide
        </button>
      </div>
    </div>
  );
}
