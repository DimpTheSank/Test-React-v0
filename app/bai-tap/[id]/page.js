'use client'
import { useEffect, use, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Cookies from 'js-cookie'
import { db } from '@/lib/firebase'
import { doc, getDoc, addDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore'
import Papa from 'papaparse'
import { convertDriveLink } from '@/lib/driveUtils'
import { useHighlight } from '@/lib/useHighlight'
import HighlightToolbar from '@/app/components/HighlightToolbar'

const mauKyNang = {
  'Reading':   '#378ADD',
  'Listening': '#1D9E75',
  'Writing':   '#BA7517',
  'Speaking':  '#A32D2D',
}

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

  const { toolbar, applyHighlight, hideToolbar } = useHighlight(['content-panel', 'question-panel'])

  const [reviewAnswers, setReviewAnswers] = useState({})

  useEffect(() => {
    if (!Cookies.get('isLoggedIn')) router.push('/')
    loadInfo()
  }, [])

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
        Audios:   splitMedia(item.Audio, 'audio'),
      }))
      setQuestions(processedData)

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
    } catch (error) {
      console.error("Lỗi khi tải bài tập:", error)
    }
  }

  const soCauChuaLam = questions.length - Object.keys(answers).length

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
          const userParts = (userAns || []).map(s => s.trim().toLowerCase())
          if (correctParts.every((c, i) => c === userParts[i])) soCauDung++
        }
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
        tongCau: questions.length,
        thoiGianNop: new Date().toISOString(),
        trangThai: 'Đã nộp',
      })

      if (assignmentId) {
        await updateDoc(doc(db, 'assignments', assignmentId), {
          trangThai: 'Đã làm',
          thoiGianNop: new Date().toISOString(),
        })
      }

      setKetQua({ dung: soCauDung, tong: questions.length })
      setSubmitDone(true)
    } catch (err) {
      console.error('Lỗi khi nộp bài:', err)
      alert('Có lỗi xảy ra khi nộp bài. Vui lòng thử lại!')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getReviewBorderColor = (q, optKey) => {
    const userAns = reviewAnswers[q.globalIndex]
    const correct = q.Correct_Ans?.trim()
    if (!userAns) return '#F0A500'
    if (optKey === correct) return '#1D9E75'
    if (optKey === userAns) return '#E24B4A'
    return '#B5D4F4'
  }

  const currentCau = questions[cauHienTai]
  const currentGroup = currentCau?.Group
  const questionsInGroup = questions.filter(q => q.Group === currentGroup)
  const firstInGroup = questionsInGroup[0]
  const mauHeader = mauKyNang[exercise?.kyNang] || '#185FA5'

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

  if (!exercise || questions.length === 0) return (
    <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 56px)' }}>
      <p style={{ color: '#185FA5' }}>Đang tải bài tập...</p>
    </main>
  )

  return (
    <main style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Responsive styles ── */}
      <style>{`
        .bt-body {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        .bt-vung2-3 {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
        }
        .bt-vung2 {
          flex: 1.2;
          border-bottom: 1px solid #B5D4F4;
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .bt-vung3 {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 35px;
        }

        /* Desktop: vùng 2 và 3 nằm ngang cạnh nhau */
        @media (min-width: 769px) {
          .bt-vung1 {
            border-right: 1px solid #B5D4F4;
          }
          .bt-vung2 {
            border-right: 1px solid #B5D4F4;
            border-bottom: none;
            flex: 1.2;
          }
          .bt-vung2-3 {
            flex-direction: row;
          }
          .bt-vung3 {
            flex: 1;
          }
        }

        /* Mobile: vùng 1 ở trái hẹp, vùng 2 trên + vùng 3 dưới */
        @media (max-width: 768px) {
          .bt-vung1 {
            width: 48px !important;
            min-width: 48px !important;
            border-right: 1px solid #B5D4F4;
          }
          .bt-vung1 .so-cau {
            width: 28px !important;
            height: 28px !important;
            font-size: 11px !important;
          }
          .bt-vung2-3 {
            flex-direction: column;
            flex: 1;
          }
          .bt-vung2 {
            flex: none;
            max-height: 40%;
            border-right: none;
            border-bottom: 1px solid #B5D4F4;
            padding: 12px;
            overflow-y: auto;
          }
          .bt-vung3 {
            flex: 1;
            padding: 12px;
            gap: 16px;
            overflow-y: auto;
          }
          .bt-nav-btn {
            padding: 8px 4px !important;
            font-size: 12px !important;
          }
        }
      `}</style>

      {/* Dialog xác nhận nộp bài */}
      {showConfirm && !submitDone && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          backgroundColor: 'rgba(12,68,124,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px',
            padding: '32px', width: '340px', maxWidth: '90vw',
            display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: '0 8px 32px rgba(12,68,124,0.2)',
          }}>
            <h3 style={{ margin: 0, color: '#0C447C', textAlign: 'center' }}>Xác nhận nộp bài</h3>
            {soCauChuaLam > 0 ? (
              <div style={{ backgroundColor: '#FAEEDA', borderRadius: '10px', padding: '12px 16px', textAlign: 'center' }}>
                <span style={{ color: '#633806', fontSize: '14px', fontWeight: '500' }}>
                  ⚠️ Bạn còn <strong>{soCauChuaLam}</strong> câu chưa làm.
                </span>
              </div>
            ) : (
              <div style={{ backgroundColor: '#E1F5EE', borderRadius: '10px', padding: '12px 16px', textAlign: 'center' }}>
                <span style={{ color: '#085041', fontSize: '14px', fontWeight: '500' }}>
                  ✅ Bạn đã hoàn thành tất cả {questions.length} câu!
                </span>
              </div>
            )}
            <p style={{ margin: 0, color: '#555', fontSize: '14px', textAlign: 'center' }}>
              Sau khi nộp bạn không thể chỉnh sửa đáp án.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowConfirm(false)} style={btnSecondary}>Làm tiếp</button>
              <button onClick={handleNopBai} disabled={isSubmitting} style={{ ...btnPrimary, backgroundColor: '#1D9E75', opacity: isSubmitting ? 0.7 : 1 }}>
                {isSubmitting ? 'Đang nộp...' : 'Nộp bài'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog nộp thành công */}
      {submitDone && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          backgroundColor: 'rgba(12,68,124,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px',
            padding: '40px 32px', width: '340px', maxWidth: '90vw',
            display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center',
            boxShadow: '0 8px 32px rgba(12,68,124,0.2)',
          }}>
            <div style={{ fontSize: '48px' }}>🎉</div>
            <h3 style={{ margin: 0, color: '#0C447C', textAlign: 'center' }}>Nộp bài thành công!</h3>
            <p style={{ fontSize: '20px', fontWeight: '700', color: '#1D9E75', margin: 0 }}>
              {ketQua?.dung} / {ketQua?.tong} câu đúng
            </p>
            <button onClick={() => router.push('/trang-chu')} style={{ ...btnPrimary, width: '100%' }}>
              Về trang chủ
            </button>
          </div>
        </div>
      )}

      {/* Header bài tập */}
      <div style={{
        backgroundColor: isReview ? '#6B7280' : mauHeader,
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0,
      }}>
        <span style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>
          {exercise.loaiBai} · {exercise.kyNang}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>—</span>
        <span style={{ color: 'white', fontSize: '14px' }}>{exercise.tenBaiTap}</span>

        {isReview && (
          <span style={{
            padding: '3px 10px', borderRadius: '20px',
            backgroundColor: 'rgba(255,255,255,0.2)', color: 'white',
            fontSize: '12px', fontWeight: '500',
          }}>
            Chế độ xem lại
          </span>
        )}

        <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
          Câu {cauHienTai + 1} / {questions.length}
        </span>

        {!isReview && (
          <button
            onClick={() => setShowConfirm(true)}
            style={{
              marginLeft: '12px', padding: '7px 18px', borderRadius: '8px',
              border: '2px solid white', backgroundColor: 'transparent',
              color: 'white', fontSize: '13px', fontWeight: '600',
              cursor: 'pointer', transition: 'background-color 0.2s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Nộp bài ✓
          </button>
        )}
      </div>

      {/* ── Body: Vùng 1 + (Vùng 2 & 3) ── */}
      <div className="bt-body">

        {/* Vùng 1: Số câu */}
        <div
          className="bt-vung1"
          style={{
            width: '72px', minWidth: '72px',
            backgroundColor: '#E6F1FB',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '12px 0', gap: '6px', overflowY: 'auto',
          }}
        >
          {questions.map((q, i) => {
            let bgColor = 'white', textColor = '#378ADD', borderColor = '#B5D4F4'

            if (i === cauHienTai) {
              bgColor = '#185FA5'; textColor = 'white'; borderColor = '#185FA5'
            } else if (isReview) {
              const userAns = reviewAnswers[i]
              const correct = q.Correct_Ans?.trim()
              if (!userAns) {
                bgColor = '#FEF3C7'; textColor = '#92400E'; borderColor = '#F0A500'
              } else if (userAns === correct) {
                bgColor = '#E1F5EE'; textColor = '#085041'; borderColor = '#9FE1CB'
              } else {
                bgColor = '#FCEBEB'; textColor = '#791F1F'; borderColor = '#F9A8A8'
              }
            } else if (answers[i]) {
              bgColor = '#E1F5EE'; textColor = '#085041'; borderColor = '#9FE1CB'
            }

            return (
              <div
                key={i}
                className="so-cau"
                onClick={() => setCauHienTai(i)}
                style={{
                  width: '36px', height: '36px', borderRadius: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                  backgroundColor: bgColor, color: textColor,
                  border: `1px solid ${borderColor}`,
                  transition: 'all 0.2s',
                }}
              >
                {i + 1}
              </div>
            )
          })}

          {!isReview && (
            <>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setShowConfirm(true)}
                style={{
                  width: '48px', padding: '8px 0', borderRadius: '8px', border: 'none',
                  backgroundColor: '#1D9E75', color: 'white',
                  fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                  marginBottom: '4px', lineHeight: '1.3',
                }}
              >
                Nộp<br/>bài
              </button>
            </>
          )}
        </div>

        {/* Vùng 2 + Vùng 3 wrapper */}
        <div className="bt-vung2-3">

          {/* Vùng 2: Nội dung (audio / hình) */}
          <div className="bt-vung2">
            {firstInGroup?.Audios?.map((src, i) => (
              <iframe
                key={src + i}
                src={src}
                width="100%" height="80"
                style={{ border: 'none', borderRadius: '8px' }}
              />
            ))}

            {firstInGroup?.Contexts?.map((ctx, i) => (
              <div key={i} style={{ fontSize: '14px', lineHeight: '1.8', color: '#0C447C', whiteSpace: 'pre-wrap' }}>
                {ctx.startsWith('http')
                  ? <img src={ctx} style={{ maxWidth: '100%', borderRadius: '8px' }} alt={`Hình ${i + 1}`} />
                  : ctx
                }
              </div>
            ))}

            {!firstInGroup?.Audios?.length && !firstInGroup?.Contexts?.length && (
              <p style={{ color: '#B5D4F4', fontSize: '14px' }}>Không có nội dung chung cho nhóm này</p>
            )}
          </div>

          {/* Vùng 3: Câu hỏi & Đáp án */}
          <div className="bt-vung3">
            {questionsInGroup.map((q) => (
              <div
                key={q.globalIndex}
                style={{
                  display: 'flex', flexDirection: 'column', gap: '12px',
                  backgroundColor: q.globalIndex === cauHienTai ? '#F8FBFF' : 'transparent',
                  padding: '10px', borderRadius: '8px',
                }}
              >
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#185FA5' }}>
                  Câu {q.globalIndex + 1}: {q.Question}
                </p>

                {(q.Question_Type === 'mcq' || q.Question_Type === 'mcq_blank') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {q.Question_Type === 'mcq'
                      ? getOptions(q).map(opt => {
                          const border = isReview
                            ? getReviewBorderColor(q, opt.key)
                            : (answers[q.globalIndex] === opt.key ? '#185FA5' : '#B5D4F4')
                          const bg = isReview
                            ? (opt.key === q.Correct_Ans?.trim() ? '#E1F5EE'
                              : opt.key === reviewAnswers[q.globalIndex] ? '#FCEBEB'
                              : !reviewAnswers[q.globalIndex] ? '#FFFBEB'
                              : 'white')
                            : (answers[q.globalIndex] === opt.key ? '#E6F1FB' : 'white')
                          const color = isReview
                            ? (opt.key === q.Correct_Ans?.trim() ? '#085041'
                              : opt.key === reviewAnswers[q.globalIndex] ? '#791F1F'
                              : '#378ADD')
                            : (answers[q.globalIndex] === opt.key ? '#0C447C' : '#378ADD')
                          return (
                            <div
                              key={opt.key}
                              onClick={() => chonDapAn(q.globalIndex, opt.key)}
                              style={{
                                padding: '10px 14px', borderRadius: '8px',
                                border: `1.5px solid ${border}`,
                                backgroundColor: bg, color,
                                fontSize: '14px',
                                cursor: isReview ? 'default' : 'pointer',
                                transition: 'all 0.15s',
                              }}
                            >
                              {opt.key}. {opt.value}
                            </div>
                          )
                        })
                      : ['A', 'B', 'C', 'D'].slice(0, parseInt(q.Num_Answers) || 4).map(key => {
                          const border = isReview
                            ? getReviewBorderColor(q, key)
                            : (answers[q.globalIndex] === key ? '#185FA5' : '#B5D4F4')
                          const bg = isReview
                            ? (key === q.Correct_Ans?.trim() ? '#E1F5EE'
                              : key === reviewAnswers[q.globalIndex] ? '#FCEBEB'
                              : !reviewAnswers[q.globalIndex] ? '#FFFBEB'
                              : 'white')
                            : (answers[q.globalIndex] === key ? '#E6F1FB' : 'white')
                          const color = isReview
                            ? (key === q.Correct_Ans?.trim() ? '#085041'
                              : key === reviewAnswers[q.globalIndex] ? '#791F1F'
                              : '#888')
                            : (answers[q.globalIndex] === key ? '#0C447C' : '#888')
                          return (
                            <div
                              key={key}
                              onClick={() => chonDapAn(q.globalIndex, key)}
                              style={{
                                padding: '10px 14px', borderRadius: '8px',
                                border: `1.5px solid ${border}`,
                                backgroundColor: bg, color,
                                fontSize: '14px', cursor: isReview ? 'default' : 'pointer',
                                fontWeight: '600', textAlign: 'center',
                              }}
                            >
                              {key}
                            </div>
                          )
                        })
                    }
                  </div>
                )}

                {q.Question_Type === 'fill_short' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Array.from({ length: parseInt(q.Num_Answers) || 1 }, (_, i) => (
                      <input
                        key={i} type="text"
                        placeholder={`Đáp án ${parseInt(q.Num_Answers) > 1 ? i + 1 : ''}`}
                        value={isReview ? (reviewAnswers[q.globalIndex]?.[i] || '') : (answers[q.globalIndex]?.[i] || '')}
                        readOnly={isReview}
                        onChange={(e) => {
                          if (isReview) return
                          const prev = answers[q.globalIndex] || []
                          const newArr = [...prev]
                          newArr[i] = e.target.value
                          setAnswers(a => ({ ...a, [q.globalIndex]: newArr }))
                        }}
                        style={{
                          padding: '10px 14px', borderRadius: '8px',
                          border: '1px solid #B5D4F4', outline: 'none',
                          backgroundColor: isReview ? '#F8FBFF' : 'white',
                        }}
                      />
                    ))}
                  </div>
                )}

                {q.Question_Type === 'fill_long' && (
                  <textarea
                    placeholder="Nhập bài làm của bạn..."
                    value={isReview ? (reviewAnswers[q.globalIndex] || '') : (answers[q.globalIndex] || '')}
                    readOnly={isReview}
                    onChange={(e) => {
                      if (isReview) return
                      setAnswers(a => ({ ...a, [q.globalIndex]: e.target.value }))
                    }}
                    style={{
                      padding: '10px 14px', borderRadius: '8px',
                      border: '1px solid #B5D4F4', minHeight: '120px',
                      resize: 'vertical', outline: 'none',
                      backgroundColor: isReview ? '#F8FBFF' : 'white',
                    }}
                  />
                )}
              </div>
            ))}

            {/* Nút điều hướng */}
            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', padding: '10px 0' }}>
              <button
                className="bt-nav-btn"
                onClick={() => setCauHienTai(i => Math.max(0, i - 1))}
                disabled={cauHienTai === 0}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #B5D4F4',
                  backgroundColor: 'white', color: '#378ADD',
                  cursor: cauHienTai === 0 ? 'not-allowed' : 'pointer',
                  opacity: cauHienTai === 0 ? 0.4 : 1, fontWeight: '500',
                }}
              >
                ← Trước
              </button>

              {!isReview && cauHienTai === questions.length - 1 ? (
                <button
                  className="bt-nav-btn"
                  onClick={() => setShowConfirm(true)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
                    backgroundColor: '#1D9E75', color: 'white',
                    fontWeight: '600', cursor: 'pointer', fontSize: '14px',
                  }}
                >
                  Nộp bài ✓
                </button>
              ) : (
                <button
                  className="bt-nav-btn"
                  onClick={() => setCauHienTai(i => Math.min(questions.length - 1, i + 1))}
                  disabled={cauHienTai === questions.length - 1}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
                    backgroundColor: '#378ADD', color: 'white',
                    cursor: cauHienTai === questions.length - 1 ? 'not-allowed' : 'pointer',
                    opacity: cauHienTai === questions.length - 1 ? 0.4 : 1, fontWeight: '500',
                  }}
                >
                  Tiếp →
                </button>
              )}
            </div>
          </div>

        </div>{/* end bt-vung2-3 */}
      </div>{/* end bt-body */}
      <HighlightToolbar
        toolbar={toolbar}
        onHighlight={applyHighlight}
        onClose={hideToolbar}
      />
    </main>
  )
}

const btnPrimary = {
  flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
  backgroundColor: '#185FA5', color: 'white',
  fontWeight: '600', cursor: 'pointer', fontSize: '14px',
}

const btnSecondary = {
  flex: 1, padding: '12px', borderRadius: '8px',
  border: '1px solid #B5D4F4', backgroundColor: 'white',
  color: '#378ADD', fontWeight: '500', cursor: 'pointer', fontSize: '14px',
}
