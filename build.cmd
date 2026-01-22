@echo off
REM Build script for Nerd Dictum
REM Double-click to run

cd /d "%~dp0"

echo === Installing fnm and Node.js ===
call fnm env --use-on-cd | Out-String | Invoke-Expression 2>nul
call fnm install --lts
call fnm use --lts

echo === Installing dependencies ===
call bun install

echo === Building and packaging ===
call bun run dist:win

echo === Done! ===
echo Check the 'release' folder for the built app.
explorer release

pause
