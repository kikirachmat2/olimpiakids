import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { saveActiveSession, ActiveMatchSession } from '@/lib/sessionStore'

const DEFAULT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzW7iHQryhHG5Qw7-m3Kx-OGZ1RcykxdzCeQJIRE3slHSm-dirgVWSj5P_7WZQRJT0QCA/exec'

/**
 * Konversi format timer ("00:02.55" / "02.55" / "DNF") menjadi milidetik
 */
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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { matchId, matchTitle, results, splits, refereePin, webhookUrl, action } = body

    const scriptWebhookUrl =
      webhookUrl && typeof webhookUrl === 'string' && webhookUrl.startsWith('https://script.google.com/')
        ? webhookUrl
        : process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL || DEFAULT_WEBHOOK_URL

    // Verifikasi PIN
    if (refereePin !== '1234' && refereePin !== '9999') {
      return NextResponse.json({ ok: false, error: 'PIN Wasit tidak valid.' }, { status: 401 })
    }

    // A. RESET DATABASE ACTION (HANYA SUPERVISOR 9999)
    if (action === 'RESET_DATABASE') {
      if (refereePin !== '9999') {
        return NextResponse.json({ ok: false, error: 'Butuh PIN Supervisor 9999.' }, { status: 403 })
      }
      if (scriptWebhookUrl) {
        await fetch(scriptWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'RESET_DATABASE' }),
        }).catch(() => {})
      }
      // Reset juga race_results di Supabase agar Leaderboard kembali bersih
      await supabase
        .from('race_results')
        .update({ duration_ms: null, finish_time: '', status: 'finished' })
        .eq('race_event_id', 2)
      return NextResponse.json({ ok: true, message: 'Seluruh database berhasil direset bersih!' })
    }

    if (!matchId || !results || !Array.isArray(results)) {
      return NextResponse.json(
        { ok: false, error: 'Data match atau hasil urutan tidak lengkap.' },
        { status: 400 }
      )
    }

    // B. RESET MATCH ACTION
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

      // Kosongkan catatan waktu anak-anak di match ini pada Supabase race_results
      const bibs = results.map((r: any) => String(r.bib_number || '').trim().toUpperCase()).filter(Boolean)
      if (bibs.length > 0) {
        const { data: partRows } = await supabase
          .from('participants')
          .select('id')
          .in('bib_number', bibs)
        if (partRows && partRows.length > 0) {
          const pIds = partRows.map((p) => p.id)
          await supabase
            .from('race_results')
            .update({ duration_ms: null, finish_time: '', status: 'finished' })
            .eq('race_event_id', 2)
            .in('participant_id', pIds)
        }
      }

      return NextResponse.json({ ok: true, message: `Match ${matchId} berhasil direset ke status LOCKED.` })
    }

    // C. KUNCI HASIL MATCH (FINAL LOCK)
    const nowIso = new Date().toISOString()

    // 1. Bangun daftar split resmi berdasarkan urutan finisher (non-DNF)
    // Ini memastikan koreksi manual waktu Wasit juga ikut tercatat akurat di tab TIMER
    const nonDnfResults = results.filter((r: any) => r.status !== 'dnf' && r.position !== 9999)
    const effectiveSplits = nonDnfResults.map((r: any, idx: number) => {
      const tStr = r.timer && r.timer !== '--.--.--' ? r.timer : splits?.[idx]?.timer || ''
      const ms = parseTimerToMs(tStr) ?? splits?.[idx]?.elapsedMs ?? 0
      return {
        position: idx + 1,
        timer: tStr,
        elapsedMs: ms,
      }
    })

    // 2. Update Match Session di Supabase menjadi LOCKED_FINAL
    // Ini langsung memicu tampilan Plasma bertransformasi menampilkan hasil akhir
    const finalSession: ActiveMatchSession = {
      matchId,
      matchTitle: matchTitle || `MATCH ${matchId}`,
      status: 'LOCKED_FINAL',
      participants: results,
      results,
      splits: effectiveSplits,
      elapsedMs: effectiveSplits.length > 0 ? effectiveSplits[effectiveSplits.length - 1].elapsedMs : 0,
      startTime: null,
      dnfList: results.filter((r: any) => r.status === 'dnf').map((r: any) => r.bib_number),
      updatedAt: nowIso,
      lockedAt: nowIso,
    }
    await saveActiveSession(finalSession)

    // 3. UPDATE LANGSUNG KE SUPABASE `race_results` (Event ID = 2)
    // Menjamin Leaderboard TV selalu terupdate 100% secara instan meskipun Google Sheets lambat
    try {
      for (const item of results) {
        const cleanBib = String(item.bib_number || '').trim().toUpperCase()
        if (!cleanBib) continue

        const isDnf = item.status === 'dnf' || item.timer === 'DNF' || item.position === 9999
        const durationMs = isDnf ? null : parseTimerToMs(item.timer)

        // Cari participant_id berdasarkan bib_number
        const { data: partRow } = await supabase
          .from('participants')
          .select('id')
          .eq('bib_number', cleanBib)
          .maybeSingle()

        if (partRow) {
          const { data: existingRes } = await supabase
            .from('race_results')
            .select('id')
            .eq('race_event_id', 2)
            .eq('participant_id', partRow.id)
            .maybeSingle()

          if (existingRes) {
            await supabase
              .from('race_results')
              .update({
                duration_ms: durationMs,
                finish_time: isDnf ? 'DNF' : item.timer || nowIso,
                status: isDnf ? 'disqualified' : 'finished',
              })
              .eq('id', existingRes.id)
          } else {
            await supabase.from('race_results').insert({
              race_event_id: 2,
              participant_id: partRow.id,
              duration_ms: durationMs,
              finish_time: isDnf ? 'DNF' : item.timer || nowIso,
              status: isDnf ? 'disqualified' : 'finished',
            })
          }
        }
      }
    } catch (dbSyncErr) {
      console.error('Direct Supabase race_results sync warning:', dbSyncErr)
    }

    // 4. FORWARD HASIL TERPADU KE GOOGLE APPS SCRIPT (TAB TIMER, WASIT, & MASTER DATABASE)
    // Kompatibel 100% dengan Web App lama (SUBMIT_TIMER + SUBMIT_URUTAN) maupun baru (SUBMIT_KUNCI_MATCH)
    let webhookStatus = 'skipped'
    let webhookDetails: unknown = null

    if (scriptWebhookUrl) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          // Coba panggil SUBMIT_KUNCI_MATCH terlebih dahulu
          const resKunci = await fetch(scriptWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'SUBMIT_KUNCI_MATCH',
              matchId,
              matchTitle,
              results,
              splits: effectiveSplits,
              timestamp: nowIso,
            }),
          })

          const jsonKunci = await resKunci.json().catch(() => null)

          if (resKunci.ok && jsonKunci && jsonKunci.ok) {
            webhookStatus = 'success'
            webhookDetails = jsonKunci
            break
          }

          // Fallback Otomatis: Jika Apps Script di Google Sheets masih versi sebelumnya ("Aksi tidak dikenal."),
          // kirim berurutan SUBMIT_TIMER (ke tab TIMER) lalu SUBMIT_URUTAN (ke tab WASIT & MASTER DATABASE)
          if (effectiveSplits.length > 0) {
            await fetch(scriptWebhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'SUBMIT_TIMER',
                matchId,
                matchTitle,
                splits: effectiveSplits,
                timestamp: nowIso,
              }),
            })
          }

          const resUrutan = await fetch(scriptWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'SUBMIT_URUTAN',
              matchId,
              matchTitle,
              results,
              timestamp: nowIso,
            }),
          })

          if (resUrutan.ok) {
            webhookStatus = 'success_fallback'
            webhookDetails = await resUrutan.json().catch(() => ({ ok: true }))
            break
          }
        } catch (fetchErr) {
          if (attempt === 2) {
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
