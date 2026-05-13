'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { readExcelFromDrive } from '@/lib/readExcel'

export default function BaiTap({ params }) {
  const router = useRouter()
  const [questions, setQuestions] = useState([])
  const [exercise, setExercise] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { id } = use(params)

  useEffect(() => {
    if (!Cookies.get('isLoggedIn')) {
      router.push('/')
      return
    }
    loadBaiTap()
  }, [])

  const loadBaiTap = async () => {
    try {
      // Lấy thông tin exercise từ Firestore
      const exSnap = await getDoc(doc(db, 'exercises', id))
      if (!exSnap.exists()) {
        setError('Không tìm thấy bài tập')
        return
      }

      const exData = exSnap.data()
      setExercise(exData)

      // Đọc file Excel từ Drive
      const qs = await readExcelFromDrive(exData.linkDrive)
      setQuestions(qs)
    } catch (err) {
      console.error(err)
      setError('Không thể tải bài tập, thử lại sau')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 56px)' }}>
      <p style={{ color: '#185FA5' }}>Đang tải bài tập...</p>
    </main>
  )

  if (error) return (
    <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 56px)' }}>
      <p style={{ color: '#E24B4A' }}>{error}</p>
    </main>
  )

  return (
    <main style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
      <p>Đã load {questions.length} câu</p>
      {/* Sau này render 3 vùng ở đây */}
    </main>
  )
}