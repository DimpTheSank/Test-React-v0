'use client'
import { useEffect, use, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Cookies from 'js-cookie'
import { db } from '@/lib/firebase'
import { doc, getDoc, addDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore'
import Papa from 'papaparse'
import { convertDriveLink } from '@/lib/driveUtils'
import { useHighlight } from '@/lib/useHighlight'
import HighlightToolbar from '@/app/components/HighlightToolbar'
import { SkeletonBaiTap } from '@/app/components/Skeleton'
import { renderContextBlock } from '@/lib/parseContext'
import { isAnswerCorrect } from '@/lib/answerUtils'

const mauKyNang = {
  'Reading':   'var(--c-primary-mid)',
  'Listening': 'var(--c-success)',
  'Writing':   'var(--c-writing)',
  'Speaking':  'var(--c-speaking)',
  'Tổng hợp':  'var(--c-tonghop)',
}

// ─── FontSizeControl ──────────────────────────────────────────────────────────
function FontSizeControl({ label, value, onChange, min = 11, max = 36 }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '4px',
      padding: '3px 6px', borderRadius: '8px',
      backgroundColor: 'var(--c-primary-bg)',
      border: '1px solid var(--c-primary-pale)',
      userSelect: 'none', flexShrink: 0,
    }}>
      <span style={{ fontSize: '10px', color: 'var(--c-text-muted)', fontWeight: '600', marginRight: '2px' }}>
        {label}
      </span>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        style={{
          width: '20px', height: '20px', borderRadius: '5px', border: 'none',
          backgroundColor: value <= min ? 'transparent' : 'var(--c-surface)',
          color: value <= min ? 'var(--c-primary-pale)' : 'var(--c-primary)',
          fontSize: '14px', fontWeight: '700', cursor: value <= min ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1, padding: 0, transition: 'background-color 0.15s',
        }}
      >−</button>
      <span style={{
        fontSize: '11px', fontWeight: '600', color: 'var(--c-primary)',
        minWidth: '24px', textAlign: 'center',
      }}>{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        style={{
          width: '20px', height: '20px', borderRadius: '5px', border: 'none',
          backgroundColor: value >= max ? 'transparent' : 'var(--c-surface)',
          color: value >= max ? 'var(--c-primary-pale)' : 'var(--c-primary)',
          fontSize: '14px', fontWeight: '700', cursor: value >= max ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1, padding: 0, transition: 'background-color 0.15s',
        }}
      >+</button>
    </div>
  )
}

// ─── Navigator Bar (ngang, giống IELTS) ──────────────────────────────────────
function NavigatorBar({ questions, answers, reviewAnswers, isReview, currentGroup, onJump, notes }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      padding: '6px 16px', overflowX: 'auto',
      borderBottom: '1px solid var(--c-primary-pale)',
      backgroundColor: 'var(--c-sidebar-bg)',
      flexShrink: 0,
    }}>
      <span style={{
        fontSize: '11px', color: 'var(--c-text-muted)', fontWeight: '600',
        whiteSpace: 'nowrap', marginRight: '4px',
      }}>Câu:</span>

      {questions.map((q, i) => {
        const userAns   = isReview ? reviewAnswers[q.globalIndex] : answers[q.globalIndex]
        const correct   = q.Correct_Ans?.trim()
        const inCurrent = q.Group === currentGroup
        const hasNote   = !!(notes?.[q.globalIndex] && notes[q.globalIndex].trim())   // ← THÊM

        let bg = 'var(--c-surface)', color = 'var(--c-primary-mid)', border = 'var(--c-primary-pale)'

        if (inCurrent && !isReview) {
          bg = 'var(--c-primary)'; color = '#fff'; border = 'var(--c-primary)'
        } else if (isReview) {
          if (q.Question_Type === 'fill_blank') {
            const correctParts = (correct || '').split('|').map(s => s.trim())
            const userParts    = (userAns || []).map(s => s || '')
            const allCorrect   = correctParts.every((c, ci) => isAnswerCorrect(userParts[ci], c))
            const anyFilled    = (userAns || []).some(Boolean)
            if (!anyFilled)      { bg = 'var(--c-warn-bg)';    color = 'var(--c-warn-textsoft)';  border = 'var(--c-warn)'          }
            else if (allCorrect) { bg = 'var(--c-success-bg)'; color = 'var(--c-success-text)';   border = 'var(--c-success-border)' }
            else                 { bg = 'var(--c-danger-bg)';  color = 'var(--c-danger-text)';    border = 'var(--c-danger-border)'  }
          } else {
            if (!userAns)                              { bg = 'var(--c-warn-bg)';    color = 'var(--c-warn-textsoft)';  border = 'var(--c-warn)'          }
            else if (isAnswerCorrect(userAns, correct)) { bg = 'var(--c-success-bg)'; color = 'var(--c-success-text)';   border = 'var(--c-success-border)' }
            else                                        { bg = 'var(--c-danger-bg)';  color = 'var(--c-danger-text)';    border = 'var(--c-danger-border)'  }
          }
          if (inCurrent) { border = 'var(--c-primary)'; }
        } else if (userAns) {
          bg = 'var(--c-success-bg)'; color = 'var(--c-success-text)'; border = 'var(--c-success-border)'
          if (inCurrent) { border = 'var(--c-primary-mid)' }
        } else if (inCurrent) {
          bg = 'var(--c-primary-bg)'; color = 'var(--c-primary)'; border = 'var(--c-primary-light)'
        }

        return (
          <div
            key={i}
            onClick={() => onJump(i)}
            style={{
              position: 'relative',                          /* ← THÊM để đặt dot absolute */
              width: '30px', height: '30px', borderRadius: '6px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              backgroundColor: bg, color, border: `1px solid ${border}`,
              transition: 'all 0.15s',
            }}
          >
            {i + 1}
            {hasNote && (                                     /* ← THÊM dot vàng */
              <span style={{
                position: 'absolute', top: '-3px', right: '-3px',
                width: '7px', height: '7px', borderRadius: '50%',
                backgroundColor: 'var(--c-warn)',
                border: '1.5px solid var(--c-sidebar-bg)',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
// ─── Helper: nhận diện link Drive để quyết định render iframe hay audio player ─
function isDriveLink(url) {
  return typeof url === 'string' && url.includes('drive.google.com')
}

// ─── Custom Audio Player (dùng cho link R2 / link audio trực tiếp) ───────────
function AudioPlayer({ src }) {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => { setDuration(audio.duration || 0); setIsLoading(false) }
    const handleEnded = () => setIsPlaying(false)
    const handleWaiting = () => setIsLoading(true)
    const handlePlaying = () => setIsLoading(false)

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('waiting', handleWaiting)
    audio.addEventListener('playing', handlePlaying)
    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('waiting', handleWaiting)
      audio.removeEventListener('playing', handlePlaying)
    }
  }, [src])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) { audio.pause(); setIsPlaying(false) }
    else { audio.play(); setIsPlaying(true) }
  }

  const skip = (sec) => {
    const audio = audioRef.current
    if (!audio) return
    const max = duration || audio.duration || 0
    const next = Math.min(Math.max(audio.currentTime + sec, 0), max)
    audio.currentTime = next
    setCurrentTime(next)
  }

  const handleSeek = (e) => {
    const audio = audioRef.current
    const val = parseFloat(e.target.value)
    if (!audio || isNaN(val)) return
    audio.currentTime = val
    setCurrentTime(val)
  }

  const formatTime = (t) => {
    if (!t || isNaN(t)) return '0:00'
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const pct = duration ? (currentTime / duration) * 100 : 0

  const skipBtnStyle = (size) => ({
    width: size, height: size, borderRadius: '50%',
    border: '1.5px solid var(--c-primary-pale)',
    backgroundColor: 'var(--c-surface)', color: 'var(--c-primary)',
    fontSize: '11px', fontWeight: '700', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'all 0.15s', gap: '1px',
    boxShadow: '0 1px 2px rgba(24,95,165,0.08)',
  })

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '10px',
      width: '100%', padding: '16px 20px', borderRadius: '14px',
      background: 'linear-gradient(135deg, var(--c-primary-bg) 0%, var(--c-primary-barest) 100%)',
      border: '1px solid var(--c-primary-pale)',
      boxShadow: 'var(--shadow-card)',
      boxSizing: 'border-box', flexShrink: 0,
    }}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          fontSize: '11px', fontWeight: '700', color: 'var(--c-primary)',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          🎧 Audio {isLoading && <span style={{ fontWeight: '400', textTransform: 'none', color: 'var(--c-text-muted)' }}>đang tải...</span>}
        </span>
        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--c-primary-dark)', fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(currentTime)} <span style={{ color: 'var(--c-text-muted)', fontWeight: '400' }}>/ {formatTime(duration)}</span>
        </span>
      </div>

      <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.01"
          value={currentTime}
          onChange={handleSeek}
          style={{
            width: '100%', height: '6px', borderRadius: '99px',
            appearance: 'none', WebkitAppearance: 'none',
            background: `linear-gradient(to right, var(--c-primary) 0%, var(--c-primary-mid) ${pct}%, var(--c-primary-pale) ${pct}%, var(--c-primary-pale) 100%)`,
            outline: 'none', cursor: 'pointer', accentColor: 'var(--c-primary)',
          }}
        />
        <style>{`
          input[type="range"]::-webkit-slider-thumb {
            appearance: none; -webkit-appearance: none;
            width: 16px; height: 16px; border-radius: 50%;
            background: var(--c-surface); border: 3px solid var(--c-primary);
            cursor: pointer; box-shadow: 0 1px 4px rgba(24,95,165,0.35);
            transition: transform 0.15s;
          }
          input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.15); }
          input[type="range"]::-moz-range-thumb {
            width: 16px; height: 16px; border-radius: 50%;
            background: var(--c-surface); border: 3px solid var(--c-primary);
            cursor: pointer;
          }
        `}</style>
      </div>

      {/* Hàng nút điều khiển: -10 -5 -3 ▶ +3 +5 +10 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <button onClick={() => skip(-10)} title="Lùi 10 giây" style={skipBtnStyle('34px')}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-primary-bg)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--c-surface)'}>
          <span style={{ fontSize: '13px' }}>⏮</span>10
        </button>

        <button onClick={() => skip(-5)} title="Lùi 5 giây" style={skipBtnStyle('30px')}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-primary-bg)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--c-surface)'}>
          <span style={{ fontSize: '12px' }}>◀</span>5
        </button>

        <button onClick={() => skip(-3)} title="Lùi 3 giây" style={skipBtnStyle('27px')}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-primary-bg)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--c-surface)'}>
          <span style={{ fontSize: '11px' }}>◀</span>3
        </button>

        <button
          onClick={togglePlay}
          title={isPlaying ? 'Tạm dừng' : 'Phát'}
          style={{
            width: '52px', height: '52px', borderRadius: '50%', border: 'none', cursor: 'pointer',
            backgroundColor: 'var(--c-primary)', color: '#fff', fontSize: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(24,95,165,0.35)', flexShrink: 0,
            transition: 'transform 0.15s, background-color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)'; e.currentTarget.style.backgroundColor = 'var(--c-primary-dark)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = 'var(--c-primary)' }}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <button onClick={() => skip(3)} title="Tiến 3 giây" style={skipBtnStyle('27px')}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-primary-bg)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--c-surface)'}>
          3<span style={{ fontSize: '11px' }}>▶</span>
        </button>

        <button onClick={() => skip(5)} title="Tiến 5 giây" style={skipBtnStyle('30px')}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-primary-bg)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--c-surface)'}>
          5<span style={{ fontSize: '12px' }}>▶</span>
        </button>

        <button onClick={() => skip(10)} title="Tiến 10 giây" style={skipBtnStyle('34px')}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-primary-bg)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--c-surface)'}>
          10<span style={{ fontSize: '13px' }}>⏭</span>
        </button>
      </div>
    </div>
  )
}
// ─── Render audio: iframe nếu là Drive, AudioPlayer nếu không ────────────────
function AudioSource({ src }) {
  return isDriveLink(src)
    ? <iframe src={src} width="100%" height="80" style={{ border: 'none', borderRadius: '8px', flexShrink: 0 }} />
    : <AudioPlayer src={src} />
}
const MAX_NOTE_LENGTH = 300

// ─── Note Button (icon sổ ghi chú cạnh mỗi câu) ───────────────────────────────
function NoteButton({ hasNote, isActive, onClick }) {
  return (
    <button
      data-note-btn
      onClick={onClick}
      title="Ghi chú"
      style={{
        width: '26px', height: '26px', borderRadius: '6px', flexShrink: 0,
        border: `1px solid ${isActive ? 'var(--c-primary)' : hasNote ? 'var(--c-warn)' : 'var(--c-primary-pale)'}`,
        backgroundColor: isActive ? 'var(--c-primary)' : hasNote ? 'var(--c-warn-bgsoft)' : 'var(--c-surface)',
        color: isActive ? '#fff' : hasNote ? 'var(--c-warn-text)' : 'var(--c-text-muted)',
        fontSize: '13px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s', position: 'relative',
      }}
    >
      📓
      {hasNote && !isActive && (
        <span style={{
          position: 'absolute', top: '-3px', right: '-3px',
          width: '8px', height: '8px', borderRadius: '50%',
          backgroundColor: 'var(--c-warn)', border: '1.5px solid var(--c-surface)',
        }} />
      )}
    </button>
  )
}

// ─── Note Panel (bong bóng nổi góc dưới trái) ─────────────────────────────────
function NotePanel({ activeIdx, note, onChange, onClose, isReview }) {
  if (activeIdx === null) return null
  const len = (note || '').length

  return (
    <div
      id="note-panel"
      style={{
        position: 'fixed', bottom: '20px', left: '20px', zIndex: 3000,
        width: '320px', maxWidth: 'calc(100vw - 40px)',
        backgroundColor: 'var(--c-surface)', borderRadius: '16px',
        boxShadow: 'var(--shadow-modal)', border: '1px solid var(--c-primary-pale)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      {/* Header giống bong bóng chat */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', backgroundColor: 'var(--c-primary)',
      }}>
        <span style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>
          📓 Ghi chú câu {activeIdx + 1}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: '#fff',
            fontSize: '18px', cursor: 'pointer', lineHeight: 1, padding: 0,
          }}
        >×</button>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <textarea
          autoFocus
          value={note || ''}
          onChange={e => onChange(e.target.value.slice(0, MAX_NOTE_LENGTH))}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="Nhập ghi chú cho câu này..."
          style={{
            width: '100%', minHeight: '90px', padding: '10px 12px',
            borderRadius: '8px', border: '1px solid var(--c-primary-pale)',
            outline: 'none', resize: 'vertical', fontSize: '13px',
            fontFamily: 'inherit',
            backgroundColor: 'var(--c-surface)',
            color: 'var(--c-text)', boxSizing: 'border-box',
          }}
        />

        <span style={{ fontSize: '11px', color: 'var(--c-text-muted)', textAlign: 'right' }}>
          {len}/{MAX_NOTE_LENGTH}
        </span>

      </div>
    </div>
  )
}
// ─── Context Panel (trái) ─────────────────────────────────────────────────────
function ContextPanel({ firstInGroup, fontSize, transcript }) {
  const hasTranscript = !!firstInGroup?.Transcript

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--c-primary-pale)',
      minWidth: 0, minHeight: 0, overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px',
        borderBottom: '1px solid var(--c-primary-pale)',
        backgroundColor: 'var(--c-primary-barest)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--c-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          📄 Context
        </span>
        <FontSizeControl label="Cỡ chữ" value={fontSize.value} onChange={fontSize.set} />
      </div>

      {/* Content */}
      <div
        id="content-panel"
        key={firstInGroup?.Group ?? firstInGroup?.globalIndex ?? 'empty'}
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: '20px 24px',
          fontSize: `${fontSize.value}px`, lineHeight: '1.85',
          color: 'var(--c-primary-dark)',
          display: 'flex', flexDirection: 'column', gap: '16px',
        }}
      >
        {firstInGroup?.Audios?.map((src, i) => (
          <AudioSource key={src + i} src={src} />
        ))}

        <div className={firstInGroup?.Layout === '2col' ? 'vung2-2col' : undefined}>
          {firstInGroup?.Contexts?.map((ctx, i) => (
            <div key={i} style={{
              lineHeight: '1.85', color: 'var(--c-primary-dark)',
              breakInside: 'avoid', marginBottom: '4px',
              textAlign: 'justify', hyphens: 'auto',
            }}>
              {ctx.startsWith('http')
                ? <img src={ctx} style={{ maxWidth: '100%', borderRadius: '8px' }} alt={`Hình ${i + 1}`} />
                : renderContextBlock(ctx, `ctx-${i}`)
              }
            </div>
          ))}
        </div>

        {!firstInGroup?.Audios?.length && !firstInGroup?.Contexts?.length && (
          <p style={{ color: 'var(--c-primary-pale)', fontStyle: 'italic' }}>
            Không có nội dung chung cho nhóm này.
          </p>
        )}

        {/* ── Transcript ── */}
        {hasTranscript && (
          <TranscriptBox
            transcriptText={firstInGroup.Transcript}
            transcript={transcript}
          />
        )}
      </div>
    </div>
  )
}

// ─── Transcript Box ─────────────────────────────────────────────────────────
function TranscriptBox({ transcriptText, transcript }) {
  const { unlocked, visible, onToggleVisible, input, setInput, error, disabled, onUnlock } = transcript

  return (
    <div style={{
      marginTop: '4px', padding: '14px 16px', borderRadius: '10px',
      border: '1px solid var(--c-primary-bg)',
      backgroundColor: 'var(--c-primary-barest)',
      display: 'flex', flexDirection: 'column', gap: '10px',
    }}>
      {!unlocked ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="password"
              placeholder="Nhập pass"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onUnlock()}
              disabled={disabled}
              style={{
                flex: 1, minWidth: '140px', padding: '8px 12px', borderRadius: '8px',
                border: '1px solid var(--c-primary-pale)', backgroundColor: 'var(--c-surface)',
                fontSize: '13px', outline: 'none',
              }}
            />
            <button
              onClick={onUnlock}
              disabled={disabled}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                backgroundColor: disabled ? 'var(--c-primary-pale)' : 'var(--c-primary-mid)',
                color: '#fff', fontSize: '13px', fontWeight: '600',
                cursor: disabled ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap', transition: 'background-color 0.15s',
              }}
            >
              Hiện Transcript
            </button>
          </div>
          {error && (
            <span style={{ fontSize: '12px', color: 'var(--c-danger)', fontWeight: '600' }}>
              {error}
            </span>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Toggle header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--c-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📝 Transcript
            </span>
            <button
              onClick={onToggleVisible}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px', borderRadius: '9999px',
                border: '1px solid var(--c-primary-pale)',
                backgroundColor: visible ? 'var(--c-primary-mid)' : 'var(--c-surface)',
                color: visible ? '#fff' : 'var(--c-primary-mid)',
                fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {visible ? '🙈 Ẩn' : '👁 Hiện'}
            </button>
          </div>

          {/* Nội dung — chỉ render khi visible */}
          {visible && (
            <div style={{
              fontSize: 'inherit', lineHeight: '1.85', color: 'var(--c-text-soft)',
              whiteSpace: 'pre-wrap',
            }}>
              {transcriptText}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Questions Panel (phải) ───────────────────────────────────────────────────
function QuestionsPanel({
  questionsInGroup, cauHienTai, answers, reviewAnswers,
  isReview, fontSize, onAnswer,
  isFirstGroup, isLastGroup, goToPrevGroup, goToNextGroup,
  onNopBai, getOptions, getReviewBorderColor,
  notes, activeNoteIdx, onOpenNote,          // ← THÊM
}) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      minWidth: 0, minHeight: 0, overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px',
        borderBottom: '1px solid var(--c-primary-pale)',
        backgroundColor: 'var(--c-primary-barest)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--c-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          ✏️ Questions
        </span>
        <FontSizeControl label="Cỡ chữ" value={fontSize.value} onChange={fontSize.set} />
      </div>

      {/* Scrollable questions */}
      <div id="question-panel" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {questionsInGroup.map((q) => (
          <QuestionItem
            key={q.globalIndex}
            q={q}
            isCurrent={q.globalIndex === cauHienTai}
            isReview={isReview}
            answers={answers}
            reviewAnswers={reviewAnswers}
            fontSize={fontSize.value}
            onAnswer={onAnswer}
            getOptions={getOptions}
            getReviewBorderColor={getReviewBorderColor}
            notes={notes}                         /* ← THÊM */
            activeNoteIdx={activeNoteIdx}          /* ← THÊM */
            onOpenNote={onOpenNote}                /* ← THÊM */
          />
        ))}

        {/* Nav buttons */}
        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', padding: '10px 0' }}>
          <button
            onClick={goToPrevGroup}
            disabled={isFirstGroup}
            style={{
              flex: 1, padding: '12px', borderRadius: '8px',
              border: '1px solid var(--c-primary-pale)',
              backgroundColor: 'var(--c-surface)', color: 'var(--c-primary-mid)',
              cursor: isFirstGroup ? 'not-allowed' : 'pointer',
              opacity: isFirstGroup ? 0.4 : 1, fontWeight: '500', fontSize: '14px',
            }}
          >← Trước</button>

          {!isReview && isLastGroup ? (
            <button
              onClick={onNopBai}
              style={{
                flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
                backgroundColor: 'var(--c-success)', color: '#fff',
                fontWeight: '600', cursor: 'pointer', fontSize: '14px',
              }}
            >Nộp bài ✓</button>
          ) : (
            <button
              onClick={goToNextGroup}
              disabled={isLastGroup}
              style={{
                flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
                backgroundColor: 'var(--c-primary-mid)', color: '#fff',
                cursor: isLastGroup ? 'not-allowed' : 'pointer',
                opacity: isLastGroup ? 0.4 : 1, fontWeight: '500', fontSize: '14px',
              }}
            >Tiếp →</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Single Question Item ─────────────────────────────────────────────────────
function QuestionItem({ q, isCurrent, isReview, answers, reviewAnswers, fontSize, onAnswer, getOptions, getReviewBorderColor, notes, activeNoteIdx, onOpenNote }) {
  const hasNote = !!(notes?.[q.globalIndex] && notes[q.globalIndex].trim())

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '12px',
      backgroundColor: isCurrent ? 'var(--c-primary-barest)' : 'transparent',
      padding: '10px', borderRadius: '8px',
    }}>
      {/* Header: câu hỏi + nút ghi chú */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        {q.Question_Type !== 'fill_blank' && (
          <p style={{ margin: 0, flex: 1, fontSize: `${fontSize}px`, fontWeight: '600', color: 'var(--c-primary)' }}>
            {q.Question}
          </p>
        )}
        <div style={{ marginLeft: q.Question_Type === 'fill_blank' ? 'auto' : 0 }}>
          <NoteButton
            hasNote={hasNote}
            isActive={activeNoteIdx === q.globalIndex}
            onClick={() => onOpenNote(q.globalIndex)}
          />
        </div>
      </div>

      {/* MCQ */}
      {(q.Question_Type === 'mcq' || q.Question_Type === 'mcq_blank') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {q.Question_Type === 'mcq'
            ? getOptions(q).map(opt => {
                const border = isReview ? getReviewBorderColor(q, opt.key) : (answers[q.globalIndex] === opt.key ? 'var(--c-primary)' : 'var(--c-primary-pale)')
                const bg     = isReview
                  ? (isAnswerCorrect(opt.key, q.Correct_Ans) ? 'var(--c-success-bg)' : opt.key === reviewAnswers[q.globalIndex] ? 'var(--c-danger-bg)' : !reviewAnswers[q.globalIndex] ? 'var(--c-warn-bgsoft)' : 'var(--c-surface)')
                  : (answers[q.globalIndex] === opt.key ? 'var(--c-primary-bg)' : 'var(--c-surface)')
                const color  = isReview
                  ? (isAnswerCorrect(opt.key, q.Correct_Ans) ? 'var(--c-success-text)' : opt.key === reviewAnswers[q.globalIndex] ? 'var(--c-danger-text)' : 'var(--c-primary-mid)')
                  : (answers[q.globalIndex] === opt.key ? 'var(--c-primary-dark)' : 'var(--c-primary-mid)')
                return (
                  <div key={opt.key} onClick={() => !isReview && onAnswer(q.globalIndex, opt.key)}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: `1.5px solid ${border}`, backgroundColor: bg, color, fontSize: `${fontSize}px`, cursor: isReview ? 'default' : 'pointer', transition: 'all 0.15s' }}>
                    {opt.key}. {opt.value}
                  </div>
                )
              })
            : ['A', 'B', 'C', 'D'].slice(0, parseInt(q.Num_Answers) || 4).map(key => {
                const border = isReview ? getReviewBorderColor(q, key) : (answers[q.globalIndex] === key ? 'var(--c-primary)' : 'var(--c-primary-pale)')
                const bg     = isReview
                  ? (isAnswerCorrect(key, q.Correct_Ans) ? 'var(--c-success-bg)' : key === reviewAnswers[q.globalIndex] ? 'var(--c-danger-bg)' : !reviewAnswers[q.globalIndex] ? 'var(--c-warn-bgsoft)' : 'var(--c-surface)')
                  : (answers[q.globalIndex] === key ? 'var(--c-primary-bg)' : 'var(--c-surface)')
                const color  = isReview
                  ? (isAnswerCorrect(key, q.Correct_Ans) ? 'var(--c-success-text)' : key === reviewAnswers[q.globalIndex] ? 'var(--c-danger-text)' : 'var(--c-text-muted)')
                  : (answers[q.globalIndex] === key ? 'var(--c-primary-dark)' : 'var(--c-text-muted)')
                return (
                  <div key={key} onClick={() => !isReview && onAnswer(q.globalIndex, key)}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: `1.5px solid ${border}`, backgroundColor: bg, color, fontSize: `${fontSize}px`, cursor: isReview ? 'default' : 'pointer', fontWeight: '600', textAlign: 'center' }}>
                    {key}
                  </div>
                )
              })
          }
        </div>
      )}

      {/* Fill short */}
      {q.Question_Type === 'fill_short' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Array.from({ length: parseInt(q.Num_Answers) || 1 }, (_, i) => (
            <input key={i} type="text"
              placeholder={`Đáp án ${parseInt(q.Num_Answers) > 1 ? i + 1 : ''}`}
              value={isReview ? (reviewAnswers[q.globalIndex]?.[i] || '') : (answers[q.globalIndex]?.[i] || '')}
              readOnly={isReview}
              onChange={(e) => {
                if (isReview) return
                const prev = answers[q.globalIndex] || []
                const newArr = [...prev]; newArr[i] = e.target.value
                onAnswer(q.globalIndex, newArr)
              }}
              style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--c-primary-pale)', outline: 'none', backgroundColor: isReview ? 'var(--c-primary-barest)' : 'var(--c-surface)', fontSize: `${fontSize}px` }}
            />
          ))}
        </div>
      )}

      {/* Fill long */}
      {q.Question_Type === 'fill_long' && (
        <textarea
          placeholder="Nhập bài làm của bạn..."
          value={isReview ? (reviewAnswers[q.globalIndex] || '') : (answers[q.globalIndex] || '')}
          readOnly={isReview}
          onChange={(e) => { if (isReview) return; onAnswer(q.globalIndex, e.target.value) }}
          style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--c-primary-pale)', minHeight: '120px', resize: 'vertical', outline: 'none', backgroundColor: isReview ? 'var(--c-primary-barest)' : 'var(--c-surface)', fontSize: `${fontSize}px` }}
        />
      )}

      {/* Fill blank */}
      {q.Question_Type === 'fill_blank' && (
        <FillBlankQuestion
          q={q}
          isReview={isReview}
          userAnswer={isReview ? null : answers[q.globalIndex]}
          reviewAnswer={isReview ? reviewAnswers[q.globalIndex] : null}
          onChange={(newSlots) => onAnswer(q.globalIndex, newSlots)}
          fontSize={fontSize}
        />
      )}
    </div>
  )
}

// ─── FillBlankQuestion Component ──────────────────────────────────────────────
function FillBlankQuestion({ q, isReview, userAnswer, reviewAnswer, onChange, fontSize }) {
  const correctParts = (q.Correct_Ans || '').split('|').map(s => s.trim())
  const wordBankRaw  = (q.Word_Bank   || '').split('|').map(s => s.trim()).filter(Boolean)
  const numBlanks    = correctParts.length

  const slots = userAnswer
    ? [...userAnswer, ...Array(numBlanks).fill(null)].slice(0, numBlanks)
    : Array(numBlanks).fill(null)

  const usedWords = slots.filter(Boolean)
  const bankWords = wordBankRaw.filter(w => {
    const usedCount  = usedWords.filter(u => u === w).length
    const totalCount = wordBankRaw.filter(x => x === w).length
    return usedCount < totalCount
  })

  const handleClickWord = (word) => {
    if (isReview) return
    const firstEmpty = slots.findIndex(s => !s)
    if (firstEmpty === -1) return
    const newSlots = [...slots]; newSlots[firstEmpty] = word
    onChange(newSlots)
  }

  const handleClickSlot = (slotIdx) => {
    if (isReview) return
    const newSlots = [...slots]; newSlots[slotIdx] = null
    onChange(newSlots)
  }

  const segments = []
  let blankIdx = 0
  const parts = q.Question.split('___')
  parts.forEach((part, i) => {
    if (part) segments.push({ type: 'text', val: part })
    if (i < parts.length - 1) segments.push({ type: 'blank', idx: blankIdx++ })
  })

  const getSlotStyle = (slotIdx) => {
    if (isReview) {
      const revAns = (reviewAnswer || [])[slotIdx]
      if (!revAns)                                          return { bg: 'var(--c-warn-bgsoft)', border: 'var(--c-warn)', color: 'var(--c-warn-textsoft)' }
      if (isAnswerCorrect(revAns, correctParts[slotIdx])) return { bg: 'var(--c-success-bg)', border: 'var(--c-success)', color: 'var(--c-success-text)' }
      return                                                       { bg: 'var(--c-danger-bg)', border: 'var(--c-danger)', color: 'var(--c-danger-text)' }
    }
    if (slots[slotIdx]) return { bg: 'var(--c-primary-bg)', border: 'var(--c-primary-mid)', color: 'var(--c-primary-dark)' }
    return                     { bg: 'var(--c-surface)',   border: 'var(--c-primary-pale)', color: 'var(--c-primary-pale)' }
  }

  const fs = fontSize || 14

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{
        fontSize: `${fs}px`, lineHeight: '2.4', color: 'var(--c-text)',
        padding: '14px 18px', borderRadius: '10px',
        border: '1px solid var(--c-primary-bg)', backgroundColor: 'var(--c-primary-barest)',
      }}>
        {segments.map((seg, si) => {
          if (seg.type === 'text') return <span key={si}>{seg.val}</span>
          const idx    = seg.idx
          const style  = getSlotStyle(idx)
          const filled = isReview ? (reviewAnswer || [])[idx] : slots[idx]
          return (
            <span key={si} onClick={() => filled && handleClickSlot(idx)}
              title={filled && !isReview ? 'Click để bỏ chọn' : undefined}
              style={{
                display: 'inline-block', minWidth: '90px', padding: '3px 12px', margin: '0 3px',
                borderRadius: '6px', border: `1.5px dashed ${style.border}`,
                backgroundColor: style.bg, color: style.color,
                fontSize: `${Math.max(11, fs - 1)}px`, fontWeight: filled ? '600' : '400',
                cursor: filled && !isReview ? 'pointer' : 'default',
                textAlign: 'center', verticalAlign: 'middle', transition: 'all 0.15s', userSelect: 'none',
              }}
              onMouseEnter={e => { if (filled && !isReview) e.currentTarget.style.backgroundColor = 'var(--c-danger-bg)' }}
              onMouseLeave={e => { if (filled && !isReview) e.currentTarget.style.backgroundColor = style.bg }}
            >
              {filled || <span style={{ opacity: 0.35, fontStyle: 'italic', fontWeight: 400, fontSize: `${Math.max(11, fs - 2)}px` }}>...</span>}
              {isReview && filled && !isAnswerCorrect(filled, correctParts[idx]) && (
                <span style={{ marginLeft: '6px', color: 'var(--c-success)', fontWeight: '600', fontSize: `${Math.max(11, fs - 2)}px` }}>
                  → {correctParts[idx]}
                </span>
              )}
            </span>
          )
        })}
      </div>

      {!isReview && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '8px',
          padding: '12px 14px', borderRadius: '10px',
          border: '1.5px solid var(--c-primary-pale)',
          backgroundColor: 'var(--c-primary-bgsoft)', minHeight: '48px',
        }}>
          {bankWords.length === 0 && (
            <span style={{ color: 'var(--c-primary-pale)', fontSize: `${Math.max(11, fs - 1)}px`, fontStyle: 'italic', alignSelf: 'center' }}>
              Tất cả từ đã được điền
            </span>
          )}
          {bankWords.map((word, wi) => (
            <span key={`${word}-${wi}`} onClick={() => handleClickWord(word)}
              style={{
                padding: '6px 14px', borderRadius: '20px',
                border: '1.5px solid var(--c-primary-pale)',
                backgroundColor: 'var(--c-surface)', color: 'var(--c-primary)',
                fontSize: `${Math.max(11, fs - 1)}px`, fontWeight: '500',
                cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s',
                boxShadow: '0 1px 3px rgba(24,95,165,0.08)',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--c-primary-bg)'; e.currentTarget.style.borderColor = 'var(--c-primary-mid)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--c-surface)'; e.currentTarget.style.borderColor = 'var(--c-primary-pale)' }}
            >
              {word}
            </span>
          ))}
        </div>
      )}

      {isReview && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '8px',
          padding: '10px 14px', borderRadius: '10px',
          border: '1px solid var(--c-primary-bg)', backgroundColor: 'var(--c-primary-barest)',
        }}>
          <span style={{ color: 'var(--c-text-muted)', fontSize: `${Math.max(11, fs - 2)}px`, marginRight: '4px', alignSelf: 'center' }}>Word bank:</span>
          {wordBankRaw.map((word, wi) => (
            <span key={wi} style={{
              padding: '4px 12px', borderRadius: '20px',
              border: '1px solid var(--c-primary-pale)', backgroundColor: 'var(--c-surface)',
              color: correctParts.includes(word) ? 'var(--c-success)' : 'var(--c-text-muted)',
              fontSize: `${Math.max(11, fs - 2)}px`, fontWeight: correctParts.includes(word) ? '600' : '400',
            }}>{word}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BaiTap({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const isReview = searchParams.get('review') === 'true'

  const [exercise, setExercise]     = useState(null)
  const [questions, setQuestions]   = useState([])
  const [cauHienTai, setCauHienTai] = useState(0)
  const [answers, setAnswers]       = useState({})
  const [showConfirm, setShowConfirm]   = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitDone, setSubmitDone]     = useState(false)
  const [ketQua, setKetQua]             = useState(null)
  const [draftSaved, setDraftSaved]     = useState(false)
  const [reviewAnswers, setReviewAnswers] = useState({})

  const [notes, setNotes]             = useState({})
  const [activeNoteIdx, setActiveNoteIdx] = useState(null)

  const [fontSizeContext, setFontSizeContext]     = useState(16)
  const [fontSizeQuestions, setFontSizeQuestions] = useState(16)

  const { toolbar, applyHighlight, hideToolbar } = useHighlight(['content-panel', 'question-panel'])

  const saveDraftTimeout = useRef(null)
  const assignmentIdRef  = useRef(null)
  const isFirstLoad      = useRef(true)
  const [transcriptUnlocked, setTranscriptUnlocked] = useState(false)
  const [transcriptVisible, setTranscriptVisible]   = useState(false)  
  const [transcriptInput, setTranscriptInput]       = useState('')
  const [transcriptError, setTranscriptError]       = useState(false)
  const [transcriptDisabled, setTranscriptDisabled] = useState(false)

  const handleUnlockTranscript = () => {
    if (transcriptDisabled) return

    const correctPass = (exercise?.pass || '').toString()

    // Chưa cấu hình pass cho bài này
    if (!correctPass) {
      setTranscriptError('Chưa có')
      setTranscriptDisabled(true)
      setTimeout(() => { setTranscriptError(false); setTranscriptDisabled(false) }, 2000)
      return
    }

    if (transcriptInput === correctPass) {
      setTranscriptUnlocked(true)
      setTranscriptError(false)
    } else {
      setTranscriptError('Sai pass')
      setTranscriptDisabled(true)
      setTimeout(() => { setTranscriptError(false); setTranscriptDisabled(false) }, 2000)
    }
  }
  const toggleTranscriptVisible = () => setTranscriptVisible(v => !v)

  // ── Auth & load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!Cookies.get('isLoggedIn')) router.push('/')
    loadInfo()
  }, [])

  // ── Auto-save draft ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false; return }
    if (Object.keys(answers).length === 0 && Object.keys(notes).length === 0) return

    clearTimeout(saveDraftTimeout.current)
    saveDraftTimeout.current = setTimeout(async () => {
      try {
        const userInfo = getUserInfo()
        if (!userInfo) return
        let assignId = assignmentIdRef.current
        if (!assignId) {
          const assignSnap = await getDocs(query(
            collection(db, 'assignments'),
            where('userId', '==', userInfo.taiKhoan),
            where('exerciseId', '==', id)
          ))
          assignId = assignSnap.docs[0]?.id || null
          assignmentIdRef.current = assignId
        }
        if (assignId) {
          await updateDoc(doc(db, 'assignments', assignId), {
            trangThai: 'Đang làm', answers, notes,        // ← thêm notes
            tongCauDraft: questions.length,
            thoiGianLuuNhap: new Date().toISOString(),
          })
          setDraftSaved(true)
          setTimeout(() => setDraftSaved(false), 2000)
        }
      } catch (err) { console.error('Lỗi lưu nháp:', err) }
    }, 1500)

    return () => clearTimeout(saveDraftTimeout.current)
  }, [answers, notes])   // ← thêm notes vào dependency

  function getUserInfo() {
    try {
      const raw = document.cookie.split('; ').find(r => r.startsWith('userInfo='))?.split('=')[1]
      return JSON.parse(decodeURIComponent(raw))
    } catch { return null }
  }

  async function loadInfo() {
    try {
      const exSnap = await getDoc(doc(db, 'exercises', id))
      if (!exSnap.exists()) return
      const exData = exSnap.data()
      setExercise(exData)

      const fileId = exData.linkDrive.match(/\/d\/([a-zA-Z0-9_-]+)/)[1]
      const csvUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`
      const response = await fetch(csvUrl)
      const text = await response.text()

      const { data } = Papa.parse(text, {
        header: true, skipEmptyLines: true,
        transform: (val, col) => (col === 'Group' || col === 'Layout' ? val.trim() : val)
      })
      const splitMedia = (raw, type) =>
        (raw || '').split('|').map(s => s.trim()).filter(Boolean).map(s => convertDriveLink(s, type))
      const processedData = data.map((item, index) => ({
        ...item, globalIndex: index,
        Contexts:   splitMedia(item.Context, 'image'),
        Audios:     splitMedia(item.Audio,   'audio'),
        Transcript: (item.Transcript || '').trim(),
      }))
      setQuestions(processedData)

      const userInfo = getUserInfo()
      if (!userInfo) return

      if (isReview) {
        const subSnap = await getDocs(query(
          collection(db, 'submissions'),
          where('userId', '==', userInfo.taiKhoan),
          where('exerciseId', '==', id)
        ))
        if (!subSnap.empty) {
          const best = subSnap.docs.map(d => d.data())
            .reduce((a, b) => (a.diem ?? -1) >= (b.diem ?? -1) ? a : b)
          setReviewAnswers(best.answers || {})
        }

        // Notes lưu ở assignments, không ở submissions → query riêng để hiển thị (read-only)
        const assignSnapRv = await getDocs(query(
          collection(db, 'assignments'),
          where('userId', '==', userInfo.taiKhoan),
          where('exerciseId', '==', id)
        ))
        const assignNoteDoc = assignSnapRv.docs[0]
        if (assignNoteDoc) assignmentIdRef.current = assignNoteDoc.id
        if (assignNoteDoc?.data()?.notes) setNotes(assignNoteDoc.data().notes)

      } else {
        const assignSnap = await getDocs(query(
          collection(db, 'assignments'),
          where('userId', '==', userInfo.taiKhoan),
          where('exerciseId', '==', id)
        ))
        const assignDoc = assignSnap.docs[0]
        if (assignDoc) {
          assignmentIdRef.current = assignDoc.id
          const assignData = assignDoc.data()
          if (assignData.trangThai === 'Đang làm' && assignData.answers) {
            setAnswers(assignData.answers)
          }
          if (assignData.notes) setNotes(assignData.notes)   // ← notes load bất kể trạng thái
        }
      }
    } catch (error) { console.error("Lỗi khi tải bài tập:", error) }
  }

  // ── Computed ────────────────────────────────────────────────────────────────
  const currentCau       = questions[cauHienTai]
  const currentGroup     = currentCau?.Group
  const questionsInGroup = questions.filter(q => q.Group === currentGroup)
  const firstInGroup     = questionsInGroup[0]
  const firstIdxOfGroup  = questionsInGroup[0]?.globalIndex ?? 0
  const lastIdxOfGroup   = questionsInGroup[questionsInGroup.length - 1]?.globalIndex ?? 0
  const isFirstGroup     = firstIdxOfGroup === 0
  const isLastGroup      = lastIdxOfGroup === questions.length - 1
  const mauHeader        = mauKyNang[exercise?.kyNang] || 'var(--c-primary)'

  const soCauChuaLam = questions.filter(q => {
    const ans = answers[q.globalIndex]
    if (q.Question_Type === 'fill_blank') {
      const numBlanks = (q.Question.match(/___/g) || []).length
      return !ans || (Array.isArray(ans) && ans.filter(Boolean).length < numBlanks)
    }
    return !ans
  }).length

  // ── Navigation ──────────────────────────────────────────────────────────────
  const goToPrevGroup = () => {
    if (isFirstGroup) return
    const prevGroupName = questions[firstIdxOfGroup - 1]?.Group
    const prevGroupFirstIdx = questions.findIndex(q => q.Group === prevGroupName)
    hideToolbar()
    setCauHienTai(prevGroupFirstIdx === -1 ? 0 : prevGroupFirstIdx)
  }

  const goToNextGroup = () => {
    if (isLastGroup) return
    hideToolbar()
    setCauHienTai(lastIdxOfGroup + 1)
  }

  const handleJump = (i) => {
    hideToolbar()
    setCauHienTai(i)
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const getOptions = (q) => {
    if (!q) return []
    return ['A', 'B', 'C', 'D', 'E']
      .map(k => ({ key: k, value: q[`Opt_${k}`] }))
      .filter(o => o.value && o.value.trim() !== '')
  }

  const getReviewBorderColor = (q, optKey) => {
    const userAns = reviewAnswers[q.globalIndex]
    const correct = q.Correct_Ans?.trim()
    if (!userAns) return 'var(--c-warn)'
    if (isAnswerCorrect(optKey, correct)) return 'var(--c-success)'
    if (optKey === userAns) return 'var(--c-danger)'
    return 'var(--c-primary-pale)'
  }

  const handleAnswer = (globalIndex, val) => {
    if (isReview) return
    setAnswers(prev => ({ ...prev, [globalIndex]: val }))
  }

  const handleOpenNote = (globalIndex) => {
    setActiveNoteIdx(prev => (prev === globalIndex ? null : globalIndex))
  }

  const handleChangeNote = (val) => {
    if (activeNoteIdx === null) return
    setNotes(prev => ({ ...prev, [activeNoteIdx]: val }))
  }

  useEffect(() => {
    const handleClickOutsideNote = (e) => {
      if (activeNoteIdx === null) return
      if (e.target.closest('#note-panel') || e.target.closest('[data-note-btn]')) return
      setActiveNoteIdx(null)
    }
    document.addEventListener('mousedown', handleClickOutsideNote)
    return () => document.removeEventListener('mousedown', handleClickOutsideNote)
  }, [activeNoteIdx])

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleNopBai = async () => {
    setIsSubmitting(true)
    try {
      const userInfo = getUserInfo()
      const taiKhoan = userInfo?.taiKhoan
      let soCauDung = 0

      questions.forEach((q) => {
        const correctRaw = q.Correct_Ans?.trim()
        if (!correctRaw) return
        const userAns = answers[q.globalIndex]

        if (q.Question_Type === 'mcq' || q.Question_Type === 'mcq_blank') {
          if (isAnswerCorrect(userAns, correctRaw)) soCauDung++
        } else if (q.Question_Type === 'fill_short') {
          const correctParts = correctRaw.split('|').map(s => s.trim())
          const userParts    = userAns || []
          if (correctParts.every((c, i) => isAnswerCorrect(userParts[i], c))) soCauDung++
        } else if (q.Question_Type === 'fill_blank') {
          const correctParts = correctRaw.split('|').map(s => s.trim())
          const userParts    = userAns || []
          if (correctParts.every((c, i) => isAnswerCorrect(userParts[i], c))) soCauDung++
        }
      })

      const assignSnap   = await getDocs(query(collection(db, 'assignments'), where('userId', '==', taiKhoan), where('exerciseId', '==', id)))
      const assignmentId = assignSnap.docs[0]?.id || null

      await addDoc(collection(db, 'submissions'), {
        userId: taiKhoan, exerciseId: id, assignmentId,
        answers, diem: soCauDung, tongCau: questions.length,
        thoiGianNop: new Date().toISOString(), trangThai: 'Đã nộp',
      })

      if (assignmentId) {
        await updateDoc(doc(db, 'assignments', assignmentId), {
          trangThai: 'Đã làm', thoiGianNop: new Date().toISOString(),
          answers: null, thoiGianLuuNhap: null,
        })
      }

      setKetQua({ dung: soCauDung, tong: questions.length })
      setSubmitDone(true)
    } catch (err) {
      console.error('Lỗi khi nộp bài:', err)
      alert('Có lỗi xảy ra khi nộp bài. Vui lòng thử lại!')
    } finally { setIsSubmitting(false) }
  }

  if (!exercise || questions.length === 0) return <SkeletonBaiTap />

  return (
    <main style={{ minHeight: 'calc(100vh - 56px)', height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>

      <style>{`
        .vung2-2col { column-count: 2; column-gap: 28px; }
        @media (max-width: 768px) {
          .ielts-body { flex-direction: column !important; }
          .bt-panel-left  { border-right: none !important; border-bottom: 1px solid var(--c-primary-pale); max-height: 45vh; }
          .bt-panel-right { max-height: 55vh; }
          .vung2-2col { column-count: 1; }
        }
        @keyframes fadeInOut {
          0%   { opacity: 0; transform: translateY(4px); }
          20%  { opacity: 1; transform: translateY(0); }
          80%  { opacity: 1; }
          100% { opacity: 0; }
        }
        .draft-saved-toast { animation: fadeInOut 2s ease forwards; }
      `}</style>

      {/* ── Confirm dialog ── */}
      {showConfirm && !submitDone && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, backgroundColor: 'var(--c-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--c-surface)', borderRadius: '16px', padding: '32px', width: '340px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--shadow-modal)' }}>
            <h3 style={{ margin: 0, color: 'var(--c-primary-dark)', textAlign: 'center' }}>Xác nhận nộp bài</h3>
            {soCauChuaLam > 0 ? (
              <div style={{ backgroundColor: 'var(--c-warn-bg)', borderRadius: '10px', padding: '12px 16px', textAlign: 'center' }}>
                <span style={{ color: 'var(--c-warn-text)', fontSize: '14px', fontWeight: '500' }}>⚠️ Bạn còn <strong>{soCauChuaLam}</strong> câu chưa làm.</span>
              </div>
            ) : (
              <div style={{ backgroundColor: 'var(--c-success-bg)', borderRadius: '10px', padding: '12px 16px', textAlign: 'center' }}>
                <span style={{ color: 'var(--c-success-text)', fontSize: '14px', fontWeight: '500' }}>✅ Bạn đã hoàn thành tất cả {questions.length} câu!</span>
              </div>
            )}
            <p style={{ margin: 0, color: 'var(--c-text-soft)', fontSize: '14px', textAlign: 'center' }}>Sau khi nộp bạn không thể chỉnh sửa đáp án.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowConfirm(false)} style={btnSecondary}>Làm tiếp</button>
              <button onClick={handleNopBai} disabled={isSubmitting}
                style={{ ...btnPrimary, backgroundColor: 'var(--c-success)', opacity: isSubmitting ? 0.7 : 1 }}>
                {isSubmitting ? 'Đang nộp...' : 'Nộp bài'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Submit done dialog ── */}
      {submitDone && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, backgroundColor: 'var(--c-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--c-surface)', borderRadius: '16px', padding: '40px 32px', width: '340px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', boxShadow: 'var(--shadow-modal)' }}>
            <div style={{ fontSize: '48px' }}>🎉</div>
            <h3 style={{ margin: 0, color: 'var(--c-primary-dark)', textAlign: 'center' }}>Nộp bài thành công!</h3>
            <p style={{ fontSize: '20px', fontWeight: '700', color: 'var(--c-success)', margin: 0 }}>{ketQua?.dung} / {ketQua?.tong} câu đúng</p>
            <button onClick={() => router.push('/trang-chu')} style={{ ...btnPrimary, width: '100%' }}>Về trang chủ</button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        backgroundColor: isReview ? 'var(--c-text-muted)' : mauHeader,
        padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
      }}>
        <span style={{ color: 'var(--c-surface)', fontWeight: '600', fontSize: '14px' }}>{exercise.loaiBai} · {exercise.kyNang}</span>
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>—</span>
        <span style={{ color: 'var(--c-surface)', fontSize: '14px' }}>{exercise.tenBaiTap}</span>
        {isReview && (
          <span style={{ padding: '3px 10px', borderRadius: '20px', backgroundColor: 'rgba(255,255,255,0.2)', color: 'var(--c-surface)', fontSize: '12px', fontWeight: '500' }}>Chế độ xem lại</span>
        )}
        {draftSaved && (
          <span className="draft-saved-toast" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', gap: '4px' }}>✓ Đã lưu nháp</span>
        )}
        <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
          {questions.length} câu
        </span>
        {!isReview && (
          <button
            onClick={() => setShowConfirm(true)}
            style={{ marginLeft: '8px', padding: '7px 18px', borderRadius: '8px', border: '2px solid white', backgroundColor: 'transparent', color: 'var(--c-surface)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >Nộp bài ✓</button>
        )}
      </div>

      {/* ── Navigator bar ngang ── */}
      <NavigatorBar
        questions={questions}
        answers={answers}
        reviewAnswers={reviewAnswers}
        isReview={isReview}
        currentGroup={currentGroup}
        onJump={handleJump}
        notes={notes}
      />

      {/* ── Body: 2 panel ── */}
      <div className="ielts-body" style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Panel trái: Context */}
        <div className="bt-panel-left" style={{ flex: 1.8, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--c-primary-pale)', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          <ContextPanel
            firstInGroup={firstInGroup}
            fontSize={{ value: fontSizeContext, set: setFontSizeContext }}
            transcript={{
              unlocked: transcriptUnlocked,
              visible: transcriptVisible,
              onToggleVisible: toggleTranscriptVisible,
              input: transcriptInput,
              setInput: setTranscriptInput,
              error: transcriptError,
              disabled: transcriptDisabled,
              onUnlock: handleUnlockTranscript,
            }}
          />
        </div>

        {/* Panel phải: Questions */}
        <div className="bt-panel-right" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          <QuestionsPanel
            questionsInGroup={questionsInGroup}
            cauHienTai={cauHienTai}
            answers={answers}
            reviewAnswers={reviewAnswers}
            isReview={isReview}
            fontSize={{ value: fontSizeQuestions, set: setFontSizeQuestions }}
            onAnswer={handleAnswer}
            isFirstGroup={isFirstGroup}
            isLastGroup={isLastGroup}
            goToPrevGroup={goToPrevGroup}
            goToNextGroup={goToNextGroup}
            onNopBai={() => setShowConfirm(true)}
            getOptions={getOptions}
            getReviewBorderColor={getReviewBorderColor}
            notes={notes}                    
            activeNoteIdx={activeNoteIdx}    
            onOpenNote={handleOpenNote}      
          />
        </div>

      </div>

      <HighlightToolbar toolbar={toolbar} onHighlight={applyHighlight} onClose={hideToolbar} />

      <NotePanel
        activeIdx={activeNoteIdx}
        note={activeNoteIdx !== null ? notes[activeNoteIdx] : ''}
        onChange={handleChangeNote}
        onClose={() => setActiveNoteIdx(null)}
        isReview={isReview}
      />
    </main>
  )
}

const btnPrimary = {
  flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
  backgroundColor: 'var(--c-primary)', color: 'var(--c-surface)',
  fontWeight: '600', cursor: 'pointer', fontSize: '14px',
}
const btnSecondary = {
  flex: 1, padding: '12px', borderRadius: '8px',
  border: '1px solid var(--c-primary-pale)', backgroundColor: 'var(--c-surface)',
  color: 'var(--c-primary-mid)', fontWeight: '500', cursor: 'pointer', fontSize: '14px',
}