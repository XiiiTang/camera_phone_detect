@echo off
echo Testing Node.js server startup...
echo.

REM Kill any existing node processes
taskkill /f /im node.exe >nul 2>&1

REM Start the server in a new window that stays open on error
echo Starting Node.js server...
start "Test Node.js Server" cmd /k "node server.js || (echo ERROR: Server failed to start! && pause)"

REM Wait for server to start
timeout /t 5 /nobreak >nul

REM Test if server is responding
echo Testing server response...
curl http://localhost:3000/api/health

echo.
echo Test completed. Check the server window for any error messages.
pause
