'use client'
import { useEffect, use, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import Papa from 'papaparse'
import { convertDriveLink } from '@/lib/driveUtils'

const mauKyNang = {
  'Reading':   '#378ADD',
  'Listening': '#1D9E75',
  'Writing':   '#BA7517',
  'Speaking':  '#A32D2D',
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

  const mauHeader = mauKyNang[exercise?.kyNang] || '#185FA5'

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
      <p style={{ color: '#185FA5' }}>Đang tải bài tập...</p>
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
        <span style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>
          {exercise.loaiBai} · {exercise.kyNang}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>—</span>
        <span style={{ color: 'white', fontSize: '14px' }}>{exercise.tenBaiTap}</span>
        <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
          Câu {cauHienTai + 1} / {questions.length}
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Vùng 1: Số câu */}
        <div style={{
          width: '72px', minWidth: '72px',
          borderRight: '1px solid #B5D4F4', backgroundColor: '#E6F1FB',
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
                backgroundColor: i === cauHienTai ? '#185FA5' : answers[i] ? '#E1F5EE' : 'white',
                color: i === cauHienTai ? 'white' : answers[i] ? '#085041' : '#378ADD',
                border: `1px solid ${i === cauHienTai ? '#185FA5' : answers[i] ? '#9FE1CB' : '#B5D4F4'}`,
                transition: 'all 0.2s'
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Vùng 2: Nội dung */}
        <div style={{
          flex: 1.2, borderRight: '1px solid #B5D4F4',
          padding: '20px', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          {firstInGroup?.Audio && (
            <iframe
              key={firstInGroup.Audio}
              src={firstInGroup.Audio}
              width="100%"
              height="80"
              style={{ border: 'none', borderRadius: '8px' }}
            />
          )}
          {firstInGroup?.Context && (
            <div style={{ fontSize: '14px', lineHeight: '1.8', color: '#0C447C', whiteSpace: 'pre-wrap' }}>
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
            <p style={{ color: '#B5D4F4', fontSize: '14px' }}>Không có nội dung chung cho nhóm này</p>
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
                backgroundColor: q.globalIndex === cauHienTai ? '#F8FBFF' : 'transparent',
                padding: '10px',
                borderRadius: '8px'
              }}
            >
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#185FA5' }}>
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
                            border: `1px solid ${answers[q.globalGlobalIndex || q.globalIndex] === opt.key ? '#185FA5' : '#B5D4F4'}`,
                            backgroundColor: answers[q.globalIndex] === opt.key ? '#E6F1FB' : 'white',
                            color: answers[q.globalIndex] === opt.key ? '#0C447C' : '#378ADD',
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
                            border: `1px solid ${answers[q.globalIndex] === key ? '#185FA5' : '#B5D4F4'}`,
                            backgroundColor: answers[q.globalIndex] === key ? '#E6F1FB' : 'white',
                            color: answers[q.globalIndex] === key ? '#0C447C' : '#888',
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
                      style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #B5D4F4', outline: 'none' }}
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
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #B5D4F4', minHeight: '120px', resize: 'vertical', outline: 'none' }}
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
                flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #B5D4F4',
                backgroundColor: 'white', color: '#378ADD', cursor: cauHienTai === 0 ? 'not-allowed' : 'pointer',
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
                backgroundColor: '#378ADD', color: 'white', cursor: cauHienTai === questions.length - 1 ? 'not-allowed' : 'pointer',
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