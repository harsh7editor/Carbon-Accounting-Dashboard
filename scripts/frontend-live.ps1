Param(
    [string]$Url = 'http://localhost:5173'
)

Write-Output "Starting frontend dev server..."
Start-Process -FilePath "npm" -ArgumentList "run","dev" -WorkingDirectory "frontend"

Start-Sleep -Seconds 2
Write-Output "Opening Chrome at $Url"
Start-Process "chrome" $Url
