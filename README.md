# Voice Recognition Widget

A minimal floating window for voice-to-text transcription using Google Gemini.

## Requirements

- [Bun](https://bun.sh/) (v1.0+)
- [Google Gemini API Key](https://makersuite.google.com/app/apikey)

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

Output: `release/` folder containing:
- `.dmg` installer
- `.zip` archive

### Windows

```bash
bun run dist:win
```

Output: `release/` folder containing:
- NSIS installer (`.exe`)
- Portable version

### Linux

```bash
bun run dist:linux
```

Output: `release/` folder containing:
- AppImage
- `.deb` package

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `GEMINI_API_KEY` | (required) | Google Gemini API key |
| `GEMINI_MODEL` | `gemini-3-flash-preview` | AI model to use |

## Usage

1. Click the microphone button to start recording
2. Click again to stop and transcribe
3. Transcribed text is automatically copied to clipboard
