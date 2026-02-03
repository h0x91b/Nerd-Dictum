import './StatsButton.css';

export function StatsButton() {
  const handleClick = () => {
    window.electronAPI.openStatsWindow();
  };

  return (
    <button
      className="stats-button"
      onClick={handleClick}
      aria-label="View statistics"
      title="View statistics"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
        <path d="M4 9h4v11H4V9zm6-5h4v16h-4V4zm6 8h4v8h-4v-8z" />
      </svg>
    </button>
  );
}
