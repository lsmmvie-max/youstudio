@echo off
setlocal
cd /d "%~dp0"

echo [YouStudio Setup]
echo.

echo Installing server dependencies...
cd apps\server
call bun install
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: Server install failed
  pause
  exit /b 1
)

echo Installing web dependencies...
cd ..\web
call bun install
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: Web install failed
  pause
  exit /b 1
)

cd ..\..
echo.
echo Setup complete! Run start.bat to launch YouStudio.
pause
