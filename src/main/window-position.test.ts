import { describe, it, expect } from 'vitest';

// Pure functions extracted for testing
interface WindowPosition {
  x: number;
  y: number;
  displayCount: number;
}

interface DisplayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
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
  const isPositionVisible = displayBounds.some(display => {
    return (
      savedPosition.x >= display.x &&
      savedPosition.x < display.x + display.width &&
      savedPosition.y >= display.y &&
      savedPosition.y < display.y + display.height
    );
  });

  return isPositionVisible;
}

describe('window-position', () => {
  describe('isPositionValid', () => {
    const singleDisplay: DisplayBounds[] = [
      { x: 0, y: 0, width: 1920, height: 1080 }
    ];

    const dualDisplayHorizontal: DisplayBounds[] = [
      { x: 0, y: 0, width: 1920, height: 1080 },
      { x: 1920, y: 0, width: 1920, height: 1080 }
    ];

    const dualDisplayVertical: DisplayBounds[] = [
      { x: 0, y: 0, width: 1920, height: 1080 },
      { x: 0, y: 1080, width: 1920, height: 1080 }
    ];

    it('should return true for valid position on single display', () => {
      const position: WindowPosition = { x: 100, y: 100, displayCount: 1 };
      expect(isPositionValid(position, 1, singleDisplay)).toBe(true);
    });

    it('should return false when display count changed (1 -> 2)', () => {
      const position: WindowPosition = { x: 100, y: 100, displayCount: 1 };
      expect(isPositionValid(position, 2, dualDisplayHorizontal)).toBe(false);
    });

    it('should return false when display count changed (2 -> 1)', () => {
      const position: WindowPosition = { x: 100, y: 100, displayCount: 2 };
      expect(isPositionValid(position, 1, singleDisplay)).toBe(false);
    });

    it('should return true for position on second display (horizontal)', () => {
      const position: WindowPosition = { x: 2000, y: 100, displayCount: 2 };
      expect(isPositionValid(position, 2, dualDisplayHorizontal)).toBe(true);
    });

    it('should return true for position on second display (vertical)', () => {
      const position: WindowPosition = { x: 100, y: 1200, displayCount: 2 };
      expect(isPositionValid(position, 2, dualDisplayVertical)).toBe(true);
    });

    it('should return false for position outside all displays', () => {
      const position: WindowPosition = { x: 5000, y: 5000, displayCount: 1 };
      expect(isPositionValid(position, 1, singleDisplay)).toBe(false);
    });

    it('should return false for negative position outside display bounds', () => {
      const position: WindowPosition = { x: -100, y: -100, displayCount: 1 };
      expect(isPositionValid(position, 1, singleDisplay)).toBe(false);
    });

    it('should handle display with negative origin (external monitor on left)', () => {
      const displaysWithNegativeOrigin: DisplayBounds[] = [
        { x: -1920, y: 0, width: 1920, height: 1080 },
        { x: 0, y: 0, width: 1920, height: 1080 }
      ];
      const position: WindowPosition = { x: -1000, y: 100, displayCount: 2 };
      expect(isPositionValid(position, 2, displaysWithNegativeOrigin)).toBe(true);
    });

    it('should return true for position at display origin (0, 0)', () => {
      const position: WindowPosition = { x: 0, y: 0, displayCount: 1 };
      expect(isPositionValid(position, 1, singleDisplay)).toBe(true);
    });

    it('should return true for position at edge of display', () => {
      const position: WindowPosition = { x: 1919, y: 1079, displayCount: 1 };
      expect(isPositionValid(position, 1, singleDisplay)).toBe(true);
    });

    it('should return false for position exactly at display boundary', () => {
      // x=1920 is outside the display (0-1919 inclusive)
      const position: WindowPosition = { x: 1920, y: 0, displayCount: 1 };
      expect(isPositionValid(position, 1, singleDisplay)).toBe(false);
    });
  });
});
