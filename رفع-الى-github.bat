@echo off
echo ========================================
echo   Setup Git and Push to GitHub
echo ========================================
echo.

REM 1) Set your name and email
set /p GIT_NAME="Enter your name (example: Omar Joky): "
set /p GIT_EMAIL="Enter your email (example: your@email.com): "
git config --global user.name "%GIT_NAME%"
git config --global user.email "%GIT_EMAIL%"
echo Name and email configured.
echo.

REM 2) Add files and create first commit
git init
git add .
git commit -m "gift and perfume store"
echo.

REM 3) Rename branch to main
git branch -M main
echo.

REM 4) Add remote repository
set /p REMOTE="Enter repository URL (example: https://github.com/cb-w/nasamatalward.git): "
git remote remove origin 2>nul
git remote add origin %REMOTE%
echo.

REM 5) Push to GitHub
echo Pushing to GitHub... You will be asked for username and password (use Token from GitHub).
git push -u origin main
echo.
echo Done. If any errors appear, copy and send them.
pause
