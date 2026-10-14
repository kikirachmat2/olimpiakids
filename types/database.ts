// TypeScript definition untuk tabel-tabel di Supabase

export interface Participant {
  id: number
  name: string
  bib_number: string
  age_months: number | null
  created_at?: string
}

export type RaceStatus = 'idle' | 'running' | 'finished'

export interface RaceEvent {
  id: number
  name: string
  status: RaceStatus
  start_time: string | null
  created_at?: string
}

export type ResultStatus = 'finished' | 'disqualified'

export interface RaceResult {
  id: number
  participant_id: number
  race_event_id: number
  finish_time: string
  duration_ms: number | null
  status: ResultStatus
  created_at?: string
}

// Tipe gabungan untuk kebutuhan tampilan papan skor (Leaderboard)
export interface LeaderboardEntry extends RaceResult {
  participant: Participant
}
