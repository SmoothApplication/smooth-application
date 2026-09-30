param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Message
)

# One-command "ship it": stage everything, commit, and push, so you don't have to retype
# `git add -A` / `git commit -m "..."` / `git push` separately every time.
#
# Usage (from this folder, in PowerShell):
#   .\ship.ps1 "Fix the thing that was broken"
#
# If PowerShell blocks the script the first time with an "execution policy" error, run this once
# in the same window, then try again:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

$ErrorActionPreference = "Stop"

Write-Host "==> git add -A"
git add -A

$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Host "Nothing to commit - working tree matches the last commit. Skipping commit/push."
    exit 0
}

Write-Host "==> git commit"
git commit -m $Message

Write-Host "==> git push"
git push

Write-Host ""
Write-Host "Done. Pushed to main." -ForegroundColor Green
