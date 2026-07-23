@echo off
cd /d "%~dp0"
set NEXT_TELEMETRY_DISABLED=1
where node >nul 2>nul
if errorlevel 1 (
  echo Instaleaza mai intai Node.js 22 LTS de la https://nodejs.org/
  start https://nodejs.org/
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  where npx >nul 2>nul
  if errorlevel 1 (
    echo Instalarea Node.js nu include npm. Reinstaleaza Node.js de la https://nodejs.org/
    pause
    exit /b 1
  )
  set "PNPM=npx --yes pnpm@11.3.0"
) else (
  set "PNPM=pnpm"
)

if "%~1"=="--check" (
  call %PNPM% --version
  if errorlevel 1 goto error
  echo Lansatorul este pregatit.
  exit /b 0
)

call %PNPM% install --frozen-lockfile
if errorlevel 1 goto error
call %PNPM% assets
if errorlevel 1 goto error
call %PNPM% local:prepare
if errorlevel 1 goto error

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:3000'"
call %PNPM% start
goto end

:error
echo.
echo Instalarea nu a putut fi finalizata. Verifica legatura la internet si incearca din nou.
pause

:end
