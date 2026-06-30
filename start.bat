@echo off
setlocal
cd /d "%~dp0"

echo [YouStudio Start]
echo.

echo Killing any processes on ports 3737 and 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3737 "') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 "') do taskkill /f /pid %%a >nul 2>&1

echo Starting SERVER (port 3737)...
start "YouStudio Server" cmd /k "cd /d %~dp0apps\server && bun run dev"

timeout /t 2 /nobreak >nul

echo Starting EDITOR (port 5173)...
start "YouStudio Editor" cmd /k "cd /d %~dp0apps\web && bun run dev"

echo.
echo Services starting:
echo   SERVER: http://localhost:3737/health
echo   EDITOR: http://localhost:5173
echo.
echo Wait a few seconds, then open http://localhost:5173
pause
