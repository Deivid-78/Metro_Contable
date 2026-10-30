@echo off
rem Crea el icono "Metro Contable" en el escritorio (Windows, usa Microsoft Edge en modo aplicacion)
set "APP=%~dp0www\index.html"
set "ICO=%~dp0www\icon.ico"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Metro Contable.lnk'); $s.TargetPath='%EDGE%'; $s.Arguments='--app='+([uri]'%APP%').AbsoluteUri; $s.IconLocation='%ICO%'; $s.Save()"
echo Listo: busque "Metro Contable" en el escritorio.
pause
