import { test, expect } from '@playwright/test';

test.describe('Voice Widget - UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the voice widget with microphone button', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle('Voice Widget');

    // Check microphone button is visible and in idle state
    const micButton = page.getByRole('button', { name: 'Start recording' });
    await expect(micButton).toBeVisible();
  });

  test('should have drag handle visible', async ({ page }) => {
    // The drag handle should be present for window dragging
    const dragHandle = page.locator('.drag-handle');
    await expect(dragHandle).toBeVisible();
  });

  test('mic button should have correct idle styling', async ({ page }) => {
    const micButton = page.locator('.mic-button');
    await expect(micButton).toHaveClass(/idle/);
    await expect(micButton).not.toHaveClass(/recording/);
    await expect(micButton).not.toHaveClass(/transcribing/);
  });

  test('mic button should not be disabled in idle state', async ({ page }) => {
    const micButton = page.getByRole('button', { name: 'Start recording' });
    await expect(micButton).not.toBeDisabled();
  });

  test('should show microphone icon in idle state', async ({ page }) => {
    const micIcon = page.locator('.mic-button svg');
    await expect(micIcon).toBeVisible();
  });
});

test.describe('Voice Widget - Recording with Mocked Audio', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate and mock getUserMedia before any recording attempts
    await page.goto('/');
  });

  test('should transition to recording state when mic permission granted', async ({ page }) => {
    // Mock getUserMedia to simulate microphone access
    await page.evaluate(() => {
      const mockStream = {
        getTracks: () => [{ stop: () => {} }],
        getAudioTracks: () => [{ stop: () => {} }],
      };

      // Create a mock AudioContext
      const originalAudioContext = window.AudioContext;
      (window as any).AudioContext = class MockAudioContext {
        sampleRate = 48000;
        state = 'running';
        createMediaStreamSource() {
          return {
            connect: () => {},
            disconnect: () => {},
          };
        }
        createScriptProcessor() {
          return {
            connect: () => {},
            disconnect: () => {},
            onaudioprocess: null,
          };
        }
        get destination() {
          return {};
        }
        close() {
          return Promise.resolve();
        }
      };

      // Mock getUserMedia
      navigator.mediaDevices.getUserMedia = () => Promise.resolve(mockStream as any);
    });

    // Click the button
    await page.getByRole('button', { name: 'Start recording' }).click();

    // Should transition to recording state
    const micButton = page.locator('.mic-button');
    await expect(micButton).toHaveClass(/recording/, { timeout: 5000 });
  });

  test('should show error message when microphone access denied', async ({ page }) => {
    // Mock getUserMedia to reject
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    });

    // Click the button
    await page.getByRole('button', { name: 'Start recording' }).click();

    // Should show error message
    const flashMessage = page.locator('.flash-message');
    await expect(flashMessage).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Voice Widget - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('mic button should have aria-label', async ({ page }) => {
    const micButton = page.getByRole('button', { name: 'Start recording' });
    await expect(micButton).toHaveAttribute('aria-label', 'Start recording');
  });

  test('button should be focusable', async ({ page }) => {
    const micButton = page.getByRole('button', { name: 'Start recording' });

    // Focus the button
    await micButton.focus();

    // Verify it's focused
    await expect(micButton).toBeFocused();
  });
});
