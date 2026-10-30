import { NextResponse } from 'next/server'

/**
 * /api/timer/submit
 * Catatan: Sesuai arsitektur baru, Meja Timer tidak lagi mengirim data sendiri.
 * Wasit adalah Master yang mengunci dan mengirim hasil terpadu (Urutan + Timer).
 * Endpoint ini dipertahankan sebagai no-op / bridge logging.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    return NextResponse.json({
      ok: true,
      message: 'Timer split diterima di session master. Kunci final dilakukan oleh Wasit.',
      data: body,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Invalid payload' },
      { status: 400 }
    )
  }
}
