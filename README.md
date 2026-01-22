# Nerd Dictum

**Voice recognition for developers who speak in code.**

A minimal floating widget for voice-to-text transcription, optimized for technical speech. Built for programmers, sysadmins, and other tech professionals who need reliable transcription of domain-specific vocabulary.

## Why This Exists

Standard voice recognition tools struggle with:

- **Technical jargon** — `kubectl`, `nginx`, `systemd`, camelCase identifiers
- **Mixed languages** — switching between English, Hebrew, Russian mid-sentence
- **Imperfect diction** — mumbling, fast speech, accents
- **Code dictation** — file paths, function names, CLI commands

Nerd Dictum uses Google Gemini's multimodal capabilities with a prompt engineered specifically for developer speech. It preserves code tokens, acronyms, and technical terms faithfully instead of "correcting" them to common words.

## Who It's For

- Developers who think faster than they type
- Multilingual tech workers who code-switch constantly
- Anyone with non-standard speech patterns who's tired of being misunderstood
- People who want to dictate commit messages, documentation, or Slack messages without fighting autocorrect

## How It Works

1. Click the microphone button (or use global hotkey)
2. Speak naturally — mix languages, use tech terms
3. Click again to stop
4. Transcription is copied to clipboard automatically

The widget floats above all windows — always accessible, never in the way.

## Requirements

- [Bun](https://bun.sh/) (v1.0+)
- [Google Gemini API Key](https://makersuite.google.com/app/apikey) — **must be from a personal Gmail account**, not a Google Workspace (enterprise) account

## Setup

```bash
# Install dependencies
bun install

# Set your Gemini API key
export GEMINI_API_KEY="your-api-key-here"
```

## Development

```bash
bun run dev
```

## Building Distributable App

### macOS

```bash
bun run dist
```

Output: `release/` folder containing `.dmg` installer and `.zip` archive.

### Windows

```bash
bun run dist:win
```

Output: `release/` folder containing NSIS installer and portable version.

### Linux

```bash
bun run dist:linux
```

Output: `release/` folder containing AppImage and `.deb` package.

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `GEMINI_API_KEY` | (required) | Google Gemini API key |
| `GEMINI_MODEL` | `gemini-3-flash-preview` | AI model to use |

## Technical Details

- **Audio format:** WAV, 16kHz mono, 16-bit PCM
- **Max recording:** 15 minutes
- **Min recording:** 250ms
- **Retry logic:** 3 attempts with exponential backoff

See [CLAUDE.md](./CLAUDE.md) for full technical documentation.
