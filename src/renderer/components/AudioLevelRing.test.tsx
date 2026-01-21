import { describe, it, expect } from 'bun:test';
import { render } from '@testing-library/react';
import { AudioLevelRing } from './AudioLevelRing';

describe('AudioLevelRing', () => {
  it('renders svg element', () => {
    const { container } = render(<AudioLevelRing level={0.5} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('class')).toBe('audio-level-ring');
  });

  it('renders background arc always', () => {
    const { container } = render(<AudioLevelRing level={0} />);
    const paths = container.querySelectorAll('path');
    // At least background arc should be present
    expect(paths.length).toBeGreaterThanOrEqual(1);
  });

  it('renders active arc when level > 0', () => {
    const { container } = render(<AudioLevelRing level={0.5} />);
    const paths = container.querySelectorAll('path');
    // Should have both background and active arc
    expect(paths.length).toBe(2);
  });

  it('does not render active arc when level is near 0', () => {
    const { container } = render(<AudioLevelRing level={0.005} />);
    const paths = container.querySelectorAll('path');
    // Only background arc
    expect(paths.length).toBe(1);
  });

  it('respects custom size prop', () => {
    const customSize = 80;
    const { container } = render(<AudioLevelRing level={0.5} size={customSize} />);
    const svg = container.querySelector('svg');
    // Container size = size + (strokeWidth + gap) * 2 + 4 = 80 + 20 + 4 = 104
    expect(svg?.getAttribute('width')).toBe('104');
    expect(svg?.getAttribute('height')).toBe('104');
  });

  it('uses correct color class based on level', () => {
    // Low level
    const { container: containerLow } = render(<AudioLevelRing level={0.2} />);
    const pathLow = containerLow.querySelectorAll('path')[1];
    expect(pathLow?.classList.contains('tachometer-low')).toBe(true);

    // Mid level
    const { container: containerMid } = render(<AudioLevelRing level={0.5} />);
    const pathMid = containerMid.querySelectorAll('path')[1];
    expect(pathMid?.classList.contains('tachometer-mid')).toBe(true);

    // High level
    const { container: containerHigh } = render(<AudioLevelRing level={0.9} />);
    const pathHigh = containerHigh.querySelectorAll('path')[1];
    expect(pathHigh?.classList.contains('tachometer-high')).toBe(true);
  });

  it('background arc has correct class', () => {
    const { container } = render(<AudioLevelRing level={0.5} />);
    const bgPath = container.querySelectorAll('path')[0];
    expect(bgPath?.classList.contains('tachometer-bg')).toBe(true);
  });
});
