# Changelog

## 2026-02-03

- Bug — Fix crash on quit: remove call to undefined stopKeyboardHook() left over from uiohook-napi removal
- Bug — Fix macOS microphone indicator staying active when opening Settings; properly release MediaStream after enumerating audio devices
- Feature — Auto-lower volume during recording: lowers system volume to 10% when recording starts, restores original level after transcription completes (macOS only)
- Feature — Add usage statistics: track total transcriptions, words, characters, recording time with 30-day activity graph; includes streak counter, most active day, time saved estimate, and reset option

## 2026-02-01

- Feature — Add hold-to-record mode: hold a modifier key (Right Command by default) to record, release to transcribe; configurable in Settings > General
- Feature — Add Google Analytics 4 integration for usage tracking: app_start, recording_start, recording_stop, transcription_success, transcription_error events
- Feature — Add "Forever" option to hide popup: hide widget permanently until manually shown via tray menu
- Feature — Add "Hide widget permanently" setting in General tab

## 2026-01-28

- Feature — Expand conversation context: include last 3 transcripts for better accuracy in ongoing conversations
- Feature — Add customizable global hotkey: change the recording shortcut from default ⌘⇧R to any key combination; configure in Settings > General
- Feature — Add hide button (eye icon) with popup menu to temporarily hide widget for 10 minutes, 1 hour, 3 hours, or until end of day

## 2026-01-27

- Feature — Add sound feedback on transcription completion: success chime when text is copied to clipboard, error tone on failure; toggle in Settings > General

## 2026-01-25

- Feature — Enforce single instance: prevent multiple app instances from running simultaneously
- Feature — Add "Use previous transcript as context" setting to improve accuracy for related speech
- Feature — Add Clarification setting to clean up speech disfluencies (uh, um, stutters, filler words)
- Feature — Add custom language input and reorderable selected languages list
- Feature — Rename onboarding screen to "Welcome"; add "Reset Welcome Screen" button in Settings
- Feature — Add clipboard history (20 entries): saves previous clipboard content and transcriptions; access via tray menu or Cmd+Shift+V
- UX — Add explicit cancel indication during transcription: hover shows ✕ icon over spinner
- UX — Split settings page into 4 tabs: General, Languages, Appearance, Advanced
- UX — Add confirmation dialog when canceling settings with unsaved changes
- UX — Improve language selection: add search field, group by popularity
- Bug — Fix race condition in transcribeWithRetry: abort existing transcription before starting new one
- Performance — Move update check and microphone permission request to background; UI now appears instantly on startup

## 2026-01-24

- Bug — Fix macOS microphone indicator staying active after recording stops; add cleanup on component unmount and window close
- Bug — Fix auto-updater not quitting app after user clicks "Restart Now"

## 2026-01-23

- Feature — Add GitHub Actions release workflow for cross-platform builds (macOS, Windows, Linux)
- Feature — Add auto-update support via electron-updater with GitHub Releases; checks hourly and on startup
- Bug — Fix quitAndInstall not working on macOS: properly close tray and windows before installing update

## 2026-01-22

- Feature — Add custom keyword glossary to bias transcription with user-defined terms and aliases
- Feature — Add onboarding screen with step-by-step instructions for getting Google Gemini API key
- Feature — Add info button opening separate window with usage instructions
- Feature — Add "Developer Tools" toggle in system tray menu
- Feature — Settings and Info windows now appear in Cmd+Tab (dynamic dock visibility)
- Feature — Settings and Info windows now open on the same screen as the widget (multi-monitor support)
- UI — Replace mic button tooltip with permanent "⌘⇧R" shortcut hint
- Bug — Fix Settings and Info windows moving together with main widget when dragging
- Bug — Fix window titles to show "Nerd Dictum — Settings" and "Nerd Dictum — How to Use"
- Bug — Fix dock icon not appearing correctly for Info window
- Bug — Debounce silence/sound state logs to reduce console spam
- Feature — Update retry logic: 30s timeout for first attempt, 2min timeout for retry

## 2026-01-21

- Feature — Add success state with green checkmark icon that fades to idle after transcription
- Feature — Expand settings: speech domain selector, microphone device picker, silence detection toggle with adjustable duration
- Feature — Add "Launch at startup" option in Settings
- Feature — Add theme selector (light/dark/system) with preview swatches and cross-window sync
- Feature — Add real-time audio level visualization as tachometer arc around mic button
- Feature — Allow canceling in-progress transcription from the widget button
- Refactor — Replace deprecated ScriptProcessorNode with AudioWorkletNode for audio capture
- Refactor — Replace system prompt field with custom domain hint; add "Custom" option to speech domain selector
- Refactor — Centralize window-position validation, reuse WAV encoding helpers

## 2026-01-20

- Feature — Initial project skeleton with Electron + React + Vite setup
- Feature — Implement audio recording with Web Audio API (WAV, PCM 16-bit mono 16kHz)
- Feature — Add WAV encoding utility with base64 support for Gemini API
- Feature — Integrate audio recording with transcription API, copy result to clipboard
- Feature — Add audio validation (min 250ms, max 15 minutes) with user-facing error messages
- Feature — Add error handling with user-friendly messages, error/success flash styling, and retry capability
- Feature — Add global keyboard shortcut (Cmd/Ctrl+Shift+R) to toggle recording
- Feature — Add settings UI with gear icon to configure Gemini API key and model
- Feature — Add custom system prompt and multi-language selection in settings
- Feature — Add system tray integration with Show/Hide, Settings, Quit menu
- Feature — Remember window position across restarts
- Feature — Add silence auto-stop recording (2.5s threshold)
- Feature — Add draggable title bar with grip dots drag handle
- Bug — Fix invisible window by adding background color to widget container
- Bug — Fix window dragging
- Bug — Fix silence auto-stop not working (stale closure issue)
- Bug — Fix settings to open in separate window instead of inside tiny widget
- Test — Add comprehensive unit tests and E2E tests for error handling
