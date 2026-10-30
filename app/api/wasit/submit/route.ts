import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const DEFAULT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzW7iHQryhHG5Qw7-m3Kx-OGZ1RcykxdzCeQJIRE3slHSm-dirgVWSj5P_7WZQRJT0QCA/exec'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { matchId, matchTitle, results, refereePin, webhookUrl } = body

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

    // 1. UPDATE LANGSUNG KE SUPABASE DATABASE (PRIMARY REALTIME SYNC)
    let supabaseStatus = 'skipped'
    try {
      const eventId = 2 // LEADERBOARD BABY CRAWLING
      const nowIso = new Date().toISOString()

      for (const res of results) {
        if (!res.bib_number) continue
        const cleanBib = String(res.bib_number).trim().toUpperCase()
        const cleanName = String(res.name || '').trim()
        const isDnf = res.status === 'dnf'

        // Upsert data peserta
        let participantId: number | null = null
        const { data: existingP } = await supabase
          .from('participants')
          .select('id')
          .eq('bib_number', cleanBib)
          .maybeSingle()

        if (existingP) {
          participantId = existingP.id
          if (cleanName) {
            await supabase.from('participants').update({ name: cleanName }).eq('id', participantId)
          }
        } else {
          const { data: newP } = await supabase
            .from('participants')
            .insert({ bib_number: cleanBib, name: cleanName || cleanBib })
            .select('id')
            .single()
          if (newP) participantId = newP.id
        }

        if (participantId) {
          if (isDnf) {
            // DNF: hapus catatan durasi, beri status 'disqualified', dan taruh di posisi terbawah
            await supabase.from('race_results').upsert(
              {
                participant_id: participantId,
                race_event_id: eventId,
                duration_ms: null,
                finish_time: nowIso,
                status: 'disqualified',
                position: 9999,
              },
              { onConflict: 'participant_id,race_event_id' }
            )
          } else {
            // Peserta normal: pertahankan durasi jika sudah pernah dicatat oleh timer
            const { data: existingR } = await supabase
              .from('race_results')
              .select('duration_ms, finish_time')
              .eq('participant_id', participantId)
              .eq('race_event_id', eventId)
              .maybeSingle()

            await supabase.from('race_results').upsert(
              {
                participant_id: participantId,
                race_event_id: eventId,
                duration_ms: existingR?.duration_ms || null,
                finish_time: existingR?.finish_time || nowIso,
                status: 'finished',
                position: res.position || 1,
              },
              { onConflict: 'participant_id,race_event_id' }
            )
          }
        }
      }
      supabaseStatus = 'success'
    } catch (dbErr) {
      console.warn('Gagal sync langsung ke Supabase:', dbErr)
      supabaseStatus = 'error'
    }

    // 2. FORWARD KE GOOGLE APPS SCRIPT WEB APP (SHEET BACKUP & FORMULA SYNC)
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
              action: 'SUBMIT_URUTAN',
              matchId,
              matchTitle,
              results,
              submittedAt: new Date().toISOString(),
            }),
            redirect: 'follow',
          })
          
          if (scriptRes.ok) {
            try {
              const data = await scriptRes.json()
              webhookDetails = data
              if (data && data.ok) {
                webhookStatus = 'success'
                break
              }
            } catch {
              webhookStatus = 'success'
              break
            }
          } else {
            webhookStatus = `failed_${scriptRes.status}`
          }
        } catch (err) {
          console.error(`Attempt ${attempt} error calling Apps Script:`, err)
          webhookStatus = 'error'
        }

        // Jika attempt 1 atau 2 gagal, tunggu sebentar lalu coba lagi
        if (attempt < 3 && webhookStatus !== 'success') {
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt))
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Hasil ${matchTitle || `Match ${matchId}`} berhasil disimpan ke Sheets!`,
      webhookStatus,
      webhookDetails,
      savedAt: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
