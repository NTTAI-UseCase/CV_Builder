/**
 * hooks/useWebSocket.js
 * Manages the WebSocket connection to the FastAPI backend.
 * Handles: connect, reconnect, send, event routing.
 */
import { useEffect, useRef, useCallback, useState } from 'react'

const WS_BASE = import.meta.env.VITE_WS_URL || `ws://${window.location.host}/ws`

// Exponential backoff: 1s, 2s, 4s, 8s, 16s, then cap at 30s
function backoffDelay(attempt) {
  return Math.min(1000 * Math.pow(2, attempt), 30000)
}

export function useWebSocket({ sessionId, onEvent }) {
  const wsRef = useRef(null)
  const reconnectCount = useRef(0)
  const reconnectTimer = useRef(null)
  const connIdRef = useRef(0)   // Incremented on every connect; stale onclose handlers bail out
  const [connected, setConnected] = useState(false)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const connect = useCallback(() => {
    if (!sessionId) return
    // Don't open a second socket if one is already open or connecting
    const state = wsRef.current?.readyState
    if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return

    const myId = ++connIdRef.current
    const url = `${WS_BASE}/${sessionId}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (connIdRef.current !== myId) return   // Superseded by a newer connection
      setConnected(true)
      reconnectCount.current = 0
    }

    ws.onmessage = (evt) => {
      try {
        const event = JSON.parse(evt.data)
        onEventRef.current(event)
      } catch (e) {
        console.error('[WS] Parse error', e)
      }
    }

    ws.onclose = () => {
      if (connIdRef.current !== myId) return   // We already moved on; don't reconnect
      setConnected(false)
      const delay = backoffDelay(reconnectCount.current)
      reconnectTimer.current = setTimeout(() => {
        reconnectCount.current++
        connect()
      }, delay)
    }

    ws.onerror = () => { /* onclose fires next; reconnect is handled there */ }
  }, [sessionId])

  useEffect(() => {
    connect()
    return () => {
      // Invalidate this connection's onclose so it never schedules a reconnect
      connIdRef.current++
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  const send = useCallback((type, data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }))
    } else {
      console.warn('[WS] Not connected, cannot send')
    }
  }, [])

  return { connected, send }
}
