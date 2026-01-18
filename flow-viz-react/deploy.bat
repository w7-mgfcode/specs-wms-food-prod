@echo off
echo ==========================================
echo   FlowViz Self-Hosted Deployment
echo ==========================================
echo.
echo 1. Building and Starting Containers...
echo    (This may take a few minutes for the first run)
echo.

docker-compose up -d --build

echo.
echo ------------------------------------------
echo Services Deployed!
echo.
echo [Frontend] http://localhost
echo [Backend]  http://localhost:3000
echo [DB Admin] http://localhost:5050 (admin@flowviz.com / password)
echo ------------------------------------------
echo.
echo To stop: docker-compose down
pause
