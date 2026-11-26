Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "A:\snowman_factory_interactive"
WshShell.Run "cmd.exe /c """"A:\snowman_factory_interactive\start_ai_bridge.bat"" --silent""", 0, False
