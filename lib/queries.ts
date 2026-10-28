import { supabase } from './supabase'
import {
  Participant,
  RaceEvent,
  RaceResult,
  LeaderboardItem,
  QueryResponse,
} from '@/types/database'

// =========================================================
// A. PESERTA (PARTICIPANTS)
// =========================================================

/**
 * Mengambil semua daftar peserta, diurutkan berdasarkan bib_number ASC
 */
export async function getParticipants(): Promise<QueryResponse<Participant[]>> {
  try {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .order('bib_number', { ascending: true })

    if (error) {
      return { data: null, error: `Gagal memuat peserta: ${error.message}` }
    }

    return { data: (data as Participant[]) || [], error: null }
  } catch (err: unknown) {
    return { data: null, error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem' }
  }
}

/**
 * Menambahkan peserta baru dengan pengecekan nomor BIB duplikat
 */
export async function addParticipant(data: {
  name: string
  bib_number: string
  age_months: number | null
}): Promise<QueryResponse<Participant>> {
  try {
    const cleanBib = data.bib_number.trim().toUpperCase()
    const cleanName = data.name.trim()

    const { data: inserted, error } = await supabase
      .from('participants')
      .insert({
        name: cleanName,
        bib_number: cleanBib,
        age_months: data.age_months,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505' || error.message.includes('unique constraint') || error.message.includes('bib_number')) {
        return { data: null, error: `Nomor BIB "${cleanBib}" sudah terdaftar. Gunakan nomor lain.` }
      }
      return { data: null, error: `Gagal menambahkan peserta: ${error.message}` }
    }

    return { data: inserted as Participant, error: null }
  } catch (err: unknown) {
    return { data: null, error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem' }
  }
}

/**
 * Menghapus peserta (otomatis menghapus hasil lomba terkait melalui cascade constraint)
 */
export async function deleteParticipant(id: number): Promise<QueryResponse<boolean>> {
  try {
    const { error } = await supabase
      .from('participants')
      .delete()
      .eq('id', id)

    if (error) {
      return { data: false, error: `Gagal menghapus peserta: ${error.message}` }
    }

    return { data: true, error: null }
  } catch (err: unknown) {
    return { data: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem' }
  }
}

// =========================================================
// B. RACE EVENT (BABAK / EVENT LOMBA)
// =========================================================

/**
 * Mengambil event yang sedang aktif: status 'running', jika tidak ada cari 'idle' terbaru
 */
export async function getActiveRace(): Promise<QueryResponse<RaceEvent | null>> {
  try {
    // 1. Cek yang sedang running terlebih dahulu
    const { data: runningRace, error: runningErr } = await supabase
      .from('race_events')
      .select('*')
      .eq('status', 'running')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (runningErr) {
      return { data: null, error: `Gagal memeriksa lomba berjalan: ${runningErr.message}` }
    }

    if (runningRace) {
      return { data: runningRace as RaceEvent, error: null }
    }

    // 2. Jika tidak ada yang running, cari yang 'idle' terbaru
    const { data: idleRace, error: idleErr } = await supabase
      .from('race_events')
      .select('*')
      .eq('status', 'idle')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (idleErr) {
      return { data: null, error: `Gagal memeriksa lomba berikutnya: ${idleErr.message}` }
    }

    return { data: (idleRace as RaceEvent) || null, error: null }
  } catch (err: unknown) {
    return { data: null, error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem' }
  }
}

/**
 * Membuat babak/event lomba baru dengan status default 'idle'
 */
export async function createRaceEvent(name: string): Promise<QueryResponse<RaceEvent>> {
  try {
    const { data, error } = await supabase
      .from('race_events')
      .insert({
        name: name.trim(),
        status: 'idle',
      })
      .select()
      .single()

    if (error) {
      return { data: null, error: `Gagal membuat babak lomba: ${error.message}` }
    }

    return { data: data as RaceEvent, error: null }
  } catch (err: unknown) {
    return { data: null, error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem' }
  }
}

/**
 * Mengubah status lomba menjadi 'running' dan merekam start_time
 */
export async function startRace(eventId: number): Promise<QueryResponse<RaceEvent>> {
  try {
    const nowIso = new Date().toISOString()
    const { data, error } = await supabase
      .from('race_events')
      .update({
        status: 'running',
        start_time: nowIso,
      })
      .eq('id', eventId)
      .select()
      .single()

    if (error) {
      return { data: null, error: `Gagal memulai lomba: ${error.message}` }
    }

    return { data: data as RaceEvent, error: null }
  } catch (err: unknown) {
    return { data: null, error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem' }
  }
}

/**
 * Mengubah status lomba menjadi 'finished' (selesai)
 */
export async function finishRace(eventId: number): Promise<QueryResponse<RaceEvent>> {
  try {
    const { data, error } = await supabase
      .from('race_events')
      .update({
        status: 'finished',
      })
      .eq('id', eventId)
      .select()
      .single()

    if (error) {
      return { data: null, error: `Gagal mengakhiri lomba: ${error.message}` }
    }

    return { data: data as RaceEvent, error: null }
  } catch (err: unknown) {
    return { data: null, error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem' }
  }
}

// =========================================================
// C. HASIL LOMBA & PENCATATAN FINISH
// =========================================================

/**
 * Mengambil daftar hasil lomba untuk suatu event (berguna untuk sinkronisasi tombol peserta di admin)
 */
export async function getRaceResults(eventId: number): Promise<QueryResponse<RaceResult[]>> {
  try {
    const { data, error } = await supabase
      .from('race_results')
      .select('*')
      .eq('race_event_id', eventId)

    if (error) {
      return { data: null, error: `Gagal memuat hasil lomba: ${error.message}` }
    }

    return { data: (data as RaceResult[]) || [], error: null }
  } catch (err: unknown) {
    return { data: null, error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem' }
  }
}

/**
 * Mencatat waktu finish seorang peserta pada suatu race_event
 */
export async function recordFinish(
  participantId: number,
  eventId: number
): Promise<QueryResponse<RaceResult>> {
  try {
    // 1. Ambil data race_event untuk memastikan status dan start_time
    const { data: eventData, error: eventErr } = await supabase
      .from('race_events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (eventErr || !eventData) {
      return { data: null, error: 'Data lomba tidak ditemukan.' }
    }

    if (eventData.status !== 'running') {
      return { data: null, error: 'Lomba belum dimulai atau sudah selesai.' }
    }

    if (!eventData.start_time) {
      return { data: null, error: 'Waktu mulai lomba belum tercatat.' }
    }

    // 2. Cek apakah peserta sudah pernah punya catatan di event ini
    const { data: existingResult } = await supabase
      .from('race_results')
      .select('id, duration_ms')
      .eq('race_event_id', eventId)
      .eq('participant_id', participantId)
      .maybeSingle()

    if (existingResult && existingResult.duration_ms !== null) {
      return { data: null, error: 'Peserta ini sudah tercatat finish pada sesi ini!' }
    }

    // 3. Hitung durasi milidetik
    const now = Date.now()
    const startTime = new Date(eventData.start_time).getTime()
    const durationMs = Math.max(0, now - startTime)
    const finishTimeIso = new Date(now).toISOString()

    // 4. Update jika baris sudah dibuat (misal dari sinkronisasi Google Sheets) atau Insert baru
    if (existingResult) {
      const { data: updated, error: updateErr } = await supabase
        .from('race_results')
        .update({
          finish_time: finishTimeIso,
          duration_ms: durationMs,
          status: 'finished',
        })
        .eq('id', existingResult.id)
        .select()
        .single()

      if (updateErr) {
        return { data: null, error: `Gagal memperbarui catatan finish: ${updateErr.message}` }
      }
      return { data: updated as RaceResult, error: null }
    } else {
      const { data: result, error: insertErr } = await supabase
        .from('race_results')
        .insert({
          participant_id: participantId,
          race_event_id: eventId,
          finish_time: finishTimeIso,
          duration_ms: durationMs,
          status: 'finished',
        })
        .select()
        .single()

      if (insertErr) {
        if (insertErr.code === '23505') {
          return { data: null, error: 'Peserta ini sudah tercatat finish pada sesi ini!' }
        }
        return { data: null, error: `Gagal mencatat finish: ${insertErr.message}` }
      }

      return { data: result as RaceResult, error: null }
    }
  } catch (err: unknown) {
    return { data: null, error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem' }
  }
}

/**
 * Mengambil papan skor (Leaderboard) dengan menggabungkan race_results & participants
 * Urutan utama: duration_ms ASC (waktu tercepat di atas).
 * Peserta dengan waktu seri dipecah berdasarkan urutan position Sheet lalu id.
 * Peserta tanpa waktu (null) ditaruh di bagian paling bawah.
 */
export async function getLeaderboard(eventId: number): Promise<QueryResponse<LeaderboardItem[]>> {
  try {
    const { data, error } = await supabase
      .from('race_results')
      .select(`
        id,
        participant_id,
        duration_ms,
        position,
        finish_time,
        status,
        participants (
          id,
          name,
          bib_number
        )
      `)
      .eq('race_event_id', eventId)
      .order('duration_ms', { ascending: true, nullsFirst: false })
      .order('position', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })

    if (error) {
      return { data: null, error: `Gagal memuat papan skor: ${error.message}` }
    }

    interface LeaderboardRowQuery {
      participant_id: number
      duration_ms: number | null
      finish_time: string
      status: LeaderboardItem['status']
      participants: {
        id: number
        name: string
        bib_number: string
      } | null
    }

    // Format data menjadi struktur LeaderboardItem yang rapi
    const leaderboard: LeaderboardItem[] = ((data as unknown as LeaderboardRowQuery[]) || []).map((row, index: number) => ({
      rank: index + 1,
      participant_id: row.participant_id,
      participant_name: row.participants?.name || 'Anonim',
      bib_number: row.participants?.bib_number || '-',
      duration_ms: row.duration_ms,
      finish_time: row.finish_time,
      status: row.status,
    }))

    return { data: leaderboard, error: null }
  } catch (err: unknown) {
    return { data: null, error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem' }
  }
}
