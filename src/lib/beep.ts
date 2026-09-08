// Rest-timer end signal (spec §6.3): vibrate where available (Android), WebAudio beep everywhere.
// iOS has no vibrate API and needs the AudioContext created from a user gesture — call `primeAudio()`
// from the first ✓ tap so the later beep is allowed to play.
let ctx: AudioContext | null = null

// iOS 17+ exposes the audio session; `playback` lets Web Audio sound through the ringer/silent switch
// (the default `auto` category is muted by it — the phone "never pinged" on silent, 2026-09-08).
type AudioSessionNavigator = Navigator & { audioSession?: { type: string } }

export function primeAudio(): void {
  try {
    const session = (navigator as AudioSessionNavigator).audioSession
    if (session) session.type = 'playback'
  } catch {
    // older iOS / other browsers: no audio session API
  }
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

export function beep(): void {
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    // not supported
  }
  try {
    ctx ??= new AudioContext()
    const now = ctx.currentTime
    for (const [start, freq] of [
      [0, 880],
      [0.18, 880],
      [0.36, 1175],
    ] as const) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.exponentialRampToValueAtTime(0.4, now + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.15)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + start)
      osc.stop(now + start + 0.16)
    }
  } catch {
    // audio blocked; vibration (if any) already fired
  }
}
