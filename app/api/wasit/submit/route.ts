import { NextResponse } from 'next/server'

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

    // 1. Forward ke Google Apps Script Web App (dari custom settings, env, atau default)
    const scriptWebhookUrl = (webhookUrl && typeof webhookUrl === 'string' && webhookUrl.startsWith('https://script.google.com/')) 
      ? webhookUrl 
      : (process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL || DEFAULT_WEBHOOK_URL)
    let webhookStatus = 'skipped'
    let webhookDetails: unknown = null

    if (scriptWebhookUrl) {
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
          webhookStatus = 'success'
          try {
            webhookDetails = await scriptRes.json()
          } catch {
            // ignore
          }
        } else {
          webhookStatus = `failed_${scriptRes.status}`
        }
      } catch (err) {
        console.error('Gagal memanggil webhook Apps Script:', err)
        webhookStatus = 'error'
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
