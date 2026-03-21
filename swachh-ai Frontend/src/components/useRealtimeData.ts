/**
 * src/hooks/useRealtimeData.ts
 * WebSocket hook — replaces polling for dashboard, leaderboard, dispatch.
 * Falls back to polling if WebSocket unavailable.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { useAppDispatch } from '@/hooks'
import { setApiStatus, setBins, setLeaderboard } from '@/store'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const WS_URL = API.replace(/^http/, 'ws') + '/api/ws/dashboard'

type EventHandler = (data: any) => void

interface Handlers {
  onDashboard?:  EventHandler
  onLeaderboard?: EventHandler
  onMap?:        EventHandler
  onDispatch?:   EventHandler
}

export function useRealtimeData(handlers: Handlers) {
  const dispatch  = useAppDispatch()
  const wsRef     = useRef<WebSocket | null>(null)
  const retryRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [connected, setConnected] = useState(false)
  const [usingWS, setUsingWS]     = useState(false)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setUsingWS(true)
        dispatch(setApiStatus('online'))
        // Heartbeat every 25s
        const hb = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send('ping')
          else clearInterval(hb)
        }, 25000)
      }

      ws.onmessage = (event) => {
        try {
          const { event: type, data } = JSON.parse(event.data)
          if (type === 'dashboard'   && handlers.onDashboard)   handlers.onDashboard(data)
          if (type === 'leaderboard' && handlers.onLeaderboard) {
            handlers.onLeaderboard(data)
            if (data.wards) dispatch(setLeaderboard(data.wards))
          }
          if (type === 'map' && handlers.onMap) {
            handlers.onMap(data)
            if (data.bins) dispatch(setBins(data.bins))
          }
          if (type === 'dispatch_update' && handlers.onDispatch) handlers.onDispatch(data)
        } catch {}
      }

      ws.onerror = () => {
        setConnected(false)
        setUsingWS(false)
      }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null
        // Reconnect after 3s
        retryRef.current = setTimeout(connect, 3000)
      }
    } catch {
      // WebSocket not available — caller uses polling fallback
      setUsingWS(false)
    }
  }, [dispatch, handlers])

  useEffect(() => {
    connect()
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [connect])

  return { connected, usingWS }
}
