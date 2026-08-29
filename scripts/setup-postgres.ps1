param(
  [string]$Database = "sic",
  [string]$User = "postgres",
  [string]$Server = "localhost",
  [int]$Port = 5432
)

$ErrorActionPreference = "Stop"

if ($Database -notmatch '^[a-zA-Z_][a-zA-Z0-9_]*$') {
  throw "El nombre de la base de datos contiene caracteres no permitidos."
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$psql = Get-Command psql -ErrorAction Stop
$createdb = Get-Command createdb -ErrorAction Stop
$securePassword = Read-Host "Contraseña de PostgreSQL para $User" -AsSecureString
$credential = [System.Management.Automation.PSCredential]::new($User, $securePassword)
$plainPassword = $credential.GetNetworkCredential().Password

try {
  $env:PGPASSWORD = $plainPassword
  $exists = & $psql.Source -w -h $Server -p $Port -U $User -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$Database'"

  if ($LASTEXITCODE -ne 0) {
    throw "No fue posible autenticar con PostgreSQL. Verifique usuario, contraseña, puerto y servicio."
  }

  if (($exists | Out-String).Trim() -ne "1") {
    & $createdb.Source -w -h $Server -p $Port -U $User $Database
    if ($LASTEXITCODE -ne 0) {
      throw "No fue posible crear la base de datos '$Database'."
    }
    Write-Host "Base de datos '$Database' creada."
  } else {
    Write-Host "La base de datos '$Database' ya existe."
  }

  $encodedUser = [Uri]::EscapeDataString($User)
  $encodedPassword = [Uri]::EscapeDataString($plainPassword)
  $connectionString = "postgresql://${encodedUser}:${encodedPassword}@${Server}:${Port}/${Database}"
  Set-Content -LiteralPath (Join-Path $projectRoot ".dev.vars") -Value "DATABASE_URL=`"$connectionString`"" -Encoding utf8
  Write-Host "Conexión guardada localmente en .dev.vars (ignorado por Git)."

  Push-Location $projectRoot
  try {
    & pnpm db:migrate
    if ($LASTEXITCODE -ne 0) {
      throw "La conexión funcionó, pero las migraciones no se pudieron aplicar."
    }
  } finally {
    Pop-Location
  }

  Write-Host "PostgreSQL quedó conectado y migrado correctamente."
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  $plainPassword = $null
}
