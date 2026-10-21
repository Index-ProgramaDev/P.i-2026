@echo off
chcp 65001 >nul
cd /d "%~dp0\.."
echo ========================================================
echo   Limpeza de Storage e Histórico - Cam-Security
echo ========================================================

if exist ".venv\Scripts\python.exe" (
    .venv\Scripts\python.exe scripts\clean_storage.py %*
) else (
    python scripts\clean_storage.py %*
)

pause
