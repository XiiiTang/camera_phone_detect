@echo off
echo Starting AI Camera Recognition App...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm packages are installed
if not exist node_modules (
    echo Installing npm packages...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install npm packages
        pause
        exit /b 1
    )
)

REM Start AI backend server in new window
echo Starting AI backend server...
start "AI Backend Server" cmd /c "cd /d D:\llamacpp\llama.cpp\build\bin && .\llama-server -hf ggml-org/Qwen2.5-VL-7B-Instruct-GGUF"

REM Wait a moment for AI server to start
timeout /t 5 /nobreak >nul

REM Start Node.js backend server in new window
echo Starting Node.js backend server...
start "Node.js Backend Server" cmd /c "node server.js"

REM Wait a moment for Node.js server to start
timeout /t 3 /nobreak >nul

REM Open browser with the application
echo Opening browser...
start http://localhost:3000

echo.
echo All services started successfully!
echo.
echo Services running:
echo - AI Backend Server (llama-server)
echo - Node.js Backend Server (port 3000)
echo - Web Application (http://localhost:3000)
echo.
echo Press any key to close this window...
pause >nul
