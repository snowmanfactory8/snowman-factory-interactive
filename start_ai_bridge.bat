@echo off
chcp 65001 >nul
title SNOWMAN FACTORY - Local LLM CLI Bridge (Codex / Claude)
cd /d "A:\snowman_factory_interactive"

:: Register snowman-ai-bridge:// custom URI protocol in HKCU so browser button can one-click launch the server
reg add "HKCU\Software\Classes\snowman-ai-bridge" /ve /d "URL:Snowman Factory AI Bridge Protocol" /f >nul 2>&1
reg add "HKCU\Software\Classes\snowman-ai-bridge" /v "URL Protocol" /d "" /f >nul 2>&1
reg add "HKCU\Software\Classes\snowman-ai-bridge\shell\open\command" /ve /d "wscript.exe \"A:\snowman_factory_interactive\launch_ai_bridge_silent.vbs\"" /f >nul 2>&1

:: Check if port 8787 is already listening
netstat -ano | findstr ":8787 " | findstr "LISTENING" >nul 2>&1
if "%1"=="--silent" (
  if %errorlevel% equ 0 exit /b 0
  start "" /b node "A:\snowman_factory_interactive\ai_cli_bridge.js"
  exit /b 0
)

echo =============================================================
echo  SNOWMAN FACTORY Local LLM CLI Bridge (http://127.0.0.1:8787)
echo  Browser One-Click Protocol [snowman-ai-bridge://] Registered
echo =============================================================
node "A:\snowman_factory_interactive\ai_cli_bridge.js"
pause
