'use client'
import { useEffect, use, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Cookies from 'js-cookie'
import { db } from '@/lib/firebase'
import {
  doc, getDoc, addDoc, collection, query, where,
  getDocs, updateDoc
} from 'firebase/firestore'
import Papa from 'papaparse'
import { convertDriveLink } from '@/lib/driveUtils'
import { useHighlight } from '@/lib/useHighlight'
import HighlightToolbar from '@/app/components/HighlightToolbar'
import { renderContextBlock } from '@/lib/parseContext'
import { isAnswerCorrect, normalizeAns } from '@/lib/answerUtils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUserInfo() {
  try {
    const raw = document.cookie.split('; ')
      .find(r => r.startsWith('userInfo='))?.split('=')[1]
    return JSON.parse(decodeURIComponent(raw))
  } catch { return null }
}

const mauKyNang = {
  'Reading':   'var(--c-primary-mid)',
  'Listening': 'var(--c-success)',
  'Writing':   'var(--c-writing)',
  'Speaking':  'var(--c-speaking)',
  'Tổng hợp':  'var(--c-tonghop)',
}

// ─── Font size control ────────────────────────────────────────────────────────

function FontSizeControl({ label, value, onChange, min = 11, max = 36 }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '4px',
      padding: '3px 8px', borderRadius: '8px',
      backgroundColor: 'var(--c-primary-bg)',
      border: '1px solid var(--c-primary-pale)',
      userSelect: 'none', flexShrink: 0,
    }}>
      <span style={{ fontSize: '10px', color: 'var(--c-text-muted)', fontWeight: '600', marginRight: '2px' }}>
        {label}
      </span>
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        style={{ width: '20px', height: '20px', borderRadius: '5px', border: 'none',
          backgroundColor: value <= min ? 'transparent' : 'var(--c-surface)',
          color: value <= min ? 'var(--c-primary-pale)' : 'var(--c-primary)',
          fontSize: '14px', fontWeight: '700', cursor: value <= min ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}>
        −
      </button>
      <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--c-primary)', minWidth: '24px', textAlign: 'center' }}>
        {value}
      </span>
      <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        style={{ width: '20px', height: '20px', borderRadius: '5px', border: 'none',
          backgroundColor: value >= max ? 'transparent' : 'var(--c-surface)',
          color: value >= max ? 'var(--c-primary-pale)' : 'var(--c-primary)',
          fontSize: '14px', fontWeight: '700', cursor: value >= max ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}>
        +
      </button>
    </div>
  )
}

// ─── Custom Audio Player (thay cho iframe Drive) ─────────────────────────────
function AudioPlayer({ src }) {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [hoverTime, setHoverTime] = useState(null) // vị trí hover trên thanh tiến trình

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
      boxSizing: 'border-box',
    }}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Hàng trên: label + thời gian */}
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

      {/* Thanh tiến trình — trải toàn bộ chiều ngang */}
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

const MAX_NOTE_LENGTH_IELTS = 2000

// ─── Nút toggle ghi chú cố định (góc dưới trái) ───────────────────────────────
function NoteToggleButton({ isOpen, hasNote, onClick }) {
  if (isOpen) return null
  return (
    <button
      onClick={onClick}
      title="Ghi chú"
      style={{
        position: 'fixed', bottom: '20px', left: '20px', zIndex: 3000,
        width: '52px', height: '52px', borderRadius: '50%', border: 'none',
        backgroundColor: 'var(--c-primary)', color: '#fff',
        fontSize: '22px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 14px rgba(24,95,165,0.35)',
        transition: 'transform 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      📓
      {hasNote && (
        <span style={{
          position: 'absolute', top: '2px', right: '2px',
          width: '11px', height: '11px', borderRadius: '50%',
          backgroundColor: 'var(--c-warn)', border: '2px solid var(--c-surface)',
        }} />
      )}
    </button>
  )
}

// ─── Panel ghi chú mở rộng (cố định, cao & rộng hơn TOEIC) ────────────────────
function NotePanelIELTS({ isOpen, note, onChange, onClose, isReview }) {
  if (!isOpen) return null
  const len = (note || '').length

  return (
    <div style={{
      position: 'fixed', bottom: '20px', left: '20px', zIndex: 3000,
      width: '420px', maxWidth: 'calc(100vw - 40px)',
      height: '380px', maxHeight: 'calc(100vh - 100px)',
      backgroundColor: 'var(--c-surface)', borderRadius: '16px',
      boxShadow: 'var(--shadow-modal)', border: '1px solid var(--c-primary-pale)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', backgroundColor: 'var(--c-primary)', flexShrink: 0,
      }}>
        <span style={{ color: '#fff', fontSize: '14px', fontWeight: '600' }}>
          📓 Ghi chú bài làm
        </span>
        <button
          onClick={onClose}
          title="Thu nhỏ"
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px',
            color: '#fff', fontSize: '13px', fontWeight: '600',
            cursor: 'pointer', padding: '5px 10px', lineHeight: 1,
          }}
        >
          Thu nhỏ ▾
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
        <textarea
          autoFocus
          value={note || ''}
          onChange={e => onChange(e.target.value.slice(0, MAX_NOTE_LENGTH_IELTS))}
          maxLength={MAX_NOTE_LENGTH_IELTS}
          placeholder="Ghi chú tự do cho cả bài — từ vựng, ý chính, chiến lược làm bài..."
          style={{
            flex: 1, width: '100%', padding: '12px 14px',
            borderRadius: '10px', border: '1px solid var(--c-primary-pale)',
            outline: 'none', resize: 'none', fontSize: '13.5px', lineHeight: '1.6',
            fontFamily: 'inherit',
            backgroundColor: isReview ? 'var(--c-primary-barest)' : 'var(--c-surface)',
            color: 'var(--c-text)', boxSizing: 'border-box',
          }}
        />
        {!isReview && (
          <span style={{ fontSize: '11px', color: 'var(--c-text-muted)', textAlign: 'right', flexShrink: 0 }}>
            {len}/{MAX_NOTE_LENGTH_IELTS}
          </span>
        )}
      </div>
    </div>
  )
}
// ─── Passage renderer (Vùng trái) ────────────────────────────────────────────
function PassagePanel({ passage, audios, fontSize }) {
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
          📄 Passage
        </span>
        <FontSizeControl label="Cỡ chữ" value={fontSize.value} onChange={fontSize.set} />
      </div>

      {/* Content — flex: 1 + minHeight: 0 cho phép scroll */}
      <div id="ielts-passage-panel" style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        padding: '24px 28px',
        fontSize: `${fontSize.value}px`, lineHeight: '1.85',
        color: 'var(--c-primary-dark)',
      }}>
        {/* Audio nếu có */}
        {audios?.map((src, i) => (
          <div key={i} style={{ marginBottom: '16px' }}>
            <AudioPlayer src={src} />
          </div>
        ))}

        {/* Passage text */}
        {passage ? (
          <div style={{ textAlign: 'justify', hyphens: 'auto' }}>
            <PassageContent raw={passage} />
          </div>
        ) : (
          <p style={{ color: 'var(--c-text-muted)', fontStyle: 'italic' }}>
            Không có passage.
          </p>
        )}
      </div>
    </div>
  )
}

// Parse passage: **bold**, *italic*, paragraph breaks
function PassageContent({ raw }) {
  const paragraphs = raw.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  return (
    <>
      {paragraphs.map((para, pi) => {
        // Heading: bắt đầu bằng ## hoặc toàn bộ là **...**
        const isTitle = /^\*\*[^*]+\*\*$/.test(para) || para.startsWith('## ')
        const cleanPara = para.replace(/^##\s*/, '')

        return (
          <p key={pi} style={{
            margin: isTitle ? '20px 0 8px' : '0 0 14px',
            fontWeight: isTitle ? '700' : '400',
            fontSize: isTitle ? 'calc(1em + 1px)' : 'inherit',
            color: isTitle ? 'var(--c-primary-dark)' : 'inherit',
          }}>
            {parseInline(cleanPara)}
          </p>
        )
      })}
    </>
  )
}

function parseInline(text) {
  const nodes = []
  const regex = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g
  let lastIdx = 0, match, key = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) nodes.push(text.slice(lastIdx, match.index))
    if (match[1]) nodes.push(<strong key={key++}>{match[2]}</strong>)
    else nodes.push(<em key={key++}>{match[4]}</em>)
    lastIdx = regex.lastIndex
  }
  if (lastIdx < text.length) nodes.push(text.slice(lastIdx))
  return nodes
}

// ─── Questions panel (Vùng phải) ─────────────────────────────────────────────

function QuestionsPanel({ groups, answers, reviewAnswers, isReview, onChange, fontSize, audios, centered, isListening }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      minWidth: 0, minHeight: 0, overflow: 'hidden',
    }}>
      {/* Toolbar giữ nguyên */}
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

      {/* Scrollable questions — thêm overflowX hidden để chặn tràn ngang toàn panel */}
      <div id="ielts-questions-panel" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '20px 0' }}>
        <div style={{ display: 'flex', width: '100%', minWidth: 0 }}>
          {centered && <div className="ielts-q-margin" style={{ flex: 1 }} />}

          <div className="ielts-q-content" style={{
            flex: centered ? 10 : 1,
            minWidth: 0, // bắt buộc để overflowX auto trong bảng hoạt động
            display: 'flex', flexDirection: 'column', gap: '28px',
            padding: centered ? '0 24px 48px' : '0 32px 48px', // Reading: padding rộng hơn (32px)
          }}>
            {centered && audios?.map((src, i) => (
              <AudioPlayer key={i} src={src} />
            ))}
            {groups.map((group, gi) => (
              <QuestionGroup
                key={gi}
                group={group}
                answers={answers}
                reviewAnswers={reviewAnswers}
                isReview={isReview}
                onChange={onChange}
                fontSize={fontSize.value}
                isListening={isListening}
              />
            ))}
          </div>

          {centered && <div className="ielts-q-margin" style={{ flex: 1 }} />}
        </div>
      </div>
    </div>
  )
}
// ─── Question Group ───────────────────────────────────────────────────────────

function QuestionGroup({ group, answers, reviewAnswers, isReview, onChange, fontSize, isListening }) {
  const firstQ  = group.questions[0]
  const label   = firstQ?.Question_Label || ''
  const type    = firstQ?.Question_Type?.toLowerCase()
  const infoRaw = firstQ?.Question_Info?.trim() || ''
  const isInfoUrl = infoRaw.startsWith('http')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Audio của nhóm — chỉ hiện khi Listening */}
      {isListening && group.audios?.map((src, i) => (
        <AudioPlayer key={src + i} src={src} />
      ))}

      {/* Group label — hiện với tất cả các dạng */}
      {label && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px',
          backgroundColor: 'var(--c-primary-bg)',
          borderLeft: '3px solid var(--c-primary-mid)',
        }}>
          <span style={{
            fontSize: `${Math.max(12, fontSize - 1)}px`,
            fontWeight: '600',
            color: 'var(--c-primary-dark)',
            whiteSpace: 'pre-wrap',   // ← thêm dòng này
            lineHeight: 1.6,          // (tuỳ chọn) cho dễ đọc khi có nhiều dòng
          }}>
            {parseInline(label)}
          </span>
        </div>
      )}

      {/* Question_Info — tất cả dạng trừ map và matching_headings (tự render) */}
      {infoRaw && type !== 'map' && type !== 'matching_headings' && (
        isInfoUrl
          ? <img src={infoRaw} alt="Info" style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--c-primary-pale)' }} />
          : <div style={{
              padding: '12px 16px', borderRadius: '8px',
              backgroundColor: 'var(--c-primary-barest)',
              border: '1px solid var(--c-primary-bg)',
              fontSize: `${fontSize}px`, lineHeight: '1.7',
              color: 'var(--c-primary-dark)',
            }}>
              {renderContextBlock(infoRaw, `info-${firstQ?.globalIndex}`)}
            </div>
      )}

      {/* Dispatch theo type */}
      {type === 'table' && (
        <TableQuestion questions={group.questions} answers={answers} reviewAnswers={reviewAnswers}
          isReview={isReview} onChange={onChange} fontSize={fontSize} />
      )}
      {type === 'flowchart' && (
        <FlowchartQuestion questions={group.questions} answers={answers} reviewAnswers={reviewAnswers}
          isReview={isReview} onChange={onChange} fontSize={fontSize} />
      )}
      {type === 'map' && (
        <MapQuestion questions={group.questions} answers={answers} reviewAnswers={reviewAnswers}
          isReview={isReview} onChange={onChange} fontSize={fontSize} />
      )}
      {type === 'matching_headings' && (
        <MatchingHeadingsQuestion questions={group.questions} answers={answers} reviewAnswers={reviewAnswers}
          isReview={isReview} onChange={onChange} fontSize={fontSize} />
      )}
      {type === 'matching_passage' && (
        <MatchingPassageQuestion questions={group.questions} answers={answers} reviewAnswers={reviewAnswers}
          isReview={isReview} onChange={onChange} fontSize={fontSize} />
      )}
      {(type === 'tfng' || type === 'ynng') && (
        <TFNGQuestion questions={group.questions} answers={answers} reviewAnswers={reviewAnswers}
          isReview={isReview} onChange={onChange} fontSize={fontSize} type={type} />
      )}
      {type === 'mc2' && (
        <Mc2Question questions={group.questions} answers={answers} reviewAnswers={reviewAnswers}
          isReview={isReview} onChange={onChange} fontSize={fontSize} />
      )}
      {(type === 'fill_note') && (
        <FillNoteQuestion questions={group.questions} answers={answers} reviewAnswers={reviewAnswers}
          isReview={isReview} onChange={onChange} fontSize={fontSize} />
      )}
      {(type === 'mc' || type === 'fill') && (
        group.questions.map((q) => {
          const userAns    = isReview ? reviewAnswers[q.globalIndex] : answers[q.globalIndex]
          const onChangeFn = (val) => !isReview && onChange(q.globalIndex, val)
          if (type === 'mc')   return <McQuestion   key={q.globalIndex} q={q} userAns={userAns} isReview={isReview} onChange={onChangeFn} fontSize={fontSize} />
          if (type === 'fill') return <FillQuestion key={q.globalIndex} q={q} userAns={userAns} isReview={isReview} onChange={onChangeFn} fontSize={fontSize} />
        })
      )}
      {type === 'fill_inline' && (
        <FillInlineQuestion questions={group.questions} answers={answers} reviewAnswers={reviewAnswers}
          isReview={isReview} onChange={onChange} fontSize={fontSize} />
      )}
      {!['table','flowchart','map','matching_headings','tfng','ynng','mc','fill','fill_note','mc2','matching_passage','fill_inline'].includes(type) && type && (
        <div style={{ color: 'var(--c-text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
          [{type}] — dạng này sẽ được thêm sau.
        </div>
      )}

    </div>
  )
}
// ─── MC Question ──────────────────────────────────────────────────────────────

function McQuestion({ q, userAns, isReview, onChange, fontSize }) {
  const correct = q.Correct_Ans?.trim()
  const options = ['A', 'B', 'C', 'D', 'E']
    .map(k => ({ key: k, value: q[`Opt_${k}`] }))
    .filter(o => o.value?.trim())

  const getStyle = (key) => {
    if (isReview) {
      const isCorrectOpt = isAnswerCorrect(key, correct)
      const isUserOpt    = key === userAns
      if (isCorrectOpt)              return { bg: 'var(--c-success-bg)', border: 'var(--c-success)', color: 'var(--c-success-text)' }
      if (isUserOpt && !isCorrectOpt) return { bg: 'var(--c-danger-bg)',  border: 'var(--c-danger)',  color: 'var(--c-danger-text)'  }
      return { bg: 'var(--c-surface)', border: 'var(--c-primary-pale)', color: 'var(--c-text-soft)' }
    }
    if (key === userAns) return { bg: 'var(--c-primary-bg)', border: 'var(--c-primary-mid)', color: 'var(--c-primary-dark)' }
    return { bg: 'var(--c-surface)', border: 'var(--c-primary-pale)', color: 'var(--c-text-soft)' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Số câu + câu hỏi */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <QuestionNumber num={q.Question_Num || (q.globalIndex + 1)} />
        <p style={{ margin: 0, fontSize: `${fontSize}px`, fontWeight: '500', color: 'var(--c-primary-dark)', lineHeight: 1.5, flex: 1 }}>
          {parseInline(q.Question || '')}
        </p>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '32px' }}>
        {options.map(opt => {
          const s = getStyle(opt.key)
          return (
            <div key={opt.key}
              onClick={() => !isReview && onChange(opt.key)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '9px 14px', borderRadius: '8px',
                border: `1.5px solid ${s.border}`,
                backgroundColor: s.bg, color: s.color,
                fontSize: `${fontSize}px`, cursor: isReview ? 'default' : 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isReview && opt.key !== userAns) e.currentTarget.style.backgroundColor = 'var(--c-primary-barest)' }}
              onMouseLeave={e => { if (!isReview && opt.key !== userAns) e.currentTarget.style.backgroundColor = s.bg }}
            >
              <span style={{ fontWeight: '700', flexShrink: 0, minWidth: '18px' }}>{opt.key}.</span>
              <span style={{ flex: 1, lineHeight: 1.5 }}>{parseInline(opt.value)}</span>
              {isReview && isAnswerCorrect(opt.key, correct)  && <span style={{ flexShrink: 0, fontSize: '14px' }}>✅</span>}
              {isReview && opt.key === userAns && !isAnswerCorrect(opt.key, correct) && <span style={{ flexShrink: 0, fontSize: '14px' }}>❌</span>}
            </div>
          )
        })}
        {isReview && !userAns && (
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--c-warn-text)', fontStyle: 'italic' }}>
            ⚠️ Chưa trả lời — đáp án đúng: <strong>{correct}</strong>
          </p>
        )}
      </div>
    </div>
  )
}
// ─── Choose N of M (mc2) ──────────────────────────────────────────────────────
//
// Sheet format — mỗi row = 1 đáp án đúng cần tìm:
//   Question_Type: mc2
//   Question:      đề bài (chỉ row đầu, VD "Which TWO are mentioned as...?")
//   Opt_A..Opt_H:  danh sách lựa chọn (chỉ row đầu)
//   Num_Answers:   số lượng cần chọn (chỉ row đầu, mặc định = số row trong group)
//   Correct_Ans:   1 chữ cái đúng cho row đó

function Mc2Question({ questions, answers, reviewAnswers, isReview, onChange, fontSize }) {
  const firstQ    = questions[0]
  const groupKey  = firstQ.globalIndex
  const numPicks  = parseInt(firstQ.Num_Answers) || questions.length
  const options   = ['A','B','C','D','E','F','G','H']
    .map(k => ({ key: k, value: firstQ[`Opt_${k}`] }))
    .filter(o => o.value?.trim())

  const correctSet = questions
    .map(q => q.Correct_Ans?.trim().toUpperCase())
    .filter(Boolean)

  const rawSelected = isReview ? reviewAnswers[groupKey] : answers[groupKey]
  const selected    = Array.isArray(rawSelected) ? rawSelected : []

  const toggle = (key) => {
    if (isReview) return
    let next
    if (selected.includes(key)) {
      next = selected.filter(k => k !== key)
    } else if (selected.length < numPicks) {
      next = [...selected, key]
    } else {
      return // đã chọn đủ, bỏ qua click thêm
    }
    // Ghi cùng 1 mảng vào tất cả các câu trong group để đồng bộ chấm điểm + navigator
    questions.forEach(q => onChange(q.globalIndex, next))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Đề bài */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <QuestionNumber num={`${questions[0].Question_Num}-${questions[questions.length-1].Question_Num}`} />
        <p style={{ margin: 0, fontSize: `${fontSize}px`, fontWeight: '500', color: 'var(--c-primary-dark)', lineHeight: 1.5, flex: 1 }}>
          {parseInline(firstQ.Question || '')}
          <span style={{ marginLeft: '8px', fontSize: `${Math.max(11, fontSize - 3)}px`, fontWeight: '700', color: 'var(--c-primary-mid)' }}>
            (Chọn {numPicks} đáp án)
          </span>
        </p>
      </div>

      {/* Danh sách lựa chọn */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '32px' }}>
        {options.map(opt => {
          const isSelected = selected.includes(opt.key)
          const isCorrectOpt = correctSet.includes(opt.key)

          let bg = 'var(--c-surface)', border = 'var(--c-primary-pale)', color = 'var(--c-text-soft)'
          if (isReview) {
            if (isCorrectOpt)                     { bg = 'var(--c-success-bg)'; border = 'var(--c-success)'; color = 'var(--c-success-text)' }
            else if (isSelected && !isCorrectOpt) { bg = 'var(--c-danger-bg)';  border = 'var(--c-danger)';  color = 'var(--c-danger-text)'  }
          } else if (isSelected) {
            bg = 'var(--c-primary-bg)'; border = 'var(--c-primary-mid)'; color = 'var(--c-primary-dark)'
          }

          return (
            <div key={opt.key}
              onClick={() => toggle(opt.key)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '9px 14px', borderRadius: '8px',
                border: `1.5px solid ${border}`, backgroundColor: bg, color,
                fontSize: `${fontSize}px`, cursor: isReview ? 'default' : 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isReview && !isSelected) e.currentTarget.style.backgroundColor = 'var(--c-primary-barest)' }}
              onMouseLeave={e => { if (!isReview && !isSelected) e.currentTarget.style.backgroundColor = bg }}
            >
              {/* Checkbox vuông */}
              <span style={{
                width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0, marginTop: '1px',
                border: `2px solid ${isSelected || isCorrectOpt ? border : 'var(--c-primary-pale)'}`,
                backgroundColor: isSelected || (isReview && isCorrectOpt) ? border : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {(isSelected || (isReview && isCorrectOpt)) && (
                  <span style={{ color: '#fff', fontSize: '11px', fontWeight: '700', lineHeight: 1 }}>✓</span>
                )}
              </span>
              <span style={{ fontWeight: '700', flexShrink: 0, minWidth: '18px' }}>{opt.key}.</span>
              <span style={{ flex: 1, lineHeight: 1.5 }}>{parseInline(opt.value)}</span>
              {isReview && isCorrectOpt && <span style={{ flexShrink: 0, fontSize: '14px' }}>✅</span>}
              {isReview && isSelected && !isCorrectOpt && <span style={{ flexShrink: 0, fontSize: '14px' }}>❌</span>}
            </div>
          )
        })}
      </div>

      {isReview && selected.length === 0 && (
        <p style={{ margin: '2px 0 0 32px', fontSize: '12px', color: 'var(--c-warn-text)', fontStyle: 'italic' }}>
          ⚠️ Chưa trả lời — đáp án đúng: <strong>{correctSet.join(', ')}</strong>
        </p>
      )}
    </div>
  )
}
// ─── Fill Question ────────────────────────────────────────────────────────────
function FillQuestion({ q, userAns, isReview, onChange, fontSize }) {
  const correct   = q.Correct_Ans?.trim() || ''
  const val       = userAns || ''
  const isCorrect = isAnswerCorrect(val, correct)

  let borderColor = 'var(--c-primary-pale)'
  let bgColor     = 'var(--c-surface)'
  if (isReview) {
    if (!val.trim())  { borderColor = 'var(--c-warn)';    bgColor = 'var(--c-warn-bgsoft)'  }
    else if (isCorrect) { borderColor = 'var(--c-success)'; bgColor = 'var(--c-success-bg)' }
    else               { borderColor = 'var(--c-danger)';  bgColor = 'var(--c-danger-bg)'   }
  } else if (val.trim()) {
    borderColor = 'var(--c-primary-mid)'; bgColor = 'var(--c-primary-bg)'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Số câu + câu hỏi */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <QuestionNumber num={q.Question_Num || (q.globalIndex + 1)} />
        <p style={{ margin: 0, fontSize: `${fontSize}px`, fontWeight: '500', color: 'var(--c-primary-dark)', lineHeight: 1.5, flex: 1 }}>
          {parseInline(q.Question || '')}
        </p>
      </div>

      {/* Input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '32px' }}>
        <input
          type="text"
          readOnly={isReview}
          value={val}
          onChange={e => onChange(e.target.value)}
          placeholder="Nhập đáp án..."
          style={{
            flex: 1, maxWidth: '320px',
            padding: '9px 14px', borderRadius: '8px',
            border: `1.5px solid ${borderColor}`,
            backgroundColor: bgColor,
            fontSize: `${fontSize}px`, outline: 'none',
            fontFamily: 'inherit', color: 'var(--c-primary-dark)',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => { if (!isReview) e.currentTarget.style.borderColor = 'var(--c-primary)' }}
          onBlur={e => { if (!isReview) e.currentTarget.style.borderColor = borderColor }}
        />
        {isReview && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>
              {!val.trim() ? '⚠️' : isCorrect ? '✅' : '❌'}
            </span>
            {!isCorrect && correct && (
              <span style={{ fontSize: '13px', color: 'var(--c-success)', fontWeight: '600' }}>
                → {correct}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
// ─── Fill Inline Question (mỗi câu 1 dòng, blank nằm trong chính câu đó) ─────
//
// Sheet format — mỗi row = 1 câu độc lập:
//   Question_Type: fill_inline
//   Question_Num:  số câu (dùng để hiển thị số thứ tự trong ___ (n))
//   Question:      câu có chứa ___ (n), ví dụ:
//                  "Kira says that lecturers are easier to ___ (12) than those in her home country."
//   Correct_Ans:   đáp án đúng cho câu đó

function FillInlineQuestion({ questions, answers, reviewAnswers, isReview, onChange, fontSize }) {
  const parseSegments = (text) => {
    const segments = []
    const regex = /___\s*\((\d+)\)/g
    let last = 0, m
    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) segments.push({ type: 'text', val: text.slice(last, m.index) })
      segments.push({ type: 'blank', num: m[1] })
      last = regex.lastIndex
    }
    if (last < text.length) segments.push({ type: 'text', val: text.slice(last) })
    return segments
  }

  const renderQuestion = (q) => {
    const qIdx      = q.globalIndex
    const correct   = q.Correct_Ans?.trim() || ''
    const userVal   = String(isReview ? (reviewAnswers[qIdx] || '') : (answers[qIdx] || ''))
    const isCorrect = isAnswerCorrect(userVal, correct)
    const raw       = q.Question || ''
    const num       = q.Question_Num || (qIdx + 1)

    let borderColor = 'var(--c-primary-pale)'
    let bgColor     = 'var(--c-surface)'
    if (isReview) {
      if (!userVal.trim())  { borderColor = 'var(--c-warn)';    bgColor = 'var(--c-warn-bgsoft)'  }
      else if (isCorrect)   { borderColor = 'var(--c-success)'; bgColor = 'var(--c-success-bg)'   }
      else                  { borderColor = 'var(--c-danger)';  bgColor = 'var(--c-danger-bg)'    }
    } else if (userVal.trim()) {
      borderColor = 'var(--c-primary-mid)'; bgColor = 'var(--c-primary-bg)'
    }

    // Nếu câu không có ___ (n) thì tự thêm blank vào cuối, để tránh sheet quên nhập
    const hasBlank = /___\s*\(\d+\)/.test(raw)
    const text     = hasBlank ? raw : `${raw} ___ (${num})`
    const segments = parseSegments(text)

    const inputBlank = (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', verticalAlign: 'middle', margin: '0 2px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: `${Math.max(18, fontSize)}px`, height: `${Math.max(18, fontSize)}px`,
          borderRadius: '50%', backgroundColor: 'var(--c-primary)', color: '#fff',
          fontSize: `${Math.max(10, fontSize - 4)}px`, fontWeight: '700',
          flexShrink: 0, padding: '0 3px', lineHeight: 1,
        }}>{num}</span>
        {isReview ? (
          <>
            <span style={{
              padding: '2px 10px', borderRadius: '5px',
              border: `1.5px solid ${borderColor}`, backgroundColor: bgColor,
              fontSize: `${Math.max(11, fontSize - 1)}px`, fontWeight: '600',
              color: !userVal.trim() ? 'var(--c-warn-text)' : isCorrect ? 'var(--c-success-text)' : 'var(--c-danger-text)',
            }}>
              {userVal.trim() || '—'}
            </span>
            {!isCorrect && correct && (
              <span style={{ fontSize: '11px', color: 'var(--c-success)', fontWeight: '700' }}>→ {correct}</span>
            )}
            <span style={{ fontSize: '12px' }}>{!userVal.trim() ? '⚠️' : isCorrect ? '✅' : '❌'}</span>
          </>
        ) : (
          <input
            type="text"
            value={userVal}
            onChange={e => !isReview && onChange(qIdx, e.target.value)}
            placeholder="..."
            style={{
              width: '160px', padding: '3px 8px', borderRadius: '6px',
              border: `1.5px solid ${borderColor}`, backgroundColor: bgColor,
              fontSize: `${Math.max(11, fontSize - 1)}px`, outline: 'none',
              fontFamily: 'inherit', color: 'var(--c-primary-dark)',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--c-primary)'}
            onBlur={e => e.currentTarget.style.borderColor = borderColor}
          />
        )}
      </span>
    )

    return (
      <div key={qIdx} style={{
        padding: '10px 14px', borderRadius: '9px',
        border: '1px solid var(--c-primary-pale)',
        backgroundColor: 'var(--c-surface)',
      }}>
        <p style={{ margin: 0, fontSize: `${fontSize}px`, lineHeight: '2', color: 'var(--c-primary-dark)' }}>
          {segments.map((seg, si) =>
            seg.type === 'text' ? <span key={si}>{parseInline(seg.val)}</span> : <span key={si}>{inputBlank}</span>
          )}
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {questions.map(q => renderQuestion(q))}
    </div>
  )
}
// ─── Table Question ───────────────────────────────────────────────────────────
//
// Sheet format (cột Question, chỉ điền ở row đầu tiên của group):
//   Hàng 1 = header:  Type;;Location;;Height
//   Hàng 2+= data:    Waterfall;;___ (5);;23m
//                     ___ (6);;North;;___ (7)
//
// Mỗi ___ trong bảng map lần lượt với 1 row trong group (theo Question_Num).
// Correct_Ans của mỗi row = đáp án cho ___ đó.
// Ô có (số) sau ___ dùng để hiển thị số câu trong ô trống.

function TableQuestion({ questions, answers, reviewAnswers, isReview, onChange, fontSize }) {
  const firstQ   = questions[0]
  const tableRaw = firstQ?.Question?.trim() || ''

  // Parse bảng: tách hàng theo \n, tách cột theo ;;
  const rows = tableRaw
    .split('\n')
    .map(r => r.trim())
    .filter(Boolean)
    .map(r => r.split(';;').map(c => c.trim()))

  if (rows.length === 0) return null

  const headerRow = rows[0]
  const dataRows  = rows.slice(1)

  // Map số câu → question object để lấy đáp án
  // Mỗi ___ (n) trong bảng → question có Question_Num === n
  const qByNum = {}
  questions.forEach(q => { qByNum[String(q.Question_Num).trim()] = q })

  // parseCell: có thể là text thuần, ___ (n) thuần, hoặc text xen lẫn ___ (n)
  const parseCell = (cell) => {
    const decoded = cell.replace(/\\n/g, '\n')   // ← thêm dòng này: giải mã \\n → newline thật
    if (!decoded.includes('___')) return { type: 'text', value: decoded }
    const pureBlank = decoded.match(/^___\s*\((\d+)\)$/)
    if (pureBlank) return { type: 'blank', num: pureBlank[1] }
    return { type: 'mixed', value: decoded }
  }

  // Parse mixed cell thành mảng segments [{type:'text',val} | {type:'blank',num}]
  const parseMixed = (cell) => {
    const segments = []
    const regex = /___\s*\((\d+)\)/g
    let last = 0, m
    while ((m = regex.exec(cell)) !== null) {
      if (m.index > last) segments.push({ type: 'text', val: cell.slice(last, m.index) })
      segments.push({ type: 'blank', num: m[1] })
      last = regex.lastIndex
    }
    if (last < cell.length) segments.push({ type: 'text', val: cell.slice(last) })
    return segments
  }

  const renderBlankInput = (num, ci) => {
    const q       = qByNum[num]
    const qIdx    = q?.globalIndex
    const correct = q?.Correct_Ans?.trim() || ''
    const userVal = q ? (isReview ? (reviewAnswers[qIdx] || '') : (answers[qIdx] || '')) : ''
    const isCorrect = isAnswerCorrect(userVal, correct)

    let borderColor = 'var(--c-primary-pale)'
    let bgColor     = 'var(--c-surface)'
    if (isReview) {
      if (!userVal.trim())  { borderColor = 'var(--c-warn)';    bgColor = 'var(--c-warn-bgsoft)'  }
      else if (isCorrect)   { borderColor = 'var(--c-success)'; bgColor = 'var(--c-success-bg)'   }
      else                  { borderColor = 'var(--c-danger)';  bgColor = 'var(--c-danger-bg)'    }
    } else if (userVal.trim()) {
      borderColor = 'var(--c-primary-mid)'; bgColor = 'var(--c-primary-bg)'
    }

    return (
      <span key={`blank-${num}-${ci}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', verticalAlign: 'middle', margin: '0 2px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: `${Math.max(18, fontSize)}px`, height: `${Math.max(18, fontSize)}px`,
          borderRadius: '50%', backgroundColor: 'var(--c-primary)', color: '#fff',
          fontSize: `${Math.max(10, fontSize - 4)}px`, fontWeight: '700',
          flexShrink: 0, padding: '0 3px', lineHeight: 1,
        }}>{num}</span>
        {isReview ? (
          <>
            <span style={{
              fontSize: `${Math.max(11, fontSize - 1)}px`, fontWeight: '600', padding: '1px 8px',
              borderRadius: '5px', border: `1.5px solid ${borderColor}`, backgroundColor: bgColor,
              color: !userVal.trim() ? 'var(--c-warn-text)' : isCorrect ? 'var(--c-success-text)' : 'var(--c-danger-text)',
            }}>
              {userVal.trim() || '—'}
            </span>
            {!isCorrect && correct && (
              <span style={{ fontSize: '11px', color: 'var(--c-success)', fontWeight: '700' }}>→ {correct}</span>
            )}
            <span style={{ fontSize: '12px' }}>{!userVal.trim() ? '⚠️' : isCorrect ? '✅' : '❌'}</span>
          </>
        ) : (
          <input
            type="text"
            value={userVal}
            onChange={e => q && onChange(qIdx, e.target.value)}
            placeholder="..."
            style={{
              width: '140px', padding: '3px 7px', borderRadius: '5px',
              border: `1.5px solid ${borderColor}`, backgroundColor: bgColor,
              fontSize: `${Math.max(11, fontSize - 1)}px`, outline: 'none',
              fontFamily: 'inherit', color: 'var(--c-primary-dark)', textAlign: 'center',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--c-primary)'}
            onBlur={e => e.currentTarget.style.borderColor = borderColor}
          />
        )}
      </span>
    )
  }

  const renderCell = (cell, ci, ri) => {
    const parsed = parseCell(cell)

    if (parsed.type === 'text') {
      return (
        <td key={ci} style={tdStyle(false)}>
          <span style={{ fontSize: `${fontSize}px`, whiteSpace: 'pre-wrap', display: 'block' }}>
            {parseInline(parsed.value)}
          </span>
        </td>
      )
    }

    if (parsed.type === 'blank') {
      // Toàn bộ cell là 1 ô trống
      return (
        <td key={ci} style={tdStyle(true)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {renderBlankInput(parsed.num, ci)}
          </div>
        </td>
      )
    }

    // Mixed: text xen lẫn ô trống
    const segments = parseMixed(parsed.value)
    return (
      <td key={ci} style={{ ...tdStyle(false), textAlign: 'left' }}>
        <span style={{ fontSize: `${fontSize}px`, lineHeight: '2', whiteSpace: 'pre-wrap' }}>
          {segments.map((seg, si) =>
            seg.type === 'text'
              ? <span key={si}>{parseInline(seg.val)}</span>
              : renderBlankInput(seg.num, `${ci}-${si}`)
          )}
        </span>
      </td>
    )
  }

  return (
    <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--c-primary-pale)', padding: '2px' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '400px' }}>
        {/* Header */}
        <thead>
          <tr style={{ backgroundColor: 'var(--c-primary)' }}>
            {headerRow.map((h, i) => (
              <th key={i} style={{
                padding: '10px 14px', textAlign: 'center',
                fontSize: `${Math.max(11, fontSize - 1)}px`,
                fontWeight: '700', color: '#fff',
                borderRight: i < headerRow.length - 1 ? '1px solid rgba(255,255,255,0.15)' : 'none',
              }}>
                <div style={{ whiteSpace: 'pre-wrap', textAlign: 'center' }}>
                  {h.replace(/\\n/g, '\n')}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {/* Data rows */}
        <tbody>
          {dataRows.map((row, ri) => (
            <tr key={ri} style={{
              backgroundColor: ri % 2 === 0 ? 'var(--c-surface)' : 'var(--c-primary-barest)',
            }}>
              {row.map((cell, ci) => renderCell(cell, ci, ri))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function tdStyle(isBlank, bg) {
  return {
    padding: '10px 14px',
    borderTop: '1px solid var(--c-primary-bg)',
    borderRight: '1px solid var(--c-primary-bg)',
    textAlign: isBlank ? 'center' : 'left',
    verticalAlign: 'middle',
    backgroundColor: bg || 'transparent',
    minWidth: isBlank ? '160px' : '80px',
  }
}

// ─── Flowchart Question ───────────────────────────────────────────────────────
//
// Sheet format — 1 row duy nhất cho cả group:
//   Question_Type: flowchart
//   Question_Num:  số câu đầu tiên (dùng để map ___ (n))
//   Question:      các bước cách nhau bằng \n, mỗi bước có thể có ___ (n)
//   Correct_Ans:   đáp án pipe-separated theo thứ tự số câu
//
// Ví dụ Question:
//   Elephants located by ___ (5)
//   Herd selected — same family, similar ___ (6)
//   Transported by ___ (7) to new location
//   Released into reserve

function FlowchartQuestion({ questions, answers, reviewAnswers, isReview, onChange, fontSize }) {
  const firstQ = questions[0]
  const raw    = firstQ?.Question?.trim() || ''

  // Mỗi row = 1 câu, Question_Num là key để map với ___ (n) trong text
  const qByNum = {}
  questions.forEach(q => {
    const num = String(q.Question_Num ?? '').trim()
    if (num) qByNum[num] = q
  })

  // Tách từng bước theo \n
  const steps = raw.split('\n').map(s => s.trim()).filter(Boolean)

  // Parse text có ___ (n) xen kẽ
  const parseSegments = (text) => {
    const segments = []
    const regex = /___\s*\((\d+)\)/g
    let last = 0, m
    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) segments.push({ type: 'text', val: text.slice(last, m.index) })
      segments.push({ type: 'blank', num: m[1] })
      last = regex.lastIndex
    }
    if (last < text.length) segments.push({ type: 'text', val: text.slice(last) })
    return segments
  }

  const renderInlineBlank = (num) => {
    const q       = qByNum[num]
    const qIdx    = q?.globalIndex
    const correct = q?.Correct_Ans?.trim() || ''
    const userVal = q ? String(isReview ? (reviewAnswers[qIdx] || '') : (answers[qIdx] || '')) : ''
    const isCorrect = isAnswerCorrect(userVal, correct)

    let borderColor = 'var(--c-primary-pale)'
    let bgColor     = 'var(--c-surface)'
    if (isReview) {
      if (!userVal.trim())  { borderColor = 'var(--c-warn)';    bgColor = 'var(--c-warn-bgsoft)'  }
      else if (isCorrect)   { borderColor = 'var(--c-success)'; bgColor = 'var(--c-success-bg)'   }
      else                  { borderColor = 'var(--c-danger)';  bgColor = 'var(--c-danger-bg)'    }
    } else if (userVal.trim()) {
      borderColor = 'var(--c-primary-mid)'; bgColor = 'var(--c-primary-bg)'
    }

    return (
      <span key={`fc-${num}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', verticalAlign: 'middle', margin: '0 3px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: `${Math.max(18, fontSize)}px`, height: `${Math.max(18, fontSize)}px`,
          borderRadius: '50%', backgroundColor: 'var(--c-primary)', color: '#fff',
          fontSize: `${Math.max(10, fontSize - 4)}px`, fontWeight: '700',
          flexShrink: 0, padding: '0 3px', lineHeight: 1,
        }}>{num}</span>
        {isReview ? (
          <>
            <span style={{
              padding: '2px 10px', borderRadius: '5px',
              border: `1.5px solid ${borderColor}`, backgroundColor: bgColor,
              fontSize: `${Math.max(11, fontSize - 1)}px`, fontWeight: '600',
              color: !userVal.trim() ? 'var(--c-warn-text)' : isCorrect ? 'var(--c-success-text)' : 'var(--c-danger-text)',
            }}>
              {userVal.trim() || '—'}
            </span>
            {!isCorrect && correct && (
              <span style={{ fontSize: '11px', color: 'var(--c-success)', fontWeight: '700' }}>→ {correct}</span>
            )}
            <span style={{ fontSize: '12px' }}>{!userVal.trim() ? '⚠️' : isCorrect ? '✅' : '❌'}</span>
          </>
        ) : (
          <input
            type="text"
            value={userVal}
            onChange={e => q && !isReview && onChange(qIdx, e.target.value)}
            placeholder="..."
            style={{
              width: '300px', padding: '3px 8px', borderRadius: '6px',
              border: `1.5px solid ${borderColor}`, backgroundColor: bgColor,
              fontSize: `${Math.max(11, fontSize - 1)}px`, outline: 'none',
              fontFamily: 'inherit', color: 'var(--c-primary-dark)', textAlign: 'center',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--c-primary)'}
            onBlur={e => e.currentTarget.style.borderColor = borderColor}
          />
        )}
      </span>
    )
  }

  const renderStep = (text) => {
    const segments = parseSegments(text)
    const hasBlank = segments.some(s => s.type === 'blank')
    return (
      <div style={{
        padding: '12px 20px', borderRadius: '10px',
        border: `1.5px solid ${hasBlank ? 'var(--c-primary-light)' : 'var(--c-primary-pale)'}`,
        backgroundColor: hasBlank ? 'var(--c-primary-barest)' : 'var(--c-surface)',
        fontSize: `${fontSize}px`, lineHeight: '2.2',
        color: 'var(--c-primary-dark)', textAlign: 'center',
        minWidth: '220px', maxWidth: '480px', width: '100%',
      }}>
        {segments.map((seg, si) =>
          seg.type === 'text'
            ? <span key={si}>{parseInline(seg.val)}</span>
            : renderInlineBlank(seg.num)
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0' }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          {renderStep(step)}
          {i < steps.length - 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
              <div style={{ width: '2px', height: '12px', backgroundColor: 'var(--c-primary-light)' }} />
              <div style={{ width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '9px solid var(--c-primary-light)' }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Map Question ─────────────────────────────────────────────────────────────
//
// Sheet format — mỗi row = 1 câu:
//   Question_Type: map
//   Context:       link Drive ảnh map (chỉ điền ở row đầu của group)
//   Question_Num:  số câu
//   Question:      tên địa danh (vd: "the car park")
//   Correct_Ans:   chữ cái đúng trên map (vd: A, B, C...)

function MapQuestion({ questions, answers, reviewAnswers, isReview, onChange, fontSize }) {
  const firstQ   = questions[0]
  const imageUrl = firstQ?.Map_Image?.trim()
    ? convertDriveLink(firstQ.Map_Image.trim(), 'image')
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Hình map căn giữa */}
      {imageUrl && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <img
            src={imageUrl}
            alt="Map"
            style={{
              maxWidth: '100%', borderRadius: '10px',
              border: '1px solid var(--c-primary-pale)',
              boxShadow: 'var(--shadow-card)',
            }}
          />
        </div>
      )}

      {/* Danh sách câu hỏi */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {questions.map((q) => {
          const qIdx      = q.globalIndex
          const correct   = q.Correct_Ans?.trim() || ''
          const userVal   = String(isReview ? (reviewAnswers[qIdx] || '') : (answers[qIdx] || ''))
          const isCorrect = isAnswerCorrect(userVal, correct)

          let borderColor = 'var(--c-primary-pale)'
          let bgColor     = 'var(--c-surface)'
          if (isReview) {
            if (!userVal.trim())  { borderColor = 'var(--c-warn)';    bgColor = 'var(--c-warn-bgsoft)'  }
            else if (isCorrect)   { borderColor = 'var(--c-success)'; bgColor = 'var(--c-success-bg)'   }
            else                  { borderColor = 'var(--c-danger)';  bgColor = 'var(--c-danger-bg)'    }
          } else if (userVal.trim()) {
            borderColor = 'var(--c-primary-mid)'; bgColor = 'var(--c-primary-bg)'
          }

          return (
            <div key={qIdx} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 14px', borderRadius: '9px',
              border: `1.5px solid ${borderColor}`,
              backgroundColor: bgColor,
              transition: 'all 0.15s',
            }}>
              {/* Số câu */}
              <QuestionNumber num={q.Question_Num || qIdx + 1} />

              {/* Tên địa danh */}
              <span style={{
                flex: 1, fontSize: `${fontSize}px`,
                color: 'var(--c-primary-dark)', fontStyle: 'italic',
              }}>
                {parseInline(q.Question || '')}
              </span>

              {/* Input hoặc chip review */}
              {isReview ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span style={{
                    minWidth: '36px', height: '36px', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: `${fontSize}px`, fontWeight: '700',
                    border: `1.5px solid ${borderColor}`, backgroundColor: bgColor,
                    color: !userVal.trim() ? 'var(--c-warn-text)' : isCorrect ? 'var(--c-success-text)' : 'var(--c-danger-text)',
                  }}>
                    {userVal.trim() || '—'}
                  </span>
                  {!isCorrect && correct && (
                    <span style={{ fontSize: '13px', color: 'var(--c-success)', fontWeight: '700' }}>→ {correct}</span>
                  )}
                  <span style={{ fontSize: '16px' }}>
                    {!userVal.trim() ? '⚠️' : isCorrect ? '✅' : '❌'}
                  </span>
                </div>
              ) : (
                <input
                  type="text"
                  value={userVal}
                  onChange={e => !isReview && onChange(qIdx, e.target.value.toUpperCase())}
                  placeholder="A/B/C..."
                  maxLength={2}
                  style={{
                    width: '150px', padding: '8px', borderRadius: '8px',
                    border: `1.5px solid ${borderColor}`,
                    backgroundColor: 'var(--c-surface)',
                    fontSize: `${fontSize}px`, fontWeight: '700',
                    outline: 'none', textAlign: 'center',
                    fontFamily: 'inherit', color: 'var(--c-primary-dark)',
                    transition: 'border-color 0.15s',
                    flexShrink: 0,
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--c-primary)'}
                  onBlur={e => e.currentTarget.style.borderColor = borderColor}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Matching Headings ────────────────────────────────────────────────────────
//
// Sheet format — mỗi row = 1 đoạn văn cần chọn heading:
//   Question_Type:  matching_headings
//   Question_Label: danh sách headings, mỗi cái 1 dòng, vd:
//                   "i. The history of...\nii. Problems with...\niii. A new solution"
//   Question_Num:   số câu
//   Question:       tên đoạn (vd: "Paragraph A")
//   Correct_Ans:    chữ số La Mã đúng (vd: ii)

function MatchingHeadingsQuestion({ questions, answers, reviewAnswers, isReview, onChange, fontSize }) {
  const firstQ  = questions[0]
  const headings = (firstQ?.Question_Info || '')
    .split('\n').map(h => h.trim()).filter(Boolean)

  const renderInput = (q) => {
    const qIdx      = q.globalIndex
    const correct   = q.Correct_Ans?.trim() || ''
    const userVal   = String(isReview ? (reviewAnswers[qIdx] || '') : (answers[qIdx] || ''))
    const isCorrect = isAnswerCorrect(userVal, correct)

    let borderColor = 'var(--c-primary-pale)'
    let bgColor     = 'var(--c-surface)'
    if (isReview) {
      if (!userVal.trim())  { borderColor = 'var(--c-warn)';    bgColor = 'var(--c-warn-bgsoft)'  }
      else if (isCorrect)   { borderColor = 'var(--c-success)'; bgColor = 'var(--c-success-bg)'   }
      else                  { borderColor = 'var(--c-danger)';  bgColor = 'var(--c-danger-bg)'    }
    } else if (userVal.trim()) {
      borderColor = 'var(--c-primary-mid)'; bgColor = 'var(--c-primary-bg)'
    }

    return (
      <div key={qIdx} style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 14px', borderRadius: '9px',
        border: `1.5px solid ${borderColor}`, backgroundColor: bgColor,
        transition: 'all 0.15s',
      }}>
        <QuestionNumber num={q.Question_Num || qIdx + 1} />
        <span style={{ flex: 1, fontSize: `${fontSize}px`, color: 'var(--c-primary-dark)', fontWeight: '500' }}>
          {parseInline(q.Question || '')}
        </span>
        {isReview ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{
              padding: '4px 12px', borderRadius: '6px', fontWeight: '700',
              fontSize: `${fontSize}px`, border: `1.5px solid ${borderColor}`,
              backgroundColor: bgColor,
              color: !userVal.trim() ? 'var(--c-warn-text)' : isCorrect ? 'var(--c-success-text)' : 'var(--c-danger-text)',
            }}>
              {userVal.trim() || '—'}
            </span>
            {!isCorrect && correct && (
              <span style={{ fontSize: '13px', color: 'var(--c-success)', fontWeight: '700' }}>→ {correct}</span>
            )}
            <span style={{ fontSize: '16px' }}>{!userVal.trim() ? '⚠️' : isCorrect ? '✅' : '❌'}</span>
          </div>
        ) : (
          <input
            type="text"
            value={userVal}
            onChange={e => !isReview && onChange(qIdx, e.target.value)}
            placeholder="i / ii / iii..."
            style={{
              width: '100px', padding: '8px', borderRadius: '8px',
              border: `1.5px solid ${borderColor}`, backgroundColor: 'var(--c-surface)',
              fontSize: `${fontSize}px`, fontWeight: '600',
              outline: 'none', textAlign: 'center',
              fontFamily: 'inherit', color: 'var(--c-primary-dark)',
              transition: 'border-color 0.15s', flexShrink: 0,
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--c-primary)'}
            onBlur={e => e.currentTarget.style.borderColor = borderColor}
          />
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Danh sách headings */}
      {headings.length > 0 && (
        <div style={{
          padding: '12px 16px', borderRadius: '10px',
          backgroundColor: 'var(--c-primary-barest)',
          border: '1px solid var(--c-primary-bg)',
          display: 'flex', flexDirection: 'column', gap: '6px',
        }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--c-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
            List of Headings
          </span>
          {headings.map((h, i) => (
            <span key={i} style={{ fontSize: `${Math.max(12, fontSize - 1)}px`, color: 'var(--c-primary-dark)', lineHeight: 1.5 }}>
              {parseInline(h)}
            </span>
          ))}
        </div>
      )}
      {/* Các câu hỏi */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {questions.map(q => renderInput(q))}
      </div>
    </div>
  )
}
// ─── Matching Passage (paragraph letters A-G) ─────────────────────────────────
//
// Sheet format — mỗi row = 1 statement cần tìm đoạn văn chứa nó:
//   Question_Type:  matching_passage
//   Question_Info:  danh sách statement, mỗi cái 1 dòng (chỉ điền row đầu)
//   Question_Num:   số câu
//   Question:       nội dung statement
//   Correct_Ans:    chữ cái đoạn văn đúng (vd: F, D, G, E...)

function MatchingPassageQuestion({ questions, answers, reviewAnswers, isReview, onChange, fontSize }) {
  const firstQ = questions[0]
  const statements = (firstQ?.Question_Info || '')
    .split('\n').map(s => s.trim()).filter(Boolean)

  const renderInput = (q) => {
    const qIdx      = q.globalIndex
    const correct   = q.Correct_Ans?.trim().toUpperCase() || ''
    const userVal   = String(isReview ? (reviewAnswers[qIdx] || '') : (answers[qIdx] || '')).toUpperCase()
    const isCorrect = isAnswerCorrect(userVal, correct)

    let borderColor = 'var(--c-primary-pale)'
    let bgColor     = 'var(--c-surface)'
    if (isReview) {
      if (!userVal.trim())  { borderColor = 'var(--c-warn)';    bgColor = 'var(--c-warn-bgsoft)'  }
      else if (isCorrect)   { borderColor = 'var(--c-success)'; bgColor = 'var(--c-success-bg)'   }
      else                  { borderColor = 'var(--c-danger)';  bgColor = 'var(--c-danger-bg)'    }
    } else if (userVal.trim()) {
      borderColor = 'var(--c-primary-mid)'; bgColor = 'var(--c-primary-bg)'
    }

    return (
      <div key={qIdx} style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 14px', borderRadius: '9px',
        border: `1.5px solid ${borderColor}`, backgroundColor: bgColor,
        transition: 'all 0.15s',
      }}>
        <QuestionNumber num={q.Question_Num || qIdx + 1} />
        <span style={{ flex: 1, fontSize: `${fontSize}px`, color: 'var(--c-primary-dark)', fontWeight: '500' }}>
          {parseInline(q.Question || '')}
        </span>
        {isReview ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{
              padding: '4px 12px', borderRadius: '6px', fontWeight: '700',
              fontSize: `${fontSize}px`, border: `1.5px solid ${borderColor}`,
              backgroundColor: bgColor,
              color: !userVal.trim() ? 'var(--c-warn-text)' : isCorrect ? 'var(--c-success-text)' : 'var(--c-danger-text)',
            }}>
              {userVal.trim() || '—'}
            </span>
            {!isCorrect && correct && (
              <span style={{ fontSize: '13px', color: 'var(--c-success)', fontWeight: '700' }}>→ {correct}</span>
            )}
            <span style={{ fontSize: '16px' }}>{!userVal.trim() ? '⚠️' : isCorrect ? '✅' : '❌'}</span>
          </div>
        ) : (
          <input
            type="text"
            value={answers[qIdx] || ''}
            onChange={e => !isReview && onChange(qIdx, e.target.value.toUpperCase())}
            placeholder="A/B/C..."
            maxLength={2}
            style={{
              width: '100px', padding: '8px', borderRadius: '8px',
              border: `1.5px solid ${borderColor}`, backgroundColor: 'var(--c-surface)',
              fontSize: `${fontSize}px`, fontWeight: '700',
              outline: 'none', textAlign: 'center',
              fontFamily: 'inherit', color: 'var(--c-primary-dark)',
              transition: 'border-color 0.15s', flexShrink: 0,
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--c-primary)'}
            onBlur={e => e.currentTarget.style.borderColor = borderColor}
          />
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Danh sách statement dùng chung */}
      {statements.length > 0 && (
        <div style={{
          padding: '12px 16px', borderRadius: '10px',
          backgroundColor: 'var(--c-primary-barest)',
          border: '1px solid var(--c-primary-bg)',
          display: 'flex', flexDirection: 'column', gap: '6px',
        }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--c-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
            Statements
          </span>
          {statements.map((s, i) => (
            <span key={i} style={{ fontSize: `${Math.max(12, fontSize - 1)}px`, color: 'var(--c-primary-dark)', lineHeight: 1.5 }}>
              {parseInline(s)}
            </span>
          ))}
        </div>
      )}
      {/* Các câu hỏi */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {questions.map(q => renderInput(q))}
      </div>
    </div>
  )
}
// ─── TRUE/FALSE/NOT GIVEN & YES/NO/NOT GIVEN ──────────────────────────────────
//
// Sheet format — mỗi row = 1 phát biểu:
//   Question_Type:  tfng  (hoặc ynng)
//   Question_Num:   số câu
//   Question:       phát biểu cần đánh giá
//   Correct_Ans:    TRUE / FALSE / NOT GIVEN  (hoặc YES / NO / NOT GIVEN)

function TFNGQuestion({ questions, answers, reviewAnswers, isReview, onChange, fontSize, type }) {
  const isYNNG  = type === 'ynng'
  const options = isYNNG ? ['YES', 'NO', 'NOT GIVEN'] : ['TRUE', 'FALSE', 'NOT GIVEN']

  const renderInput = (q) => {
    const qIdx      = q.globalIndex
    const correct   = q.Correct_Ans?.trim().toUpperCase() || ''
    const userVal   = String(isReview ? (reviewAnswers[qIdx] || '') : (answers[qIdx] || '')).toUpperCase()
    const isCorrect = isAnswerCorrect(userVal, correct)

    let borderColor = 'var(--c-primary-pale)'
    let bgColor     = 'var(--c-surface)'
    if (isReview) {
      if (!userVal.trim())  { borderColor = 'var(--c-warn)';    bgColor = 'var(--c-warn-bgsoft)'  }
      else if (isCorrect)   { borderColor = 'var(--c-success)'; bgColor = 'var(--c-success-bg)'   }
      else                  { borderColor = 'var(--c-danger)';  bgColor = 'var(--c-danger-bg)'    }
    } else if (userVal.trim()) {
      borderColor = 'var(--c-primary-mid)'; bgColor = 'var(--c-primary-bg)'
    }

    return (
      <div key={qIdx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Số câu + phát biểu */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <QuestionNumber num={q.Question_Num || qIdx + 1} />
          <p style={{ margin: 0, fontSize: `${fontSize}px`, color: 'var(--c-primary-dark)', lineHeight: 1.6, flex: 1 }}>
            {parseInline(q.Question || '')}
          </p>
        </div>

        {/* 3 nút chọn đáp án */}
        <div style={{ paddingLeft: '34px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {isReview ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {options.map(opt => {
                const isUserOpt    = opt === userVal
                const isCorrectOpt = opt === correct
                let obg = 'var(--c-surface)', obd = 'var(--c-primary-pale)', oc = 'var(--c-text-muted)'
                if (isCorrectOpt)                    { obg = 'var(--c-success-bg)'; obd = 'var(--c-success)'; oc = 'var(--c-success-text)' }
                else if (isUserOpt && !isCorrectOpt) { obg = 'var(--c-danger-bg)';  obd = 'var(--c-danger)';  oc = 'var(--c-danger-text)'  }
                return (
                  <span key={opt} style={{
                    padding: '7px 16px', borderRadius: '8px',
                    border: `1.5px solid ${obd}`, backgroundColor: obg, color: oc,
                    fontSize: `${Math.max(12, fontSize - 2)}px`, fontWeight: '700',
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                  }}>
                    {opt}
                    {isCorrectOpt && <span style={{ fontSize: '13px' }}>✅</span>}
                    {isUserOpt && !isCorrectOpt && <span style={{ fontSize: '13px' }}>❌</span>}
                  </span>
                )
              })}
              {!userVal.trim() && (
                <span style={{ fontSize: '12px', color: 'var(--c-warn-text)', fontStyle: 'italic', alignSelf: 'center' }}>
                  ⚠️ Chưa trả lời
                </span>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {options.map(opt => {
                const isSelected = (answers[qIdx] || '').toUpperCase() === opt
                return (
                  <button
                    key={opt}
                    onClick={() => onChange(qIdx, opt)}
                    style={{
                      padding: '8px 18px', borderRadius: '8px', cursor: 'pointer',
                      fontSize: `${Math.max(12, fontSize - 2)}px`, fontWeight: '700', userSelect: 'none',
                      border: `1.5px solid ${isSelected ? 'var(--c-primary)' : 'var(--c-primary-pale)'}`,
                      backgroundColor: isSelected ? 'var(--c-primary)' : 'var(--c-surface)',
                      color: isSelected ? '#fff' : 'var(--c-text-soft)',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--c-primary-barest)' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--c-surface)' }}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {questions.map(q => renderInput(q))}
    </div>
  )
}

// ─── Fill Note Question ───────────────────────────────────────────────────────
//
// Sheet format — mỗi row = 1 câu:
//   Question_Type:  fill_note
//   Question_Label: hướng dẫn (chỉ row đầu)
//   Question:       toàn bộ đoạn văn có ___ (n) (chỉ row đầu)
//   Question_Num:   số câu (n) để map với ___ (n) trong đoạn văn
//   Correct_Ans:    đáp án cho câu đó
//
// Ví dụ Question (row đầu):
//   "Reasons for overpopulation:\n- Strict ___ (1) of anti-poaching laws\n
//    - Successful ___ (2)\n\nProblems:\n- Damage to ___ (3) in the park"

function FillNoteQuestion({ questions, answers, reviewAnswers, isReview, onChange, fontSize }) {
  const firstQ = questions[0]
  const raw    = firstQ?.Question?.trim() || ''

  // Map Question_Num → question object
  const qByNum = {}
  questions.forEach(q => {
    const num = String(q.Question_Num ?? '').trim()
    if (num) qByNum[num] = q
  })

  // Parse đoạn văn: tách theo \n thành các dòng, mỗi dòng parse inline ___ (n)
  const lines = raw.split('\n')

  const parseSegments = (text) => {
    const segments = []
    const regex = /___\s*\((\d+)\)/g
    let last = 0, m
    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) segments.push({ type: 'text', val: text.slice(last, m.index) })
      segments.push({ type: 'blank', num: m[1] })
      last = regex.lastIndex
    }
    if (last < text.length) segments.push({ type: 'text', val: text.slice(last) })
    return segments
  }

  const renderInlineBlank = (num) => {
    const q       = qByNum[num]
    const qIdx    = q?.globalIndex
    const correct = q?.Correct_Ans?.trim() || ''
    const userVal = q ? String(isReview ? (reviewAnswers[qIdx] || '') : (answers[qIdx] || '')) : ''
    const isCorrect = isAnswerCorrect(userVal, correct)

    let borderColor = 'var(--c-primary-pale)'
    let bgColor     = 'var(--c-surface)'
    if (isReview) {
      if (!userVal.trim())  { borderColor = 'var(--c-warn)';    bgColor = 'var(--c-warn-bgsoft)'  }
      else if (isCorrect)   { borderColor = 'var(--c-success)'; bgColor = 'var(--c-success-bg)'   }
      else                  { borderColor = 'var(--c-danger)';  bgColor = 'var(--c-danger-bg)'    }
    } else if (userVal.trim()) {
      borderColor = 'var(--c-primary-mid)'; bgColor = 'var(--c-primary-bg)'
    }

    return (
      <span key={`fn-${num}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', verticalAlign: 'middle', margin: '0 2px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: `${Math.max(18, fontSize)}px`, height: `${Math.max(18, fontSize)}px`, borderRadius: '50%',
          backgroundColor: 'var(--c-primary)', color: '#fff',
          fontSize: `${Math.max(10, fontSize - 4)}px`, fontWeight: '700', flexShrink: 0,
          padding: '0 2px',
        }}>{num}</span>
        {isReview ? (
          <>
            <span style={{
              padding: '2px 10px', borderRadius: '5px',
              border: `1.5px solid ${borderColor}`, backgroundColor: bgColor,
              fontSize: `${Math.max(11, fontSize - 1)}px`, fontWeight: '600',
              color: !userVal.trim() ? 'var(--c-warn-text)' : isCorrect ? 'var(--c-success-text)' : 'var(--c-danger-text)',
            }}>
              {userVal.trim() || '—'}
            </span>
            {!isCorrect && correct && (
              <span style={{ fontSize: '11px', color: 'var(--c-success)', fontWeight: '700' }}>→ {correct}</span>
            )}
            <span style={{ fontSize: '12px' }}>{!userVal.trim() ? '⚠️' : isCorrect ? '✅' : '❌'}</span>
          </>
        ) : (
          <input
            type="text"
            value={userVal}
            onChange={e => q && !isReview && onChange(qIdx, e.target.value)}
            placeholder="..."
            style={{
              width: '150px', padding: '3px 8px', borderRadius: '5px',
              border: `1.5px solid ${borderColor}`, backgroundColor: bgColor,
              fontSize: `${Math.max(11, fontSize - 1)}px`, outline: 'none',
              fontFamily: 'inherit', color: 'var(--c-primary-dark)',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--c-primary)'}
            onBlur={e => e.currentTarget.style.borderColor = borderColor}
          />
        )}
      </span>
    )
  }

  const renderLine = (line, li) => {
    if (!line.trim()) return <div key={li} style={{ height: '8px' }} />

    // Heading: bắt đầu bằng ## hoặc **...**
    const isHeading = line.trim().startsWith('## ') || /^\*\*[^*]+\*\*$/.test(line.trim())
    const cleanLine = line.replace(/^##\s*/, '').replace(/^\*\*|\*\*$/g, '')

    // Bullet: bắt đầu bằng - hoặc •
    const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('• ')
    const bulletContent = line.trim().replace(/^[-•]\s+/, '')

    const segments = parseSegments(isHeading ? cleanLine : isBullet ? bulletContent : line)

    const rendered = segments.map((seg, si) =>
      seg.type === 'text'
        ? <span key={si}>{parseInline(seg.val)}</span>
        : renderInlineBlank(seg.num)
    )

    if (isHeading) {
      return (
        <div key={li} style={{
          fontWeight: '700', fontSize: `${fontSize}px`,
          color: 'var(--c-primary-dark)', marginTop: '10px', marginBottom: '2px',
        }}>
          {rendered}
        </div>
      )
    }

    if (isBullet) {
      return (
        <div key={li} style={{
          display: 'flex', gap: '8px', alignItems: 'flex-start',
          fontSize: `${fontSize}px`, lineHeight: '2.2',
          color: 'var(--c-primary-dark)',
        }}>
          <span style={{ color: 'var(--c-primary-mid)', flexShrink: 0, marginTop: '1px' }}>•</span>
          <span style={{ flex: 1 }}>{rendered}</span>
        </div>
      )
    }

    return (
      <div key={li} style={{
        fontSize: `${fontSize}px`, lineHeight: '2.2',
        color: 'var(--c-primary-dark)',
      }}>
        {rendered}
      </div>
    )
  }

  return (
    <div style={{
      padding: '16px 20px', borderRadius: '10px',
      border: '1px solid var(--c-primary-pale)',
      backgroundColor: 'var(--c-primary-barest)',
    }}>
      {lines.map((line, li) => renderLine(line, li))}
    </div>
  )
}

// ─── Question number badge ────────────────────────────────────────────────────

function QuestionNumber({ num }) {
  return (
    <span style={{
      minWidth: '26px', height: '26px', borderRadius: '6px', flexShrink: 0,
      backgroundColor: 'var(--c-primary-bg)', color: 'var(--c-primary)',
      fontSize: '11px', fontWeight: '700',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginTop: '1px',
      userSelect: 'none', WebkitUserSelect: 'none',   // ← disable text selection
    }}>
      {num}
    </span>
  )
}
// ─── Navigator bar (top) ──────────────────────────────────────────────────────

function NavigatorBar({ questions, answers, reviewAnswers, isReview, current, onJump }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      padding: '6px 16px', overflowX: 'auto',
      borderBottom: '1px solid var(--c-primary-pale)',
      backgroundColor: 'var(--c-sidebar-bg)',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: '11px', color: 'var(--c-text-muted)', fontWeight: '600', whiteSpace: 'nowrap', marginRight: '4px' }}>
        Câu:
      </span>
      {questions.map((q, i) => {
        const userAns = isReview ? reviewAnswers[q.globalIndex] : answers[q.globalIndex]
        const correct = q.Correct_Ans?.trim()
        const isCurrent = i === current

        let bg = 'var(--c-surface)', color = 'var(--c-primary-mid)', border = 'var(--c-primary-pale)'
        if (isCurrent) {
          bg = 'var(--c-primary)'; color = '#fff'; border = 'var(--c-primary)'
        } else if (isReview) {
          const isMc2 = q.Question_Type === 'mc2'
          const answered = isMc2 ? Array.isArray(userAns) && userAns.length > 0 : !!userAns
          const correctHit = isMc2
            ? Array.isArray(userAns) && userAns.some(v => v?.trim().toUpperCase() === correct?.toUpperCase())
            : isAnswerCorrect(userAns, correct)
          if (!answered)      { bg = 'var(--c-warn-bg)';    color = 'var(--c-warn-text)';    border = 'var(--c-warn)'          }
          else if (correctHit) { bg = 'var(--c-success-bg)'; color = 'var(--c-success-text)'; border = 'var(--c-success-border)' }
          else                { bg = 'var(--c-danger-bg)';  color = 'var(--c-danger-text)';  border = 'var(--c-danger-border)'  }
        } else if (q.Question_Type === 'mc2' ? Array.isArray(userAns) && userAns.length > 0 : userAns) {
          bg = 'var(--c-success-bg)'; color = 'var(--c-success-text)'; border = 'var(--c-success-border)'
        }

        return (
          <div key={i} onClick={() => onJump(i)}
            style={{
              width: '30px', height: '30px', borderRadius: '6px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              backgroundColor: bg, color, border: `1px solid ${border}`,
              transition: 'all 0.15s',
            }}>
            {q.Question_Num || i + 1}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BaiTapIELTS({ params }) {
  const { id }       = use(params)
  const router       = useRouter()
  const searchParams = useSearchParams()
  const isReview     = searchParams.get('review') === 'true'

  const [ghiChuBai, setGhiChuBai] = useState('')
  const [noteOpen, setNoteOpen]   = useState(false)

  const [exercise, setExercise]       = useState(null)
  const [questions, setQuestions]     = useState([])
  const [passage, setPassage]         = useState('')
  const [audios, setAudios]           = useState([])
  const [answers, setAnswers]         = useState({})
  const [reviewAnswers, setReviewAnswers] = useState({})
  const [currentQ, setCurrentQ]       = useState(0)

  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitDone, setSubmitDone]   = useState(false)
  const [ketQua, setKetQua]           = useState(null)
  const [draftSaved, setDraftSaved]   = useState(false)

  const [fontPassage, setFontPassage] = useState(18)
  const [fontQuestions, setFontQuestions] = useState(18)

  const { toolbar, applyHighlight, hideToolbar } = useHighlight(['ielts-passage-panel', 'ielts-questions-panel'])

  const assignmentIdRef  = useRef(null)
  const saveDraftTimeout = useRef(null)
  const isFirstLoad      = useRef(true)

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!Cookies.get('isLoggedIn')) { router.push('/'); return }
    loadInfo()
  }, [])

  // ── Auto-save draft ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false; return }
    if (Object.keys(answers).length === 0 && !ghiChuBai) return

    clearTimeout(saveDraftTimeout.current)
    saveDraftTimeout.current = setTimeout(async () => {
      try {
        const userInfo = getUserInfo()
        if (!userInfo) return
        let assignId = assignmentIdRef.current
        if (!assignId) {
          const snap = await getDocs(query(
            collection(db, 'assignments'),
            where('userId', '==', userInfo.taiKhoan),
            where('exerciseId', '==', id)
          ))
          assignId = snap.docs[0]?.id || null
          assignmentIdRef.current = assignId
        }
        if (assignId) {
          const updateData = isReview
            ? { ghiChuBai }
            : {
                trangThai: 'Đang làm', answers, ghiChuBai,
                tongCauDraft: questions.length,
                thoiGianLuuNhap: new Date().toISOString(),
              }
          await updateDoc(doc(db, 'assignments', assignId), updateData)
          setDraftSaved(true)
          setTimeout(() => setDraftSaved(false), 2000)
        }
      } catch (err) { console.error('Lỗi lưu nháp:', err) }
    }, 1500)

    return () => clearTimeout(saveDraftTimeout.current)
  }, [answers, ghiChuBai])

  async function loadInfo() {
    try {
      const exSnap = await getDoc(doc(db, 'exercises', id))
      if (!exSnap.exists()) return
      const exData = exSnap.data()
      setExercise(exData)

      const fileId = exData.linkDrive.match(/\/d\/([a-zA-Z0-9_-]+)/)[1]
      const csvUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`
      const res    = await fetch(csvUrl)
      const text   = await res.text()

      const { data } = Papa.parse(text, {
        header: true, skipEmptyLines: true,
        transform: (val, col) => col === 'Group' ? val.trim() : val,
      })

      const processed = data.map((row, i) => ({
        ...row,
        globalIndex: i,
        Question_Num: row.Question_Num || String(i + 1),
      }))

      setQuestions(processed)

      // Lấy passage từ row đầu tiên có Context
      const passageRow = processed.find(r => r.Context?.trim())
      if (passageRow) setPassage(passageRow.Context)

      // Lấy audio từ row đầu tiên có Audio
      const audioRow = processed.find(r => r.Audio?.trim())
      if (audioRow) {
        const audioUrls = (audioRow.Audio || '').split('|')
          .map(s => convertDriveLink(s.trim(), 'audio')).filter(Boolean)
        setAudios(audioUrls)
      }

      // Load answers
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

        // Ghi chú lưu ở assignments, cần query riêng để hiển thị (read-only)
        const assignSnapRv = await getDocs(query(
          collection(db, 'assignments'),
          where('userId', '==', userInfo.taiKhoan),
          where('exerciseId', '==', id)
        ))
        const assignRvDoc = assignSnapRv.docs[0]
        if (assignRvDoc) assignmentIdRef.current = assignRvDoc.id
        if (assignRvDoc?.data()?.ghiChuBai) setGhiChuBai(assignRvDoc.data().ghiChuBai)

      } else {
        const assignSnap = await getDocs(query(
          collection(db, 'assignments'),
          where('userId', '==', userInfo.taiKhoan),
          where('exerciseId', '==', id)
        ))
        const assignDoc = assignSnap.docs[0]
        if (assignDoc) {
          assignmentIdRef.current = assignDoc.id
          const d = assignDoc.data()
          if (d.trangThai === 'Đang làm' && d.answers) setAnswers(d.answers)
          if (d.ghiChuBai) setGhiChuBai(d.ghiChuBai)   // ← notes load bất kể trạng thái
        }
      }
    } catch (err) { console.error('Lỗi tải bài IELTS:', err) }
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleNopBai() {
    setIsSubmitting(true)
    try {
      const userInfo = getUserInfo()
      let soCauDung = 0

      questions.forEach(q => {
        const correct = q.Correct_Ans?.trim()
        if (!correct) return

        if (q.Question_Type === 'mc2') {
          const selected = Array.isArray(answers[q.globalIndex]) ? answers[q.globalIndex] : []
          if (selected.some(v => normalizeAns(v) === normalizeAns(correct))) soCauDung++
          return
        }

        const userAns = String(answers[q.globalIndex] || '').trim()
        if (isAnswerCorrect(userAns, correct)) soCauDung++
      })

      const assignSnap = await getDocs(query(
        collection(db, 'assignments'),
        where('userId', '==', userInfo.taiKhoan),
        where('exerciseId', '==', id)
      ))
      const assignmentId = assignSnap.docs[0]?.id || null

      await addDoc(collection(db, 'submissions'), {
        userId: userInfo.taiKhoan, exerciseId: id, assignmentId,
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
      console.error('Lỗi nộp bài:', err)
      alert('Có lỗi xảy ra. Vui lòng thử lại!')
    } finally { setIsSubmitting(false) }
  }

  // ── Computed ────────────────────────────────────────────────────────────────
  const soCauChuaLam = questions.filter(q => {
    const ans = answers[q.globalIndex]
    return !ans || !String(ans).trim()
  }).length

  // Gom questions theo Group
  const groups = (() => {
    const map = new Map()
    questions.forEach(q => {
      const g = q.Group || 'default'
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(q)
    })
    return [...map.values()].map(qs => ({
      questions: qs,
      audios: (qs[0]?.Audio || '')
        .split('|')
        .map(s => convertDriveLink(s.trim(), 'audio'))
        .filter(Boolean),
    }))
  })()

  const mauHeader = mauKyNang[exercise?.kyNang] || 'var(--c-primary)'

  if (!exercise || questions.length === 0) return <SkeletonIELTS />

  return (
    <main style={{ minHeight: 'calc(100vh - 56px)', height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>

      <style>{`
        @keyframes fadeInOut {
          0%   { opacity: 0; transform: translateY(4px); }
          20%  { opacity: 1; transform: translateY(0); }
          80%  { opacity: 1; }
          100% { opacity: 0; }
        }
        .draft-toast { animation: fadeInOut 2s ease forwards; }

        @media (max-width: 768px) {
          .ielts-body { flex-direction: column !important; }
          .ielts-passage { border-right: none !important; border-bottom: 1px solid var(--c-primary-pale); max-height: 45vh; }
          .ielts-questions { max-height: 55vh; }

          /* Ẩn lề trái/phải trên mobile, nội dung full width */
          .ielts-q-margin { display: none !important; }
          .ielts-q-content { flex: 1 !important; padding: 0 12px !important; }
        }
      `}</style>

      {/* ── Confirm dialog ── */}
      {showConfirm && !submitDone && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, backgroundColor: 'var(--c-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--c-surface)', borderRadius: '16px', padding: '32px', width: '340px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--shadow-modal)' }}>
            <h3 style={{ margin: 0, color: 'var(--c-primary-dark)', textAlign: 'center' }}>Xác nhận nộp bài</h3>
            {soCauChuaLam > 0 ? (
              <div style={{ backgroundColor: 'var(--c-warn-bg)', borderRadius: '10px', padding: '12px 16px', textAlign: 'center' }}>
                <span style={{ color: 'var(--c-warn-text)', fontSize: '14px', fontWeight: '500' }}>⚠️ Còn <strong>{soCauChuaLam}</strong> câu chưa làm.</span>
              </div>
            ) : (
              <div style={{ backgroundColor: 'var(--c-success-bg)', borderRadius: '10px', padding: '12px 16px', textAlign: 'center' }}>
                <span style={{ color: 'var(--c-success-text)', fontSize: '14px', fontWeight: '500' }}>✅ Đã hoàn thành tất cả {questions.length} câu!</span>
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
            <p style={{ fontSize: '20px', fontWeight: '700', color: 'var(--c-success)', margin: 0 }}>
              {ketQua?.dung} / {ketQua?.tong} câu đúng
            </p>
            <button onClick={() => router.push('/trang-chu')} style={{ ...btnPrimary, width: '100%' }}>
              Về trang chủ
            </button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        backgroundColor: isReview ? 'var(--c-text-muted)' : mauHeader,
        padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
      }}>
        <span style={{ color: '#fff', fontWeight: '700', fontSize: '13px' }}>IELTS</span>
        <span style={{ color: 'rgba(255,255,255,0.6)' }}>·</span>
        <span style={{ color: '#fff', fontWeight: '600', fontSize: '13px' }}>{exercise.kyNang}</span>
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>—</span>
        <span style={{ color: '#fff', fontSize: '13px' }}>{exercise.tenBaiTap}</span>

        {isReview && (
          <span style={{ padding: '3px 10px', borderRadius: '20px', backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: '11px', fontWeight: '500' }}>
            Chế độ xem lại
          </span>
        )}

        {draftSaved && (
          <span className="draft-toast" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>✓ Đã lưu nháp</span>
        )}

        <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>
          {questions.length} câu
        </span>

        {!isReview && (
          <button onClick={() => setShowConfirm(true)}
            style={{ marginLeft: '8px', padding: '7px 18px', borderRadius: '8px', border: '2px solid white', backgroundColor: 'transparent', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
            Nộp bài ✓
          </button>
        )}
      </div>

      {/* ── Navigator bar ── */}
      <NavigatorBar
        questions={questions}
        answers={answers}
        reviewAnswers={reviewAnswers}
        isReview={isReview}
        current={currentQ}
        onJump={setCurrentQ}
      />
      
      {/* ── Body: 2 panel ── */}
      <div className="ielts-body" style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {exercise.kyNang !== 'Listening' && (
          <div className="ielts-passage" style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--c-primary-pale)', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
            <PassagePanel
              passage={passage}
              audios={audios}
              fontSize={{ value: fontPassage, set: setFontPassage }}
            />
          </div>
        )}

        {/* Questions */}
        <div className="ielts-questions" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          <QuestionsPanel
            groups={groups}
            answers={answers}
            reviewAnswers={reviewAnswers}
            isReview={isReview}
            onChange={(idx, val) => setAnswers(a => ({ ...a, [idx]: val }))}
            fontSize={{ value: fontQuestions, set: setFontQuestions }}
            isListening={exercise.kyNang === 'Listening'}
            centered={exercise.kyNang === 'Listening'}   // ← THÊM: bật lề 2 bên khi Listening
            audios={exercise.kyNang === 'Listening' ? audios : undefined}  // ← THÊM 
          />
        </div>

      </div>

      <HighlightToolbar toolbar={toolbar} onHighlight={applyHighlight} onClose={hideToolbar} />
      <NoteToggleButton
        isOpen={noteOpen}
        hasNote={!!ghiChuBai?.trim()}
        onClick={() => setNoteOpen(true)}
      />
      <NotePanelIELTS
        isOpen={noteOpen}
        note={ghiChuBai}
        onChange={setGhiChuBai}
        onClose={() => setNoteOpen(false)}
        isReview={isReview}
      />
    </main>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonIELTS() {
  const P = ({ w = '100%', h = '14px', r = '4px' }) => (
    <div style={{ width: w, height: h, borderRadius: r, backgroundColor: 'var(--c-primary-pale)', animation: 'sk-pulse 1.6s ease-in-out infinite' }} />
  )
  return (
    <main style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes sk-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <div style={{ height: '44px', backgroundColor: 'var(--c-primary-bg)', borderBottom: '1px solid var(--c-primary-pale)' }} />
      <div style={{ height: '44px', backgroundColor: 'var(--c-sidebar-bg)', borderBottom: '1px solid var(--c-primary-pale)' }} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {[0, 1].map(i => (
          <div key={i} style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', borderRight: i === 0 ? '1px solid var(--c-primary-pale)' : 'none' }}>
            <P h="18px" w="60%" r="6px" />
            {Array.from({ length: 10 }).map((_, j) => <P key={j} w={`${70 + Math.random() * 30}%`} />)}
          </div>
        ))}
      </div>
    </main>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const btnPrimary = {
  flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
  backgroundColor: 'var(--c-primary)', color: '#fff',
  fontWeight: '600', cursor: 'pointer', fontSize: '14px',
}
const btnSecondary = {
  flex: 1, padding: '12px', borderRadius: '8px',
  border: '1px solid var(--c-primary-pale)', backgroundColor: 'var(--c-surface)',
  color: 'var(--c-primary-mid)', fontWeight: '500', cursor: 'pointer', fontSize: '14px',
}