/**
 * hooks/useVoice.js
 * Browser-native speech input (SpeechRecognition) and output (SpeechSynthesis).
 * When autoSpeak is on, the bot speaks each reply then automatically opens
 * the mic so the user can respond hands-free.
 */
import { useState, useRef, useCallback } from 'react'

const SR = window.SpeechRecognition || window.webkitSpeechRecognition

export function useVoice() {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking]   = useState(false)
  const [autoSpeak, setAutoSpeak]     = useState(false)
  const [transcript, setTranscript]   = useState('')
  const recognitionRef = useRef(null)
  const autoSpeakRef   = useRef(false)  // kept in sync with autoSpeak state

  const inputSupported  = Boolean(SR)
  const outputSupported = Boolean(window.speechSynthesis)

  /** Start microphone / speech recognition */
  const startListening = useCallback(() => {
    if (!SR) return
    const rec = new SR()
    rec.continuous     = true
    rec.interimResults = true
    rec.lang           = 'en-US'

    rec.onstart  = () => setIsListening(true)
    rec.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join('')
      setTranscript(t)
    }
    rec.onend  = () => setIsListening(false)
    rec.onerror = () => setIsListening(false)

    recognitionRef.current = rec
    rec.start()
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  const clearTranscript = useCallback(() => setTranscript(''), [])

  /**
   * Speak text aloud.
   * When autoSpeak is on, automatically opens the mic after the bot
   * finishes speaking so the user can reply hands-free.
   */
  const speak = useCallback((text) => {
    if (!outputSupported || !autoSpeakRef.current) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.onstart = () => setIsSpeaking(true)
    utt.onend   = () => {
      setIsSpeaking(false)
      // Auto-open mic after bot finishes speaking (500 ms gap to avoid
      // picking up the tail of the TTS audio)
      if (autoSpeakRef.current && SR) {
        setTimeout(() => {
          if (autoSpeakRef.current) startListening()
        }, 500)
      }
    }
    window.speechSynthesis.speak(utt)
  }, [outputSupported, startListening])

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
  }, [])

  const toggleAutoSpeak = useCallback(() => {
    setAutoSpeak(prev => {
      const next = !prev
      autoSpeakRef.current = next
      if (!next) {
        window.speechSynthesis?.cancel()
        recognitionRef.current?.stop()
      }
      return next
    })
  }, [])

  return {
    inputSupported,
    outputSupported,
    isListening,
    isSpeaking,
    autoSpeak,
    transcript,
    startListening,
    stopListening,
    clearTranscript,
    speak,
    stopSpeaking,
    toggleAutoSpeak,
  }
}
