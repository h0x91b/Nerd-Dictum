import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';
import { ThemeProvider } from '../contexts/ThemeContext';

const defaultSettings = {
  apiKey: 'test-api-key',
  model: 'gemini-3-flash-preview',
  languages: ['en'],
  speechDomain: 'programming',
  customDomainHint: '',
  customKeywords: '',
  microphoneDeviceId: '',
  silenceDetectionEnabled: true,
  silenceDurationMs: 2500,
  launchAtStartup: false,
  clarificationEnabled: true,
  previousTranscriptContextEnabled: true,
};

const createMockElectronAPI = (overrides: Partial<typeof window.electronAPI> = {}) => ({
  getSettings: mock(() => Promise.resolve({ ...defaultSettings })),
  saveSettings: mock(() => Promise.resolve(true)),
  closeSettingsWindow: mock(() => Promise.resolve()),
  openExternalUrl: mock(() => Promise.resolve(true)),
  // These are required by the interface but not used in SettingsPage tests
  getApiKey: mock(() => Promise.resolve('test-api-key')),
  getModel: mock(() => Promise.resolve('gemini-3-flash-preview')),
  copyToClipboard: mock(() => Promise.resolve(true)),
  onToggleRecording: mock(() => () => {}),
  openSettingsWindow: mock(() => Promise.resolve(true)),
  openInfoWindow: mock(() => Promise.resolve(true)),
  getMicrophonePermissionStatus: mock(() => Promise.resolve('granted' as const)),
  requestMicrophonePermission: mock(() => Promise.resolve(true)),
  getAppVersion: mock(() => Promise.resolve('1.0.0')),
  getRecentTranscript: mock(() => Promise.resolve(null)),
  ...overrides,
});

// Mock navigator.mediaDevices
const mockMediaDevices = {
  getUserMedia: mock(() => Promise.resolve({ getTracks: () => [] })),
  enumerateDevices: mock(() => Promise.resolve([])),
};

function renderSettingsPage(electronAPI = createMockElectronAPI()) {
  window.electronAPI = electronAPI as typeof window.electronAPI;
  return render(
    <ThemeProvider>
      <SettingsPage />
    </ThemeProvider>
  );
}

describe('SettingsPage - Unsaved Changes Dialog', () => {
  let originalMediaDevices: MediaDevices;

  beforeEach(() => {
    originalMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: mockMediaDevices,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      writable: true,
      configurable: true,
    });
  });

  it('should NOT show dialog when Cancel is clicked with no changes', async () => {
    const mockAPI = createMockElectronAPI();
    renderSettingsPage(mockAPI);

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    });

    // Click Cancel without making any changes
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    // Dialog should NOT appear
    expect(screen.queryByText('Unsaved Changes')).toBeNull();

    // Window should close immediately
    expect(mockAPI.closeSettingsWindow).toHaveBeenCalled();
  });

  it('should show dialog when Cancel is clicked with unsaved changes', async () => {
    const mockAPI = createMockElectronAPI();
    renderSettingsPage(mockAPI);

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    });

    // Make a change to the model field
    const modelInput = screen.getByLabelText('Model');
    fireEvent.change(modelInput, { target: { value: 'new-model' } });

    // Click Cancel
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    // Dialog should appear
    expect(screen.getByText('Unsaved Changes')).toBeTruthy();
    expect(screen.getByText('Are you sure? All changes will be lost.')).toBeTruthy();

    // Window should NOT close yet
    expect(mockAPI.closeSettingsWindow).not.toHaveBeenCalled();
  });

  it('should close window when Discard is clicked in dialog', async () => {
    const mockAPI = createMockElectronAPI();
    renderSettingsPage(mockAPI);

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    });

    // Make a change
    const modelInput = screen.getByLabelText('Model');
    fireEvent.change(modelInput, { target: { value: 'new-model' } });

    // Click Cancel to show dialog
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    // Click Discard
    const discardButton = screen.getByRole('button', { name: 'Discard' });
    fireEvent.click(discardButton);

    // Window should close
    expect(mockAPI.closeSettingsWindow).toHaveBeenCalled();

    // Dialog should be hidden
    expect(screen.queryByText('Unsaved Changes')).toBeNull();
  });

  it('should hide dialog and stay when Stay is clicked', async () => {
    const mockAPI = createMockElectronAPI();
    renderSettingsPage(mockAPI);

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    });

    // Make a change
    const modelInput = screen.getByLabelText('Model');
    fireEvent.change(modelInput, { target: { value: 'new-model' } });

    // Click Cancel to show dialog
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    // Verify dialog is shown
    expect(screen.getByText('Unsaved Changes')).toBeTruthy();

    // Click Stay
    const stayButton = screen.getByRole('button', { name: 'Stay' });
    fireEvent.click(stayButton);

    // Dialog should be hidden
    expect(screen.queryByText('Unsaved Changes')).toBeNull();

    // Window should NOT close
    expect(mockAPI.closeSettingsWindow).not.toHaveBeenCalled();

    // Settings page should still be visible with changes intact
    expect((screen.getByLabelText('Model') as HTMLInputElement).value).toBe('new-model');
  });

  it('should NOT show dialog after successful Save', async () => {
    const mockAPI = createMockElectronAPI();
    renderSettingsPage(mockAPI);

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    });

    // Make a change
    const modelInput = screen.getByLabelText('Model');
    fireEvent.change(modelInput, { target: { value: 'new-model' } });

    // Click Save
    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    // Wait for save to complete
    await waitFor(() => {
      expect(mockAPI.saveSettings).toHaveBeenCalled();
    });

    // After save, hasUnsavedChanges should be false
    // The window closes after 500ms timeout, but let's verify dialog doesn't appear
    // by simulating beforeunload event
    const beforeUnloadEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnloadEvent);

    // Dialog should NOT appear because initialSettingsRef was updated
    expect(screen.queryByText('Unsaved Changes')).toBeNull();
  });

  it('should detect changes to various fields', async () => {
    const mockAPI = createMockElectronAPI();
    renderSettingsPage(mockAPI);

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    });

    // Test checkbox change (Launch at startup)
    const launchCheckbox = screen.getByLabelText('Launch at startup');
    fireEvent.click(launchCheckbox);

    // Click Cancel - should show dialog
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(screen.getByText('Unsaved Changes')).toBeTruthy();
  });

  it('should detect changes to language selection', async () => {
    const mockAPI = createMockElectronAPI();
    renderSettingsPage(mockAPI);

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    });

    // Toggle a language
    const russianCheckbox = screen.getByLabelText('Russian');
    fireEvent.click(russianCheckbox);

    // Click Cancel - should show dialog
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(screen.getByText('Unsaved Changes')).toBeTruthy();
  });

  it('should NOT show dialog when changes are reverted to initial state', async () => {
    const mockAPI = createMockElectronAPI();
    renderSettingsPage(mockAPI);

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    });

    // Make a change
    const modelInput = screen.getByLabelText('Model');
    const originalValue = (modelInput as HTMLInputElement).value;
    fireEvent.change(modelInput, { target: { value: 'new-model' } });

    // Revert the change
    fireEvent.change(modelInput, { target: { value: originalValue } });

    // Click Cancel - should NOT show dialog
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(screen.queryByText('Unsaved Changes')).toBeNull();
    expect(mockAPI.closeSettingsWindow).toHaveBeenCalled();
  });

  it('should handle beforeunload event with unsaved changes', async () => {
    const mockAPI = createMockElectronAPI();
    renderSettingsPage(mockAPI);

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    });

    // Make a change
    const modelInput = screen.getByLabelText('Model');
    fireEvent.change(modelInput, { target: { value: 'new-model' } });

    // Simulate beforeunload event
    const beforeUnloadEvent = new Event('beforeunload', { cancelable: true });
    const preventDefaultSpy = spyOn(beforeUnloadEvent, 'preventDefault');
    window.dispatchEvent(beforeUnloadEvent);

    // preventDefault should have been called
    expect(preventDefaultSpy).toHaveBeenCalled();

    // Dialog should appear (need to wait for state update)
    await waitFor(() => {
      expect(screen.getByText('Unsaved Changes')).toBeTruthy();
    });
  });

  it('should NOT trigger beforeunload dialog after Discard was clicked', async () => {
    const mockAPI = createMockElectronAPI();
    renderSettingsPage(mockAPI);

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    });

    // Make a change
    const modelInput = screen.getByLabelText('Model');
    fireEvent.change(modelInput, { target: { value: 'new-model' } });

    // Click Cancel to show dialog
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    // Click Discard - this sets isClosingRef to true
    const discardButton = screen.getByRole('button', { name: 'Discard' });
    fireEvent.click(discardButton);

    // Now simulate beforeunload (which would happen when window actually closes)
    const beforeUnloadEvent = new Event('beforeunload', { cancelable: true });
    const preventDefaultSpy = spyOn(beforeUnloadEvent, 'preventDefault');
    window.dispatchEvent(beforeUnloadEvent);

    // preventDefault should NOT have been called because isClosingRef is true
    expect(preventDefaultSpy).not.toHaveBeenCalled();

    // Dialog should NOT reappear
    expect(screen.queryByText('Unsaved Changes')).toBeNull();
  });
});
