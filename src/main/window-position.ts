export interface WindowPosition {
  x: number;
  y: number;
  displayCount: number;
}

export interface DisplayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayLike {
  bounds: DisplayBounds;
}

export function getDisplayBounds(displays: DisplayLike[]): DisplayBounds[] {
  return displays.map((display) => display.bounds);
}

/**
 * Validates if saved position should be restored based on display configuration.
 * Returns true if position is valid and should be used.
 */
export function isPositionValid(
  savedPosition: WindowPosition,
  currentDisplayCount: number,
  displayBounds: DisplayBounds[]
): boolean {
  // Check if display count matches
  if (savedPosition.displayCount !== currentDisplayCount) {
    return false;
  }

  // Check if position is within any display's visible bounds
  const isPositionVisible = displayBounds.some((display) => {
    return (
      savedPosition.x >= display.x &&
      savedPosition.x < display.x + display.width &&
      savedPosition.y >= display.y &&
      savedPosition.y < display.y + display.height
    );
  });

  return isPositionVisible;
}
