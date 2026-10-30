@echo off
rem Start Pitch with one double-click: rebuilds the website (a few seconds), starts the API, which also
rem serves the website, and opens http://localhost:8000. Close this window to stop Pitch.
title Pitch
cd /d "%~dp0"

rem Already running? Then just open it.
netstat -ano | findstr /r /c:":8000 .*LISTENING" >nul && (
  start "" http://localhost:8000
  exit /b
)

echo Building the website...
pushd frontend
call npm run build --silent
if errorlevel 1 (
  echo.
  echo The website didn't build. See the messages above.
  popd
  pause
  exit /b 1
)
popd

rem Open Chrome (your default browser) once the server answers, in the background.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for ($i = 0; $i -lt 90; $i++) { try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', 8000); $c.Close(); Start-Process 'http://localhost:8000'; break } catch { Start-Sleep 1 } }"

echo.
echo Pitch is starting at http://localhost:8000 . Keep this window open while you use Pitch; close it to stop.
echo.
cd backend
uv run --env-file ../.env.local uvicorn app.main:app --port 8000
pause
