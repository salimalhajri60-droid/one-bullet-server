@echo off
setlocal
where deno >nul 2>nul
if errorlevel 1 (
  echo Deno is not installed.
  echo Install it from https://deno.com/runtime then run this file again.
  pause
  exit /b 1
)
echo.
echo === ONE BULLET / Deno Deploy ===
echo This will use Deno's official login flow. Do not paste any token into this file.
echo.
deno deploy create
if errorlevel 1 goto :end
deno deploy --prod
:end
pause
