@echo off
setlocal EnableDelayedExpansion

set "PATH=C:\Users\sripa\mingw64-install\mingw64\bin;C:\Users\sripa\cmake-install\cmake-3.31.6-windows-x86_64\bin;%PATH%"
set "RUSTC=%~1"
shift

set "RUSTC_ARGS="
:collect
if "%~1"=="" goto run
set "RUSTC_ARGS=!RUSTC_ARGS! %1"
shift
goto collect

:run
call "%RUSTC%" !RUSTC_ARGS!
exit /b %ERRORLEVEL%
