'use client'
import { useEffect, use, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Cookies from 'js-cookie'
import { db } from '@/lib/firebase'
import { doc, getDoc, addDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore'
import Papa from 'papaparse'
import { SkeletonVocab } from '@/app/components/Skeleton'

const getUserInfo = () => {
  try {
    const raw = document.cookie.split('; ').find(r => r.startsWith('userInfo='))?.split('=')[1]
    return JSON.parse(decodeURIComponent(raw))
  } catch { return null }
}

export default function VocabPage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const isReview = searchParams.get('review') === 'true'

  const [exercise, setExercise] = useState(null)
  const [words, setWords] = useState([])       // [{ vietnamese?, english }]
  const [answers, setAnswers] = useState({})   // { index: string }
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitDone, setSubmitDone] = useState(false)
  const [ketQua, setKetQua] = useState(null)
  const [reviewAnswers, setReviewAnswers] = useState({})

  useEffect(() => {
    if (!Cookies.get('isLoggedIn')) { router.push('/'); return }
    loadInfo()
  }, [])

  const loadInfo = async () => {
    try {
      const exSnap = await getDoc(doc(db, 'exercises', id))
      if (!exSnap.exists()) return
      const exData = exSnap.data()
      setExercise(exData)

      const fileId = exData.linkDrive.match(/\/d\/([a-zA-Z0-9_-]+)/)[1]
      const csvUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`
      const res = await fetch(csvUrl)
      const text = await res.text()

      const { data } = Papa.parse(text, { header: true, skipEmptyLines: true })
      setWords(data.map((row, i) => ({ ...row, globalIndex: i })))

      if (isReview) {
        const userInfo = getUserInfo()
        const subSnap = await getDocs(query(
          collection(db, 'submissions'),
          where('userId', '==', userInfo?.taiKhoan),
          where('exerciseId', '==', id)
        ))
        if (!subSnap.empty) {
          const best = subSnap.docs
            .map(d => d.data())
            .reduce((a, b) => (a.diem ?? -1) >= (b.diem ?? -1) ? a : b)
          setReviewAnswers(best.answers || {})
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải vocab:', err)
    }
  }

  const handleNopBai = async () => {
    setIsSubmitting(true)
    try {
      const userInfo = getUserInfo()
      const taiKhoan = userInfo?.taiKhoan
      const isListening = exercise?.kyNang === 'Vocab Listening'

      let soCauDung = 0
      words.forEach((w, i) => {
        const correct = (isListening ? w.English : w.English)?.trim().toLowerCase()
        const user = (answers[i] || '').trim().toLowerCase()
        if (user === correct) soCauDung++
      })

      const assignQuery = query(
        collection(db, 'assignments'),
        where('userId', '==', taiKhoan),
        where('exerciseId', '==', id)
      )
      const assignSnap = await getDocs(assignQuery)
      const assignmentId = assignSnap.docs[0]?.id || null

      await addDoc(collection(db, 'submissions'), {
        userId: taiKhoan,
        exerciseId: id,
        assignmentId,
        answers,
        diem: soCauDung,
        tongCau: words.length,
        thoiGianNop: new Date().toISOString(),
        trangThai: 'Đã nộp',
      })

      if (assignmentId) {
        await updateDoc(doc(db, 'assignments', assignmentId), {
          trangThai: 'Đã làm',
          thoiGianNop: new Date().toISOString(),
        })
      }

      setKetQua({ dung: soCauDung, tong: words.length })
      setSubmitDone(true)
    } catch (err) {
      console.error('Lỗi khi nộp bài:', err)
      alert('Có lỗi xảy ra khi nộp bài. Vui lòng thử lại!')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!exercise || words.length === 0) return <SkeletonVocab />


  const isListening = exercise.kyNang === 'Vocab Listening'
  const soCauDaLam = Object.keys(answers).filter(k => answers[k]?.trim()).length
  const soCauChuaLam = words.length - soCauDaLam
  const mauHeader = isListening ? 'var(--c-success)' : 'var(--c-primary-mid)'

  return (
    <main style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>

      {/* Confirm dialog */}
      {showConfirm && !submitDone && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          backgroundColor: 'var(--c-overlay)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            backgroundColor: 'var(--c-surface)', borderRadius: '16px',
            padding: '32px', width: '340px',
            display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: '0 8px 32px rgba(12,68,124,0.2)',
          }}>
            <h3 style={{ margin: 0, color: 'var(--c-primary-dark)', textAlign: 'center' }}>Xác nhận nộp bài</h3>
            {soCauChuaLam > 0 ? (
              <div style={{ backgroundColor: 'var(--c-warn-bg)', borderRadius: '10px', padding: '12px 16px', textAlign: 'center' }}>
                <span style={{ color: 'var(--c-warn-text)', fontSize: '14px', fontWeight: '500' }}>
                  ⚠️ Bạn còn <strong>{soCauChuaLam}</strong> từ chưa điền.
                </span>
              </div>
            ) : (
              <div style={{ backgroundColor: 'var(--c-success-bg)', borderRadius: '10px', padding: '12px 16px', textAlign: 'center' }}>
                <span style={{ color: 'var(--c-success-text)', fontSize: '14px', fontWeight: '500' }}>
                  ✅ Bạn đã điền đủ tất cả {words.length} từ!
                </span>
              </div>
            )}
            <p style={{ margin: 0, color: 'var(--c-text-soft)', fontSize: '14px', textAlign: 'center' }}>
              Sau khi nộp bạn không thể chỉnh sửa đáp án.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowConfirm(false)} style={btnSecondary}>Làm tiếp</button>
              <button onClick={handleNopBai} disabled={isSubmitting} style={{ ...btnPrimary, backgroundColor: 'var(--c-success)', opacity: isSubmitting ? 0.7 : 1 }}>
                {isSubmitting ? 'Đang nộp...' : 'Nộp bài'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit done dialog */}
      {submitDone && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          backgroundColor: 'var(--c-overlay)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            backgroundColor: 'var(--c-surface)', borderRadius: '16px',
            padding: '40px 32px', width: '340px',
            display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center',
            boxShadow: '0 8px 32px rgba(12,68,124,0.2)',
          }}>
            <div style={{ fontSize: '48px' }}>🎉</div>
            <h3 style={{ margin: 0, color: 'var(--c-primary-dark)', textAlign: 'center' }}>Nộp bài thành công!</h3>
            <p style={{ fontSize: '20px', fontWeight: '700', color: 'var(--c-success)', margin: 0 }}>
              {ketQua?.dung} / {ketQua?.tong} từ đúng
            </p>
            <button onClick={() => router.push('/trang-chu')} style={{ ...btnPrimary, width: '100%' }}>
              Về trang chủ
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        backgroundColor: isReview ? 'var(--c-text-muted)' : mauHeader,
        padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: '12px',
        flexShrink: 0,
      }}>
        <span style={{ color: 'var(--c-surface)', fontWeight: '600', fontSize: '14px' }}>
          {exercise.loaiBai} · {exercise.kyNang}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>—</span>
        <span style={{ color: 'var(--c-surface)', fontSize: '14px' }}>{exercise.tenBaiTap}</span>

        {isReview && (
          <span style={{
            padding: '3px 10px', borderRadius: '20px',
            backgroundColor: 'rgba(255,255,255,0.2)', color: 'var(--c-surface)',
            fontSize: '12px', fontWeight: '500',
          }}>Chế độ xem lại</span>
        )}

        {/* Progress */}
        {!isReview && (
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', marginLeft: 'auto' }}>
            {soCauDaLam} / {words.length} từ đã điền
          </span>
        )}

        {!isReview && (
          <button
            onClick={() => setShowConfirm(true)}
            style={{
              marginLeft: isReview ? 'auto' : '12px',
              padding: '7px 18px', borderRadius: '8px',
              border: '2px solid white', backgroundColor: 'transparent',
              color: 'var(--c-surface)', fontSize: '13px', fontWeight: '600',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Nộp bài ✓
          </button>
        )}
      </div>

      {/* Progress bar */}
      {!isReview && (
        <div style={{ height: '4px', backgroundColor: 'rgba(0,0,0,0.08)', flexShrink: 0 }}>
          <div style={{
            height: '100%',
            width: `${(soCauDaLam / words.length) * 100}%`,
            backgroundColor: mauHeader,
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}

      {/* Word list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {words.map((word, i) =>
            isListening
              ? <ListeningRow
                  key={i} word={word} index={i}
                  isReview={isReview}
                  userAnswer={isReview ? reviewAnswers[i] : answers[i]}
                  onChange={val => !isReview && setAnswers(prev => ({ ...prev, [i]: val }))}
                />
              : <ReadingRow
                  key={i} word={word} index={i}
                  isReview={isReview}
                  userAnswer={isReview ? reviewAnswers[i] : answers[i]}
                  onChange={val => !isReview && setAnswers(prev => ({ ...prev, [i]: val }))}
                />
          )}

          {/* Bottom submit */}
          {!isReview && (
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirm(true)}
                style={{
                  padding: '12px 32px', borderRadius: '10px', border: 'none',
                  backgroundColor: 'var(--c-success)', color: 'var(--c-surface)',
                  fontSize: '15px', fontWeight: '600', cursor: 'pointer',
                }}
              >
                Nộp bài ✓
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

// ─── Vocab Reading Row ────────────────────────────────────────────────────────
function ReadingRow({ word, index, isReview, userAnswer, onChange }) {
  const correct = word.English?.trim() ?? ''
  const isCorrect = userAnswer?.trim().toLowerCase() === correct.toLowerCase()
  const isWrong = isReview && userAnswer?.trim() && !isCorrect
  const isEmpty = isReview && !userAnswer?.trim()

  let borderColor = 'var(--c-primary-pale)'
  let bgColor = 'var(--c-surface)'
  if (isReview) {
    if (isCorrect) { borderColor = 'var(--c-success)'; bgColor = 'var(--c-success-bg)' }
    else if (isWrong) { borderColor = 'var(--c-danger)'; bgColor = 'var(--c-danger-bg)' }
    else { borderColor = 'var(--c-warn)'; bgColor = 'var(--c-warn-bgsoft)' }
  } else if (userAnswer?.trim()) {
    borderColor = 'var(--c-primary-mid)'; bgColor = 'var(--c-primary-bgsoft)'
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '16px',
      padding: '14px 18px', borderRadius: '12px',
      border: `1.5px solid ${borderColor}`,
      backgroundColor: bgColor,
      transition: 'all 0.2s',
    }}>
      {/* Index */}
      <span style={{ color: 'var(--c-primary-pale)', fontSize: '13px', fontWeight: '600', minWidth: '24px' }}>
        {index + 1}
      </span>

      {/* Vietnamese meaning */}
      <span style={{ flex: 1, fontSize: '15px', color: 'var(--c-primary-dark)', fontWeight: '500' }}>
        {word.Vietnamese}
      </span>

      {/* Input */}
      <input
        type="text"
        readOnly={isReview}
        value={userAnswer || ''}
        onChange={e => onChange(e.target.value)}
        placeholder="Nhập từ tiếng Anh..."
        style={{
          width: '220px', padding: '8px 12px',
          borderRadius: '8px',
          border: `1px solid ${isReview ? 'transparent' : 'var(--c-primary-pale)'}`,
          backgroundColor: isReview ? 'transparent' : 'var(--c-surface)',
          fontSize: '14px', outline: 'none',
          color: isReview ? (isCorrect ? 'var(--c-success-text)' : 'var(--c-danger-text)') : 'var(--c-primary-dark)',
          fontWeight: isReview ? '600' : '400',
        }}
      />

      {/* Review status */}
      {isReview && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '140px' }}>
          {isCorrect && <span style={{ fontSize: '18px' }}>✅</span>}
          {isWrong && (
            <>
              <span style={{ fontSize: '18px' }}>❌</span>
              <span style={{ fontSize: '13px', color: 'var(--c-success)', fontWeight: '600' }}>
                → {correct}
              </span>
            </>
          )}
          {isEmpty && (
            <>
              <span style={{ fontSize: '18px' }}>⚠️</span>
              <span style={{ fontSize: '13px', color: 'var(--c-success)', fontWeight: '600' }}>
                → {correct}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Vocab Listening Row ──────────────────────────────────────────────────────
function ListeningRow({ word, index, isReview, userAnswer, onChange }) {
  const correct = word.English?.trim() ?? ''
  const isCorrect = userAnswer?.trim().toLowerCase() === correct.toLowerCase()
  const isWrong = isReview && userAnswer?.trim() && !isCorrect
  const isEmpty = isReview && !userAnswer?.trim()
  const [speaking, setSpeaking] = useState(false)

  let borderColor = 'var(--c-primary-pale)'
  let bgColor = 'var(--c-surface)'
  if (isReview) {
    if (isCorrect) { borderColor = 'var(--c-success)'; bgColor = 'var(--c-success-bg)' }
    else if (isWrong) { borderColor = 'var(--c-danger)'; bgColor = 'var(--c-danger-bg)' }
    else { borderColor = 'var(--c-warn)'; bgColor = 'var(--c-warn-bgsoft)' }
  } else if (userAnswer?.trim()) {
    borderColor = 'var(--c-success)'; bgColor = '#F0FBF7'
  }

  const speak = () => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(correct)
    utter.lang = 'en-GB'
    utter.rate = 0.75
    utter.onstart = () => setSpeaking(true)
    utter.onend = () => setSpeaking(false)
    utter.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utter)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '16px',
      padding: '14px 18px', borderRadius: '12px',
      border: `1.5px solid ${borderColor}`,
      backgroundColor: bgColor,
      transition: 'all 0.2s',
    }}>
      {/* Index */}
      <span style={{ color: 'var(--c-primary-pale)', fontSize: '13px', fontWeight: '600', minWidth: '24px' }}>
        {index + 1}
      </span>

      {/* Speaker button */}
      <button
        onClick={speak}
        title="Phát âm"
        style={{
          width: '44px', height: '44px', borderRadius: '50%',
          border: 'none', cursor: 'pointer',
          backgroundColor: speaking ? 'var(--c-success)' : 'var(--c-primary-bg)',
          color: speaking ? 'var(--c-surface)' : 'var(--c-primary)',
          fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
          flexShrink: 0,
          boxShadow: speaking ? '0 0 0 4px rgba(29,158,117,0.2)' : 'none',
        }}
      >
        {speaking ? '🔊' : '🔈'}
      </button>

      {/* Input */}
      <input
        type="text"
        readOnly={isReview}
        value={userAnswer || ''}
        onChange={e => onChange(e.target.value)}
        placeholder="Nghe và điền từ tiếng Anh..."
        style={{
          flex: 1, padding: '8px 12px',
          borderRadius: '8px',
          border: `1px solid ${isReview ? 'transparent' : 'var(--c-primary-pale)'}`,
          backgroundColor: isReview ? 'transparent' : 'var(--c-surface)',
          fontSize: '14px', outline: 'none',
          color: isReview ? (isCorrect ? 'var(--c-success-text)' : 'var(--c-danger-text)') : 'var(--c-primary-dark)',
          fontWeight: isReview ? '600' : '400',
        }}
      />

      {/* Review status */}
      {isReview && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '140px' }}>
          {isCorrect && <span style={{ fontSize: '18px' }}>✅</span>}
          {isWrong && (
            <>
              <span style={{ fontSize: '18px' }}>❌</span>
              <span style={{ fontSize: '13px', color: 'var(--c-success)', fontWeight: '600' }}>
                → {correct}
              </span>
            </>
          )}
          {isEmpty && (
            <>
              <span style={{ fontSize: '18px' }}>⚠️</span>
              <span style={{ fontSize: '13px', color: 'var(--c-success)', fontWeight: '600' }}>
                → {correct}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────
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