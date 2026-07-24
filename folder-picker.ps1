Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.RootFolder = [Environment+SpecialFolder]::MyComputer
$f.ShowNewFolderButton = $false
$f.AutoUpgradeEnabled = $true
$f.Description = "Select a folder"
if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }
