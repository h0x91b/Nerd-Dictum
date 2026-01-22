import './InfoButton.css';

export function InfoButton() {
  const handleClick = () => {
    window.electronAPI.openInfoWindow();
  };

  return (
    <button
      className="info-button"
      onClick={handleClick}
      aria-label="How to use"
      title="How to use"
    >
      i
    </button>
  );
}
