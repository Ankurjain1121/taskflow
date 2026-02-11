$files = Get-ChildItem -Path 'H:\Claude\new task management\frontend\src' -Recurse -Filter '*.ts'
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match '/api/v1') {
        $newContent = $content -replace '/api/v1', '/api'
        Set-Content $file.FullName -Value $newContent -NoNewline
        Write-Output "Fixed: $($file.FullName)"
    }
}
