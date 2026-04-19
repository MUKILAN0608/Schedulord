@echo off
color 0E
echo =======================================================
echo     INITIATING SCHEDULORD SOVEREIGN ARCHITECTURE       
echo =======================================================
echo.

echo [1/3] Igniting Go Engine...
start "Sovereign Go Engine" cmd /c "cd backend\go-engine && go run ./cmd/main.go"

echo [2/3] Igniting API Gateway (Node.js)...
start "Schedulord API Gateway" cmd /c "cd backend\api-gateway && npm run dev"

echo [3/3] Igniting Frontend (React/Vite)...
start "Schedulord Frontend" cmd /c "cd frontend && npm run dev"

echo.
echo [STATUS] All systems are fully active. 
echo [STATUS] Three background terminals have been launched.
echo [STATUS] Access the platform at: http://localhost:3001
echo.
echo =======================================================
pause
