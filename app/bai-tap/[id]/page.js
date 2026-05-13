'use client'
import { useEffect, use, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import Papa from 'papaparse'

export default function BaiTap({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [exercise, setExercise] = useState(null)
  const [questions, setQuestions] = useState([])

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

    const { data } = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    })

    console.log('Số câu:', data.length)
    console.log('Câu 1:', data[0])
    setQuestions(data)
  }

  return (
    <main style={{ padding: '24px' }}>
      {exercise && (
        <p style={{ color: '#0C447C', fontWeight: '600' }}>
          {exercise.loaiBai} · {exercise.kyNang} — {exercise.tenBaiTap}
        </p>
      )}
      <p style={{ color: '#185FA5' }}>
        Số câu: {questions.length}
      </p>
    </main>
  )
}