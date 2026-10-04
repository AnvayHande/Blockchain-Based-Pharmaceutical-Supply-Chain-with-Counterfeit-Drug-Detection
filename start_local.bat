@echo off
echo ================================================
echo    PharmaChain — Local Development Starter
echo ================================================
echo.

cd /d "%~dp0"

echo [1/4] Starting Local Blockchain Node...
start "Hardhat Node" cmd /k "npm run node"

echo Waiting for node to start...
timeout /t 5 /nobreak >nul

echo [2/4] Deploying Smart Contract to Local Node...
call npm run deploy:local

echo [3/4] Starting Backend Server...
start "Backend Server" cmd /k "cd backend && npm start"

echo [4/4] Starting Frontend...
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo.
echo ================================================
echo  All services started successfully!
echo.
echo  Frontend:   http://localhost:5173
echo  Backend:    http://localhost:3001
echo ================================================
echo  *** IMPORTANT: HOW TO LOG IN AS ADMIN ***
echo.
echo  Because you are running locally, Hardhat ALWAYS uses 
echo  Account #0 as the Deployer (Admin).
echo.
echo  1. Open MetaMask.
echo  2. Switch network to "Localhost 8545".
echo  3. Import this EXACT private key:
echo     0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
echo  4. Connect this account to the frontend.
echo ================================================
echo.
pause
