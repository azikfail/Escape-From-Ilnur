param([Parameter(Mandatory=$true)][string]$Source)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$outputDirectory = Join-Path $PSScriptRoot 'build'
[System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
$sourceImage = [System.Drawing.Image]::FromFile($Source)
try {
    # Convert the prepared square image to the PNG and multi-size ICO formats.
    $sourceImage.Save((Join-Path $outputDirectory 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $sizes = @(16, 24, 32, 48, 64, 128, 256)
    $layers = @()
    foreach ($size in $sizes) {
        $bitmap = [System.Drawing.Bitmap]::new($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $stream = [System.IO.MemoryStream]::new()
        try {
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.DrawImage($sourceImage, 0, 0, $size, $size)
            $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
            $layers += ,$stream.ToArray()
        } finally { $stream.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
    }
    $file = [System.IO.File]::Create((Join-Path $outputDirectory 'icon.ico'))
    $writer = [System.IO.BinaryWriter]::new($file)
    try {
        $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
        $offset = 6 + 16 * $sizes.Count
        for ($i = 0; $i -lt $sizes.Count; $i++) {
            $dimension = if ($sizes[$i] -eq 256) { 0 } else { $sizes[$i] }
            $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
            $writer.Write([byte]0); $writer.Write([byte]0)
            $writer.Write([uint16]1); $writer.Write([uint16]32)
            $writer.Write([uint32]$layers[$i].Length); $writer.Write([uint32]$offset)
            $offset += $layers[$i].Length
        }
        foreach ($layer in $layers) { $writer.Write([byte[]]$layer) }
    } finally { $writer.Dispose() }
} finally { $sourceImage.Dispose() }
