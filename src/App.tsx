import { useState, useRef, useCallback, useEffect } from 'react'

type AppState = 'idle' | 'listening' | 'processing' | 'responded' | 'error'

// ── Icons ───────────────────────────────────────────────────────────────────

function FlameIcon({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2C12 2 8 6.5 8 10c0 1.1.4 2.1 1 2.9C8.4 12.3 8 11.2 8 10c0 0-3 2.5-3 5.5C5 19.1 8.1 22 12 22s7-2.9 7-6.5c0-3-3-5.5-3-5.5 0 1.2-.4 2.3-1 3C15.6 12.1 16 11.1 16 10c0-3.5-4-8-4-8z"
        fill="url(#flameGrad)"
      />
      <defs>
        <linearGradient id="flameGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff8c42" />
          <stop offset="60%" stopColor="#ff4500" />
          <stop offset="100%" stopColor="#ff1a1a" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function MicIcon({ size = 40, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="2" width="6" height="11" rx="3" fill={color} />
      <path
        d="M5 10c0 3.87 3.13 7 7 7s7-3.13 7-7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <line x1="12" y1="17" x2="12" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="9" y1="21" x2="15" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ShieldIcon({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6l-8-4z"
        fill="none"
        stroke="rgba(255,107,0,0.25)"
        strokeWidth="1.5"
      />
      <path
        d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6l-8-4z"
        fill="url(#shieldGrad)"
        opacity="0.12"
      />
      <defs>
        <linearGradient id="shieldGrad" x1="12" y1="2" x2="12" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff6b00" />
          <stop offset="100%" stopColor="#ff1a1a" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function WaveAnimation() {
  return (
    <div className="flex items-end gap-[3px]" style={{ height: 24 }}>
      <div className="wave-bar" style={{ height: 24 }} />
      <div className="wave-bar" style={{ height: 24 }} />
      <div className="wave-bar" style={{ height: 24 }} />
      <div className="wave-bar" style={{ height: 24 }} />
      <div className="wave-bar" style={{ height: 24 }} />
    </div>
  )
}

function SpeakingWave() {
  return (
    <div className="flex items-end gap-[2px]" style={{ height: 20 }}>
      <div className="speaking-bar" style={{ height: 20 }} />
      <div className="speaking-bar" style={{ height: 20 }} />
      <div className="speaking-bar" style={{ height: 20 }} />
      <div className="speaking-bar" style={{ height: 20 }} />
      <div className="speaking-bar" style={{ height: 20 }} />
      <div className="speaking-bar" style={{ height: 20 }} />
      <div className="speaking-bar" style={{ height: 20 }} />
    </div>
  )
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-2">
      <div className="dot" />
      <div className="dot" />
      <div className="dot" />
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [appState, setAppState] = useState<AppState>('idle')
  const [transcript, setTranscript] = useState('')
  const [roastText, setRoastText] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [micPressed, setMicPressed] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  
  const isResettingRef = useRef<boolean>(false)

  const ensureAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume()
    }
  }

  const stopAndClearAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop()
      } catch (e) {
        // Ignore
      }
      sourceNodeRef.current.disconnect()
      sourceNodeRef.current = null
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAndClearAudio()
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  const processAudioRecording = async (audioBlob: Blob) => {
    setAppState('processing')
    try {
      // 1. STT
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      
      const sttRes = await fetch('/api/stt', {
        method: 'POST',
        body: formData,
      })
      
      if (!sttRes.ok) throw new Error('Failed to transcribe audio')
      const sttData = await sttRes.json()
      const text = sttData.text
      setTranscript(text)
      
      if (!text.trim()) {
        throw new Error('No speech detected')
      }

      // 2. Roast
      const roastRes = await fetch('/api/roast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      
      if (!roastRes.ok) throw new Error('Failed to generate roast')
      const roastData = await roastRes.json()
      const roast = roastData.roast
      setRoastText(roast)

      // 3. TTS
      const ttsRes = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: roast }),
      })
      
      if (!ttsRes.ok) throw new Error('Failed to generate speech')
      const ttsAudioBuffer = await ttsRes.arrayBuffer()
      
      if (isResettingRef.current) return // Prevent playing if user reset during process
      
      // Play Audio using Web Audio API
      stopAndClearAudio()
      ensureAudioContext() // Make sure context is active
      const audioBuffer = await audioContextRef.current!.decodeAudioData(ttsAudioBuffer)
      
      sourceNodeRef.current = audioContextRef.current!.createBufferSource()
      sourceNodeRef.current.buffer = audioBuffer
      sourceNodeRef.current.connect(audioContextRef.current!.destination)
      
      sourceNodeRef.current.onended = () => {
        setIsSpeaking(false)
      }
      
      setAppState('responded')
      setIsSpeaking(true)
      sourceNodeRef.current.start(0)

    } catch (error: any) {
      if (isResettingRef.current) return
      console.error(error)
      setErrorMsg(error.message || "Something went wrong — tap to try again.")
      setAppState('error')
    }
  }

  const startListening = useCallback(async () => {
    setErrorMsg('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        // Release tracks
        stream.getTracks().forEach((track) => track.stop())
        if (isResettingRef.current) return
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        processAudioRecording(audioBlob)
      }

      mediaRecorder.start()
      setAppState('listening')
    } catch (err: any) {
      console.error('Mic access error:', err)
      setErrorMsg("Couldn't access the mic — check permissions and try again.")
      setAppState('error')
    }
  }, [])

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const handleMicTap = useCallback(() => {
    isResettingRef.current = false
    ensureAudioContext() // Unlock audio context on user tap

    if (appState === 'idle' || appState === 'error') {
      startListening()
    } else if (appState === 'listening') {
      stopListening()
    }
  }, [appState, startListening, stopListening])

  const reset = useCallback(() => {
    isResettingRef.current = true
    stopAndClearAudio()
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setAppState('idle')
    setTranscript('')
    setRoastText('')
    setIsSpeaking(false)
    setErrorMsg('')
  }, [])

  // ── Mic ring color / style by state ──────────────────────────────────────
  const micRingClass =
    appState === 'listening'
      ? 'animate-mic-glow-listening'
      : 'animate-mic-glow-idle'

  const micBgStyle =
    appState === 'listening'
      ? {
          background:
            'radial-gradient(circle at 35% 35%, #ff8c42, #ff4500 50%, #cc0000)',
        }
      : {
          background:
            'radial-gradient(circle at 35% 35%, #1e1e35, #14142a 60%, #0f0f1f)',
        }

  // ── Instruction text ──────────────────────────────────────────────────────
  const instructionText =
    appState === 'listening'
      ? 'Tap to stop recording...'
      : appState === 'processing'
        ? 'Thinking of a comeback...'
        : appState === 'responded'
          ? 'Your rival has spoken.'
          : appState === 'error'
            ? errorMsg || "Tap to try again."
            : 'Tap and say your trash talk'

  const instructionColor =
    appState === 'error'
      ? 'text-red-400'
      : appState === 'listening'
        ? 'text-fire-400'
        : appState === 'processing'
          ? 'text-orange-400'
          : 'text-gray-400'

  return (
    <>
      <div className="noise-overlay" />

      {/* Page background with radial vignette */}
      <div
        style={{
          minHeight: '100vh',
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,107,0,0.08) 0%, transparent 70%), #09090f',
        }}
      >
        {/* Centered column */}
        <div
          style={{ maxWidth: 480 }}
          className="mx-auto px-5 pb-16 pt-10 flex flex-col items-center gap-0"
        >
          {/* ── HEADER ── */}
          <header className="w-full text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="flame-icon">
                <FlameIcon size={36} />
              </span>
              <h1
                className="font-display gradient-text leading-none tracking-wide"
                style={{ fontSize: 'clamp(2.4rem, 10vw, 3.4rem)' }}
              >
                RIVALRY ROAST
              </h1>
              <span className="flame-icon" style={{ animationDelay: '0.4s' }}>
                <FlameIcon size={36} />
              </span>
            </div>
            <p className="text-gray-500 text-sm font-medium tracking-widest uppercase">
              Talk smack.&nbsp; Get roasted back.
            </p>
          </header>

          {/* ── MIC SECTION ── */}
          <section className="flex flex-col items-center gap-6 w-full mb-8">
            {/* Pulse rings + button */}
            <div className="relative flex items-center justify-center" style={{ width: 180, height: 180 }}>
              {/* Outer idle pulse ring */}
              {appState === 'idle' && (
                <div
                  className="absolute rounded-full animate-pulse-ring"
                  style={{
                    width: 160,
                    height: 160,
                    border: '2px solid rgba(255,107,0,0.4)',
                  }}
                />
              )}
              {/* Listening rings — two staggered */}
              {appState === 'listening' && (
                <>
                  <div
                    className="absolute rounded-full animate-listening-ring"
                    style={{
                      width: 160,
                      height: 160,
                      border: '2px solid rgba(255,107,0,0.7)',
                    }}
                  />
                  <div
                    className="absolute rounded-full animate-listening-ring"
                    style={{
                      width: 160,
                      height: 160,
                      border: '2px solid rgba(255,69,0,0.5)',
                      animationDelay: '0.4s',
                    }}
                  />
                </>
              )}

              {/* Mic button */}
              <button
                onClick={handleMicTap}
                disabled={appState === 'processing' || appState === 'responded'}
                onPointerDown={() => setMicPressed(true)}
                onPointerUp={() => setMicPressed(false)}
                onPointerLeave={() => setMicPressed(false)}
                className={`
                  relative z-10 rounded-full flex items-center justify-center
                  transition-transform duration-150 select-none outline-none
                  ${micRingClass}
                  ${appState === 'idle' || appState === 'error' || appState === 'listening' ? 'cursor-pointer' : 'cursor-default'}
                  ${micPressed ? 'scale-95' : 'scale-100'}
                `}
                style={{
                  width: 140,
                  height: 140,
                  border: '2.5px solid rgba(255,107,0,0.45)',
                  ...micBgStyle,
                }}
                aria-label={
                  appState === 'listening'
                    ? 'Listening to your trash talk'
                    : 'Tap to record trash talk'
                }
              >
                {/* Inner gradient ring */}
                <div
                  className="absolute inset-1 rounded-full opacity-20"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255,140,66,0.6), transparent 60%)',
                  }}
                />

                {appState === 'listening' ? (
                  <WaveAnimation />
                ) : appState === 'processing' ? (
                  <LoadingDots />
                ) : (
                  <MicIcon size={42} color={appState === 'idle' || appState === 'error' ? '#fff' : '#aaa'} />
                )}
              </button>
            </div>

            {/* State instruction */}
            <p
              className={`text-sm font-medium tracking-wide transition-all duration-300 ${instructionColor} animate-fade-in`}
              key={appState}
            >
              {instructionText}
            </p>
          </section>

          {/* ── TRANSCRIPT CARD ── */}
          {(transcript || appState === 'listening') && (
            <div className="w-full mb-4 animate-fade-up">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-2 ml-1">
                You said:
              </p>
              <div
                className="w-full rounded-2xl px-5 py-4 relative"
                style={{
                  background: '#13132a',
                  borderLeft: '3px solid rgba(255,140,66,0.6)',
                  boxShadow: '0 2px 24px rgba(255,107,0,0.08)',
                }}
              >
                {/* Speech bubble tail */}
                <div
                  className="absolute"
                  style={{
                    bottom: -7,
                    left: 22,
                    width: 14,
                    height: 14,
                    background: '#13132a',
                    borderBottom: '3px solid rgba(255,140,66,0.6)',
                    borderLeft: '3px solid rgba(255,140,66,0.6)',
                    borderBottomLeftRadius: 3,
                    transform: 'rotate(-45deg)',
                    clipPath: 'polygon(0 0, 0 100%, 100% 100%)',
                  }}
                />
                <p
                  className="text-gray-100 leading-relaxed"
                  style={{ fontSize: 15, minHeight: 22 }}
                >
                  {transcript || (
                    <span className="text-gray-600 italic">Recording... tap mic to stop.</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* ── RIVAL RESPONSE CARD ── */}
          {appState === 'responded' && roastText ? (
            <div className="w-full mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center justify-between mb-2 ml-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">
                  The Rival claps back:
                </p>
                {isSpeaking && (
                  <div className="flex items-center gap-2 animate-fade-in">
                    <span className="text-xs text-fire-400 font-medium uppercase tracking-widest">
                      Now speaking
                    </span>
                    <SpeakingWave />
                  </div>
                )}
              </div>
              <div
                className="w-full rounded-2xl px-5 py-5 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #1a0a00 0%, #1f0a0a 100%)',
                  borderRight: '3px solid rgba(255,69,0,0.7)',
                  boxShadow:
                    '0 4px 40px rgba(255,26,26,0.15), 0 1px 0 rgba(255,107,0,0.2) inset',
                }}
              >
                {/* Gradient overlay top-right accent */}
                <div
                  className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(circle at top right, #ff4500, transparent 70%)',
                  }}
                />
                {/* Rival icon */}
                <div className="absolute top-3 right-4 opacity-60">
                  <ShieldIcon size={40} />
                </div>

                <p
                  className="text-gray-100 leading-relaxed relative z-10 pr-8"
                  style={{ fontSize: 15 }}
                >
                  {roastText}
                </p>

                {/* Bottom flame accent line */}
                <div
                  className="mt-4 h-px opacity-30"
                  style={{
                    background: 'linear-gradient(to right, #ff6b00, #ff1a1a, transparent)',
                  }}
                />
                <div className="mt-3 flex items-center gap-2">
                  <FlameIcon size={14} />
                  <span className="text-xs text-fire-500 font-semibold uppercase tracking-widest">
                    The Rival
                  </span>
                </div>
              </div>
            </div>
          ) : appState === 'processing' ? (
            /* Processing placeholder */
            <div className="w-full mb-6 animate-fade-up">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-2 ml-1">
                The Rival claps back:
              </p>
              <div
                className="w-full rounded-2xl px-5 py-5"
                style={{
                  background: 'linear-gradient(135deg, #1a0a00 0%, #1f0a0a 100%)',
                  borderRight: '3px solid rgba(255,69,0,0.4)',
                  boxShadow: '0 4px 40px rgba(255,26,26,0.08)',
                }}
              >
                <div className="flex items-center gap-4">
                  <LoadingDots />
                  <span className="text-gray-600 text-sm italic">Cooking up something nasty...</span>
                </div>
              </div>
            </div>
          ) : (
            /* Empty state — first load or after reset */
            appState === 'idle' && !transcript && (
              <div
                className="w-full mb-6 rounded-2xl px-5 py-8 flex flex-col items-center gap-3 animate-fade-in"
                style={{
                  background: '#0d0d1a',
                  border: '1px dashed rgba(255,107,0,0.15)',
                }}
              >
                <div style={{ opacity: 0.25 }}>
                  <FlameIcon size={44} />
                </div>
                <p className="text-gray-600 text-sm text-center leading-relaxed">
                  Your rival is waiting...
                  <br />
                  <span className="text-gray-700">Hit the mic and bring the heat.</span>
                </p>
              </div>
            )
          )}

          {/* ── RESET BUTTON ── */}
          {(appState === 'responded' || appState === 'processing' || (appState === 'error' && transcript)) && (
            <button
              onClick={reset}
              className="
                mt-2 px-8 py-3 rounded-full text-sm font-semibold uppercase tracking-widest
                transition-all duration-200 hover:scale-105 active:scale-95
                animate-fade-up
              "
              style={{
                color: '#ff8c42',
                background: 'rgba(255,107,0,0.08)',
                border: '1.5px solid rgba(255,107,0,0.25)',
                animationDelay: '0.2s',
              }}
            >
              Try again →
            </button>
          )}

          {/* ── FOOTER ── */}
          <footer className="mt-12 text-center">
            <p className="text-xs text-gray-700 tracking-widest uppercase">
              Hackathon 2026 · Passion Track
            </p>
          </footer>
        </div>
      </div>
    </>
  )
}
