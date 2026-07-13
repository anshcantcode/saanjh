$ErrorActionPreference = 'Stop'

# Original procedural sound design for Saanjh's forest rituals.
# No source recordings or third-party audio are used. Running this script with
# the same PowerShell/.NET runtime always produces the same PCM samples.

$SampleRate = 24000
$outputDirectory = Join-Path $PSScriptRoot '..\assets\sounds'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

function Get-SmoothStep {
  param([double]$Value)
  $x = [Math]::Max(0.0, [Math]::Min(1.0, $Value))
  return $x * $x * (3.0 - (2.0 * $x))
}

function Get-FadeEnvelope {
  param(
    [double]$Time,
    [double]$Duration,
    [double]$Attack = 0.025,
    [double]$Release = 0.12
  )
  $fadeIn = Get-SmoothStep ($Time / [Math]::Max(0.001, $Attack))
  $fadeOut = Get-SmoothStep (($Duration - $Time) / [Math]::Max(0.001, $Release))
  return $fadeIn * $fadeOut
}

function Write-PcmWav {
  param(
    [string]$Path,
    [double[]]$Samples,
    [double]$Peak = 0.22
  )

  # Remove any tiny DC offset, then normalize conservatively. The deliberately
  # low peak leaves headroom when multiple interactions overlap on a phone.
  $mean = 0.0
  foreach ($sample in $Samples) { $mean += $sample }
  if ($Samples.Count -gt 0) { $mean /= $Samples.Count }

  $largest = 0.0
  foreach ($sample in $Samples) {
    $magnitude = [Math]::Abs($sample - $mean)
    if ($magnitude -gt $largest) { $largest = $magnitude }
  }
  $scale = if ($largest -gt 0.0000001) { $Peak / $largest } else { 0.0 }

  $channels = 1
  $bitsPerSample = 16
  $bytesPerSample = $bitsPerSample / 8
  $dataSize = $Samples.Count * $channels * $bytesPerSample
  $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Create)
  $writer = [System.IO.BinaryWriter]::new($stream)
  try {
    $writer.Write([Text.Encoding]::ASCII.GetBytes('RIFF'))
    $writer.Write([int](36 + $dataSize))
    $writer.Write([Text.Encoding]::ASCII.GetBytes('WAVEfmt '))
    $writer.Write([int]16)
    $writer.Write([int16]1)
    $writer.Write([int16]$channels)
    $writer.Write([int]$SampleRate)
    $writer.Write([int]($SampleRate * $channels * $bytesPerSample))
    $writer.Write([int16]($channels * $bytesPerSample))
    $writer.Write([int16]$bitsPerSample)
    $writer.Write([Text.Encoding]::ASCII.GetBytes('data'))
    $writer.Write([int]$dataSize)

    foreach ($sample in $Samples) {
      $value = [Math]::Max(-1.0, [Math]::Min(1.0, ($sample - $mean) * $scale))
      $writer.Write([int16][Math]::Round($value * 32767.0))
    }
  }
  finally {
    $writer.Dispose()
    $stream.Dispose()
  }
}

function New-FlowerNote {
  param([double]$Frequency, [double]$Duration = 0.82)
  $count = [int]($SampleRate * $Duration)
  $samples = [double[]]::new($count)
  for ($i = 0; $i -lt $count; $i++) {
    $t = $i / $SampleRate
    $fade = Get-FadeEnvelope $t $Duration 0.035 0.16
    $decay = [Math]::Exp(-3.25 * $t / $Duration)
    $fundamental = [Math]::Sin(2.0 * [Math]::PI * $Frequency * $t)
    $softOctave = 0.17 * [Math]::Sin(2.0 * [Math]::PI * ($Frequency * 2.002) * $t + 0.2)
    $warmPartial = 0.055 * [Math]::Sin(2.0 * [Math]::PI * ($Frequency * 3.0) * $t + 0.5)
    $samples[$i] = ($fundamental + $softOctave + $warmPartial) * $fade * $decay
  }
  return $samples
}

function New-FireflySparkle {
  $duration = 0.64
  $count = [int]($SampleRate * $duration)
  $samples = [double[]]::new($count)
  $phase = 0.0
  for ($i = 0; $i -lt $count; $i++) {
    $t = $i / $SampleRate
    $p = $t / $duration
    $frequency = 760.0 + (760.0 * (Get-SmoothStep $p))
    $phase += 2.0 * [Math]::PI * $frequency / $SampleRate
    $fade = Get-FadeEnvelope $t $duration 0.03 0.2
    $decay = [Math]::Exp(-2.4 * $p)
    $shimmer = [Math]::Sin($phase) + (0.2 * [Math]::Sin(($phase * 1.502) + 0.35))
    $samples[$i] = $shimmer * $fade * $decay
  }
  return $samples
}

function New-StarPing {
  $duration = 0.92
  $count = [int]($SampleRate * $duration)
  $samples = [double[]]::new($count)
  for ($i = 0; $i -lt $count; $i++) {
    $t = $i / $SampleRate
    $fade = Get-FadeEnvelope $t $duration 0.022 0.2
    $base = [Math]::Sin(2.0 * [Math]::PI * 659.25 * $t) * [Math]::Exp(-4.1 * $t)
    $bell = 0.28 * [Math]::Sin(2.0 * [Math]::PI * 1318.51 * $t + 0.2) * [Math]::Exp(-6.2 * $t)
    $air = 0.08 * [Math]::Sin(2.0 * [Math]::PI * 1975.53 * $t + 0.8) * [Math]::Exp(-8.0 * $t)
    $samples[$i] = ($base + $bell + $air) * $fade
  }
  return $samples
}

function New-CompletionChime {
  $duration = 2.25
  $count = [int]($SampleRate * $duration)
  $samples = [double[]]::new($count)
  $frequencies = @(392.00, 523.25, 659.25, 783.99)
  $starts = @(0.0, 0.16, 0.34, 0.54)
  for ($i = 0; $i -lt $count; $i++) {
    $t = $i / $SampleRate
    $value = 0.0
    for ($n = 0; $n -lt $frequencies.Count; $n++) {
      $local = $t - $starts[$n]
      if ($local -ge 0.0) {
        $noteDuration = $duration - $starts[$n]
        $fade = Get-FadeEnvelope $local $noteDuration 0.035 0.35
        $decay = [Math]::Exp(-3.35 * $local / $noteDuration)
        $tone = [Math]::Sin(2.0 * [Math]::PI * $frequencies[$n] * $local)
        $tone += 0.13 * [Math]::Sin(2.0 * [Math]::PI * ($frequencies[$n] * 2.003) * $local + 0.2)
        $value += $tone * $fade * $decay * (1.0 - (0.08 * $n))
      }
    }
    $samples[$i] = $value / 2.2
  }
  return $samples
}

function New-LanternBreath {
  param([bool]$Inhale)
  $duration = 1.55
  $count = [int]($SampleRate * $duration)
  $samples = [double[]]::new($count)
  $phase = 0.0
  for ($i = 0; $i -lt $count; $i++) {
    $t = $i / $SampleRate
    $p = $t / $duration
    $curve = Get-SmoothStep $p
    $frequency = if ($Inhale) { 220.0 + (110.0 * $curve) } else { 330.0 - (110.0 * $curve) }
    $phase += 2.0 * [Math]::PI * $frequency / $SampleRate
    $fade = Get-FadeEnvelope $t $duration 0.22 0.3
    $swell = [Math]::Sin([Math]::PI * $p)
    $tone = [Math]::Sin($phase) + (0.11 * [Math]::Sin(($phase * 2.0) + 0.45))
    $samples[$i] = $tone * $fade * (0.32 + (0.68 * $swell))
  }
  return $samples
}

function New-WaterStroke {
  $duration = 0.72
  $count = [int]($SampleRate * $duration)
  $samples = [double[]]::new($count)
  $random = [System.Random]::new(72419)
  $smoothNoise = 0.0
  $slowerNoise = 0.0
  for ($i = 0; $i -lt $count; $i++) {
    $t = $i / $SampleRate
    $p = $t / $duration
    $white = ($random.NextDouble() * 2.0) - 1.0
    $smoothNoise = (0.91 * $smoothNoise) + (0.09 * $white)
    $slowerNoise = (0.985 * $slowerNoise) + (0.015 * $white)
    $band = $smoothNoise - $slowerNoise
    $fade = Get-FadeEnvelope $t $duration 0.055 0.18
    $gesture = [Math]::Sin([Math]::PI * $p)
    $ripple = 0.16 * [Math]::Sin(2.0 * [Math]::PI * (245.0 + (45.0 * $p)) * $t)
    $samples[$i] = (($band * 1.5) + $ripple) * $fade * $gesture
  }
  return $samples
}

function New-StreamCurrent {
  $duration = 1.05
  $count = [int]($SampleRate * $duration)
  $samples = [double[]]::new($count)
  $random = [System.Random]::new(41873)
  $fastWater = 0.0
  $slowWater = 0.0
  for ($i = 0; $i -lt $count; $i++) {
    $t = $i / $SampleRate
    $p = $t / $duration
    $white = ($random.NextDouble() * 2.0) - 1.0
    $fastWater = (0.88 * $fastWater) + (0.12 * $white)
    $slowWater = (0.992 * $slowWater) + (0.008 * $white)
    $current = $fastWater - (0.72 * $slowWater)
    $fade = Get-FadeEnvelope $t $duration 0.14 0.2
    $slowPulse = 0.74 + (0.26 * [Math]::Sin((2.0 * [Math]::PI * 1.5 * $t) - 0.5))
    $ripple = 0.055 * [Math]::Sin(2.0 * [Math]::PI * (185.0 + (18.0 * $p)) * $t)
    $samples[$i] = (($current * 1.35) + $ripple) * $fade * $slowPulse
  }
  return $samples
}

function New-LeafCollect {
  $duration = 0.52
  $count = [int]($SampleRate * $duration)
  $samples = [double[]]::new($count)
  $phase = 0.0
  for ($i = 0; $i -lt $count; $i++) {
    $t = $i / $SampleRate
    $p = $t / $duration
    $frequency = 520.0 + (220.0 * (Get-SmoothStep $p))
    $phase += 2.0 * [Math]::PI * $frequency / $SampleRate
    $fade = Get-FadeEnvelope $t $duration 0.032 0.17
    $decay = [Math]::Exp(-2.9 * $p)
    $tone = [Math]::Sin($phase) + (0.14 * [Math]::Sin(($phase * 2.01) + 0.35))
    $samples[$i] = $tone * $fade * $decay
  }
  return $samples
}

function New-SoftRockBump {
  $duration = 0.46
  $count = [int]($SampleRate * $duration)
  $samples = [double[]]::new($count)
  $random = [System.Random]::new(9821)
  $phase = 0.0
  $softNoise = 0.0
  for ($i = 0; $i -lt $count; $i++) {
    $t = $i / $SampleRate
    $p = $t / $duration
    $frequency = 148.0 - (66.0 * (Get-SmoothStep $p))
    $phase += 2.0 * [Math]::PI * $frequency / $SampleRate
    $white = ($random.NextDouble() * 2.0) - 1.0
    $softNoise = (0.94 * $softNoise) + (0.06 * $white)
    $fade = Get-FadeEnvelope $t $duration 0.038 0.16
    $decay = [Math]::Exp(-4.6 * $p)
    $samples[$i] = (([Math]::Sin($phase) * 0.88) + ($softNoise * 0.3)) * $fade * $decay
  }
  return $samples
}

function New-LevelGate {
  $duration = 1.42
  $count = [int]($SampleRate * $duration)
  $samples = [double[]]::new($count)
  $frequencies = @(293.66, 392.00, 493.88)
  $starts = @(0.0, 0.14, 0.29)
  for ($i = 0; $i -lt $count; $i++) {
    $t = $i / $SampleRate
    $value = 0.0
    for ($n = 0; $n -lt $frequencies.Count; $n++) {
      $local = $t - $starts[$n]
      if ($local -ge 0.0) {
        $noteDuration = $duration - $starts[$n]
        $fade = Get-FadeEnvelope $local $noteDuration 0.04 0.25
        $decay = [Math]::Exp(-3.6 * $local / $noteDuration)
        $tone = [Math]::Sin(2.0 * [Math]::PI * $frequencies[$n] * $local)
        $tone += 0.1 * [Math]::Sin(2.0 * [Math]::PI * ($frequencies[$n] * 2.002) * $local + 0.25)
        $value += $tone * $fade * $decay
      }
    }
    $samples[$i] = $value / 1.9
  }
  return $samples
}

function New-SandRake {
  $duration = 0.68
  $count = [int]($SampleRate * $duration)
  $samples = [double[]]::new($count)
  $random = [System.Random]::new(64107)
  $grain = 0.0
  $bed = 0.0
  for ($i = 0; $i -lt $count; $i++) {
    $t = $i / $SampleRate
    $p = $t / $duration
    $white = ($random.NextDouble() * 2.0) - 1.0
    $grain = (0.76 * $grain) + (0.24 * $white)
    $bed = (0.97 * $bed) + (0.03 * $white)
    $texture = $grain - (0.5 * $bed)
    $fade = Get-FadeEnvelope $t $duration 0.06 0.15
    $stroke = [Math]::Sin([Math]::PI * $p)
    $samples[$i] = $texture * $fade * $stroke
  }
  return $samples
}

function New-BrushWarmth {
  $duration = 0.86
  $count = [int]($SampleRate * $duration)
  $samples = [double[]]::new($count)
  $random = [System.Random]::new(33569)
  $phase = 0.0
  $brushNoise = 0.0
  for ($i = 0; $i -lt $count; $i++) {
    $t = $i / $SampleRate
    $p = $t / $duration
    $frequency = 185.0 + (92.0 * (Get-SmoothStep $p))
    $phase += 2.0 * [Math]::PI * $frequency / $SampleRate
    $white = ($random.NextDouble() * 2.0) - 1.0
    $brushNoise = (0.9 * $brushNoise) + (0.1 * $white)
    $fade = Get-FadeEnvelope $t $duration 0.09 0.2
    $gesture = [Math]::Sin([Math]::PI * $p)
    $tone = 0.3 * [Math]::Sin($phase)
    $samples[$i] = (($brushNoise * 0.9) + $tone) * $fade * $gesture
  }
  return $samples
}

function New-SoftWindAmbience {
  $duration = 3.2
  $count = [int]($SampleRate * $duration)
  $samples = [double[]]::new($count)
  $random = [System.Random]::new(77003)
  $air = 0.0
  $body = 0.0
  $drift = 0.0
  for ($i = 0; $i -lt $count; $i++) {
    $t = $i / $SampleRate
    $white = ($random.NextDouble() * 2.0) - 1.0
    $air = (0.84 * $air) + (0.16 * $white)
    $body = (0.974 * $body) + (0.026 * $white)
    $drift = (0.9975 * $drift) + (0.0025 * $white)
    $wind = (0.38 * $air) + (0.9 * $body) - (0.55 * $drift)
    $fade = Get-FadeEnvelope $t $duration 0.42 0.48
    $swell = 0.73 + (0.17 * [Math]::Sin(2.0 * [Math]::PI * 0.34 * $t)) + (0.1 * [Math]::Sin(2.0 * [Math]::PI * 0.61 * $t + 1.2))
    $samples[$i] = $wind * $fade * $swell
  }
  return $samples
}

$sounds = @(
  @{ Name = 'flower-note-1.wav'; Samples = (New-FlowerNote 523.25); Peak = 0.18 },
  @{ Name = 'flower-note-2.wav'; Samples = (New-FlowerNote 587.33); Peak = 0.18 },
  @{ Name = 'flower-note-3.wav'; Samples = (New-FlowerNote 659.25); Peak = 0.18 },
  @{ Name = 'flower-note-4.wav'; Samples = (New-FlowerNote 783.99); Peak = 0.18 },
  @{ Name = 'flower-note-5.wav'; Samples = (New-FlowerNote 880.00); Peak = 0.18 },
  @{ Name = 'firefly-sparkle.wav'; Samples = (New-FireflySparkle); Peak = 0.17 },
  @{ Name = 'constellation-star.wav'; Samples = (New-StarPing); Peak = 0.17 },
  @{ Name = 'ritual-complete.wav'; Samples = (New-CompletionChime); Peak = 0.20 },
  @{ Name = 'lantern-inhale.wav'; Samples = (New-LanternBreath $true); Peak = 0.14 },
  @{ Name = 'lantern-exhale.wav'; Samples = (New-LanternBreath $false); Peak = 0.14 },
  @{ Name = 'water-stroke.wav'; Samples = (New-WaterStroke); Peak = 0.13 },
  @{ Name = 'stream-current.wav'; Samples = (New-StreamCurrent); Peak = 0.08 },
  @{ Name = 'leaf-collect.wav'; Samples = (New-LeafCollect); Peak = 0.15 },
  @{ Name = 'soft-rock-bump.wav'; Samples = (New-SoftRockBump); Peak = 0.13 },
  @{ Name = 'level-gate.wav'; Samples = (New-LevelGate); Peak = 0.18 },
  @{ Name = 'sand-rake.wav'; Samples = (New-SandRake); Peak = 0.09 },
  @{ Name = 'brush-warmth.wav'; Samples = (New-BrushWarmth); Peak = 0.10 },
  @{ Name = 'soft-wind-ambience.wav'; Samples = (New-SoftWindAmbience); Peak = 0.07 },

  # Kept for the existing rituals while their UI is being upgraded.
  @{ Name = 'water-drop.wav'; Samples = (New-FlowerNote 523.25 1.05); Peak = 0.16 },
  @{ Name = 'warm-chime.wav'; Samples = (New-CompletionChime); Peak = 0.19 }
)

foreach ($sound in $sounds) {
  $path = Join-Path $outputDirectory $sound.Name
  Write-PcmWav -Path $path -Samples $sound.Samples -Peak $sound.Peak
  $size = (Get-Item $path).Length
  Write-Host ('Generated {0,-24} {1,8:N0} bytes' -f $sound.Name, $size)
}
