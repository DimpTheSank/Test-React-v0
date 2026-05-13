'use client'
import { useEffect, use, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

export default function BaiTap({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [info, setInfo] = useState(null)

  useEffect(() => {
    if (!Cookies.get('isLoggedIn')) router.push('/')
    loadInfo()
  }, [])

  const loadInfo = async () => {
    // Lấy exercise từ Firestore
    const exSnap = await getDoc(doc(db, 'exercises', id))
    const exData = exSnap.data()
    console.log('Exercise:', exData)

    // Convert link Drive sang CSV
    const fileId = exData.linkDrive.match(/\/d\/([a-zA-Z0-9_-]+)/)[1]
    const csvUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`
    console.log('CSV URL:', csvUrl)

    // Fetch CSV
    const response = await fetch(csvUrl)
    const text = await response.text()
    console.log('CSV text:', text.slice(0, 300)) // in 300 ký tự đầu
  }

  return (
    <main style={{ padding: '24px' }}>
      <p style={{ color: '#185FA5' }}>
        {info ? info : 'Đang tải...'}
      </p>
    </main>
  )
}