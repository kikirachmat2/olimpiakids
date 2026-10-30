import confetti from 'canvas-confetti'

// 1. CONFETTI TRIGGERS
export function fireTop3Confetti() {
  if (typeof window === 'undefined') return
  confetti({
    particleCount: 90,
    spread: 80,
    origin: { y: 0.6 },
    colors: ['#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#fbbf24'],
    zIndex: 9999,
    disableForReducedMotion: false,
  })
}

export function fireChampionConfetti() {
  if (typeof window === 'undefined') return

  // Gelombang 1: Dual cannons dari sudut bawah kiri & kanan
  confetti({
    particleCount: 90,
    angle: 60,
    spread: 70,
    origin: { x: 0.1, y: 0.85 },
    colors: ['#ffd700', '#f59e0b', '#ffffff', '#3b82f6', '#fbbf24'],
    zIndex: 9999,
    disableForReducedMotion: false,
  })

  confetti({
    particleCount: 90,
    angle: 120,
    spread: 70,
    origin: { x: 0.9, y: 0.85 },
    colors: ['#ffd700', '#f59e0b', '#ffffff', '#3b82f6', '#fbbf24'],
    zIndex: 9999,
    disableForReducedMotion: false,
  })

  // Gelombang 2: Golden rain di tengah layar setelah 450ms
  setTimeout(() => {
    confetti({
      particleCount: 120,
      spread: 110,
      origin: { y: 0.45 },
      colors: ['#ffd700', '#f59e0b', '#fef08a', '#ffffff'],
      zIndex: 9999,
      disableForReducedMotion: false,
    })
  }, 450)
}

// 2. AUDIO SYNTHESIZER (WEB AUDIO API) - Zero external file dependency, super lightweight & reliable
let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export function playCelebrationSound(type: 'top3' | 'champion', muted: boolean = false) {
  if (muted || typeof window === 'undefined') return

  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime

    // Siapkan nada fanfare kemenangan
    // Top 3: G5 (783.99Hz) -> C6 (1046.5Hz)
    // Champion: C5 (523.25Hz) -> E5 (659.25Hz) -> G5 (783.99Hz) -> C6 (1046.5Hz) -> E6 (1318.51Hz)
    const notes =
      type === 'champion'
        ? [
            { freq: 523.25, time: 0.0, dur: 0.18 },
            { freq: 659.25, time: 0.12, dur: 0.18 },
            { freq: 783.99, time: 0.24, dur: 0.22 },
            { freq: 1046.5, time: 0.38, dur: 0.6 },
            { freq: 1318.51, time: 0.48, dur: 0.9 },
          ]
        : [
            { freq: 659.25, time: 0.0, dur: 0.2 },
            { freq: 783.99, time: 0.12, dur: 0.25 },
            { freq: 1046.5, time: 0.26, dur: 0.7 },
          ]

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'triangle' // Suara bell / chime yang hangat & lembut di telinga
      osc.frequency.setValueAtTime(freq, now + time)

      // Envelope: attack cepat, decay lembut
      gain.gain.setValueAtTime(0.001, now + time)
      gain.gain.exponentialRampToValueAtTime(0.28, now + time + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + time)
      osc.stop(now + time + dur)
    })
  } catch {
    // Abaikan jika browser autoplay policy memblokir sebelum interaksi klik pengguna
  }
}

export function playRevealSound(muted: boolean = false) {
  if (muted || typeof window === 'undefined') return

  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    // Chime nada reveal naik: A5 (880Hz) -> D6 (1174.66Hz)
    const notes = [
      { freq: 880, time: 0.0, dur: 0.16 },
      { freq: 1174.66, time: 0.1, dur: 0.35 },
    ]

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + time)
      gain.gain.setValueAtTime(0.001, now + time)
      gain.gain.exponentialRampToValueAtTime(0.2, now + time + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + time)
      osc.stop(now + time + dur)
    })
  } catch {}
}
