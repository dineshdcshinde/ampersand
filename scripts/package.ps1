<#
.SYNOPSIS
  Build the zip to upload to the Chrome Web Store / Edge Add-ons.

.DESCRIPTION
  Copies only the files the extension needs (no tests, docs or store
  images) into a temporary folder and zips it as dist/ampersand-<version>.zip.
  The version is read from manifest.json, so bump it there first.

.EXAMPLE
  npm run package
#>

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# What ships. Everything else (tests/, docs/, store/, scripts/, package.json) stays out.
$include = @('manifest.json', 'popup.html', 'popup.css', 'popup.js', 'icons', 'src')

$version = (Get-Content manifest.json -Raw | ConvertFrom-Json).version
$dist = Join-Path $root 'dist'
$stage = Join-Path $dist 'stage'
$zip = Join-Path $dist "ampersand-$version.zip"

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
if (Test-Path $zip) { Remove-Item $zip -Force }
New-Item -ItemType Directory -Path $stage -Force | Out-Null

foreach ($item in $include) { Copy-Item $item -Destination $stage -Recurse }

# Zip the *contents* of stage, so manifest.json sits at the root of the zip, as the store requires.
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
Remove-Item $stage -Recurse -Force

Write-Host "Built $zip"
