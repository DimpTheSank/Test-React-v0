'use client'
import { useEffect, use, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import Papa from 'papaparse'

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
  const [answers, setAnswers] = useState({}) // { index: 'A' hoặc 'text' }

  useEffect(() => {
    if (!Cookies.get('isLoggedIn')) router.push('/')
    loadInfo()
  }, [])

  const loadInfo = async () => {
    const exSnap = await getDoc(doc(db, 'exercises', id))
    const exData = exSnap.data()
    setExercise(exData)

    const fileId = exData.linkDrive.match(/\/d\/([a-zA-Z0-9_-]+)/)[1]
    const csvUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`
    const response = await fetch(csvUrl)
    const text = await response.text()
    const { data } = Papa.parse(text, { header: true, skipEmptyLines: true })
    setQuestions(data)
  }

  const cau = questions[cauHienTai]
  const mauHeader = mauKyNang[exercise?.kyNang] || '#185FA5'

  const getOptions = (cau) => {
    if (!cau) return []
    return ['A', 'B', 'C', 'D', 'E']
      .map(k => ({ key: k, value: cau[`Opt_${k}`] }))
      .filter(o => o.value && o.value.trim() !== '')
  }

  const chonDapAn = (key) => {
    setAnswers(prev => ({ ...prev, [cauHienTai]: key }))
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
          {cauHienTai + 1} / {questions.length}
        </span>
      </div>

      {/* 3 vùng chính */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Vùng 1: Số câu */}
        <div style={{
          width: '72px',
          minWidth: '72px',
          borderRight: '1px solid #B5D4F4',
          backgroundColor: '#E6F1FB',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 0',
          gap: '6px',
          overflowY: 'auto',
        }}>
          {questions.map((_, i) => (
            <div
              key={i}
              onClick={() => setCauHienTai(i)}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                backgroundColor: i === cauHienTai
                  ? '#185FA5'
                  : answers[i]
                  ? '#E1F5EE'
                  : 'white',
                color: i === cauHienTai
                  ? 'white'
                  : answers[i]
                  ? '#085041'
                  : '#378ADD',
                border: `1px solid ${i === cauHienTai ? '#185FA5' : answers[i] ? '#9FE1CB' : '#B5D4F4'}`,
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Vùng 2: Nội dung */}
        <div style={{
          flex: 1.2,
          borderRight: '1px solid #B5D4F4',
          padding: '20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          {cau?.Audio && (
            <audio controls style={{ width: '100%' }}>
              <source src={cau.Audio} />
            </audio>
          )}
          {cau?.Context && (
            <div style={{
              fontSize: '14px',
              lineHeight: '1.8',
              color: '#0C447C',
              whiteSpace: 'pre-wrap',
            }}>
              {cau.Context.startsWith('http')
                ? <img src={cau.Context} style={{ maxWidth: '100%', borderRadius: '8px' }} />
                : cau.Context
              }
            </div>
          )}
          {!cau?.Context && !cau?.Audio && (
            <p style={{ color: '#B5D4F4', fontSize: '14px' }}>Không có nội dung</p>
          )}
        </div>

        {/* Vùng 3: Câu hỏi & Đáp án */}
        <div style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          {cau?.Question && (
            <p style={{ margin: 0, fontSize: '14px', color: '#0C447C', lineHeight: '1.6' }}>
              {cau.Question}
            </p>
          )}

          {/* MCQ */}
          {(cau?.Question_Type === 'mcq' || cau?.Question_Type === 'mcq_blank') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cau.Question_Type === 'mcq'
                ? getOptions(cau).map(opt => (
                    <div
                      key={opt.key}
                      onClick={() => chonDapAn(opt.key)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: `1px solid ${answers[cauHienTai] === opt.key ? '#185FA5' : '#B5D4F4'}`,
                        backgroundColor: answers[cauHienTai] === opt.key ? '#E6F1FB' : 'white',
                        color: answers[cauHienTai] === opt.key ? '#0C447C' : '#378ADD',
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {opt.value}
                    </div>
                  ))
                : ['A', 'B', 'C', 'D'].slice(0, parseInt(cau.Num_Answers) || 4).map(key => (
                    <div
                      key={key}
                      onClick={() => chonDapAn(key)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: `1px solid ${answers[cauHienTai] === key ? '#185FA5' : '#B5D4F4'}`,
                        backgroundColor: answers[cauHienTai] === key ? '#E6F1FB' : 'white',
                        color: answers[cauHienTai] === key ? '#0C447C' : '#888',
                        fontSize: '14px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        transition: 'all 0.15s',
                      }}
                    >
                      {key}
                    </div>
                  ))
              }
            </div>
          )}

          {/* Fill short */}
          {cau?.Question_Type === 'fill_short' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Array.from({ length: parseInt(cau.Num_Answers) || 1 }, (_, i) => (
                <input
                  key={i}
                  type="text"
                  placeholder={`Đáp án ${parseInt(cau.Num_Answers) > 1 ? i + 1 : ''}`}
                  value={answers[cauHienTai]?.[i] || ''}
                  onChange={(e) => {
                    const prev = answers[cauHienTai] || []
                    const newArr = [...prev]
                    newArr[i] = e.target.value
                    setAnswers(a => ({ ...a, [cauHienTai]: newArr }))
                  }}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #B5D4F4',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              ))}
            </div>
          )}

          {/* Fill long */}
          {cau?.Question_Type === 'fill_long' && (
            <textarea
              placeholder="Nhập đáp án..."
              value={answers[cauHienTai] || ''}
              onChange={(e) => setAnswers(a => ({ ...a, [cauHienTai]: e.target.value }))}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #B5D4F4',
                fontSize: '14px',
                outline: 'none',
                minHeight: '160px',
                resize: 'vertical',
              }}
            />
          )}

          {/* Nút điều hướng */}
          <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
            <button
              onClick={() => setCauHienTai(i => Math.max(0, i - 1))}
              disabled={cauHienTai === 0}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #B5D4F4',
                backgroundColor: 'white',
                color: '#378ADD',
                fontSize: '14px',
                cursor: cauHienTai === 0 ? 'not-allowed' : 'pointer',
                opacity: cauHienTai === 0 ? 0.4 : 1,
              }}
            >
              ← Câu trước
            </button>
            <button
              onClick={() => setCauHienTai(i => Math.min(questions.length - 1, i + 1))}
              disabled={cauHienTai === questions.length - 1}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#378ADD',
                color: 'white',
                fontSize: '14px',
                cursor: cauHienTai === questions.length - 1 ? 'not-allowed' : 'pointer',
                opacity: cauHienTai === questions.length - 1 ? 0.4 : 1,
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