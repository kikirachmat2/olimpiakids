import { NextResponse } from 'next/server'
import { DEFAULT_MATCHES, WasitParticipant } from '@/lib/wasitDefaults'

export interface PlasmaState {
  currentMatchIdx: number
  currentMatchId: number
  wasit: {
    status: 'standby' | 'active' | 'final'
    participants: WasitParticipant[]
    updatedAt: string
  }
  timer: {
    status: 'standby' | 'active' | 'final'
    isRunning: boolean
    isPaused: boolean
    startTime: number | null
    elapsedMs: number
    splits: Array<{ position: number; timer: string; elapsedMs: number }>
    updatedAt: string
  }
  version: number
}

// In-memory global state cache for active plasma session
let plasmaState: PlasmaState = {
  currentMatchIdx: 0,
  currentMatchId: DEFAULT_MATCHES[0]?.id || 1,
  wasit: {
    status: 'standby',
    participants: DEFAULT_MATCHES[0]?.participants || [],
    updatedAt: new Date().toISOString(),
  },
  timer: {
    status: 'standby',
    isRunning: false,
    isPaused: false,
    startTime: null,
    elapsedMs: 0,
    splits: [],
    updatedAt: new Date().toISOString(),
  },
  version: 1,
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: plasmaState,
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const nowIso = new Date().toISOString()

    // 0. Reset State Total
    if (body.action === 'RESET' || body.reset === true) {
      plasmaState = {
        currentMatchIdx: 0,
        currentMatchId: DEFAULT_MATCHES[0]?.id || 1,
        wasit: {
          status: 'standby',
          participants: DEFAULT_MATCHES[0]?.participants || [],
          updatedAt: nowIso,
        },
        timer: {
          status: 'standby',
          isRunning: false,
          isPaused: false,
          startTime: null,
          elapsedMs: 0,
          splits: [],
          updatedAt: nowIso,
        },
        version: plasmaState.version + 1,
      }
      return NextResponse.json({ ok: true, version: plasmaState.version, data: plasmaState })
    }

    // 1. Match Switch
    if (typeof body.matchIdx === 'number') {
      plasmaState.currentMatchIdx = body.matchIdx
      if (body.matchId) {
        plasmaState.currentMatchId = body.matchId
      } else if (DEFAULT_MATCHES[body.matchIdx]) {
        plasmaState.currentMatchId = DEFAULT_MATCHES[body.matchIdx].id
      }
    }

    // 2. Wasit Update
    if (body.wasit) {
      plasmaState.wasit = {
        ...plasmaState.wasit,
        ...body.wasit,
        updatedAt: nowIso,
      }
    }

    // 3. Timer Update
    if (body.timer) {
      plasmaState.timer = {
        ...plasmaState.timer,
        ...body.timer,
        updatedAt: nowIso,
      }
    }

    plasmaState.version++

    return NextResponse.json({
      ok: true,
      version: plasmaState.version,
      data: plasmaState,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 400 }
    )
  }
}

