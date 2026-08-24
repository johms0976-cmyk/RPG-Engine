<#
============================================================
  FIREWALL — make this PC reachable by phones on the wifi.

  The single most common reason a phone cannot reach the table
  server is not a missing allow rule. It is a BLOCK rule that
  Windows created silently.

  The first time node.exe binds a socket, Windows shows the
  "Allow node.js JavaScript Runtime to communicate on these
  networks?" dialog. Pressing Cancel, pressing Escape, clicking
  away, or letting it time out does not mean "ask me later" —
  it writes two inbound BLOCK rules for that node.exe, one for
  Private and one for Public, and they persist forever.

  Block rules take precedence over allow rules in Windows
  Firewall. So the usual advice — "add an inbound allow rule
  for port 8080" — cannot work while those exist. The port
  rule is added, the user is told it is fixed, and the phone
  still times out. That is the loop this script breaks.

  Order of operations, and all three matter:

    1. Delete inbound BLOCK rules pointing at node.exe.
    2. Add an inbound ALLOW rule for the port (Private+Domain).
    3. Make sure the wifi is classified Private, because a rule
       scoped to Private does nothing on a network Windows has
       decided is Public.

  Usage (it elevates itself, so a normal shell is fine):

      powershell -ExecutionPolicy Bypass -File scripts\firewall.ps1
      powershell -ExecutionPolicy Bypass -File scripts\firewall.ps1 -Port 3000
      powershell -ExecutionPolicy Bypass -File scripts\firewall.ps1 -Undo
============================================================
#>

param(
  [int]$Port = 8080,
  [switch]$Undo,
  [switch]$NoPause
)

$ErrorActionPreference = "Stop"
$RuleName = "Mothership Engine"

function Say  ($m) { Write-Host "  $m" }
function Good ($m) { Write-Host "  [ OK ]   $m"  -ForegroundColor Green }
function Bad  ($m) { Write-Host "  [ BAD ]  $m"  -ForegroundColor Red }
function Note ($m) { Write-Host "           $m" -ForegroundColor DarkGray }
function Rule ()   { Write-Host ("  " + ("-" * 56)) }

# ---------------- elevate ----------------
# Firewall rules need administrator. Re-launch ourselves with the
# same arguments rather than failing with an access-denied stack.

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host ""
  Write-Host "  Firewall changes need administrator - asking for it now." -ForegroundColor Yellow
  Write-Host "  A UAC prompt is about to appear. Say yes." -ForegroundColor Yellow
  Write-Host ""
  $argList = @(
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-File", "`"$PSCommandPath`"",
    "-Port", $Port
  )
  if ($Undo) { $argList += "-Undo" }
  try {
    Start-Process powershell -Verb RunAs -ArgumentList $argList
  } catch {
    Write-Host "  Elevation was refused. Nothing has been changed." -ForegroundColor Red
    Write-Host "  Right-click Doctor.bat and choose 'Run as administrator' instead."
    Write-Host ""
    if (-not $NoPause) { Read-Host "  Press Enter to close" }
  }
  exit
}

Write-Host ""
Rule
Write-Host "  MOTHERSHIP ENGINE - firewall setup   (port $Port)"
Rule
Write-Host ""

# ---------------- undo ----------------

if ($Undo) {
  $existing = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
  if ($existing) {
    $existing | Remove-NetFirewallRule
    Good "Removed the '$RuleName' rule."
  } else {
    Say "There was no '$RuleName' rule to remove."
  }
  Note "Any node.exe block rules this script deleted are not restored -"
  Note "Windows will simply ask you again next time node opens a port."
  Write-Host ""
  if (-not $NoPause) { Read-Host "  Press Enter to close" }
  exit
}

# ---------------- 1. the block rules ----------------
# Query by application filter first: enumerating every rule and asking
# each one for its program is minutes of work on a machine with a full
# rule set, and this is seconds.

Say "Looking for block rules that Windows created for node.exe..."
Write-Host ""

$blockers = @()
try {
  $blockers = Get-NetFirewallApplicationFilter |
    Where-Object { $_.Program -and $_.Program -like "*node.exe" } |
    Get-NetFirewallRule -ErrorAction SilentlyContinue |
    Where-Object { $_.Direction -eq "Inbound" -and $_.Action -eq "Block" }
} catch {
  Bad "Could not read the firewall rule set: $($_.Exception.Message)"
}

if ($blockers -and $blockers.Count -gt 0) {
  Bad "Found $($blockers.Count) inbound BLOCK rule(s) for node.exe."
  Note "This is almost certainly why phones cannot reach the table."
  Note "A block rule beats any allow rule, so adding a port rule alone"
  Note "would have changed nothing."
  Write-Host ""
  foreach ($r in $blockers) {
    $prog = ($r | Get-NetFirewallApplicationFilter).Program
    Note "removing: $($r.DisplayName)  [$($r.Profile)]"
    Note "          $prog"
    Remove-NetFirewallRule -Name $r.Name
  }
  Write-Host ""
  Good "Block rules removed."
} else {
  Good "No node.exe block rules found - nothing was silently blocking you."
}

Write-Host ""

# ---------------- 2. the allow rule ----------------

$old = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
if ($old) { $old | Remove-NetFirewallRule }

New-NetFirewallRule `
  -DisplayName $RuleName `
  -Description "Lets phones on the same network reach the Mothership Engine table server." `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort $Port `
  -Profile Private,Domain `
  -Enabled True | Out-Null

Good "Added an inbound allow rule for TCP $Port (Private + Domain)."
Note "Deliberately NOT Public: a cafe network should not be able to"
Note "reach your table. Step 3 is about making sure your home wifi"
Note "is not miscategorised as Public."

Write-Host ""

# ---------------- 3. the network profile ----------------

$profiles = @()
try { $profiles = Get-NetConnectionProfile } catch { }

if (-not $profiles) {
  Bad "Could not read the network profiles. Check them by hand in"
  Note "Settings > Network & internet > Wi-Fi > (your network)."
} else {
  $public = $profiles | Where-Object { $_.NetworkCategory -eq "Public" }
  foreach ($p in $profiles) {
    $cat = $p.NetworkCategory
    if ($cat -eq "Public") { Bad "'$($p.Name)' is set to PUBLIC - the allow rule will not apply to it." }
    else { Good "'$($p.Name)' is $cat - the allow rule applies here." }
  }

  if ($public) {
    Write-Host ""
    Say "Switching a network to Private tells Windows it is a home or"
    Say "office network where other devices are allowed to find this PC."
    Say "Only do this for a network you trust."
    Write-Host ""
    foreach ($p in $public) {
      $answer = Read-Host "  Set '$($p.Name)' to Private? [y/N]"
      if ($answer -match '^[Yy]') {
        try {
          Set-NetConnectionProfile -InterfaceIndex $p.InterfaceIndex -NetworkCategory Private
          Good "'$($p.Name)' is now Private."
        } catch {
          Bad "Could not change it: $($_.Exception.Message)"
        }
      } else {
        Note "Left '$($p.Name)' as Public. Phones on it still will not connect."
      }
    }
  }
}

# ---------------- what to do next ----------------

Write-Host ""
Rule
Write-Host "  DONE"
Rule
Write-Host ""

$ips = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notlike "127.*" -and
    $_.IPAddress -notlike "169.254.*" -and
    $_.InterfaceAlias -notmatch "vEthernet|VirtualBox|VMware|Hyper-V|WSL|Docker|Loopback|Tailscale|VPN"
  }

if ($ips) {
  Say "Start the server (Play.bat), then on the phone open:"
  Write-Host ""
  foreach ($ip in $ips) {
    Write-Host "      http://$($ip.IPAddress):$Port" -ForegroundColor Cyan
    Note "($($ip.InterfaceAlias))"
  }
  Write-Host ""
  Say "If you are not sure which one, try the health check first -"
  Say "it loads instantly and proves reachability without the app:"
  Write-Host ""
  foreach ($ip in $ips) {
    Write-Host "      http://$($ip.IPAddress):$Port/net/health" -ForegroundColor Cyan
  }
  Write-Host ""
  Say "It should show the word: ok"
} else {
  Bad "No usable network address found. This PC is not on a wifi or"
  Note "ethernet that a phone could share."
}

Write-Host ""
Say "Still nothing? The remaining suspects, in order:"
Note "1. Third-party antivirus (Norton, McAfee, ESET, Bitdefender,"
Note "   Avast, Kaspersky) has its own firewall that ignores all of"
Note "   the above. Allow node.exe inbound inside that product."
Note "2. Router has AP / client isolation enabled - devices on the"
Note "   wifi cannot see each other at all. It is a checkbox in the"
Note "   router's wireless settings, often on by default on mesh kit."
Note "3. Phone is on 5GHz and PC on a separate guest SSID, or the"
Note "   phone is on mobile data with wifi assist quietly on."
Note "4. A VPN client on this PC is capturing the whole network stack."
Write-Host ""

if (-not $NoPause) { Read-Host "  Press Enter to close" }
