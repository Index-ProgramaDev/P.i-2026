@echo off
echo ========================================
echo Iniciando CamSecurity Backend
echo ========================================
echo.
echo Ativando ambiente virtual...
call .venv\Scripts\activate.bat

echo.
echo Iniciando servidor...
python main.py

pause
