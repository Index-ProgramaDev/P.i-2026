@echo off
echo ======================================
echo Corrigindo WebSocket Support
echo ======================================
echo.

REM Ativa o ambiente virtual se existir
if exist .venv\Scripts\activate.bat (
    echo Ativando ambiente virtual...
    call .venv\Scripts\activate.bat
) else (
    echo AVISO: Ambiente virtual nao encontrado!
    echo Instalando globalmente...
)

echo.
echo Instalando websockets...
pip install websockets==15.1

echo.
echo Instalando uvicorn[standard]...
pip install "uvicorn[standard]"

echo.
echo ======================================
echo Instalacao concluida!
echo ======================================
echo.
echo Agora reinicie o servidor:
echo   python main.py
echo.
pause
