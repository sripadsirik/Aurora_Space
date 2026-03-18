@echo off
setlocal

set "PATH=C:\Users\sripa\mingw64-install\mingw64\bin;C:\Users\sripa\cmake-install\cmake-3.31.6-windows-x86_64\bin;%PATH%"
call "C:\Users\sripa\cmake-install\cmake-3.31.6-windows-x86_64\bin\cmake.exe" %*
exit /b %ERRORLEVEL%
