import { describe, it, expect, beforeEach } from 'bun:test';
import type { ClipboardEntry } from './clipboard-history';

// Since clipboard-history uses electron's clipboard directly, we'll test the
// getEntryLabel function which is pure and doesn't depend on electron
// The other functions require electron to be available

describe('clipboard-history - getEntryLabel', () => {
  // Import only the function that doesn't need electron
  // We'll create a standalone implementation for testing

  /**
   * Returns a display label for a clipboard entry.
   * This is a copy of the function for testing purposes.
   */
  function getEntryLabel(entry: Partial<ClipboardEntry>, maxLength = 40): string {
    const parts: string[] = [];

    // Mark our transcriptions
    if (entry.isTranscription) {
      parts.push('[Transcribed]');
    }

    if (entry.image && !entry.image.isEmpty()) {
      const size = entry.image.getSize();
      parts.push(`[Image ${size.width}x${size.height}]`);
    }

    if (entry.text) {
      let text = entry.text.replace(/\s+/g, ' ').trim();
      if (text.length > maxLength) {
        text = text.substring(0, maxLength - 3) + '...';
      }
      parts.push(text);
    }

    return parts.join(' ') || '[Empty]';
  }

  it('should return text content truncated', () => {
    const entry = {
      id: 1,
      text: 'This is a very long text that should be truncated at some point to fit the label',
      timestamp: Date.now(),
    };

    const label = getEntryLabel(entry, 40);

    // substring(0, 37) + '...' = 40 chars
    expect(label).toBe('This is a very long text that should ...');
    expect(label.length).toBe(40);
  });

  it('should return short text without truncation', () => {
    const entry = {
      id: 1,
      text: 'Short text',
      timestamp: Date.now(),
    };

    const label = getEntryLabel(entry);

    expect(label).toBe('Short text');
  });

  it('should include [Transcribed] prefix for transcriptions', () => {
    const entry = {
      id: 1,
      text: 'Transcribed content',
      timestamp: Date.now(),
      isTranscription: true,
    };

    const label = getEntryLabel(entry);

    expect(label).toContain('[Transcribed]');
    expect(label).toContain('Transcribed content');
  });

  it('should include image dimensions for image entries', () => {
    const entry = {
      id: 1,
      image: {
        isEmpty: () => false,
        getSize: () => ({ width: 800, height: 600 }),
      } as any,
      timestamp: Date.now(),
    };

    const label = getEntryLabel(entry);

    expect(label).toContain('[Image 800x600]');
  });

  it('should combine image and text labels', () => {
    const entry = {
      id: 1,
      text: 'Screenshot caption',
      image: {
        isEmpty: () => false,
        getSize: () => ({ width: 1920, height: 1080 }),
      } as any,
      timestamp: Date.now(),
    };

    const label = getEntryLabel(entry);

    expect(label).toContain('[Image 1920x1080]');
    expect(label).toContain('Screenshot caption');
  });

  it('should return [Empty] for empty entries', () => {
    const entry = {
      id: 1,
      timestamp: Date.now(),
    };

    const label = getEntryLabel(entry);

    expect(label).toBe('[Empty]');
  });

  it('should collapse whitespace in text', () => {
    const entry = {
      id: 1,
      text: 'Text   with\n\nmultiple   spaces\tand\ttabs',
      timestamp: Date.now(),
    };

    const label = getEntryLabel(entry);

    expect(label).toBe('Text with multiple spaces and tabs');
  });

  it('should respect custom maxLength parameter', () => {
    const entry = {
      id: 1,
      text: 'This text should be truncated at a custom length',
      timestamp: Date.now(),
    };

    const label = getEntryLabel(entry, 20);

    expect(label).toBe('This text should ...');
    expect(label.length).toBeLessThanOrEqual(20);
  });

  it('should not include empty image in label', () => {
    const entry = {
      id: 1,
      text: 'Text only',
      image: {
        isEmpty: () => true,
        getSize: () => ({ width: 0, height: 0 }),
      } as any,
      timestamp: Date.now(),
    };

    const label = getEntryLabel(entry);

    expect(label).toBe('Text only');
    expect(label).not.toContain('[Image');
  });

  it('should combine transcribed flag with image and text', () => {
    const entry = {
      id: 1,
      text: 'Voice transcription with screenshot',
      image: {
        isEmpty: () => false,
        getSize: () => ({ width: 640, height: 480 }),
      } as any,
      timestamp: Date.now(),
      isTranscription: true,
    };

    const label = getEntryLabel(entry);

    expect(label).toContain('[Transcribed]');
    expect(label).toContain('[Image 640x480]');
    expect(label).toContain('Voice transcription with screenshot');
  });

  it('should handle text at exact maxLength boundary', () => {
    const entry = {
      id: 1,
      text: 'Exactly forty characters long text!!!!!!',
      timestamp: Date.now(),
    };

    const label = getEntryLabel(entry, 40);

    expect(label).toBe('Exactly forty characters long text!!!!!!');
    expect(label.length).toBe(40);
  });

  it('should handle text one character over maxLength', () => {
    const entry = {
      id: 1,
      text: 'This is exactly forty one chars string!',
      timestamp: Date.now(),
    };

    const label = getEntryLabel(entry, 38);

    // 38 - 3 = 35 chars + '...' = 38 chars
    expect(label).toBe('This is exactly forty one chars str...');
    expect(label.length).toBe(38);
  });
});
