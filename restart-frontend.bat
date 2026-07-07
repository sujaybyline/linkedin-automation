@echo off
echo ========================================
echo Restarting Frontend with Latest Changes
echo ========================================
echo.

cd frontend

echo Step 1: Cleaning old build...
if exist dist\* (
    del /q dist\*
    echo    - Old build files removed
) else (
    echo    - No old build files found
)
echo.

echo Step 2: Building frontend...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)
echo.

echo Step 3: Starting dev server...
echo.
echo ========================================
echo Frontend server starting...
echo Open: http://localhost:5173
echo Press Ctrl+C to stop the server
echo ========================================
echo.

call npm run dev
