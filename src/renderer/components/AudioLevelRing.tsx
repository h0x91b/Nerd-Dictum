import { memo } from 'react';
import './AudioLevelRing.css';

interface AudioLevelRingProps {
  /** Audio level from 0 to 1 */
  level: number;
  /** Size of the button (to position arc around it) */
  size?: number;
}

// Tachometer arc: from 7 o'clock to 5 o'clock, going CLOCKWISE through 12 o'clock (top)
// SVG coordinates: 0° = right (3 o'clock), angles increase clockwise
// 7 o'clock in SVG = 120°
// 5 o'clock in SVG = 60°
// Going CLOCKWISE from 120° through 180°, 270°, 0°, to 60° = 300° arc
// sweep-flag=1 means clockwise

const START_ANGLE_SVG = 120;  // 7 o'clock in SVG coordinates
const ARC_SPAN = 300;         // Going clockwise: 120° -> 180° -> 270° -> 360° -> 60° = 300°

/**
 * Tachometer-style arc that shows audio level.
 * Arc goes from bottom-left (7 o'clock = 0) to bottom-right (5 o'clock = max),
 * sweeping through the top.
 */
export const AudioLevelRing = memo(function AudioLevelRing({
  level,
  size = 56,
}: AudioLevelRingProps) {
  const strokeWidth = 4;
  const gap = 6;
  const containerSize = size + (strokeWidth + gap) * 2 + 4;
  const center = containerSize / 2;
  const radius = size / 2 + gap + strokeWidth / 2;

  // Convert SVG angle (0=right, clockwise) to x,y coordinates
  const polarToCartesian = (angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    };
  };

  const startPoint = polarToCartesian(START_ANGLE_SVG);
  const endPoint = polarToCartesian(60); // 5 o'clock

  // Background arc - full range from 7 to 5 o'clock through top (clockwise)
  // sweep-flag=1 means clockwise, large-arc=1 because it's > 180°
  const bgPath = `M ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 1 1 ${endPoint.x} ${endPoint.y}`;

  // Active arc - partial based on level
  // Calculate end angle: start at 120°, go clockwise by (ARC_SPAN * level)
  const activeAngleDelta = ARC_SPAN * level;
  let activeEndAngle = START_ANGLE_SVG + activeAngleDelta;
  // Normalize to 0-360
  while (activeEndAngle >= 360) activeEndAngle -= 360;

  const activeEndPoint = polarToCartesian(activeEndAngle);
  const activeLargeArc = activeAngleDelta > 180 ? 1 : 0;

  // Only draw if there's meaningful level
  const activePath = level > 0.01
    ? `M ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${activeLargeArc} 1 ${activeEndPoint.x} ${activeEndPoint.y}`
    : '';

  // Determine color class based on level
  const getColorClass = (lvl: number) => {
    if (lvl < 0.4) return 'tachometer-low';
    if (lvl < 0.7) return 'tachometer-mid';
    return 'tachometer-high';
  };

  return (
    <svg
      className="audio-level-ring"
      width={containerSize}
      height={containerSize}
    >
      {/* Background arc */}
      <path
        d={bgPath}
        fill="none"
        className="tachometer-bg"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Active level arc */}
      {activePath && (
        <path
          d={activePath}
          fill="none"
          className={`tachometer-active ${getColorClass(level)}`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
});
