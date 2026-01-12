@echo off
chcp 65001 >nul
echo ========================================
echo   Push GitHub Pages to Repository
echo ========================================
echo.

cd /d "c:\Users\uSEr\OneDrive\Desktop\การจองเสื้อ\github-pages"

:: Check if git is installed
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed!
    echo Please install Git from: https://git-scm.com/download/win
    pause
    exit /b 1
)

:: Check if .git exists
if not exist ".git" (
    echo [INFO] Initializing Git repository...
    git init
    git remote add origin https://github.com/Rayongcpd/Cpdday2026.git
    echo.
)

:: Add all changes
echo [STEP 1] Adding changes...
git add .

:: Commit
echo [STEP 2] Committing changes...
set /p msg="Enter commit message (or press Enter for default): "
if "%msg%"=="" set msg=Update from local - %date% %time%
git commit -m "%msg%"

:: Push
echo [STEP 3] Pushing to GitHub...
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   SUCCESS! Changes pushed to GitHub
    echo ========================================
) else (
    echo.
    echo [WARNING] Push may have failed. Trying 'master' branch...
    git push -u origin master
)

echo.
pause
