import { test, expect } from '@playwright/test';

test.describe('Voice Widget - UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the voice widget with microphone button', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle('Nerd Dictum');

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

test.describe('Voice Widget - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show "Microphone access denied" error message', async ({ page }) => {
    // Mock getUserMedia to reject with NotAllowedError
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    });

    await page.getByRole('button', { name: 'Start recording' }).click();

    // Check specific error message
    const flashMessage = page.locator('.flash-message');
    await expect(flashMessage).toContainText('Microphone access denied');
  });

  test('should show "No microphone found" error message', async ({ page }) => {
    // Mock getUserMedia to reject with NotFoundError
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('No device found', 'NotFoundError'));
    });

    await page.getByRole('button', { name: 'Start recording' }).click();

    const flashMessage = page.locator('.flash-message');
    await expect(flashMessage).toContainText('No microphone found');
  });

  test('should show error styling for error messages', async ({ page }) => {
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    });

    await page.getByRole('button', { name: 'Start recording' }).click();

    const flashMessage = page.locator('.flash-message');
    await expect(flashMessage).toHaveClass(/error/);
  });

  test('should show retryable class for retryable errors', async ({ page }) => {
    // Permission denied is retryable (user might grant permission)
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    });

    await page.getByRole('button', { name: 'Start recording' }).click();

    const flashMessage = page.locator('.flash-message');
    await expect(flashMessage).toHaveClass(/retryable/);
  });

  test('should NOT show retryable class for non-retryable errors', async ({ page }) => {
    // No microphone found is not retryable (hardware issue)
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('No device found', 'NotFoundError'));
    });

    await page.getByRole('button', { name: 'Start recording' }).click();

    const flashMessage = page.locator('.flash-message');
    await expect(flashMessage).toHaveClass(/error/);
    await expect(flashMessage).not.toHaveClass(/retryable/);
  });

  test('should show retry hint for retryable errors', async ({ page }) => {
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    });

    await page.getByRole('button', { name: 'Start recording' }).click();

    const retryHint = page.locator('.retry-hint');
    await expect(retryHint).toBeVisible();
    await expect(retryHint).toContainText('(tap to retry)');
  });

  test('should NOT show retry hint for non-retryable errors', async ({ page }) => {
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('No device found', 'NotFoundError'));
    });

    await page.getByRole('button', { name: 'Start recording' }).click();

    const retryHint = page.locator('.retry-hint');
    await expect(retryHint).not.toBeVisible();
  });

  test('should return to idle state after error', async ({ page }) => {
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    });

    await page.getByRole('button', { name: 'Start recording' }).click();

    // After error, button should be back in idle state
    const micButton = page.locator('.mic-button');
    await expect(micButton).toHaveClass(/idle/);
    await expect(micButton).not.toHaveClass(/recording/);
    await expect(micButton).not.toHaveClass(/transcribing/);
  });

  test('retryable error message should be clickable', async ({ page }) => {
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    });

    await page.getByRole('button', { name: 'Start recording' }).click();

    const flashMessage = page.locator('.flash-message.retryable');
    await expect(flashMessage).toHaveAttribute('role', 'button');
    await expect(flashMessage).toHaveAttribute('tabindex', '0');
  });

  test('error message should auto-dismiss after timeout', async ({ page }) => {
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('No device found', 'NotFoundError'));
    });

    await page.getByRole('button', { name: 'Start recording' }).click();

    const flashMessage = page.locator('.flash-message');
    await expect(flashMessage).toBeVisible();

    // Non-retryable errors dismiss after 2 seconds
    await page.waitForTimeout(2500);
    await expect(flashMessage).not.toBeVisible();
  });

  test('retryable error message should stay longer before auto-dismiss', async ({ page }) => {
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    });

    await page.getByRole('button', { name: 'Start recording' }).click();

    const flashMessage = page.locator('.flash-message');
    await expect(flashMessage).toBeVisible();

    // Should still be visible after 2 seconds (retryable errors stay for 4 seconds)
    await page.waitForTimeout(2500);
    await expect(flashMessage).toBeVisible();

    // Should be gone after 4 seconds
    await page.waitForTimeout(2000);
    await expect(flashMessage).not.toBeVisible();
  });
});

test.describe('Voice Widget - Error Styling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('error message should have red background', async ({ page }) => {
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    });

    await page.getByRole('button', { name: 'Start recording' }).click();

    const flashMessage = page.locator('.flash-message.error');
    // Check that the computed background color is a shade of red
    const bgColor = await flashMessage.evaluate((el) => getComputedStyle(el).backgroundColor);
    // #c62828 = rgb(198, 40, 40)
    expect(bgColor).toContain('198');
  });

  test('error message should have white text', async ({ page }) => {
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    });

    await page.getByRole('button', { name: 'Start recording' }).click();

    const flashMessage = page.locator('.flash-message.error');
    const color = await flashMessage.evaluate((el) => getComputedStyle(el).color);
    // white = rgb(255, 255, 255)
    expect(color).toContain('255');
  });

  test('retryable error message should have pointer cursor', async ({ page }) => {
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    });

    await page.getByRole('button', { name: 'Start recording' }).click();

    const flashMessage = page.locator('.flash-message.error.retryable');
    const cursor = await flashMessage.evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor).toBe('pointer');
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
