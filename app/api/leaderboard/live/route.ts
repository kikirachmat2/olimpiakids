import { NextResponse } from 'next/server'
import { LeaderboardItem } from '@/types/database'
import { getLeaderboard } from '@/lib/queries'
import { getActiveSession } from '@/lib/sessionStore'

const SHEET_ID = '1A99yug1xh9N-1l3rEt6-RpYFZD5FpY-eJmFaXCwKpWI'
const GID_LIVE_VISUAL = '1555128462'

let cachedLeaderboard: LeaderboardItem[] | null = null
let lastFetchMs = 0
const CACHE_TTL_MS = 1800

function parseTimerToMs(raw: string | null | undefined): number | null {
  if (!raw) return null
  const s = String(raw).trim().replace(/,/g, '.').replace(/[sS"']/g, '')
  if (!s || s === '--.--.--' || s === '-' || s.toUpperCase() === 'DNF' || s === '--') return null

  let result: number | null = null
  if (s.includes(':')) {
    const cParts = s.split(':')
    if (cParts.length === 2) {
      const min = parseInt(cParts[0], 10)
      const secCs = cParts[1].split('.')
      if (secCs.length === 2) {
        const sec = parseInt(secCs[0], 10)
        const csStr = secCs[1]
        const cs =
          csStr.length === 1
            ? parseInt(csStr, 10) * 100
            : csStr.length === 2
            ? parseInt(csStr, 10) * 10
            : parseInt(csStr.substring(0, 3), 10)
        result = (min * 60 + sec) * 1000 + cs
      } else {
        const sec = parseInt(cParts[1], 10)
        result = (min * 60 + sec) * 1000
      }
    } else if (cParts.length === 3) {
      const p0 = parseInt(cParts[0], 10)
      const p1 = parseInt(cParts[1], 10)
      const p2Str = cParts[2]
      const cs =
        p2Str.length === 1
          ? parseInt(p2Str, 10) * 100
          : p2Str.length === 2
          ? parseInt(p2Str, 10) * 10
          : parseInt(p2Str.substring(0, 3), 10)
      result = (p0 * 60 + p1) * 1000 + cs
    }
  } else {
    const parts = s.split('.')
    if (parts.length === 3) {
      const min = parseInt(parts[0], 10)
      const sec = parseInt(parts[1], 10)
      const csStr = parts[2]
      const cs =
        csStr.length === 1
          ? parseInt(csStr, 10) * 100
          : csStr.length === 2
          ? parseInt(csStr, 10) * 10
          : parseInt(csStr.substring(0, 3), 10)
      result = (min * 60 + sec) * 1000 + cs
    } else if (parts.length === 2) {
      const sec = parseInt(parts[0], 10)
      const csStr = parts[1]
      const cs =
        csStr.length === 1
          ? parseInt(csStr, 10) * 100
          : csStr.length === 2
          ? parseInt(csStr, 10) * 10
          : parseInt(csStr.substring(0, 3), 10)
      result = sec * 1000 + cs
    } else if (parts.length === 1) {
      const n = parseInt(parts[0], 10)
      result = isNaN(n) ? null : n * 1000
    }
  }

  return result === null || isNaN(result) ? null : result
}

export async function GET() {
  const now = Date.now()
  if (cachedLeaderboard && now - lastFetchMs < CACHE_TTL_MS) {
    return NextResponse.json({
      ok: true,
      source: 'sheet_cache',
      leaderboard: cachedLeaderboard,
    })
  }

  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID_LIVE_VISUAL}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4500)

    const [sheetRes, session] = await Promise.all([
      fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      }),
      getActiveSession().catch(() => null),
    ])
    clearTimeout(timeoutId)

    if (sheetRes.ok) {
      const text = await sheetRes.text()
      const lines = text.split(/\r?\n/)
      const rows: Array<{
        bib: string
        name: string
        duration_ms: number | null
        isDnf: boolean
      }> = []

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        const parts = line.split(',')
        const colNo = (parts[0] || '').trim().toUpperCase()
        const bib = (parts[1] || '').trim().toUpperCase()
        const name = (parts[2] || '').trim()
        const rawTimer = (parts[3] || '').trim()

        if (!/^[0-9]{3}[A-Z]$/i.test(bib) || !name) continue

        const isDnf = colNo === 'DNF' || rawTimer.toUpperCase() === 'DNF'
        const duration_ms = isDnf ? null : parseTimerToMs(rawTimer)
        rows.push({
          bib,
          name,
          duration_ms,
          isDnf,
        })
      }

      if (rows.length > 0) {
        // Jika Wasit baru saja mengunci match (< 12 detik lalu), overlay hasil match tersebut
        // untuk menghindari jeda propagasi CDN CSV Google Sheets (2-3 detik)
        if (
          session &&
          session.status === 'LOCKED_FINAL' &&
          session.lockedAt &&
          session.results &&
          now - new Date(session.lockedAt).getTime() < 12000
        ) {
          for (const resItem of session.results) {
            const b = String(resItem.bib_number || '').trim().toUpperCase()
            const target = rows.find((r) => r.bib === b)
            if (target) {
              const isDnf =
                resItem.status === 'dnf' ||
                resItem.timer === 'DNF' ||
                resItem.position === 9999
              target.isDnf = isDnf
              target.duration_ms = isDnf ? null : parseTimerToMs(resItem.timer)
            }
          }
        }

        // Urutkan:
        // 1. Sudah finish (duration_ms tercepat di atas)
        // 2. Belum tanding (duration_ms === null && !isDnf)
        // 3. DNF selalu di paling bawah
        rows.sort((a, b) => {
          if (a.isDnf && !b.isDnf) return 1
          if (!a.isDnf && b.isDnf) return -1
          if (a.isDnf && b.isDnf) return a.name.localeCompare(b.name)

          const hasA = a.duration_ms !== null && a.duration_ms !== undefined
          const hasB = b.duration_ms !== null && b.duration_ms !== undefined
          if (hasA && hasB) return a.duration_ms! - b.duration_ms!
          if (hasA && !hasB) return -1
          if (!hasA && hasB) return 1
          return a.name.localeCompare(b.name)
        })

        const leaderboard: LeaderboardItem[] = rows.map((r, idx) => ({
          rank: idx + 1,
          participant_id: idx + 1,
          participant_name: r.name,
          bib_number: r.bib,
          duration_ms: r.isDnf ? null : r.duration_ms,
          finish_time: r.isDnf ? 'DNF' : '',
          status: r.isDnf ? 'disqualified' : 'finished',
        }))

        cachedLeaderboard = leaderboard
        lastFetchMs = now

        return NextResponse.json({
          ok: true,
          source: 'live_visual_sheet',
          leaderboard,
        })
      }
    }
  } catch (err) {
    console.warn('Fallback to Supabase leaderboard:', err)
  }

  // Fallback ke Supabase jika Google Sheets sedang tidak terjangkau
  const fallback = await getLeaderboard(2)
  return NextResponse.json({
    ok: !fallback.error,
    source: 'supabase_fallback',
    leaderboard: fallback.data || [],
  })
}

