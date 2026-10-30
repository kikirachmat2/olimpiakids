import { NextResponse } from 'next/server'
import { DEFAULT_MATCHES, WasitMatch, WasitParticipant } from '@/lib/wasitDefaults'
import { getMatchesStore, saveMatchesStore } from '@/lib/sessionStore'

const SHEET_ID = '1A99yug1xh9N-1l3rEt6-RpYFZD5FpY-eJmFaXCwKpWI'
const GID_WASIT = '248239289' // Tab WASIT (sebelumnya MASTER WASIT)

let cachedMatches: WasitMatch[] | null = null
let lastFetchedTime = 0
const CACHE_TTL_MS = 15000

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const forceFresh = searchParams.get('refresh') === 'true'

  // 1. Cek apakah ada penyesuaian kustom di Supabase (pindah peserta)
  try {
    const customMatches = await getMatchesStore()
    if (customMatches && customMatches.length > 0) {
      return NextResponse.json({
        ok: true,
        source: 'supabase_custom',
        matches: customMatches,
      })
    }
  } catch {}

  const now = Date.now()
  if (!forceFresh && cachedMatches && now - lastFetchedTime < CACHE_TTL_MS) {
    return NextResponse.json({
      ok: true,
      source: 'cache',
      matches: cachedMatches,
    })
  }

  // 2. Baca langsung dari Google Sheets Tab WASIT
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID_WASIT}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    })
    clearTimeout(timeoutId)

    if (res.ok) {
      const text = await res.text()
      const lines = text.split('\n')
      let currentMatch: string | null = null
      const parsedMatches: WasitMatch[] = []
      let currentRows: WasitParticipant[] = []

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        const parts = line.split(',')
        if (parts[0].startsWith('MATCH')) {
          if (currentMatch) {
            parsedMatches.push({
              id: parsedMatches.length + 1,
              title: currentMatch,
              participants: currentRows,
            })
          }
          currentMatch = parts[0].trim()
          currentRows = []
        } else if (parts[0] !== 'No.' && currentMatch && parts[1]) {
          const bib = parts[1].trim().toUpperCase()
          if (/^[0-9]{3}[A-Za-z]$/.test(bib)) {
            currentRows.push({
              position: currentRows.length + 1,
              bib_number: bib,
              name: parts[2] ? parts[2].trim() : '',
              urutan: parts[3] && parts[3].trim() ? parts[3].trim() : null,
              status: 'registered',
            })
          }
        }
      }

      if (currentMatch && currentRows.length > 0) {
        parsedMatches.push({
          id: parsedMatches.length + 1,
          title: currentMatch,
          participants: currentRows,
        })
      }

      if (parsedMatches.length > 0) {
        cachedMatches = parsedMatches
        lastFetchedTime = now
        return NextResponse.json({
          ok: true,
          source: 'live_sheet',
          matches: parsedMatches,
        })
      }
    }
  } catch (err: unknown) {
    console.error('Error fetching live matches from Google Sheets:', err)
  }

  // 3. Fallback bawaan
  return NextResponse.json({
    ok: true,
    source: 'fallback',
    matches: cachedMatches || DEFAULT_MATCHES,
  })
}

/**
 * POST /api/wasit/matches
 * Menyimpan pemindahan peserta antar match (maks 10 per match)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { matches } = body

    if (!Array.isArray(matches) || matches.length === 0) {
      return NextResponse.json({ ok: false, error: 'Matches array required' }, { status: 400 })
    }

    // Validasi aturan: maksimal 10 anak per match
    for (const m of matches) {
      if (m.participants && m.participants.length > 10) {
        return NextResponse.json(
          { ok: false, error: `${m.title} melebihi batas maksimal 10 peserta (${m.participants.length} peserta)` },
          { status: 400 }
        )
      }
    }

    // Simpan ke Supabase race_events (id: 998)
    const saved = await saveMatchesStore(matches)
    if (!saved) {
      return NextResponse.json({ ok: false, error: 'Gagal menyimpan ke database' }, { status: 500 })
    }

    cachedMatches = matches
    lastFetchedTime = Date.now()

    return NextResponse.json({
      ok: true,
      message: 'Berhasil memperbarui data pembagian match!',
      matches,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 500 }
    )
  }
}
