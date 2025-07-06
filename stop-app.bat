@echo off
echo Stopping AI Camera Recognition App...
echo.

REM Kill AI backend server
echo Stopping AI backend server...
taskkill /f /im llama-server.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo AI backend server stopped successfully
) else (
    echo AI backend server was not running or failed to stop
)

REM Kill Node.js backend server
echo Stopping Node.js backend server...
for /f "tokens=5" %%a in ('netstat -ano ^| find "3000" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
if %errorlevel% equ 0 (
    echo Node.js backend server stopped successfully
) else (
    echo Node.js backend server was not running or failed to stop
)

echo.
echo All services stopped successfully!
echo.
echo Press any key to close this window...
pause >nul
