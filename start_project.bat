@echo off
echo ================================================
echo    PharmaChain — Pharmaceutical Blockchain App (Sepolia)
echo ================================================
echo.

cd /d "%~dp0"

echo [1/2] Starting Backend Server...
start "Backend Server" cmd /k "cd backend && node server.js"

timeout /t 2 /nobreak >nul

echo [2/2] Starting Frontend...
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo.
echo ================================================
echo  All services started!
echo  Frontend:   http://localhost:5173
echo  Backend:    http://localhost:3001
echo ================================================
echo.
echo Press any key to close this launcher...
pause >nul
