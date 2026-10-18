# SPDX-License-Identifier: MIT
# Original Windows SMTC adapter; read-only. No player control or audio recording.
param([int]$OwnerPid = 0, [string]$App = '')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType=WindowsRuntime]
$awaitMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Await-WinRT($operation, [Type]$type) {
    $task = $awaitMethod.MakeGenericMethod($type).Invoke($null, @($operation))
    if (-not $task.Wait(3000)) { throw 'Windows media response timed out' }
    return $task.Result
}
function Emit($value) { [Console]::WriteLine(($value | ConvertTo-Json -Compress -Depth 5)) }
$manager = $null
$lastKey = ''
$lastCover = ''
$coverRetry = 0
while ($true) {
    if ($OwnerPid -gt 0 -and -not (Get-Process -Id $OwnerPid -ErrorAction SilentlyContinue)) { break }
    try {
        if (-not $manager) { $manager = Await-WinRT ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]) }
        $session = $null
        if ($App) {
            # Prefer the requested app's own SMTC session (e.g. cloudmusic).
            # IVectorView is not enumerable in Windows PowerShell; index it by position.
            $sessions = $manager.GetSessions()
            $fallback = $null
            for ($i = 0; $i -lt $sessions.Count; $i++) {
                $candidate = $sessions[$i]
                if (-not $candidate -or $candidate.SourceAppUserModelId -notmatch $App) { continue }
                if (-not $fallback) { $fallback = $candidate }
                try {
                    if ($candidate.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing') { $session = $candidate; break }
                } catch { }
            }
            if (-not $session) { $session = $fallback }
            # GetSessions() can come back empty; fall back to the current session when it matches.
            if (-not $session) {
                $current = $manager.GetCurrentSession()
                if ($current -and $current.SourceAppUserModelId -match $App) { $session = $current }
            }
        } else {
            $session = $manager.GetCurrentSession()
        }
        if (-not $session) {
            Emit @{ connected=$true; hasSong=$false; paused=$true; title=''; artist=''; album=''; id=''; cover=''; duration=0; position=0 }
        } else {
            $props = Await-WinRT ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
            $play = $session.GetPlaybackInfo()
            $timeline = $session.GetTimelineProperties()
            $key = $session.SourceAppUserModelId + '|' + $props.Title + '|' + $props.Artist
            $now = [DateTimeOffset]::UtcNow
            if ($key -ne $lastKey) { $lastKey=$key; $lastCover=''; $coverRetry=0 }
            # Re-read briefly after a track change: title and thumbnail can update separately.
            $includeCover = $coverRetry -lt 3
            if ($includeCover) {
                $coverRetry++
                if ($props.Thumbnail) {
                    $stream = $null; $reader = $null
                    try {
                        $stream = Await-WinRT ($props.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
                        if ($stream.Size -gt 0 -and $stream.Size -le 4194304) {
                            $reader = [Windows.Storage.Streams.DataReader]::new($stream)
                            $null = Await-WinRT ($reader.LoadAsync([uint32]$stream.Size)) ([uint32])
                            $bytes = New-Object byte[] ([int]$stream.Size)
                            $reader.ReadBytes($bytes)
                            $mime = $stream.ContentType
                            if ($mime -match '^image/(png|jpeg|jpg|webp|gif)$') { $lastCover = 'data:' + $mime + ';base64,' + [Convert]::ToBase64String($bytes) }
                        }
                    } catch { } finally {
                        # WinRT stream objects surface as __ComObject; Dispose is not
                        # always reachable, and a cleanup failure must never drop the track.
                        try { if ($reader) { $reader.Dispose() } } catch { }
                        try { if ($stream) { $stream.Dispose() } } catch { }
                    }
                }
            }
            $paused = $play.PlaybackStatus.ToString() -ne 'Playing'
            # Some sessions report a broken timeline (e.g. a 400-year span). Keep the
            # numbers in double space so PowerShell never binds to Math.Max(int,int).
            $duration = [double]0
            $position = [double]0
            if ($timeline) {
                $rawDuration = [double]($timeline.EndTime - $timeline.StartTime).TotalSeconds
                $rawPosition = [double]($timeline.Position - $timeline.StartTime).TotalSeconds
                if ([double]::IsNaN($rawDuration) -or [double]::IsInfinity($rawDuration) -or $rawDuration -lt 0) { $rawDuration = [double]0 }
                if ([double]::IsNaN($rawPosition) -or [double]::IsInfinity($rawPosition) -or $rawPosition -lt 0) { $rawPosition = [double]0 }
                # A duration beyond 240 hours is a broken session, not a real track.
                if ($rawDuration -gt 864000) { $rawDuration = [double]0 }
                if ($rawPosition -gt 864000) { $rawPosition = [double]0 }
                $duration = [Math]::Max([double]0, $rawDuration)
                $position = [Math]::Max([double]0, $rawPosition)
                if (-not $paused) {
                    $elapsed = [double]($now - $timeline.LastUpdatedTime).TotalSeconds
                    if ($elapsed -ge 0 -and $elapsed -lt 120) { $position += $elapsed }
                }
                if ($duration -gt 0) { $position = [Math]::Min($duration, $position) }
                $position = [Math]::Min([double]864000, $position)
            }
            $result = @{ connected=$true; hasSong=([bool]$props.Title); paused=$paused; title=$props.Title; artist=$props.Artist; album=$props.AlbumTitle; id=$key; duration=$duration; position=$position }
            if ($includeCover) { $result.cover=$lastCover }
            Emit $result
        }
    } catch {
        Emit @{ connected=$false; error=$_.Exception.Message }
        $manager = $null
    }
    Start-Sleep -Milliseconds 750
}
