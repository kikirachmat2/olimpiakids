import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { matchId, matchTitle, results, refereePin } = body

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

    // 1. Forward ke Google Apps Script Web App (jika URL sudah dipasang di env)
    const scriptWebhookUrl = process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL
    let webhookStatus = 'skipped'

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
        })
        if (scriptRes.ok) {
          webhookStatus = 'success'
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
      message: `Hasil ${matchTitle || `Match ${matchId}`} berhasil disimpan.`,
      webhookStatus,
      savedAt: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
