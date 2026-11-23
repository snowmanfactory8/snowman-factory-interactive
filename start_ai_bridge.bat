@echo off
chcp 65001 >nul
title SNOWMAN FACTORY - Local LLM CLI Bridge (Codex / Claude)
cd /d "%~dp0"
echo Starting SNOWMAN FACTORY Local LLM CLI Bridge on http://127.0.0.1:8787 ...
node ai_cli_bridge.js
pause
