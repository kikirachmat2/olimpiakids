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

let broadcastChannel: ReturnType<typeof supabase.channel> | null = null
let isChannelSubscribed = false
const pendingBroadcastQueue: Array<{ event: string; payload: unknown }> = []

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
        isChannelSubscribed = true
        console.log('[RealtimeSync] Connected to broadcast channel:', SYNC_CHANNEL_NAME)

        // Flush pending broadcasts jika ada antrian saat reconnect
        while (pendingBroadcastQueue.length > 0) {
          const item = pendingBroadcastQueue.shift()
          if (item && broadcastChannel) {
            broadcastChannel.send({
              type: 'broadcast',
              event: item.event,
              payload: item.payload,
            })
          }
        }
      } else {
        isChannelSubscribed = false
      }
    })
  }
  return broadcastChannel
}

/**
 * Broadcast event perubahan Timer ke semua device (Laptop / Plasma / Wasit)
 * Dual-Sync: Mengirim via Supabase WebSocket + update `/api/plasma/state` HTTP
 */
export function broadcastTimerEvent(payload: Omit<RealtimeTimerPayload, 'senderId'>) {
  const fullPayload = {
    ...payload,
    senderId: CLIENT_ID,
  }

  // 1. Supabase WebSocket Broadcast
  try {
    const channel = getSyncChannel()
    if (isChannelSubscribed) {
      channel.send({
        type: 'broadcast',
        event: 'timer-sync',
        payload: fullPayload,
      })
    } else {
      pendingBroadcastQueue.push({ event: 'timer-sync', payload: fullPayload })
    }
  } catch (err) {
    console.warn('[RealtimeSync] Gagal broadcast timer event via WS:', err)
  }

  // 2. HTTP State Dual-Backup (Non-blocking)
  if (typeof window !== 'undefined' && payload.action !== 'REQUEST_SYNC') {
    fetch('/api/plasma/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchIdx: payload.matchIdx,
        matchId: payload.matchId,
        timer: {
          status: payload.status,
          isRunning: payload.isRunning,
          isPaused: payload.isPaused,
          startTime: payload.startTime || null,
          elapsedMs: payload.elapsedMs || 0,
          splits: payload.splits || [],
        },
      }),
    }).catch(() => {})
  }
}

/**
 * Broadcast event perubahan Wasit ke semua device (Laptop / Plasma / Timer)
 * Dual-Sync: Mengirim via Supabase WebSocket + update `/api/plasma/state` HTTP
 */
export function broadcastWasitEvent(payload: Omit<RealtimeWasitPayload, 'senderId'>) {
  const fullPayload = {
    ...payload,
    senderId: CLIENT_ID,
  }

  // 1. Supabase WebSocket Broadcast
  try {
    const channel = getSyncChannel()
    if (isChannelSubscribed) {
      channel.send({
        type: 'broadcast',
        event: 'wasit-sync',
        payload: fullPayload,
      })
    } else {
      pendingBroadcastQueue.push({ event: 'wasit-sync', payload: fullPayload })
    }
  } catch (err) {
    console.warn('[RealtimeSync] Gagal broadcast wasit event via WS:', err)
  }

  // 2. HTTP State Dual-Backup (Non-blocking)
  if (typeof window !== 'undefined' && payload.action !== 'REQUEST_SYNC') {
    fetch('/api/plasma/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchIdx: payload.matchIdx,
        matchId: payload.matchId,
        wasit: {
          status: payload.status,
          participants: payload.participants || [],
        },
      }),
    }).catch(() => {})
  }
}
