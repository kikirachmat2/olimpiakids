import { supabase } from './supabase'
import { WasitParticipant } from './wasitDefaults'
import { ActiveMatchSession } from './sessionStore'

// Unique client ID per browser tab session to avoid processing self-broadcasts
export const CLIENT_ID =
  typeof window !== 'undefined'
    ? (window as unknown as { __olimpiakids_cid?: string }).__olimpiakids_cid ||
      ((window as unknown as { __olimpiakids_cid?: string }).__olimpiakids_cid =
        'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36))
    : 'server'

export interface RealtimeSessionPayload {
  action:
    | 'SESSION_SYNC'
    | 'UNLOCK_MATCH'
    | 'LOCK_MATCH'
    | 'START_TIMER'
    | 'SPLIT_TIMER'
    | 'RESET_TIMER'
    | 'REORDER_WASIT'
    | 'DNF_WASIT'
    | 'MANUAL_TIME_EDIT'
    | 'LOCK_FINAL'
    | 'REQUEST_SYNC'
    | 'MATCH_SWITCH'
  session: ActiveMatchSession
  senderId?: string
}

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
  startTime?: number
  elapsedMs?: number
  splits?: Array<{ position: number; timer: string; elapsedMs: number; manualEdited?: boolean }>
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
    | 'UNLOCK'
    | 'LOCK'
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
 * Broadcast event perubahan sesi aktif ke Wasit, Timer, Plasma
 */
export function broadcastSessionEvent(payload: Omit<RealtimeSessionPayload, 'senderId'>) {
  const fullPayload: RealtimeSessionPayload = {
    ...payload,
    senderId: CLIENT_ID,
  }

  try {
    const ch = getSyncChannel()
    if (isChannelSubscribed && ch) {
      ch.send({
        type: 'broadcast',
        event: 'session-sync',
        payload: fullPayload,
      })
    } else {
      pendingBroadcastQueue.push({ event: 'session-sync', payload: fullPayload })
    }
  } catch (err) {
    console.warn('[RealtimeSync] WebSocket broadcast error:', err)
  }

  // Update HTTP Endpoint fallback
  if (typeof window !== 'undefined') {
    fetch('/api/plasma/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: fullPayload.session,
        action: fullPayload.action,
        senderId: CLIENT_ID,
      }),
    }).catch(() => {})
  }
}

export function broadcastTimerEvent(payload: Omit<RealtimeTimerPayload, 'senderId'>) {
  const fullPayload = {
    ...payload,
    senderId: CLIENT_ID,
  }

  try {
    const ch = getSyncChannel()
    if (isChannelSubscribed && ch) {
      ch.send({
        type: 'broadcast',
        event: 'timer-sync',
        payload: fullPayload,
      })
    } else {
      pendingBroadcastQueue.push({ event: 'timer-sync', payload: fullPayload })
    }
  } catch (err) {
    console.warn('[RealtimeSync] WebSocket broadcast error:', err)
  }
}

export function broadcastWasitEvent(payload: Omit<RealtimeWasitPayload, 'senderId'>) {
  const fullPayload = {
    ...payload,
    senderId: CLIENT_ID,
  }

  try {
    const ch = getSyncChannel()
    if (isChannelSubscribed && ch) {
      ch.send({
        type: 'broadcast',
        event: 'wasit-sync',
        payload: fullPayload,
      })
    } else {
      pendingBroadcastQueue.push({ event: 'wasit-sync', payload: fullPayload })
    }
  } catch (err) {
    console.warn('[RealtimeSync] WebSocket broadcast error:', err)
  }
}
