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

const mauKyNang = {
  'Reading':   'var(--c-primary-mid)',
  'Listening': 'var(--c-success)',
  'Writing':   'var(--c-writing)',
  'Speaking':  'var(--c-speaking)',
}

// ─── FillBlankQuestion Component ─────────────────────────────────────────────
/**
 * Render một câu fill_blank với cơ chế click.
 *
 * Sheet format:
 *   Question   : "Can you do me ___ ? I need someone to ___ at the shop."
 *   Correct_Ans: "a favor|take over"         (thứ tự theo ô trống)
 *   Word_Bank  : "a favor|take over|schedule|customer|update"
 *
 * Cơ chế:
 *   - Click từ trong word bank → điền vào ô trống đầu tiên còn thiếu
 *   - Click từ đã điền trong câu → trả về word bank
 *
 * answers[globalIndex] = ["a favor", "take over"]   (mảng theo thứ tự blank)
 */
function FillBlankQuestion({ q, isReview, userAnswer, reviewAnswer, onChange }) {
  const correctParts = (q.Correct_Ans || '').split('|').map(s => s.trim())
  const wordBankRaw  = (q.Word_Bank   || '').split('|').map(s => s.trim()).filter(Boolean)
  const numBlanks    = correctParts.length

  // slots: mảng độ dài numBlanks, mỗi phần tử là từ đã điền hoặc null
  const slots = userAnswer
    ? [...userAnswer, ...Array(numBlanks).fill(null)].slice(0, numBlanks)
    : Array(numBlanks).fill(null)

  // Từ còn trong bank (chưa dùng)
  const usedWords = slots.filter(Boolean)
  const bankWords = wordBankRaw.filter(w => {
    const usedCount  = usedWords.filter(u => u === w).length
    const totalCount = wordBankRaw.filter(x => x === w).length
    return usedCount < totalCount
  })

  // Click từ trong word bank → điền vào ô trống đầu tiên
  const handleClickWord = (word) => {
    if (isReview) return
    const firstEmpty = slots.findIndex(s => !s)
    if (firstEmpty === -1) return // tất cả đã điền rồi
    const newSlots = [...slots]
    newSlots[firstEmpty] = word
    onChange(newSlots)
  }

  // Click ô đã điền → trả về bank
  const handleClickSlot = (slotIdx) => {
    if (isReview) return
    const newSlots = [...slots]
    newSlots[slotIdx] = null
    onChange(newSlots)
  }

  // Parse câu hỏi thành segments
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
      if (!revAns)                            return { bg: 'var(--c-warn-bgsoft)', border: 'var(--c-warn)', color: 'var(--c-warn-textsoft)' }
      if (revAns === correctParts[slotIdx])   return { bg: 'var(--c-success-bg)', border: 'var(--c-success)', color: 'var(--c-success-text)' }
      return                                         { bg: 'var(--c-danger-bg)', border: 'var(--c-danger)', color: 'var(--c-danger-text)' }
    }
    if (slots[slotIdx]) return { bg: 'var(--c-primary-bg)', border: 'var(--c-primary-mid)', color: 'var(--c-primary-dark)' }
    return                     { bg: 'var(--c-surface)',   border: 'var(--c-primary-pale)', color: 'var(--c-primary-pale)' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Câu với ô trống */}
      <div style={{
        fontSize: '14px', lineHeight: '2.4', color: 'var(--c-text)',
        padding: '14px 18px', borderRadius: '10px',
        border: '1px solid var(--c-primary-bg)', backgroundColor: 'var(--c-primary-barest)',
      }}>
        {segments.map((seg, si) => {
          if (seg.type === 'text') return <span key={si}>{seg.val}</span>

          const idx    = seg.idx
          const style  = getSlotStyle(idx)
          const filled = isReview ? (reviewAnswer || [])[idx] : slots[idx]

          return (
            <span
              key={si}
              onClick={() => filled && handleClickSlot(idx)}
              title={filled && !isReview ? 'Click để bỏ chọn' : undefined}
              style={{
                display: 'inline-block',
                minWidth: '90px',
                padding: '3px 12px',
                margin: '0 3px',
                borderRadius: '6px',
                border: `1.5px dashed ${style.border}`,
                backgroundColor: style.bg,
                color: style.color,
                fontSize: '13px',
                fontWeight: filled ? '600' : '400',
                cursor: filled && !isReview ? 'pointer' : 'default',
                textAlign: 'center',
                verticalAlign: 'middle',
                transition: 'all 0.15s',
                userSelect: 'none',
              }}
              onMouseEnter={e => { if (filled && !isReview) e.currentTarget.style.backgroundColor = 'var(--c-danger-bg)' }}
              onMouseLeave={e => { if (filled && !isReview) e.currentTarget.style.backgroundColor = style.bg }}
            >
              {filled || <span style={{ opacity: 0.35, fontStyle: 'italic', fontWeight: 400, fontSize: '12px' }}>...</span>}
              {isReview && filled && filled !== correctParts[idx] && (
                <span style={{ marginLeft: '6px', color: 'var(--c-success)', fontWeight: '600', fontSize: '12px' }}>
                  → {correctParts[idx]}
                </span>
              )}
            </span>
          )
        })}
      </div>

      {/* Word bank */}
      {!isReview && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '8px',
          padding: '12px 14px', borderRadius: '10px',
          border: '1.5px solid var(--c-primary-pale)',
          backgroundColor: 'var(--c-primary-bgsoft)',
          minHeight: '48px',
        }}>
          {bankWords.length === 0 && (
            <span style={{ color: 'var(--c-primary-pale)', fontSize: '13px', fontStyle: 'italic', alignSelf: 'center' }}>
              Tất cả từ đã được điền
            </span>
          )}
          {bankWords.map((word, wi) => (
            <span
              key={`${word}-${wi}`}
              onClick={() => handleClickWord(word)}
              style={{
                padding: '6px 14px', borderRadius: '20px',
                border: '1.5px solid var(--c-primary-pale)',
                backgroundColor: 'var(--c-surface)',
                color: 'var(--c-primary)',
                fontSize: '13px', fontWeight: '500',
                cursor: 'pointer', userSelect: 'none',
                transition: 'all 0.15s',
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

      {/* Review: word bank readonly */}
      {isReview && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '8px',
          padding: '10px 14px', borderRadius: '10px',
          border: '1px solid var(--c-primary-bg)', backgroundColor: 'var(--c-primary-barest)',
        }}>
          <span style={{ color: 'var(--c-text-muted)', fontSize: '12px', marginRight: '4px', alignSelf: 'center' }}>Word bank:</span>
          {wordBankRaw.map((word, wi) => (
            <span key={wi} style={{
              padding: '4px 12px', borderRadius: '20px',
              border: '1px solid var(--c-primary-pale)', backgroundColor: 'var(--c-surface)',
              color: correctParts.includes(word) ? 'var(--c-success)' : 'var(--c-text-muted)',
              fontSize: '12px', fontWeight: correctParts.includes(word) ? '600' : '400',
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

  const [exercise, setExercise] = useState(null)
  const [questions, setQuestions] = useState([])
  const [cauHienTai, setCauHienTai] = useState(0)
  const [answers, setAnswers] = useState({})
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitDone, setSubmitDone] = useState(false)
  const [ketQua, setKetQua] = useState(null)
  const [draftSaved, setDraftSaved] = useState(false)

  const { toolbar, applyHighlight, hideToolbar } = useHighlight(['content-panel', 'question-panel'])
  const [reviewAnswers, setReviewAnswers] = useState({})

  const saveDraftTimeout = useRef(null)
  const assignmentIdRef  = useRef(null)
  const isFirstLoad      = useRef(true)

  useEffect(() => {
    if (!Cookies.get('isLoggedIn')) router.push('/')
    loadInfo()
  }, [])

  // Auto-save draft
  useEffect(() => {
    if (isReview) return
    if (isFirstLoad.current) { isFirstLoad.current = false; return }
    if (Object.keys(answers).length === 0) return

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
            trangThai: 'Đang làm',
            answers,
            thoiGianLuuNhap: new Date().toISOString(),
          })
          setDraftSaved(true)
          setTimeout(() => setDraftSaved(false), 2000)
        }
      } catch (err) { console.error('Lỗi lưu nháp:', err) }
    }, 1500)

    return () => clearTimeout(saveDraftTimeout.current)
  }, [answers])

  const getUserInfo = () => {
    try {
      const raw = document.cookie.split('; ').find(r => r.startsWith('userInfo='))?.split('=')[1]
      return JSON.parse(decodeURIComponent(raw))
    } catch { return null }
  }

  const loadInfo = async () => {
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
        header: true,
        skipEmptyLines: true,
        transform: (val, col) => (col === 'Group' ? val.trim() : val)
      })
      const splitMedia = (raw, type) =>
        (raw || '').split('|').map(s => s.trim()).filter(Boolean).map(s => convertDriveLink(s, type))
      const processedData = data.map((item, index) => ({
        ...item,
        globalIndex: index,
        Contexts: splitMedia(item.Context, 'image'),
        Audios:   splitMedia(item.Audio,   'audio'),
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
          const best = subSnap.docs
            .map(d => d.data())
            .reduce((a, b) => (a.diem ?? -1) >= (b.diem ?? -1) ? a : b)
          setReviewAnswers(best.answers || {})
        }
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
        }
      }
    } catch (error) {
      console.error("Lỗi khi tải bài tập:", error)
    }
  }

  // ── Tính số câu chưa làm (hỗ trợ fill_blank) ──────────────────────────────
  const soCauChuaLam = questions.filter(q => {
    const ans = answers[q.globalIndex]
    if (q.Question_Type === 'fill_blank') {
      const numBlanks = (q.Question.match(/___/g) || []).length
      return !ans || (Array.isArray(ans) && ans.filter(Boolean).length < numBlanks)
    }
    return !ans
  }).length

  // ── Chấm điểm ─────────────────────────────────────────────────────────────
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
          if (userAns === correctRaw) soCauDung++
        } else if (q.Question_Type === 'fill_short') {
          const correctParts = correctRaw.split('|').map(s => s.trim().toLowerCase())
          const userParts    = (userAns || []).map(s => s.trim().toLowerCase())
          if (correctParts.every((c, i) => c === userParts[i])) soCauDung++
        } else if (q.Question_Type === 'fill_blank') {
          // Mỗi blank đúng tính 1 điểm con; cả câu đúng hết mới tính 1 điểm câu
          const correctParts = correctRaw.split('|').map(s => s.trim().toLowerCase())
          const userParts    = (userAns || []).map(s => (s || '').trim().toLowerCase())
          if (correctParts.every((c, i) => c === userParts[i])) soCauDung++
        }
      })

      const assignQuery  = query(collection(db, 'assignments'), where('userId', '==', taiKhoan), where('exerciseId', '==', id))
      const assignSnap   = await getDocs(assignQuery)
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

  const getReviewBorderColor = (q, optKey) => {
    const userAns = reviewAnswers[q.globalIndex]
    const correct = q.Correct_Ans?.trim()
    if (!userAns) return 'var(--c-warn)'
    if (optKey === correct) return 'var(--c-success)'
    if (optKey === userAns) return 'var(--c-danger)'
    return 'var(--c-primary-pale)'
  }

  const currentCau       = questions[cauHienTai]
  const currentGroup     = currentCau?.Group
  const questionsInGroup = questions.filter(q => q.Group === currentGroup)
  const firstInGroup     = questionsInGroup[0]
  const mauHeader        = mauKyNang[exercise?.kyNang] || 'var(--c-primary)'

  const getOptions = (q) => {
    if (!q) return []
    return ['A', 'B', 'C', 'D', 'E']
      .map(k => ({ key: k, value: q[`Opt_${k}`] }))
      .filter(o => o.value && o.value.trim() !== '')
  }

  const chonDapAn = (index, key) => {
    if (isReview) return
    setAnswers(prev => ({ ...prev, [index]: key }))
  }

  if (!exercise || questions.length === 0) return <SkeletonBaiTap />

  return (
    <main style={{ minHeight: 'calc(100vh - 56px)', height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>

      <style>{`
        .bt-body { display: flex; flex: 1; overflow: hidden; }
        .bt-vung2-3 { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
        .bt-vung2 {
          flex: 1.2; border-bottom: 1px solid var(--c-primary-pale);
          padding: 20px; overflow-y: auto;
          display: flex; flex-direction: column; gap: 16px;
        }
        .bt-vung3 {
          flex: 1; padding: 20px; overflow-y: auto;
          display: flex; flex-direction: column; gap: 35px;
        }
        @media (min-width: 769px) {
          .bt-vung1 { border-right: 1px solid var(--c-primary-pale); }
          .bt-vung2 { border-right: 1px solid var(--c-primary-pale); border-bottom: none; flex: 1.2; }
          .bt-vung2-3 { flex-direction: row; }
          .bt-vung3 { flex: 1; }
        }
        @media (max-width: 768px) {
          .bt-vung1 { width: 48px !important; min-width: 48px !important; border-right: 1px solid var(--c-primary-pale); }
          .bt-vung1 .so-cau { width: 28px !important; height: 28px !important; font-size: 11px !important; }
          .bt-body { overflow-y: auto; align-items: flex-start; }
          .bt-vung2-3 { flex-direction: column; overflow: visible; flex: none; }
          .bt-vung2 { flex: none; overflow: visible; border-right: none; border-bottom: 1px solid var(--c-primary-pale); padding: 12px; }
          .bt-vung3 { flex: none; overflow: visible; padding: 12px; gap: 16px; }
          .bt-nav-btn { padding: 8px 4px !important; font-size: 12px !important; }
        }
        @keyframes fadeInOut {
          0%   { opacity: 0; transform: translateY(4px); }
          20%  { opacity: 1; transform: translateY(0); }
          80%  { opacity: 1; }
          100% { opacity: 0; }
        }
        .draft-saved-toast { animation: fadeInOut 2s ease forwards; }
      `}</style>

      {/* Dialog xác nhận nộp bài */}
      {showConfirm && !submitDone && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, backgroundColor: 'var(--c-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--c-surface)', borderRadius: '16px', padding: '32px', width: '340px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 8px 32px var(--shadow-modal)' }}>
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
              <button onClick={handleNopBai} disabled={isSubmitting} style={{ ...btnPrimary, backgroundColor: 'var(--c-success)', opacity: isSubmitting ? 0.7 : 1 }}>
                {isSubmitting ? 'Đang nộp...' : 'Nộp bài'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog nộp thành công */}
      {submitDone && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, backgroundColor: 'var(--c-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--c-surface)', borderRadius: '16px', padding: '40px 32px', width: '340px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', boxShadow: '0 8px 32px var(--shadow-modal)' }}>
            <div style={{ fontSize: '48px' }}>🎉</div>
            <h3 style={{ margin: 0, color: 'var(--c-primary-dark)', textAlign: 'center' }}>Nộp bài thành công!</h3>
            <p style={{ fontSize: '20px', fontWeight: '700', color: 'var(--c-success)', margin: 0 }}>{ketQua?.dung} / {ketQua?.tong} câu đúng</p>
            <button onClick={() => router.push('/trang-chu')} style={{ ...btnPrimary, width: '100%' }}>Về trang chủ</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ backgroundColor: isReview ? 'var(--c-text-muted)' : mauHeader, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, position: 'relative' }}>
        <span style={{ color: 'var(--c-surface)', fontWeight: '600', fontSize: '14px' }}>{exercise.loaiBai} · {exercise.kyNang}</span>
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>—</span>
        <span style={{ color: 'var(--c-surface)', fontSize: '14px' }}>{exercise.tenBaiTap}</span>
        {isReview && (
          <span style={{ padding: '3px 10px', borderRadius: '20px', backgroundColor: 'rgba(255,255,255,0.2)', color: 'var(--c-surface)', fontSize: '12px', fontWeight: '500' }}>Chế độ xem lại</span>
        )}
        {draftSaved && (
          <span className="draft-saved-toast" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', gap: '4px' }}>✓ Đã lưu nháp</span>
        )}
        <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>Câu {cauHienTai + 1} / {questions.length}</span>
        {!isReview && (
          <button
            onClick={() => setShowConfirm(true)}
            style={{ marginLeft: '12px', padding: '7px 18px', borderRadius: '8px', border: '2px solid white', backgroundColor: 'transparent', color: 'var(--c-surface)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s', whiteSpace: 'nowrap' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Nộp bài ✓
          </button>
        )}
      </div>

      {/* Body */}
      <div className="bt-body">

        {/* Vùng 1: Số câu */}
        <div className="bt-vung1" style={{ width: '72px', minWidth: '72px', backgroundColor: 'var(--c-primary-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: '6px', overflowY: 'auto' }}>
          {questions.map((q, i) => {
            let bgColor = 'var(--c-surface)', textColor = 'var(--c-primary-mid)', borderColor = 'var(--c-primary-pale)'
            if (i === cauHienTai) {
              bgColor = 'var(--c-primary)'; textColor = 'var(--c-surface)'; borderColor = 'var(--c-primary)'
            } else if (isReview) {
              const userAns = reviewAnswers[i]
              const correct = q.Correct_Ans?.trim()
              if (q.Question_Type === 'fill_blank') {
                const correctParts = (correct || '').split('|').map(s => s.trim().toLowerCase())
                const userParts    = (userAns || []).map(s => (s || '').trim().toLowerCase())
                const allCorrect   = correctParts.every((c, ci) => c === userParts[ci])
                const anyFilled    = (userAns || []).some(Boolean)
                if (!anyFilled)      { bgColor = 'var(--c-warn-bg)'; textColor = 'var(--c-warn-textsoft)'; borderColor = 'var(--c-warn)' }
                else if (allCorrect) { bgColor = 'var(--c-success-bg)'; textColor = 'var(--c-success-text)'; borderColor = 'var(--c-success-border)' }
                else                 { bgColor = 'var(--c-danger-bg)'; textColor = 'var(--c-danger-text)'; borderColor = 'var(--c-danger-border)' }
              } else {
                if (!userAns)               { bgColor = 'var(--c-warn-bg)'; textColor = 'var(--c-warn-textsoft)'; borderColor = 'var(--c-warn)' }
                else if (userAns === correct){ bgColor = 'var(--c-success-bg)'; textColor = 'var(--c-success-text)'; borderColor = 'var(--c-success-border)' }
                else                         { bgColor = 'var(--c-danger-bg)'; textColor = 'var(--c-danger-text)'; borderColor = 'var(--c-danger-border)' }
              }
            } else if (answers[i]) {
              bgColor = 'var(--c-success-bg)'; textColor = 'var(--c-success-text)'; borderColor = 'var(--c-success-border)'
            }

            return (
              <div key={i} className="so-cau" onClick={() => setCauHienTai(i)}
                style={{ width: '36px', height: '36px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '500', cursor: 'pointer', backgroundColor: bgColor, color: textColor, border: `1px solid ${borderColor}`, transition: 'all 0.2s' }}
              >
                {i + 1}
              </div>
            )
          })}

          {!isReview && (
            <>
              <div style={{ flex: 1 }} />
              <button onClick={() => setShowConfirm(true)} style={{ width: '48px', padding: '8px 0', borderRadius: '8px', border: 'none', backgroundColor: 'var(--c-success)', color: 'var(--c-surface)', fontSize: '11px', fontWeight: '600', cursor: 'pointer', marginBottom: '4px', lineHeight: '1.3' }}>
                Nộp<br/>bài
              </button>
            </>
          )}
        </div>

        {/* Vùng 2 + 3 */}
        <div className="bt-vung2-3">

          {/* Vùng 2: Nội dung */}
          <div className="bt-vung2" id="content-panel">
            {firstInGroup?.Audios?.map((src, i) => (
              <iframe key={src + i} src={src} width="100%" height="80" style={{ border: 'none', borderRadius: '8px' }} />
            ))}
            {firstInGroup?.Contexts?.map((ctx, i) => (
              <div key={i} style={{ fontSize: '14px', lineHeight: '1.8', color: 'var(--c-primary-dark)', whiteSpace: 'pre-wrap' }}>
                {ctx.startsWith('http') ? <img src={ctx} style={{ maxWidth: '100%', borderRadius: '8px' }} alt={`Hình ${i + 1}`} /> : ctx}
              </div>
            ))}
            {!firstInGroup?.Audios?.length && !firstInGroup?.Contexts?.length && (
              <p style={{ color: 'var(--c-primary-pale)', fontSize: '14px' }}>Không có nội dung chung cho nhóm này</p>
            )}
          </div>

          {/* Vùng 3: Câu hỏi & Đáp án */}
          <div className="bt-vung3" id="question-panel">
            {questionsInGroup.map((q) => (
              <div key={q.globalIndex} style={{ display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: q.globalIndex === cauHienTai ? 'var(--c-primary-barest)' : 'transparent', padding: '10px', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--c-primary)' }}>
                  Câu {q.globalIndex + 1}:{' '}
                  {/* Với fill_blank, tiêu đề không lặp lại toàn bộ câu (câu được render trong component) */}
                  {q.Question_Type !== 'fill_blank' ? q.Question : ''}
                </p>

                {/* MCQ */}
                {(q.Question_Type === 'mcq' || q.Question_Type === 'mcq_blank') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {q.Question_Type === 'mcq'
                      ? getOptions(q).map(opt => {
                          const border = isReview ? getReviewBorderColor(q, opt.key) : (answers[q.globalIndex] === opt.key ? 'var(--c-primary)' : 'var(--c-primary-pale)')
                          const bg     = isReview ? (opt.key === q.Correct_Ans?.trim() ? 'var(--c-success-bg)' : opt.key === reviewAnswers[q.globalIndex] ? 'var(--c-danger-bg)' : !reviewAnswers[q.globalIndex] ? 'var(--c-warn-bgsoft)' : 'var(--c-surface)') : (answers[q.globalIndex] === opt.key ? 'var(--c-primary-bg)' : 'var(--c-surface)')
                          const color  = isReview ? (opt.key === q.Correct_Ans?.trim() ? 'var(--c-success-text)' : opt.key === reviewAnswers[q.globalIndex] ? 'var(--c-danger-text)' : 'var(--c-primary-mid)') : (answers[q.globalIndex] === opt.key ? 'var(--c-primary-dark)' : 'var(--c-primary-mid)')
                          return (
                            <div key={opt.key} onClick={() => chonDapAn(q.globalIndex, opt.key)} style={{ padding: '10px 14px', borderRadius: '8px', border: `1.5px solid ${border}`, backgroundColor: bg, color, fontSize: '14px', cursor: isReview ? 'default' : 'pointer', transition: 'all 0.15s' }}>
                              {opt.key}. {opt.value}
                            </div>
                          )
                        })
                      : ['A', 'B', 'C', 'D'].slice(0, parseInt(q.Num_Answers) || 4).map(key => {
                          const border = isReview ? getReviewBorderColor(q, key) : (answers[q.globalIndex] === key ? 'var(--c-primary)' : 'var(--c-primary-pale)')
                          const bg     = isReview ? (key === q.Correct_Ans?.trim() ? 'var(--c-success-bg)' : key === reviewAnswers[q.globalIndex] ? 'var(--c-danger-bg)' : !reviewAnswers[q.globalIndex] ? 'var(--c-warn-bgsoft)' : 'var(--c-surface)') : (answers[q.globalIndex] === key ? 'var(--c-primary-bg)' : 'var(--c-surface)')
                          const color  = isReview ? (key === q.Correct_Ans?.trim() ? 'var(--c-success-text)' : key === reviewAnswers[q.globalIndex] ? 'var(--c-danger-text)' : 'var(--c-text-muted)') : (answers[q.globalIndex] === key ? 'var(--c-primary-dark)' : 'var(--c-text-muted)')
                          return (
                            <div key={key} onClick={() => chonDapAn(q.globalIndex, key)} style={{ padding: '10px 14px', borderRadius: '8px', border: `1.5px solid ${border}`, backgroundColor: bg, color, fontSize: '14px', cursor: isReview ? 'default' : 'pointer', fontWeight: '600', textAlign: 'center' }}>
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
                          setAnswers(a => ({ ...a, [q.globalIndex]: newArr }))
                        }}
                        style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--c-primary-pale)', outline: 'none', backgroundColor: isReview ? 'var(--c-primary-barest)' : 'var(--c-surface)' }}
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
                    onChange={(e) => { if (isReview) return; setAnswers(a => ({ ...a, [q.globalIndex]: e.target.value })) }}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--c-primary-pale)', minHeight: '120px', resize: 'vertical', outline: 'none', backgroundColor: isReview ? 'var(--c-primary-barest)' : 'var(--c-surface)' }}
                  />
                )}

                {/* ── Fill blank (kéo thả) ── */}
                {q.Question_Type === 'fill_blank' && (
                  <FillBlankQuestion
                    q={q}
                    isReview={isReview}
                    userAnswer={isReview ? null : answers[q.globalIndex]}
                    reviewAnswer={isReview ? reviewAnswers[q.globalIndex] : null}
                    onChange={(newSlots) => setAnswers(a => ({ ...a, [q.globalIndex]: newSlots }))}
                  />
                )}
              </div>
            ))}

            {/* Nút điều hướng */}
            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', padding: '10px 0' }}>
              <button className="bt-nav-btn"
                onClick={() => setCauHienTai(i => Math.max(0, i - 1))}
                disabled={cauHienTai === 0}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--c-primary-pale)', backgroundColor: 'var(--c-surface)', color: 'var(--c-primary-mid)', cursor: cauHienTai === 0 ? 'not-allowed' : 'pointer', opacity: cauHienTai === 0 ? 0.4 : 1, fontWeight: '500' }}
              >← Trước</button>

              {!isReview && cauHienTai === questions.length - 1 ? (
                <button className="bt-nav-btn"
                  onClick={() => setShowConfirm(true)}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--c-success)', color: 'var(--c-surface)', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
                >Nộp bài ✓</button>
              ) : (
                <button className="bt-nav-btn"
                  onClick={() => setCauHienTai(i => Math.min(questions.length - 1, i + 1))}
                  disabled={cauHienTai === questions.length - 1}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--c-primary-mid)', color: 'var(--c-surface)', cursor: cauHienTai === questions.length - 1 ? 'not-allowed' : 'pointer', opacity: cauHienTai === questions.length - 1 ? 0.4 : 1, fontWeight: '500' }}
                >Tiếp →</button>
              )}
            </div>
          </div>

        </div>
      </div>

      <HighlightToolbar toolbar={toolbar} onHighlight={applyHighlight} onClose={hideToolbar} />
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