@echo off
echo ========================================
echo Restarting Backend Server
echo ========================================
echo.

REM Find and kill the Node process on port 4010
echo [1/3] Stopping existing server on port 4010...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4010') do (
    echo Found process ID: %%a
    taskkill /F /PID %%a 2>nul
    if errorlevel 1 (
        echo Could not kill process %%a - it may have already stopped
    ) else (
        echo Successfully stopped process %%a
    )
)

echo.
echo [2/3] Waiting for port to be released...
timeout /t 2 /nobreak >nul

echo.
echo [3/3] Starting server...
echo ----------------------------------------
node server.js

pause
