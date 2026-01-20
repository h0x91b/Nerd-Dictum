import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('should render microphone button in idle state', () => {
    render(<App />);

    const button = screen.getByRole('button', { name: /start recording/i });
    expect(button).toBeDefined();
    expect(button.className).toContain('idle');
  });

  it('should switch to recording state on click', () => {
    render(<App />);

    const button = screen.getByRole('button', { name: /start recording/i });
    fireEvent.click(button);

    const recordingButton = screen.getByRole('button', { name: /stop recording/i });
    expect(recordingButton).toBeDefined();
    expect(recordingButton.className).toContain('recording');
  });
});
