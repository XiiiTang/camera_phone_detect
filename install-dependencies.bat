@echo off
echo Installing AI Camera Recognition App Dependencies...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version

echo NPM version:
npm --version

echo.
echo Installing npm packages...
npm install

if %errorlevel% neq 0 (
    echo ERROR: Failed to install npm packages
    pause
    exit /b 1
)

echo.
echo Installation completed successfully!
echo.
echo You can now run the application using start-app.bat
echo.
echo Press any key to close this window...
pause >nul
