# Voice Recognition Widget

A minimal floating window with a single button for voice-to-text transcription. Press the button to start recording, press again to transcribe using Google Gemini and copy the result to clipboard.

## Tech Stack

- **Electron** + **Bun** + **TypeScript** + **React** + **Vite**
- **Google Gemini API** — speech-to-text transcription

## Commands

```bash
bun run dev      # Dev server + Electron
bun run build    # Production build
bun run test     # Run tests
```

## Project Structure

```
src/main/      — Electron main process
src/preload/   — Electron preload scripts
src/renderer/  — React UI (Vite)
src/lib/       — Shared libraries (audio, api)
```

## Google Gemini API Configuration

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `GEMINI_API_KEY` | (none) | Google Gemini API key (required) |
| `GEMINI_MODEL` | `gemini-3-flash-preview` | AI model to use |

### API Endpoint

```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}
```

### Request Structure

Send a POST request with:
- Text instruction (prompt) as the first part
- Base64-encoded audio data as the second part (inline data with MIME type)

### Transcription Prompt

```
Transcribe the provided audio to text. Preserve developer terms faithfully:
code-like tokens, identifiers, acronyms, file paths. Do not invent content.
Output only the final transcript.
```

**Domain hint:** "programming / developer speech" — added to prompt for better recognition of technical terms.

### Audio Format

- WAV format (PCM, 16-bit, little-endian)
- Sample rate: 16000 Hz (or system default)
- Channels: mono
- Base64 encoded before sending

### Retry Logic

- Maximum 2 retries (3 attempts total)
- Exponential backoff: `250ms * 2^attempt + random jitter (0-200ms)`
- 30-second timeout per request

### Audio Validation

- Minimum recording duration: 250ms
- Maximum recording duration: 15 minutes

---

## Changelog

After every meaningful change, add an entry to `CHANGELOG.md`:

**Entry format (one line = one log):**
```
[YYYY-MM-DD HH:MM] Feature/Bug/Refactor — Brief description of change
```

**Rules:**
1. One PR = one entry (update your line while PR is in progress)
2. One line = one log (no multi-line entries)
3. Add new entries at the END of the file
4. Don't edit others' entries (only your current one)
5. Use exact time down to minutes for uniqueness

**What to log:**
- New features
- Bug fixes
- Breaking changes
- Significant refactoring

---

## Bug Fixing Policy

**Every bug must first be reproduced by a unit test, then fixed.**

1. Write a failing test that reproduces the problem
2. Verify the test fails (red)
3. Fix the code
4. Test must become green

**Exception:** Hard-to-test bugs (race conditions, hardware-specific) — notify user and get permission.

---

## Theming

### Architecture
- **Themes:** `src/renderer/styles/themes/` — `tokens.css`, `theme-{name}.css`
- **Context:** `src/renderer/contexts/ThemeContext.tsx` — `useTheme()` hook
- **Selection:** `data-theme` attribute on `<html>`, persisted in localStorage

### CSS Tokens (use these, never hardcode colors!)
```css
/* Backgrounds */
--bg-app, --bg-primary, --bg-secondary, --bg-tertiary, --bg-hover, --bg-active

/* Text */
--text-primary, --text-secondary, --text-tertiary, --text-inverse

/* Borders */
--border-default, --border-subtle, --border-strong

/* Accent (interactive) */
--accent-primary, --accent-hover, --accent-active

/* Semantic */
--color-success, --color-warning, --color-error, --color-info

/* Widget-specific */
--color-recording, --color-transcribing

/* Shadows */
--shadow-sm, --shadow-md, --shadow-lg
```

### Writing Theme-Friendly CSS
```css
/* GOOD */
.my-component {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}

.my-button:hover {
  background: var(--bg-hover);
}

/* BAD - never do this */
.my-component {
  background: #2a2a2a;  /* hardcoded! */
  color: #e0e0e0;       /* hardcoded! */
}
```

### Adding a New Theme
1. Create `src/renderer/styles/themes/theme-{name}.css`
2. Define all tokens inside `[data-theme="{name}"] { ... }`
3. Import in `global.css`
4. Add to `ThemeMode` type in `ThemeContext.tsx`

---

## Application States

The widget has three states:
- **Idle** — Waiting for user input (microphone button ready)
- **Recording** — Capturing audio from microphone (button pulsing)
- **Transcribing** — Sending audio to API, waiting for response (spinner)

## User Flow

1. User clicks microphone button → State: `Idle` → `Recording`
2. User clicks again to stop → State: `Recording` → `Transcribing`
3. API returns transcript → Copy to clipboard → State: `Transcribing` → `Idle`
4. Show flash message: "Copied to clipboard"
