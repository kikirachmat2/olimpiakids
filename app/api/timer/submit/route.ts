import { NextResponse } from 'next/server'

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

    // Forward ke Google Apps Script Web App
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

