import { supabase } from './supabase'
import { WasitMatch, WasitParticipant, DEFAULT_MATCHES } from './wasitDefaults'

export const SESSION_EVENT_ID = 999
export const MATCHES_STORE_EVENT_ID = 998
export const DNF_STORE_EVENT_ID = 997

export type MatchLockStatus = 
  | 'LOCKED'            // Match baru dipilih / belum dibuka. Timer kosong & disabled. Plasma stay di match sebelumnya.
  | 'UNLOCKED'          // Wasit buka gembok! Timer muncul & aktif (tombol START menyala). Plasma transisi ke match ini, timer 00:00.00.
  | 'RUNNING'           // Timer menekan START. Stopwatch berjalan, wasit bisa geser posisi & tandai DNF live.
  | 'TIMER_COMPLETED'   // Split terakhir ditekan (semua finisher non-DNF tercatat). Stopwatch STOP otomatis. Wasit review & edit manual waktu.
  | 'LOCKED_FINAL'      // Wasit menekan KUNCI HASIL MATCH. Urutan + Timer menyatu. Plasma transform ke tampilan hasil terpadu.

export interface ActiveMatchSession {
  matchId: number
  matchTitle: string
  status: MatchLockStatus
  participants: WasitParticipant[]
  splits: Array<{ position: number; timer: string; elapsedMs: number; manualEdited?: boolean }>
  results?: Array<{ position: number; bib_number: string; name: string; status: string; timer: string }>
  elapsedMs: number
  startTime: number | null
  dnfList: string[]
  matchStatuses?: Record<number, 'LOCKED' | 'UNLOCKED' | 'FINAL'>
  updatedAt: string
  lockedAt?: string
}

export const INITIAL_MATCH_SESSION: ActiveMatchSession = {
  matchId: 1,
  matchTitle: DEFAULT_MATCHES[0]?.title || 'MATCH 1 (051 B - 057 B)',
  status: 'LOCKED',
  participants: DEFAULT_MATCHES[0]?.participants || [],
  splits: [],
  elapsedMs: 0,
  startTime: null,
  dnfList: [],
  updatedAt: new Date().toISOString(),
}

/**
 * Simpan / perbarui status sesi match aktif di Supabase race_events (id: 999)
 * Tahan banting terhadap refresh, beda device, dan restart server Vercel.
 */
export async function saveActiveSession(session: ActiveMatchSession): Promise<boolean> {
  try {
    const payload = {
      ...session,
      status: (session.status || 'LOCKED').toUpperCase(),
      updatedAt: new Date().toISOString(),
    }
    const { error } = await supabase.from('race_events').upsert({
      id: SESSION_EVENT_ID,
      name: JSON.stringify(payload),
      status: payload.status === 'RUNNING' ? 'running' : 'idle',
      start_time: session.startTime ? new Date(session.startTime).toISOString() : new Date().toISOString(),
    })
    if (error) {
      console.warn('Gagal simpan session ke Supabase:', error)
      return false
    }
    return true
  } catch (err) {
    console.warn('Exception saat simpan session:', err)
    return false
  }
}

/**
 * Muat status sesi match aktif dari Supabase race_events (id: 999)
 */
export async function getActiveSession(): Promise<ActiveMatchSession> {
  try {
    const { data, error } = await supabase
      .from('race_events')
      .select('name')
      .eq('id', SESSION_EVENT_ID)
      .maybeSingle()

    if (!error && data?.name) {
      const parsed = JSON.parse(data.name) as ActiveMatchSession
      if (parsed) {
        parsed.status = (parsed.status || 'LOCKED').toUpperCase() as MatchLockStatus
        parsed.participants = parsed.participants || []
        parsed.splits = parsed.splits || []
        parsed.dnfList = parsed.dnfList || []
        return parsed
      }
    }
  } catch (err) {
    console.warn('Gagal muat session dari Supabase:', err)
  }
  return INITIAL_MATCH_SESSION
}

/**
 * Simpan data kustom peserta match (jika ada pemindahan peserta antar match maks 10)
 */
export async function saveMatchesStore(matches: WasitMatch[]): Promise<boolean> {
  try {
    const payload = {
      matches,
      updatedAt: new Date().toISOString(),
    }
    const { error } = await supabase.from('race_events').upsert({
      id: MATCHES_STORE_EVENT_ID,
      name: JSON.stringify(payload),
      status: 'idle',
      start_time: new Date().toISOString(),
    })
    return !error
  } catch (err) {
    console.warn('Exception simpan matches store:', err)
    return false
  }
}

/**
 * Muat data kustom peserta match (jika pernah diedit oleh panitia)
 */
export async function getMatchesStore(): Promise<WasitMatch[] | null> {
  try {
    const { data, error } = await supabase
      .from('race_events')
      .select('name')
      .eq('id', MATCHES_STORE_EVENT_ID)
      .maybeSingle()

    if (!error && data?.name) {
      const parsed = JSON.parse(data.name)
      if (parsed?.matches && Array.isArray(parsed.matches)) {
        return parsed.matches as WasitMatch[]
      }
    }
  } catch (err) {
    console.warn('Gagal muat matches store:', err)
  }
  return null
}

/**
 * Muat daftar global nomor dada (BIB) yang berstatus DNF secara persisten
 * (Kebal terhadap overwrite dari Google Apps Script versi lama)
 */
export async function getGlobalDnfBibs(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('race_events')
      .select('name')
      .eq('id', DNF_STORE_EVENT_ID)
      .maybeSingle()

    if (!error && data?.name) {
      const parsed = JSON.parse(data.name)
      if (Array.isArray(parsed?.dnfBibs)) {
        return parsed.dnfBibs as string[]
      }
    }
  } catch {}
  return []
}

/**
 * Simpan daftar global nomor dada (BIB) yang berstatus DNF
 */
export async function saveGlobalDnfBibs(dnfBibs: string[]): Promise<boolean> {
  try {
    const cleanUnique = Array.from(new Set(dnfBibs.map((b) => String(b).trim().toUpperCase()).filter(Boolean)))
    const { error } = await supabase.from('race_events').upsert({
      id: DNF_STORE_EVENT_ID,
      name: JSON.stringify({ dnfBibs: cleanUnique, updatedAt: new Date().toISOString() }),
      status: 'idle',
      start_time: new Date().toISOString(),
    })
    return !error
  } catch {
    return false
  }
}
