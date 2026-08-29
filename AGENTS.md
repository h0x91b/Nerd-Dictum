# AI Agents Configuration

Instructions for AI coding assistants working with this codebase.

## Project Context

**Nerd Dictum** is a desktop voice-to-text application built for developers and technical professionals.

### The Problem We Solve

Standard speech recognition fails for technical users because:

1. **Technical vocabulary** — Code terms like `kubectl`, `nginx`, `useState`, camelCase identifiers get mangled into common words
2. **Multilingual speech** — Developers often mix languages (English + Hebrew + Russian in one sentence)
3. **Non-standard diction** — Fast speech, mumbling, accents cause misrecognition
4. **Code dictation** — File paths, function names, CLI commands need exact preservation

### Our Solution

We use Google Gemini's multimodal model with prompts engineered for developer speech. The key insight: a language model understands context better than traditional speech-to-text, so it can preserve technical tokens instead of "correcting" them.

## Architecture

```
src/
├── main/           # Electron main process (window management, system tray, IPC)
├── preload/        # Secure bridge between main and renderer
├── renderer/       # React UI (Vite bundled)
└── lib/            # Shared utilities (audio recording, Gemini API)
```

**Data flow:**
1. User clicks button → renderer sends IPC to main
2. Main starts audio recording via native APIs
3. User clicks again → audio encoded as WAV, sent to Gemini
4. Transcript returned → copied to clipboard → UI shows success

## Working on This Codebase

### Before Any Changes

1. Read `CLAUDE.md` for detailed coding standards
2. Check `CHANGELOG.md` for recent work
3. Run `bun run dev` to understand current behavior

### Core Principles

| Principle | Rule |
|-----------|------|
| Bug fixes | Write failing test first, then fix |
| Testability | Every change needs testing instructions |
| Theming | Use CSS tokens (`--bg-*`, `--text-*`), never hardcode colors |
| Changelog | Update `CHANGELOG.md` |

### Common Tasks

**Adding features:**
1. Understand where it fits in the architecture
2. Implement with proper theming tokens
3. Add testing instructions
4. Update changelog

**Fixing bugs:**
1. Write a failing test that reproduces the bug
2. Fix the code
3. Verify test passes
4. Update changelog

**Changing transcription:**
- Prompt is in `src/lib/api/gemini.ts`
- Audio processing in `src/lib/audio/`
- Test with various speech patterns before committing

### Testing

```bash
bun run test        # Unit tests
bun run dev         # Manual testing with hot reload
```

For non-visible changes, use the `log()` function so changes can be verified.

### Git Editor Behavior

When running Git commands that may open an editor (`git rebase --continue`, merge commits, `git commit` without `-m`, etc.), always force a terminal-only editor or bypass the editor entirely.

- Prefer non-interactive forms like `git commit -m`, `git rebase --continue --no-edit`, or `GIT_EDITOR=true git rebase --continue`
- Never allow Git to open GUI editors like Xcode, VS Code, Cursor, or any desktop app during agent work
- If manual message editing is unavoidable, use a terminal editor only

### Git Commit Discipline

After completing any code, config, or documentation change, commit it immediately unless the user explicitly says not to commit yet.

- Do not leave finished work uncommitted by default
- Prefer small, focused commits with clear messages over one giant dump at the end
- If a task naturally produces multiple distinct changes, commit each completed chunk as you finish it

### Logging (Main Process)

In `src/main/main.ts`, use the `log()` function instead of `console.log/error/warn`:

```typescript
log('[Component] Message', data);
```

**Why:** `console.log` only writes to stdout, which is invisible when the app is launched via Finder/Launchpad/Login Items. The `log()` function uses `electron-log` which writes to both stdout AND a file at `~/Library/Logs/nerd-dictum/main.log`.

**Viewing logs:**
```bash
# Real-time
tail -f ~/Library/Logs/nerd-dictum/main.log

# Or open Console.app → ~/Library/Logs → nerd-dictum
```

**Format:** Use bracketed component names like `[AutoUpdater]`, `[Settings]`, `[Permissions]`.

## Technical Decisions

**Why Gemini over Whisper/other speech APIs:**
- Multimodal model understands context
- Single API for transcription + domain understanding
- Better at preserving technical tokens

**Gemini API Key:**
- Must be from a personal Gmail account, not a Google Workspace (enterprise) account
- Enterprise accounts may have restrictions that prevent API access

**Why Electron:**
- Cross-platform (macOS, Windows, Linux)
- System tray integration
- Global hotkeys
- Always-on-top floating window

## Target Users

- Multilingual developers (English/Hebrew/Russian common)
- People with non-standard speech patterns
- Anyone dictating technical content who's tired of autocorrect mangling their words

## Known Issues

### Native Modules and Universal macOS Builds

**Problem:** Native Node.js modules with prebuilds (like `uiohook-napi`) cause mach-o mismatch errors when building universal macOS binaries. The `@electron/universal` tool cannot merge the builds because prebuild binaries exist only for one architecture in the `build/Release` directory.

**What was tried:**
- `singleArchFiles` and `x64ArchFiles` in electron-builder config — doesn't work for files outside ASAR
- `npmRebuild: false` to skip `@electron/rebuild` — build passes but app crashes at runtime
- `PREBUILDS_ONLY=true` env var for `node-gyp-build` — still doesn't work in production builds
- Separate x64/arm64 builds — breaks auto-updates

**Current workaround:** The hold-to-record feature (which required `uiohook-napi` for global keyboard hooks) has been temporarily removed. The types (`HoldToRecordKey`, settings fields) are preserved in `src/shared/types.ts` for future restoration.

**To restore hold-to-record:**
1. Find a native module alternative that works with universal builds, OR
2. Find a way to make `uiohook-napi` work with `@electron/universal`, OR
3. Use Electron's built-in `globalShortcut` API for a subset of functionality (limited to shortcuts, not hold-to-release behavior)
