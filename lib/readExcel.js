'use client'
import { useEffect, use, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import Papa from 'papaparse'
import { convertDriveLink } from '@/lib/driveUtils'

const mauKyNang = {
  'Reading':   'var(--c-primary-mid)',
  'Listening': 'var(--c-success)',
  'Writing':   'var(--c-writing)',
  'Speaking':  'var(--c-speaking)',
}

export default function BaiTap({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [exercise, setExercise] = useState(null)
  const [questions, setQuestions] = useState([])
  const [cauHienTai, setCauHienTai] = useState(0)
  const [answers, setAnswers] = useState({}) 

  useEffect(() => {
    if (!Cookies.get('isLoggedIn')) router.push('/')
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
      const response = await fetch(csvUrl)
      const text = await response.text()
      
      const { data } = Papa.parse(text, { 
        header: true, 
        skipEmptyLines: true,
        transform: (val, col) => (col === 'Group' ? val.trim() : val)
      })
      
      const processedData = data.map((item, index) => ({ 
        ...item, 
        globalIndex: index,
        // Đảm bảo link được convert ngay khi load để render mượt hơn
        Context: convertDriveLink(item.Context, 'image'),
        Audio: convertDriveLink(item.Audio, 'audio')
      }))
      setQuestions(processedData)
    } catch (error) {
      console.error("Lỗi khi tải bài tập:", error)
    }
  }

  const currentCau = questions[cauHienTai]
  const currentGroup = currentCau?.Group
  const questionsInGroup = questions.filter(q => q.Group === currentGroup)
  const firstInGroup = questionsInGroup[0] 

  const mauHeader = mauKyNang[exercise?.kyNang] || 'var(--c-primary)'

  const getOptions = (q) => {
    if (!q) return []
    return ['A', 'B', 'C', 'D', 'E']
      .map(k => ({ key: k, value: q[`Opt_${k}`] }))
      .filter(o => o.value && o.value.trim() !== '')
  }

  const chonDapAn = (index, key) => {
    setAnswers(prev => ({ ...prev, [index]: key }))
  }

  if (!exercise || questions.length === 0) return (
    <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 56px)' }}>
      <p style={{ color: 'var(--c-primary)' }}>Đang tải bài tập...</p>
    </main>
  )

  return (
    <main style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>

      {/* Header bài tập */}
      <div style={{
        backgroundColor: mauHeader,
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <span style={{ color: 'var(--c-surface)', fontWeight: '600', fontSize: '14px' }}>
          {exercise.loaiBai} · {exercise.kyNang}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>—</span>
        <span style={{ color: 'var(--c-surface)', fontSize: '14px' }}>{exercise.tenBaiTap}</span>
        <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
          Câu {cauHienTai + 1} / {questions.length}
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Vùng 1: Số câu */}
        <div style={{
          width: '72px', minWidth: '72px',
          borderRight: '1px solid var(--c-primary-pale)', backgroundColor: 'var(--c-primary-bg)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '12px 0', gap: '6px', overflowY: 'auto',
        }}>
          {questions.map((_, i) => (
            <div
              key={i}
              onClick={() => setCauHienTai(i)}
              style={{
                width: '36px', height: '36px', borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                backgroundColor: i === cauHienTai ? 'var(--c-primary)' : answers[i] ? 'var(--c-success-bg)' : 'var(--c-surface)',
                color: i === cauHienTai ? 'var(--c-surface)' : answers[i] ? 'var(--c-success-text)' : 'var(--c-primary-mid)',
                border: `1px solid ${i === cauHienTai ? 'var(--c-primary)' : answers[i] ? 'var(--c-success-border)' : 'var(--c-primary-pale)'}`,
                transition: 'all 0.2s'
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Vùng 2: Nội dung */}
        <div style={{
          flex: 1.2, borderRight: '1px solid var(--c-primary-pale)',
          padding: '20px', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          {/* QUAN TRỌNG: Thêm key cho audio để nó reset khi đổi group */}
          {firstInGroup?.Audio && (
            <audio key={firstInGroup.Audio} controls style={{ width: '100%' }}crossOrigin="anonymous">
              <source src={firstInGroup.Audio} type="audio/mpeg"/>
            </audio>
          )}
          {firstInGroup?.Context && (
            <div style={{ fontSize: '14px', lineHeight: '1.8', color: 'var(--c-primary-dark)', whiteSpace: 'pre-wrap' }}>
              {firstInGroup.Context.startsWith('http')
                ? <img 
                    src={firstInGroup.Context} 
                    style={{ maxWidth: '100%', borderRadius: '8px' }} 
                    alt="Exercise content"
                    onError={(e) => console.error("Không thể load ảnh từ Drive:", e)} 
                  />
                : firstInGroup.Context
              }
            </div>
          )}
          {!firstInGroup?.Context && !firstInGroup?.Audio && (
            <p style={{ color: 'var(--c-primary-pale)', fontSize: '14px' }}>Không có nội dung chung cho nhóm này</p>
          )}
        </div>

        {/* Vùng 3: Câu hỏi & Đáp án */}
        <div style={{
          flex: 1, padding: '20px', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: '35px',
        }}>
          {questionsInGroup.map((q) => (
            <div 
              key={q.globalIndex} 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '12px',
                // Highlight nhẹ câu đang được chọn trong group
                backgroundColor: q.globalIndex === cauHienTai ? 'var(--c-primary-barest)' : 'transparent',
                padding: '10px',
                borderRadius: '8px'
              }}
            >
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--c-primary)' }}>
                Câu {q.globalIndex + 1}: {q.Question}
              </p>

              {/* MCQ / MCQ BLANK */}
              {(q.Question_Type === 'mcq' || q.Question_Type === 'mcq_blank') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {q.Question_Type === 'mcq'
                    ? getOptions(q).map(opt => (
                        <div
                          key={opt.key}
                          onClick={() => chonDapAn(q.globalIndex, opt.key)}
                          style={{
                            padding: '10px 14px', borderRadius: '8px',
                            border: `1px solid ${answers[q.globalGlobalIndex || q.globalIndex] === opt.key ? 'var(--c-primary)' : 'var(--c-primary-pale)'}`,
                            backgroundColor: answers[q.globalIndex] === opt.key ? 'var(--c-primary-bg)' : 'var(--c-surface)',
                            color: answers[q.globalIndex] === opt.key ? 'var(--c-primary-dark)' : 'var(--c-primary-mid)',
                            fontSize: '14px', cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          {opt.key}. {opt.value}
                        </div>
                      ))
                    : ['A', 'B', 'C', 'D'].slice(0, parseInt(q.Num_Answers) || 4).map(key => (
                        <div
                          key={key}
                          onClick={() => chonDapAn(q.globalIndex, key)}
                          style={{
                            padding: '10px 14px', borderRadius: '8px',
                            border: `1px solid ${answers[q.globalIndex] === key ? 'var(--c-primary)' : 'var(--c-primary-pale)'}`,
                            backgroundColor: answers[q.globalIndex] === key ? 'var(--c-primary-bg)' : 'var(--c-surface)',
                            color: answers[q.globalIndex] === key ? 'var(--c-primary-dark)' : 'var(--c-text-muted)',
                            fontSize: '14px', cursor: 'pointer', fontWeight: '600', textAlign: 'center'
                          }}
                        >
                          {key}
                        </div>
                      ))
                  }
                </div>
              )}

              {/* Fill short */}
              {q.Question_Type === 'fill_short' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Array.from({ length: parseInt(q.Num_Answers) || 1 }, (_, i) => (
                    <input
                      key={i} type="text"
                      placeholder={`Đáp án ${parseInt(q.Num_Answers) > 1 ? i + 1 : ''}`}
                      value={answers[q.globalIndex]?.[i] || ''}
                      onChange={(e) => {
                        const prev = answers[q.globalIndex] || []
                        const newArr = [...prev]
                        newArr[i] = e.target.value
                        setAnswers(a => ({ ...a, [q.globalIndex]: newArr }))
                      }}
                      style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--c-primary-pale)', outline: 'none' }}
                    />
                  ))}
                </div>
              )}

              {/* Fill long */}
              {q.Question_Type === 'fill_long' && (
                <textarea
                  placeholder="Nhập bài làm của bạn..."
                  value={answers[q.globalIndex] || ''}
                  onChange={(e) => setAnswers(a => ({ ...a, [q.globalIndex]: e.target.value }))}
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--c-primary-pale)', minHeight: '120px', resize: 'vertical', outline: 'none' }}
                />
              )}
            </div>
          ))}

          {/* Nút điều hướng */}
          <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', padding: '10px 0' }}>
            <button
              onClick={() => setCauHienTai(i => Math.max(0, i - 1))}
              disabled={cauHienTai === 0}
              style={{
                flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--c-primary-pale)',
                backgroundColor: 'var(--c-surface)', color: 'var(--c-primary-mid)', cursor: cauHienTai === 0 ? 'not-allowed' : 'pointer',
                opacity: cauHienTai === 0 ? 0.4 : 1, fontWeight: '500'
              }}
            >
              ← Câu trước
            </button>
            <button
              onClick={() => setCauHienTai(i => Math.min(questions.length - 1, i + 1))}
              disabled={cauHienTai === questions.length - 1}
              style={{
                flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
                backgroundColor: 'var(--c-primary-mid)', color: 'var(--c-surface)', cursor: cauHienTai === questions.length - 1 ? 'not-allowed' : 'pointer',
                opacity: cauHienTai === questions.length - 1 ? 0.4 : 1, fontWeight: '500'
              }}
            >
              Câu tiếp →
            </button>
          </div>
        </div>

      </div>
    </main>
  )
}