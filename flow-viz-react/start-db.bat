@echo off
echo Starting FlowViz Database (PostgreSQL + PGAdmin)...
docker-compose up -d
echo.
echo Services started!
echo ------------------------------------------
echo Database: localhost:5432
echo PGAdmin:  http://localhost:5050 (Login: admin@flowviz.com / password)
echo.
echo To stop services, run: docker-compose down
pause
