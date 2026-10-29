import { NextResponse } from 'next/server'
import { DEFAULT_MATCHES, WasitMatch, WasitParticipant } from '@/lib/wasitDefaults'

const SHEET_ID = '1A99yug1xh9N-1l3rEt6-RpYFZD5FpY-eJmFaXCwKpWI'
const GID_WASIT = '1982418372' // Tab WASIT 1

let cachedMatches: WasitMatch[] | null = null
let lastFetchedTime = 0
const CACHE_TTL_MS = 15000 // 15 detik cache di server agar respons cepat

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const forceFresh = searchParams.get('refresh') === 'true'

  const now = Date.now()
  if (!forceFresh && cachedMatches && now - lastFetchedTime < CACHE_TTL_MS) {
    return NextResponse.json({
      ok: true,
      source: 'cache',
      matches: cachedMatches,
    })
  }

  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID_WASIT}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
      },
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      throw new Error(`Google Sheets return status ${res.status}`)
    }

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
        currentRows.push({
          position: currentRows.length + 1,
          bib_number: parts[1].trim().toUpperCase(),
          name: parts[2] ? parts[2].trim() : '',
          urutan: parts[3] && parts[3].trim() ? parts[3].trim() : null,
          status: 'registered',
        })
      }
    }

    if (currentMatch) {
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
  } catch (err: unknown) {
    console.error('Error fetching live matches from Google Sheets:', err)
  }

  // Fallback ke cache atau data bawaan jika Sheet lambat / offline
  return NextResponse.json({
    ok: true,
    source: 'fallback',
    matches: cachedMatches || DEFAULT_MATCHES,
  })
}
