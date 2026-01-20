# Changelog

[2026-01-20 12:40] Feature — Initial project skeleton with Electron + React + Vite setup
[2026-01-20 12:45] Bug — Fix invisible window by adding background color to widget container
[2026-01-20 14:25] Feature — Implement audio recording with Web Audio API (WAV, PCM 16-bit mono 16kHz)
[2026-01-20 13:15] Feature — Add WAV encoding utility with base64 support for Gemini API
[2026-01-20 13:15] Bug — Fix window dragging by applying -webkit-app-region to visible widget instead of transparent body
[2026-01-20 13:18] Bug — Increase widget padding to 20px for larger drag region around button
[2026-01-20 13:25] Refactor — Remove widget padding/border, implement manual drag via IPC on button with click/drag detection
[2026-01-20 13:30] Bug — Fix drag using global window events, add CSS fallbacks for button styling
[2026-01-20 13:35] Bug — Fix dragging and styling: circular widget with CSS drag region, hardcoded dark colors, button with no-drag
[2026-01-20 13:40] Bug — Disable transparent window, use dark background, full-size circular button for recording
[2026-01-20 15:40] Feature — Add draggable "Voice" title bar above mic button, window resized to 100x120
[2026-01-20 15:45] Refactor — Replace text title with grip dots drag handle for better UX
[2026-01-20 15:50] Bug — Fix widget to fill window, remove side borders, resize window to 80x100
[2026-01-20 16:05] Feature — Integrate audio recording with transcription API, copy result to clipboard
[2026-01-20 17:15] Feature — Add audio validation (min 250ms, max 15 minutes) with user-facing error messages
[2026-01-20 16:55] Feature — Add error handling with user-friendly messages, error/success flash styling, and retry capability for transient errors
[2026-01-20 17:35] Test — Add comprehensive unit tests (errors.test.ts, App.test.tsx) and E2E tests (voice-widget.spec.ts) for error handling feature
