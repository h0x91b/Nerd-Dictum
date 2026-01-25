import { test, expect } from '@playwright/test';

// Settings page is at /settings.html
const SETTINGS_URL = '/settings.html';

test.describe('Settings Page - UI Elements', () => {
  test.beforeEach(async ({ page }) => {
    // Mock electronAPI before navigating
    await page.addInitScript(() => {
      (window as any).electronAPI = {
        getSettings: () =>
          Promise.resolve({
            apiKey: '',
            model: 'gemini-3-flash-preview',
            languages: [],
            speechDomain: 'programming',
            customDomainHint: '',
            microphoneDeviceId: '',
            silenceDetectionEnabled: true,
            silenceDurationMs: 2500,
            launchAtStartup: false,
          }),
        saveSettings: () => Promise.resolve(true),
        closeSettingsWindow: () => {},
        openSettingsWindow: () => {},
      };
    });

    await page.goto(SETTINGS_URL);
  });

  test('should display settings page with all form sections', async ({ page }) => {
    const settingsPage = page.locator('.settings-page');
    await expect(settingsPage).toBeVisible();
  });

  test('should display API key input field', async ({ page }) => {
    const apiKeyLabel = page.locator('label[for="api-key"]');
    await expect(apiKeyLabel).toContainText('Gemini API Key');

    const apiKeyInput = page.locator('#api-key');
    await expect(apiKeyInput).toBeVisible();
    await expect(apiKeyInput).toHaveAttribute('type', 'password');
  });

  test('should display model input field', async ({ page }) => {
    const modelLabel = page.locator('label[for="model"]');
    await expect(modelLabel).toContainText('Model');

    const modelInput = page.locator('#model');
    await expect(modelInput).toBeVisible();
    await expect(modelInput).toHaveValue('gemini-3-flash-preview');
  });

  test('should display speech domain dropdown', async ({ page }) => {
    const domainLabel = page.locator('label[for="speech-domain"]');
    await expect(domainLabel).toContainText('Speech Domain');

    const domainSelect = page.locator('#speech-domain');
    await expect(domainSelect).toBeVisible();
  });

  test('should display custom keywords field', async ({ page }) => {
    const keywordsLabel = page.locator('label[for="custom-keywords"]');
    await expect(keywordsLabel).toContainText('Custom Keywords');

    const keywordsInput = page.locator('#custom-keywords');
    await expect(keywordsInput).toBeVisible();
  });

  test('should display microphone dropdown', async ({ page }) => {
    const micLabel = page.locator('label[for="microphone"]');
    await expect(micLabel).toContainText('Microphone');

    const micSelect = page.locator('#microphone');
    await expect(micSelect).toBeVisible();
  });

  test('should display auto-stop on silence checkbox', async ({ page }) => {
    const silenceCheckbox = page.locator('input[type="checkbox"]').first();
    await expect(silenceCheckbox).toBeVisible();
    await expect(silenceCheckbox).toBeChecked();
  });

  test('should display silence duration slider when auto-stop enabled', async ({ page }) => {
    const slider = page.locator('input[type="range"]');
    await expect(slider).toBeVisible();
  });

  test('should display language grid with all languages', async ({ page }) => {
    const languageGrid = page.locator('.language-grid');
    await expect(languageGrid).toBeVisible();

    // Check that all 15 languages are present
    const languages = [
      'English',
      'Russian',
      'Hebrew',
      'Spanish',
      'French',
      'German',
      'Chinese',
      'Japanese',
      'Korean',
      'Portuguese',
      'Italian',
      'Arabic',
      'Hindi',
      'Ukrainian',
      'Polish',
    ];

    for (const lang of languages) {
      const langOption = page.locator('.language-option').filter({ hasText: lang });
      await expect(langOption).toBeVisible();
    }
  });

  test('should display launch at startup checkbox', async ({ page }) => {
    const startupLabel = page.locator('.checkbox-label').filter({ hasText: 'Launch at startup' });
    await expect(startupLabel).toBeVisible();
  });

  test('should display Cancel and Save buttons', async ({ page }) => {
    const cancelBtn = page.locator('.settings-btn-secondary');
    await expect(cancelBtn).toBeVisible();
    await expect(cancelBtn).toContainText('Cancel');

    const saveBtn = page.locator('.settings-btn-primary');
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toContainText('Save');
  });
});

test.describe('Settings Page - Form Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).electronAPI = {
        getSettings: () =>
          Promise.resolve({
            apiKey: '',
            model: 'gemini-3-flash-preview',
            languages: [],
            speechDomain: 'programming',
            customDomainHint: '',
            microphoneDeviceId: '',
            silenceDetectionEnabled: true,
            silenceDurationMs: 2500,
            launchAtStartup: false,
          }),
        saveSettings: () => Promise.resolve(true),
        closeSettingsWindow: () => {},
        openSettingsWindow: () => {},
      };
    });

    await page.goto(SETTINGS_URL);
  });

  test('should allow entering API key', async ({ page }) => {
    const apiKeyInput = page.locator('#api-key');
    await apiKeyInput.fill('test-api-key-12345');
    await expect(apiKeyInput).toHaveValue('test-api-key-12345');
  });

  test('should allow changing model', async ({ page }) => {
    const modelInput = page.locator('#model');
    await modelInput.clear();
    await modelInput.fill('gemini-2.0-flash');
    await expect(modelInput).toHaveValue('gemini-2.0-flash');
  });

  test('should toggle silence detection checkbox', async ({ page }) => {
    const silenceCheckbox = page
      .locator('.checkbox-label')
      .filter({ hasText: 'Auto-stop on silence' })
      .locator('input[type="checkbox"]');

    // Initially checked
    await expect(silenceCheckbox).toBeChecked();

    // Click to uncheck
    await silenceCheckbox.click();
    await expect(silenceCheckbox).not.toBeChecked();

    // Slider should be hidden
    const slider = page.locator('input[type="range"]');
    await expect(slider).not.toBeVisible();
  });

  test('should hide slider when silence detection disabled', async ({ page }) => {
    const silenceCheckbox = page
      .locator('.checkbox-label')
      .filter({ hasText: 'Auto-stop on silence' })
      .locator('input[type="checkbox"]');

    // Disable silence detection
    await silenceCheckbox.click();

    // Slider should be hidden
    const sliderContainer = page.locator('.slider-container');
    await expect(sliderContainer).not.toBeVisible();
  });

  test('should change silence duration slider value', async ({ page }) => {
    const slider = page.locator('input[type="range"]');
    const sliderValue = page.locator('.slider-value');

    // Initial value should be 2.5s
    await expect(sliderValue).toContainText('2.5s');

    // Change slider value
    await slider.fill('5000');
    await expect(sliderValue).toContainText('5.0s');
  });

  test('should toggle launch at startup checkbox', async ({ page }) => {
    const startupCheckbox = page
      .locator('.checkbox-label')
      .filter({ hasText: 'Launch at startup' })
      .locator('input[type="checkbox"]');

    // Initially unchecked
    await expect(startupCheckbox).not.toBeChecked();

    // Click to check
    await startupCheckbox.click();
    await expect(startupCheckbox).toBeChecked();
  });
});

test.describe('Settings Page - Language Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).electronAPI = {
        getSettings: () =>
          Promise.resolve({
            apiKey: '',
            model: 'gemini-3-flash-preview',
            languages: [],
            speechDomain: 'programming',
            customDomainHint: '',
            microphoneDeviceId: '',
            silenceDetectionEnabled: true,
            silenceDurationMs: 2500,
            launchAtStartup: false,
          }),
        saveSettings: () => Promise.resolve(true),
        closeSettingsWindow: () => {},
        openSettingsWindow: () => {},
      };
    });

    await page.goto(SETTINGS_URL);
  });

  test('should allow selecting a single language', async ({ page }) => {
    const englishCheckbox = page.locator('.language-option').filter({ hasText: 'English' }).locator('input');
    await expect(englishCheckbox).not.toBeChecked();

    await englishCheckbox.click();
    await expect(englishCheckbox).toBeChecked();
  });

  test('should allow selecting multiple languages', async ({ page }) => {
    const englishCheckbox = page.locator('.language-option').filter({ hasText: 'English' }).locator('input');
    const russianCheckbox = page.locator('.language-option').filter({ hasText: 'Russian' }).locator('input');
    const hebrewCheckbox = page.locator('.language-option').filter({ hasText: 'Hebrew' }).locator('input');

    await englishCheckbox.click();
    await russianCheckbox.click();
    await hebrewCheckbox.click();

    await expect(englishCheckbox).toBeChecked();
    await expect(russianCheckbox).toBeChecked();
    await expect(hebrewCheckbox).toBeChecked();
  });

  test('should allow deselecting a language', async ({ page }) => {
    const englishCheckbox = page.locator('.language-option').filter({ hasText: 'English' }).locator('input');

    // Select then deselect
    await englishCheckbox.click();
    await expect(englishCheckbox).toBeChecked();

    await englishCheckbox.click();
    await expect(englishCheckbox).not.toBeChecked();
  });

  test('should load pre-selected languages from settings', async ({ page }) => {
    // Navigate away and back with different initial settings
    await page.addInitScript(() => {
      (window as any).electronAPI = {
        getSettings: () =>
          Promise.resolve({
            apiKey: '',
            model: 'gemini-3-flash-preview',
            languages: ['en', 'ru', 'he'],
            speechDomain: 'programming',
            customDomainHint: '',
            microphoneDeviceId: '',
            silenceDetectionEnabled: true,
            silenceDurationMs: 2500,
            launchAtStartup: false,
          }),
        saveSettings: () => Promise.resolve(true),
        closeSettingsWindow: () => {},
        openSettingsWindow: () => {},
      };
    });

    await page.goto(SETTINGS_URL);

    const englishCheckbox = page.locator('.language-option').filter({ hasText: 'English' }).locator('input');
    const russianCheckbox = page.locator('.language-option').filter({ hasText: 'Russian' }).locator('input');
    const hebrewCheckbox = page.locator('.language-option').filter({ hasText: 'Hebrew' }).locator('input');
    const spanishCheckbox = page.locator('.language-option').filter({ hasText: 'Spanish' }).locator('input');

    await expect(englishCheckbox).toBeChecked();
    await expect(russianCheckbox).toBeChecked();
    await expect(hebrewCheckbox).toBeChecked();
    await expect(spanishCheckbox).not.toBeChecked();
  });
});

test.describe('Settings Page - Speech Domain', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).electronAPI = {
        getSettings: () =>
          Promise.resolve({
            apiKey: '',
            model: 'gemini-3-flash-preview',
            languages: [],
            speechDomain: 'programming',
            customDomainHint: '',
            microphoneDeviceId: '',
            silenceDetectionEnabled: true,
            silenceDurationMs: 2500,
            launchAtStartup: false,
          }),
        saveSettings: () => Promise.resolve(true),
        closeSettingsWindow: () => {},
        openSettingsWindow: () => {},
      };
    });

    await page.goto(SETTINGS_URL);
  });

  test('should display all speech domain options', async ({ page }) => {
    const domainSelect = page.locator('#speech-domain');

    const domains = [
      'Programming',
      'General',
      'Cooking',
      'Medical',
      'Legal',
      'Academic',
      'Business',
      'Creative Writing',
      'Custom',
    ];

    for (const domain of domains) {
      const option = domainSelect.locator(`option:text("${domain}")`);
      await expect(option).toBeAttached();
    }
  });

  test('should change speech domain', async ({ page }) => {
    const domainSelect = page.locator('#speech-domain');

    await domainSelect.selectOption('medical');
    await expect(domainSelect).toHaveValue('medical');
  });

  test('should show hint for selected domain', async ({ page }) => {
    const domainSelect = page.locator('#speech-domain');
    const hint = page.locator('.settings-hint').filter({ hasText: 'Code, APIs, technical terms' });

    // Default is programming
    await expect(hint).toBeVisible();

    // Change to cooking
    await domainSelect.selectOption('cooking');
    const cookingHint = page.locator('.settings-hint').filter({ hasText: 'Recipes, ingredients, kitchen' });
    await expect(cookingHint).toBeVisible();
  });

  test('should show custom domain hint input when Custom selected', async ({ page }) => {
    const domainSelect = page.locator('#speech-domain');
    const customHintInput = page.locator('#custom-domain-hint');

    // Custom hint input should not be visible initially
    await expect(customHintInput).not.toBeVisible();

    // Select custom domain
    await domainSelect.selectOption('custom');

    // Custom hint input should now be visible
    await expect(customHintInput).toBeVisible();
  });

  test('should allow entering custom domain hint', async ({ page }) => {
    const domainSelect = page.locator('#speech-domain');
    await domainSelect.selectOption('custom');

    const customHintInput = page.locator('#custom-domain-hint');
    await customHintInput.fill('gardening and plant care terminology');
    await expect(customHintInput).toHaveValue('gardening and plant care terminology');
  });

  test('should show character count for custom hint', async ({ page }) => {
    const domainSelect = page.locator('#speech-domain');
    await domainSelect.selectOption('custom');

    const customHintInput = page.locator('#custom-domain-hint');
    await customHintInput.fill('test');

    const charCount = page.locator('.settings-hint').filter({ hasText: '/500 characters' });
    await expect(charCount).toContainText('4/500 characters');
  });

  test('should limit custom hint to 500 characters', async ({ page }) => {
    const domainSelect = page.locator('#speech-domain');
    await domainSelect.selectOption('custom');

    const customHintInput = page.locator('#custom-domain-hint');

    // Try to enter more than 500 characters
    const longText = 'a'.repeat(600);
    await customHintInput.fill(longText);

    // Should be limited to 500 characters
    const value = await customHintInput.inputValue();
    expect(value.length).toBeLessThanOrEqual(500);
  });

  test('should hide custom hint input when switching away from Custom', async ({ page }) => {
    const domainSelect = page.locator('#speech-domain');
    const customHintInput = page.locator('#custom-domain-hint');

    // Select custom domain
    await domainSelect.selectOption('custom');
    await expect(customHintInput).toBeVisible();

    // Switch to another domain
    await domainSelect.selectOption('general');
    await expect(customHintInput).not.toBeVisible();
  });
});

test.describe('Settings Page - Save and Cancel', () => {
  test('should call saveSettings when Save clicked', async ({ page }) => {
    let savedSettings: any = null;

    await page.addInitScript(() => {
      (window as any).electronAPI = {
        getSettings: () =>
          Promise.resolve({
            apiKey: '',
            model: 'gemini-3-flash-preview',
            languages: [],
            speechDomain: 'programming',
            customDomainHint: '',
            microphoneDeviceId: '',
            silenceDetectionEnabled: true,
            silenceDurationMs: 2500,
            launchAtStartup: false,
          }),
        saveSettings: (settings: any) => {
          (window as any).lastSavedSettings = settings;
          return Promise.resolve(true);
        },
        closeSettingsWindow: () => {},
        openSettingsWindow: () => {},
      };
    });

    await page.goto(SETTINGS_URL);

    // Modify some settings
    const apiKeyInput = page.locator('#api-key');
    await apiKeyInput.fill('my-test-key');

    const englishCheckbox = page.locator('.language-option').filter({ hasText: 'English' }).locator('input');
    await englishCheckbox.click();

    const customKeywordsInput = page.locator('#custom-keywords');
    await customKeywordsInput.fill('Bun = bull');

    // Click save
    const saveBtn = page.locator('.settings-btn-primary');
    await saveBtn.click();

    // Verify settings were saved
    savedSettings = await page.evaluate(() => (window as any).lastSavedSettings);
    expect(savedSettings.apiKey).toBe('my-test-key');
    expect(savedSettings.languages).toContain('en');
    expect(savedSettings.customKeywords).toBe('Bun = bull');
  });

  test('should show "Saved!" message after successful save', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).electronAPI = {
        getSettings: () =>
          Promise.resolve({
            apiKey: '',
            model: 'gemini-3-flash-preview',
            languages: [],
            speechDomain: 'programming',
            customDomainHint: '',
            microphoneDeviceId: '',
            silenceDetectionEnabled: true,
            silenceDurationMs: 2500,
            launchAtStartup: false,
          }),
        saveSettings: () => Promise.resolve(true),
        closeSettingsWindow: () => {},
        openSettingsWindow: () => {},
      };
    });

    await page.goto(SETTINGS_URL);

    const saveBtn = page.locator('.settings-btn-primary');
    await saveBtn.click();

    const saveMessage = page.locator('.settings-message');
    await expect(saveMessage).toContainText('Saved!');
  });

  test('should show "Failed to save" message on save error', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).electronAPI = {
        getSettings: () =>
          Promise.resolve({
            apiKey: '',
            model: 'gemini-3-flash-preview',
            languages: [],
            speechDomain: 'programming',
            customDomainHint: '',
            microphoneDeviceId: '',
            silenceDetectionEnabled: true,
            silenceDurationMs: 2500,
            launchAtStartup: false,
          }),
        saveSettings: () => Promise.resolve(false),
        closeSettingsWindow: () => {},
        openSettingsWindow: () => {},
      };
    });

    await page.goto(SETTINGS_URL);

    const saveBtn = page.locator('.settings-btn-primary');
    await saveBtn.click();

    const saveMessage = page.locator('.settings-message');
    await expect(saveMessage).toContainText('Failed to save');
  });

  test('should call closeSettingsWindow when Cancel clicked', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).closeCalled = false;
      (window as any).electronAPI = {
        getSettings: () =>
          Promise.resolve({
            apiKey: '',
            model: 'gemini-3-flash-preview',
            languages: [],
            speechDomain: 'programming',
            customDomainHint: '',
            microphoneDeviceId: '',
            silenceDetectionEnabled: true,
            silenceDurationMs: 2500,
            launchAtStartup: false,
          }),
        saveSettings: () => Promise.resolve(true),
        closeSettingsWindow: () => {
          (window as any).closeCalled = true;
        },
        openSettingsWindow: () => {},
      };
    });

    await page.goto(SETTINGS_URL);

    const cancelBtn = page.locator('.settings-btn-secondary');
    await cancelBtn.click();

    const closeCalled = await page.evaluate(() => (window as any).closeCalled);
    expect(closeCalled).toBe(true);
  });

  test('should disable Save button while saving', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).electronAPI = {
        getSettings: () =>
          Promise.resolve({
            apiKey: '',
            model: 'gemini-3-flash-preview',
            languages: [],
            speechDomain: 'programming',
            customDomainHint: '',
            microphoneDeviceId: '',
            silenceDetectionEnabled: true,
            silenceDurationMs: 2500,
            launchAtStartup: false,
          }),
        saveSettings: () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(true), 1000);
          }),
        closeSettingsWindow: () => {},
        openSettingsWindow: () => {},
      };
    });

    await page.goto(SETTINGS_URL);

    const saveBtn = page.locator('.settings-btn-primary');
    await saveBtn.click();

    // Button should be disabled and show "Saving..."
    await expect(saveBtn).toBeDisabled();
    await expect(saveBtn).toContainText('Saving...');
  });
});

test.describe('Settings Page - Loading State', () => {
  test('should show loading state while fetching settings', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).electronAPI = {
        getSettings: () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  apiKey: '',
                  model: 'gemini-3-flash-preview',
                  languages: [],
                  speechDomain: 'programming',
                  customDomainHint: '',
                  microphoneDeviceId: '',
                  silenceDetectionEnabled: true,
                  silenceDurationMs: 2500,
                  launchAtStartup: false,
                }),
              500
            );
          }),
        saveSettings: () => Promise.resolve(true),
        closeSettingsWindow: () => {},
        openSettingsWindow: () => {},
      };
    });

    await page.goto(SETTINGS_URL);

    // Should show loading initially
    const loading = page.locator('.settings-loading');
    await expect(loading).toContainText('Loading...');

    // Wait for loading to complete
    await expect(loading).not.toBeVisible({ timeout: 2000 });
  });
});

test.describe('Settings Page - Pre-populated Values', () => {
  test('should load and display existing settings', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).electronAPI = {
        getSettings: () =>
          Promise.resolve({
            apiKey: 'existing-api-key',
            model: 'gemini-2.0-flash',
            languages: ['en', 'ru'],
            speechDomain: 'medical',
            customDomainHint: '',
            microphoneDeviceId: 'device-123',
            silenceDetectionEnabled: false,
            silenceDurationMs: 5000,
            launchAtStartup: true,
          }),
        saveSettings: () => Promise.resolve(true),
        closeSettingsWindow: () => {},
        openSettingsWindow: () => {},
      };
    });

    await page.goto(SETTINGS_URL);

    // Check all values are pre-populated
    const apiKeyInput = page.locator('#api-key');
    await expect(apiKeyInput).toHaveValue('existing-api-key');

    const modelInput = page.locator('#model');
    await expect(modelInput).toHaveValue('gemini-2.0-flash');

    const domainSelect = page.locator('#speech-domain');
    await expect(domainSelect).toHaveValue('medical');

    const silenceCheckbox = page
      .locator('.checkbox-label')
      .filter({ hasText: 'Auto-stop on silence' })
      .locator('input[type="checkbox"]');
    await expect(silenceCheckbox).not.toBeChecked();

    const startupCheckbox = page
      .locator('.checkbox-label')
      .filter({ hasText: 'Launch at startup' })
      .locator('input[type="checkbox"]');
    await expect(startupCheckbox).toBeChecked();

    const englishCheckbox = page.locator('.language-option').filter({ hasText: 'English' }).locator('input');
    await expect(englishCheckbox).toBeChecked();

    const russianCheckbox = page.locator('.language-option').filter({ hasText: 'Russian' }).locator('input');
    await expect(russianCheckbox).toBeChecked();
  });

  test('should load custom domain hint when speechDomain is custom', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).electronAPI = {
        getSettings: () =>
          Promise.resolve({
            apiKey: '',
            model: 'gemini-3-flash-preview',
            languages: [],
            speechDomain: 'custom',
            customDomainHint: 'My custom hint for gardening',
            microphoneDeviceId: '',
            silenceDetectionEnabled: true,
            silenceDurationMs: 2500,
            launchAtStartup: false,
          }),
        saveSettings: () => Promise.resolve(true),
        closeSettingsWindow: () => {},
        openSettingsWindow: () => {},
      };
    });

    await page.goto(SETTINGS_URL);

    const customHintInput = page.locator('#custom-domain-hint');
    await expect(customHintInput).toBeVisible();
    await expect(customHintInput).toHaveValue('My custom hint for gardening');
  });
});

test.describe('Settings Page - Microphone Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Mock navigator.mediaDevices
      const mockDevices = [
        { deviceId: 'default', kind: 'audioinput', label: 'Default Microphone', groupId: '1' },
        { deviceId: 'mic-1', kind: 'audioinput', label: 'USB Microphone', groupId: '2' },
        { deviceId: 'mic-2', kind: 'audioinput', label: 'Built-in Microphone', groupId: '3' },
      ];

      navigator.mediaDevices.getUserMedia = () => Promise.resolve({} as MediaStream);
      navigator.mediaDevices.enumerateDevices = () => Promise.resolve(mockDevices as MediaDeviceInfo[]);

      (window as any).electronAPI = {
        getSettings: () =>
          Promise.resolve({
            apiKey: '',
            model: 'gemini-3-flash-preview',
            languages: [],
            speechDomain: 'programming',
            customDomainHint: '',
            microphoneDeviceId: '',
            silenceDetectionEnabled: true,
            silenceDurationMs: 2500,
            launchAtStartup: false,
          }),
        saveSettings: () => Promise.resolve(true),
        closeSettingsWindow: () => {},
        openSettingsWindow: () => {},
      };
    });

    await page.goto(SETTINGS_URL);
  });

  test('should show System Default option', async ({ page }) => {
    const micSelect = page.locator('#microphone');
    const defaultOption = micSelect.locator('option:text("System Default")');
    await expect(defaultOption).toBeAttached();
  });

  test('should display available microphones from system', async ({ page }) => {
    const micSelect = page.locator('#microphone');

    // Wait for devices to be loaded
    await page.waitForTimeout(100);

    const usbMic = micSelect.locator('option:text("USB Microphone")');
    await expect(usbMic).toBeAttached();

    const builtinMic = micSelect.locator('option:text("Built-in Microphone")');
    await expect(builtinMic).toBeAttached();
  });

  test('should allow selecting a microphone', async ({ page }) => {
    const micSelect = page.locator('#microphone');

    // Wait for devices to be loaded
    await page.waitForTimeout(100);

    await micSelect.selectOption('mic-1');
    await expect(micSelect).toHaveValue('mic-1');
  });
});

test.describe('Settings Page - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).electronAPI = {
        getSettings: () =>
          Promise.resolve({
            apiKey: '',
            model: 'gemini-3-flash-preview',
            languages: [],
            speechDomain: 'programming',
            customDomainHint: '',
            microphoneDeviceId: '',
            silenceDetectionEnabled: true,
            silenceDurationMs: 2500,
            launchAtStartup: false,
          }),
        saveSettings: () => Promise.resolve(true),
        closeSettingsWindow: () => {},
        openSettingsWindow: () => {},
      };
    });

    await page.goto(SETTINGS_URL);
  });

  test('all form fields should have labels', async ({ page }) => {
    // API Key
    const apiKeyLabel = page.locator('label[for="api-key"]');
    await expect(apiKeyLabel).toBeVisible();

    // Model
    const modelLabel = page.locator('label[for="model"]');
    await expect(modelLabel).toBeVisible();

    // Speech Domain
    const domainLabel = page.locator('label[for="speech-domain"]');
    await expect(domainLabel).toBeVisible();

    // Microphone
    const micLabel = page.locator('label[for="microphone"]');
    await expect(micLabel).toBeVisible();
  });

  test('form inputs should be focusable via keyboard', async ({ page }) => {
    const apiKeyInput = page.locator('#api-key');
    await apiKeyInput.focus();
    await expect(apiKeyInput).toBeFocused();

    const modelInput = page.locator('#model');
    await modelInput.focus();
    await expect(modelInput).toBeFocused();

    const domainSelect = page.locator('#speech-domain');
    await domainSelect.focus();
    await expect(domainSelect).toBeFocused();
  });

  test('checkboxes should be toggleable via keyboard', async ({ page }) => {
    const silenceCheckbox = page
      .locator('.checkbox-label')
      .filter({ hasText: 'Auto-stop on silence' })
      .locator('input[type="checkbox"]');

    await silenceCheckbox.focus();
    await expect(silenceCheckbox).toBeFocused();

    // Initially checked
    await expect(silenceCheckbox).toBeChecked();

    // Toggle with space
    await page.keyboard.press('Space');
    await expect(silenceCheckbox).not.toBeChecked();
  });

  test('Save and Cancel buttons should be focusable', async ({ page }) => {
    const cancelBtn = page.locator('.settings-btn-secondary');
    const saveBtn = page.locator('.settings-btn-primary');

    await cancelBtn.focus();
    await expect(cancelBtn).toBeFocused();

    await saveBtn.focus();
    await expect(saveBtn).toBeFocused();
  });
});

test.describe('Settings Page - Unsaved Changes Dialog', () => {
  test('should NOT show discard dialog after successful Save with changes', async ({ page }) => {
    // This test reproduces a bug where clicking Save shows the "Unsaved Changes" dialog
    // after successfully saving. The dialog should NOT appear after Save.
    //
    // The bug occurs because:
    // 1. User makes changes (hasUnsavedChanges = true)
    // 2. User clicks Save
    // 3. Save succeeds, but beforeunload fires when closeSettingsWindow() is called
    // 4. beforeunload handler sees hasUnsavedChanges is still true (state not yet updated)
    // 5. Dialog appears incorrectly

    await page.addInitScript(() => {
      (window as any).closeWindowCalled = false;
      (window as any).electronAPI = {
        getSettings: () =>
          Promise.resolve({
            apiKey: 'test-key',
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
          }),
        saveSettings: () => Promise.resolve(true),
        closeSettingsWindow: () => {
          (window as any).closeWindowCalled = true;
          // Simulate what Electron does - trigger beforeunload when closing window
          window.dispatchEvent(new Event('beforeunload', { cancelable: true }));
        },
        openSettingsWindow: () => {},
        openExternalUrl: () => Promise.resolve(true),
      };
    });

    await page.goto(SETTINGS_URL);

    // Wait for settings to load
    await expect(page.locator('.settings-loading')).not.toBeVisible();

    // Switch to Languages tab and add a language
    const languagesTab = page.locator('[role="tab"]').filter({ hasText: 'Languages' });
    await languagesTab.click();

    // Toggle Russian language
    const russianCheckbox = page.locator('.language-option').filter({ hasText: 'Russian' }).locator('input');
    await russianCheckbox.click();
    await expect(russianCheckbox).toBeChecked();

    // Click Save
    const saveBtn = page.locator('.settings-btn-primary');
    await saveBtn.click();

    // Wait for "Saved!" message to appear
    const saveMessage = page.locator('.settings-message');
    await expect(saveMessage).toContainText('Saved!');

    // Wait a bit for the window close timeout (500ms in code)
    await page.waitForTimeout(600);

    // closeSettingsWindow should have been called (which triggers beforeunload)
    const closeCalled = await page.evaluate(() => (window as any).closeWindowCalled);
    expect(closeCalled).toBe(true);

    // The "Unsaved Changes" dialog should NOT appear after Save
    const discardDialog = page.locator('.confirm-dialog');
    await expect(discardDialog).not.toBeVisible();
  });
});

test.describe('Settings Page - Link to Google AI Studio', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).electronAPI = {
        getSettings: () =>
          Promise.resolve({
            apiKey: '',
            model: 'gemini-3-flash-preview',
            languages: [],
            speechDomain: 'programming',
            customDomainHint: '',
            microphoneDeviceId: '',
            silenceDetectionEnabled: true,
            silenceDurationMs: 2500,
            launchAtStartup: false,
          }),
        saveSettings: () => Promise.resolve(true),
        closeSettingsWindow: () => {},
        openSettingsWindow: () => {},
      };
    });

    await page.goto(SETTINGS_URL);
  });

  test('should have link to Google AI Studio for API key', async ({ page }) => {
    const link = page.locator('a[href="https://aistudio.google.com/apikey"]');
    await expect(link).toBeVisible();
    await expect(link).toContainText('Google AI Studio');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
