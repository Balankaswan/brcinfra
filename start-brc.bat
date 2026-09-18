@echo off
echo Starting BRC Transport Management System...
echo ============================================

REM Check if MongoDB is running (assuming MongoDB is installed as service)
sc query MongoDB >nul 2>&1
if %errorlevel% neq 0 (
    echo MongoDB service not found. Please ensure MongoDB is installed and running as a service.
    echo You can start MongoDB manually or set it as a Windows service.
    pause
    exit /b 1
)

REM Get LAN IP address
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /R /C:"IPv4 Address"') do (
    for /f "tokens=*" %%j in ("%%i") do set LAN_IP=%%j
)
set LAN_IP=%LAN_IP:~1%

if "%LAN_IP%"=="" (
    echo Could not detect LAN IP address
    echo Please check your network connection and try again
    pause
    exit /b 1
)

echo Detected LAN IP: %LAN_IP%

REM Create .env file with correct IP
echo VITE_API_URL=http://%LAN_IP%:5001/api > .env

echo Created .env file with LAN IP

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing frontend dependencies...
    npm install
)

if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    npm install
    cd ..
)

echo Starting servers...
echo   Frontend: http://%LAN_IP%:3000
echo   Backend:  http://%LAN_IP%:5001
echo   Health:   http://%LAN_IP%:5001/health
echo
echo Access from any device on your WiFi network:
echo   http://%LAN_IP%:3000
echo
echo Press Ctrl+C to stop both servers
echo ============================================

REM Start both frontend and backend
start "BRC Backend" cmd /k "cd /d %~dp0 && npm run start:backend"
start "BRC Frontend" cmd /k "cd /d %~dp0 && npm start"
