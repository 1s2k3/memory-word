# 测试上传：用 HttpClient 发送 multipart/form-data
$ErrorActionPreference = 'Stop'
$apiUrl = 'https://memory-world-nu.vercel.app/api/upload'
$secret = 'memory-world-2026'
$filePath = 'd:\JavaProject\project01\memory-world\assets\gallery-01.jpg'

if (-not (Test-Path $filePath)) { Write-Output "测试文件不存在: $filePath"; exit 1 }

$fileBytes = [System.IO.File]::ReadAllBytes($filePath)
$fileName = [System.IO.Path]::GetFileName($filePath)

$boundary = '----WebKitFormBoundary' + [System.Guid]::NewGuid().ToString('N').Substring(0, 16)
$LF = "`r`n"

# 构建多部分字节流
$enc = [System.Text.Encoding]::UTF8
$ms = New-Object System.IO.MemoryStream

function Write-Str($ms, $enc, $s) {
  $b = $enc.GetBytes($s)
  $ms.Write($b, 0, $b.Length)
}

# file part
Write-Str $ms $enc "--$boundary$LF"
Write-Str $ms $enc "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"$LF"
Write-Str $ms $enc "Content-Type: image/jpeg$LF$LF"
$ms.Write($fileBytes, 0, $fileBytes.Length)
Write-Str $ms $enc $LF

# title
Write-Str $ms $enc "--$boundary$LF"
Write-Str $ms $enc "Content-Disposition: form-data; name=`"title`"$LF$LF"
Write-Str $ms $enc "测试上传-清晨咖啡$LF"

# category
Write-Str $ms $enc "--$boundary$LF"
Write-Str $ms $enc "Content-Disposition: form-data; name=`"category`"$LF$LF"
Write-Str $ms $enc "日常$LF"

# mood
Write-Str $ms $enc "--$boundary$LF"
Write-Str $ms $enc "Content-Disposition: form-data; name=`"mood`"$LF$LF"
Write-Str $ms $enc "一个温暖的早晨$LF"

# end
Write-Str $ms $enc "--$boundary--$LF"

$bodyBytes = $ms.ToArray()
$ms.Dispose()

try {
  $r = Invoke-WebRequest -Uri $apiUrl -Method Post -UseBasicParsing -TimeoutSec 60 `
    -Headers @{ 'X-Upload-Secret' = $secret } `
    -ContentType "multipart/form-data; boundary=$boundary" `
    -Body $bodyBytes
  Write-Output "Status: $($r.StatusCode)"
  Write-Output "Body: $($r.Content)"
} catch {
  Write-Output "ERR: $($_.Exception.Message)"
  if ($_.ErrorDetails) { Write-Output $_.ErrorDetails.Message }
}
