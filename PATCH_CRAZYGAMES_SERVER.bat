@echo off
setlocal EnableExtensions DisableDelayedExpansion
set /p DENO_URL=Paste your Deno app URL (example https://one-bullet.my-org.deno.net): 
if "%DENO_URL%"=="" exit /b 1
powershell -NoProfile -Command "$u='%DENO_URL%'.TrimEnd('/'); $s=Get-Content -LiteralPath 'client-for-crazygames.html' -Raw; $s=$s.Replace('https://YOUR_APP.YOUR_ORG.deno.net',$u); Set-Content -LiteralPath 'index-crazygames-final.html' -Value $s -Encoding UTF8"
echo.
echo Created index-crazygames-final.html
pause
