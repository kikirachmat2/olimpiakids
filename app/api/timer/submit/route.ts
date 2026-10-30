import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const DEFAULT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzW7iHQryhHG5Qw7-m3Kx-OGZ1RcykxdzCeQJIRE3slHSm-dirgVWSj5P_7WZQRJT0QCA/exec'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { matchId, matchTitle, splits, participants, pin, webhookUrl } = body

    if (!matchId || !splits || !Array.isArray(splits) || splits.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Data match atau rekaman timer tidak lengkap.' },
        { status: 400 }
      )
    }

    // Verifikasi PIN
    if (pin !== '1234' && pin !== '9999') {
      return NextResponse.json(
        { ok: false, error: 'PIN Petugas Timer tidak valid.' },
        { status: 401 }
      )
    }

    // 1. UPDATE LANGSUNG KE SUPABASE DATABASE (PRIMARY REALTIME SYNC)
    let supabaseStatus = 'skipped'
    try {
      const eventId = 2 // LEADERBOARD BABY CRAWLING
      const nowIso = new Date().toISOString()

      // Buat map posisi -> split
      const splitByPos: Record<number, { timer: string; elapsedMs: number }> = {}
      for (const sp of splits) {
        if (sp && sp.position) {
          splitByPos[sp.position] = sp
        }
      }

      // Cari peserta dan pasangkan waktu jika bukan DNF
      if (Array.isArray(participants) && participants.length > 0) {
        for (const p of participants) {
          if (!p.bib_number) continue
          const cleanBib = String(p.bib_number).trim().toUpperCase()

          const { data: pData } = await supabase
            .from('participants')
            .select('id')
            .eq('bib_number', cleanBib)
            .maybeSingle()

          if (pData) {
            // Cek status saat ini di race_results
            const { data: existingR } = await supabase
              .from('race_results')
              .select('id, position, status, finish_time')
              .eq('participant_id', pData.id)
              .eq('race_event_id', eventId)
              .maybeSingle()

            // JIKA ANAK TERSEBUT DNF: JANGAN TULIS TIMER!
            if (existingR?.status === 'disqualified' || existingR?.finish_time === 'DNF') {
              continue
            }

            // Jika ada nomor urut/posisi dan ada split untuk posisi tersebut
            const targetPos = existingR?.position
            if (targetPos && splitByPos[targetPos]) {
              await supabase
                .from('race_results')
                .update({
                  duration_ms: splitByPos[targetPos].elapsedMs,
                  finish_time: nowIso,
                  status: 'finished',
                })
                .eq('id', existingR.id)
            }
          }
        }
      }
      supabaseStatus = 'success'
    } catch (dbErr) {
      console.warn('Gagal sync timer langsung ke Supabase:', dbErr)
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
              action: 'SUBMIT_TIMER',
              matchId,
              matchTitle,
              splits,
              participants: participants || [],
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
          console.error(`Attempt ${attempt} error calling Apps Script for Timer:`, err)
          webhookStatus = 'error'
        }

        if (attempt < 3 && webhookStatus !== 'success') {
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt))
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Catatan waktu ${matchTitle || `Match ${matchId}`} berhasil disimpan ke Google Sheets!`,
      webhookStatus,
      webhookDetails,
      savedAt: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

