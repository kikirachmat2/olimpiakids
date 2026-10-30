import { supabase } from './supabase'
import { WasitParticipant } from './wasitDefaults'

// Unique client ID per browser tab session to avoid processing self-broadcasts
export const CLIENT_ID =
  typeof window !== 'undefined'
    ? (window as unknown as { __olimpiakids_cid?: string }).__olimpiakids_cid ||
      ((window as unknown as { __olimpiakids_cid?: string }).__olimpiakids_cid =
        'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36))
    : 'server'

export interface RealtimeTimerPayload {
  action:
    | 'START'
    | 'SPLIT'
    | 'PAUSE'
    | 'RESUME'
    | 'RESET'
    | 'MATCH_SWITCH'
    | 'STATUS_CHANGE'
    | 'REQUEST_SYNC'
    | 'FULL_SYNC'
  matchId?: number
  matchIdx?: number
  startTime?: number // unix timestamp ms
  elapsedMs?: number
  splits?: Array<{ position: number; timer: string; elapsedMs: number }>
  isRunning?: boolean
  isPaused?: boolean
  status?: 'standby' | 'active' | 'final'
  senderId?: string
}

export interface RealtimeWasitPayload {
  action:
    | 'REORDER'
    | 'DNF'
    | 'MATCH_SWITCH'
    | 'STATUS_CHANGE'
    | 'REQUEST_SYNC'
    | 'FULL_SYNC'
  matchId?: number
  matchIdx?: number
  participants?: WasitParticipant[]
  status?: 'standby' | 'active' | 'final'
  senderId?: string
}

const SYNC_CHANNEL_NAME = 'olimpiakids-live-mirror'

/**
 * Mendapatkan atau membuat Supabase Realtime Broadcast Channel singleton
 */
let broadcastChannel: ReturnType<typeof supabase.channel> | null = null

export function getSyncChannel() {
  if (!broadcastChannel) {
    broadcastChannel = supabase.channel(SYNC_CHANNEL_NAME, {
      config: {
        broadcast: {
          self: false, // jangan dengar pesan sendiri
        },
      },
    })
    broadcastChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[RealtimeSync] Connected to broadcast channel:', SYNC_CHANNEL_NAME)
      }
    })
  }
  return broadcastChannel
}

/**
 * Broadcast event perubahan Timer ke semua device (Laptop / Plasma / Wasit)
 */
export function broadcastTimerEvent(payload: Omit<RealtimeTimerPayload, 'senderId'>) {
  try {
    const channel = getSyncChannel()
    channel.send({
      type: 'broadcast',
      event: 'timer-sync',
      payload: {
        ...payload,
        senderId: CLIENT_ID,
      },
    })
  } catch (err) {
    console.warn('[RealtimeSync] Gagal broadcast timer event:', err)
  }
}

/**
 * Broadcast event perubahan Wasit ke semua device (Laptop / Plasma / Timer)
 */
export function broadcastWasitEvent(payload: Omit<RealtimeWasitPayload, 'senderId'>) {
  try {
    const channel = getSyncChannel()
    channel.send({
      type: 'broadcast',
      event: 'wasit-sync',
      payload: {
        ...payload,
        senderId: CLIENT_ID,
      },
    })
  } catch (err) {
    console.warn('[RealtimeSync] Gagal broadcast wasit event:', err)
  }
}
