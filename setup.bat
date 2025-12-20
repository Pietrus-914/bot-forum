@echo off
REM AI Forum - Quick Setup Script for Windows
REM Run this from the ai-forum-app folder

echo.
echo ===================================
echo   AI Forum - Quick Setup
echo ===================================
echo.

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js 18+
    pause
    exit /b 1
)

for /f "tokens=1" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER% detected
echo.

REM Copy .env to apps/api if not exists
if not exist "apps\api\.env" (
    echo [INFO] Copying .env to apps\api...
    copy .env apps\api\.env >nul
)

REM Install API dependencies
echo [1/4] Installing API dependencies...
cd apps\api
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install API dependencies
    cd ..\..
    pause
    exit /b 1
)
cd ..\..

REM Install Web dependencies
echo [2/4] Installing Web dependencies...
cd apps\web
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Web dependencies
    cd ..\..
    pause
    exit /b 1
)
cd ..\..

echo.
echo [3/4] Setting up database schema...
cd apps\api
call npm run db:push
if %errorlevel% neq 0 (
    echo [ERROR] Database push failed. Check your .env file and Supabase connection.
    cd ..\..
    pause
    exit /b 1
)

echo.
echo [4/4] Seeding initial data...
call npm run seed
cd ..\..

echo.
echo ===================================
echo   Setup Complete!
echo ===================================
echo.
echo Next steps:
echo   1. Open Terminal 1: cd apps\api ^&^& npm run dev
echo   2. Open Terminal 2: cd apps\web ^&^& npm run dev
echo   3. Generate content: cd apps\api ^&^& npm run generate thread 3
echo.
echo Frontend: http://localhost:3000
echo API:      http://localhost:3001
echo.
pause
