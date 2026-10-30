import { NextResponse } from 'next/server'
import { DEFAULT_MATCHES, WasitParticipant } from '@/lib/wasitDefaults'
import { ActiveMatchSession, INITIAL_MATCH_SESSION, getActiveSession, saveActiveSession } from '@/lib/sessionStore'

export interface PlasmaState {
  currentMatchIdx: number
  currentMatchId: number
  session: ActiveMatchSession
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

let plasmaState: PlasmaState = {
  currentMatchIdx: 0,
  currentMatchId: DEFAULT_MATCHES[0]?.id || 1,
  session: INITIAL_MATCH_SESSION,
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
  // Coba ambil session persistent dari Supabase jika memory kosong
  try {
    const dbSession = await getActiveSession()
    if (dbSession && dbSession.matchId) {
      plasmaState.session = dbSession
      plasmaState.currentMatchId = dbSession.matchId
      plasmaState.currentMatchIdx = Math.max(0, dbSession.matchId - 1)
    }
  } catch {}

  return NextResponse.json(
    {
      ok: true,
      data: plasmaState,
      session: plasmaState.session,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    }
  )
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const nowIso = new Date().toISOString()

    // 1. Session Sync
    if (body.session) {
      plasmaState.session = {
        ...plasmaState.session,
        ...body.session,
        updatedAt: nowIso,
      }
      plasmaState.currentMatchId = body.session.matchId || plasmaState.currentMatchId
      plasmaState.currentMatchIdx = Math.max(0, plasmaState.currentMatchId - 1)

      // Simpan ke Supabase race_events (id: 999) secara background
      saveActiveSession(plasmaState.session).catch(() => {})
    }

    // 2. Legacy wasit/timer update fallback
    if (body.wasit) {
      plasmaState.wasit = { ...plasmaState.wasit, ...body.wasit, updatedAt: nowIso }
    }
    if (body.timer) {
      plasmaState.timer = { ...plasmaState.timer, ...body.timer, updatedAt: nowIso }
    }

    plasmaState.version++

    return NextResponse.json({
      ok: true,
      version: plasmaState.version,
      data: plasmaState,
      session: plasmaState.session,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 400 }
    )
  }
}
