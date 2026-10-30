import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { saveActiveSession, ActiveMatchSession } from '@/lib/sessionStore'

const DEFAULT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzW7iHQryhHG5Qw7-m3Kx-OGZ1RcykxdzCeQJIRE3slHSm-dirgVWSj5P_7WZQRJT0QCA/exec'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { matchId, matchTitle, results, splits, refereePin, webhookUrl, action } = body

    if (!matchId || !results || !Array.isArray(results)) {
      return NextResponse.json(
        { ok: false, error: 'Data match atau hasil urutan tidak lengkap.' },
        { status: 400 }
      )
    }

    // Verifikasi PIN
    if (refereePin !== '1234' && refereePin !== '9999') {
      return NextResponse.json(
        { ok: false, error: 'PIN Wasit tidak valid.' },
        { status: 401 }
      )
    }

    // A. RESET ACTION
    if (action === 'RESET_MATCH') {
      const resetSession: ActiveMatchSession = {
        matchId,
        matchTitle: matchTitle || `MATCH ${matchId}`,
        status: 'LOCKED',
        participants: results.map((r: any, idx: number) => ({
          position: idx + 1,
          bib_number: r.bib_number,
          name: r.name,
          status: 'registered',
        })),
        splits: [],
        elapsedMs: 0,
        startTime: null,
        dnfList: [],
        updatedAt: new Date().toISOString(),
      }
      await saveActiveSession(resetSession)
      return NextResponse.json({ ok: true, message: `Match ${matchId} berhasil direset ke status LOCKED.` })
    }

    // B. KUNCI HASIL MATCH (FINAL LOCK)
    const nowIso = new Date().toISOString()

    // 1. Update Match Session di Supabase menjadi LOCKED_FINAL
    // Ini langsung memicu tampilan Plasma bertransformasi menampilkan hasil akhir
    const finalSession: ActiveMatchSession = {
      matchId,
      matchTitle: matchTitle || `MATCH ${matchId}`,
      status: 'LOCKED_FINAL',
      participants: results,
      splits: splits || [],
      elapsedMs: (splits && splits.length > 0) ? splits[splits.length - 1].elapsedMs : 0,
      startTime: null,
      dnfList: results.filter((r: any) => r.status === 'dnf').map((r: any) => r.bib_number),
      updatedAt: nowIso,
      lockedAt: nowIso,
    }
    await saveActiveSession(finalSession)

    // 2. FORWARD HASIL TERPADU KE GOOGLE APPS SCRIPT (TAB WASIT, TIMER, & MASTER DATABASE)
    const scriptWebhookUrl = (webhookUrl && typeof webhookUrl === 'string' && webhookUrl.startsWith('https://script.google.com/')) 
      ? webhookUrl 
      : (process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL || DEFAULT_WEBHOOK_URL)
    
    let webhookStatus = 'skipped'
    let webhookDetails: unknown = null

    if (scriptWebhookUrl) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const scriptRes = await fetch(scriptWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'SUBMIT_KUNCI_MATCH',
              matchId,
              matchTitle,
              results,
              splits: splits || [],
              timestamp: nowIso,
            }),
          })
          if (scriptRes.ok) {
            webhookStatus = 'success'
            webhookDetails = await scriptRes.json().catch(() => ({ ok: true }))
            break
          }
        } catch (fetchErr) {
          if (attempt === 3) {
            webhookStatus = 'error'
            webhookDetails = fetchErr instanceof Error ? fetchErr.message : 'Unknown error'
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Hasil Match ${matchId} berhasil dikunci dan disinkronkan!`,
      matchId,
      webhookStatus,
      webhookDetails,
      session: finalSession,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem' },
      { status: 500 }
    )
  }
}
