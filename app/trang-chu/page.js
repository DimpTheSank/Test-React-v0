'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'

export default function TrangChu() {
  const router = useRouter()
  const [baiTapList, setBaiTapList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!Cookies.get('isLoggedIn')) {
      router.push('/')
      return
    }
    loadBaiTap()
  }, [])

  const loadBaiTap = async () => {
    try {
      const userInfo = JSON.parse(decodeURIComponent(
        document.cookie.split('; ').find(r => r.startsWith('userInfo='))?.split('=')[1]
      ))

      // Lấy assignments của user này
      const assignQuery = query(
        collection(db, 'assignments'),
        where('userId', '==', userInfo.taiKhoan || Cookies.get('userId'))
      )
      const assignSnap = await getDocs(assignQuery)

      // Lấy chi tiết từng exercise
      const baiTapData = await Promise.all(
        assignSnap.docs.map(async (assignDoc) => {
          const assign = assignDoc.data()
          const exSnap = await getDoc(doc(db, 'exercises', assign.exerciseId))
          return {
            id: assignDoc.id,
            exerciseId: assign.exerciseId,
            thoiGianGiao: assign.thoiGianGiao,
            ...exSnap.data(),
            trangThai: 'Chưa làm', // sau này lấy từ submissions
            diem: null,
          }
        })
      )

      setBaiTapList(baiTapData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 56px)' }}>
      <p style={{ color: '#185FA5' }}>Đang tải...</p>
    </main>
  )

  return (
    <main style={{ padding: '24px 16px', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '20px', color: '#0C447C' }}>Bài tập của tôi</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {baiTapList.length === 0
          ? <p style={{ color: '#888' }}>Chưa có bài tập nào được giao.</p>
          : baiTapList.map(bai => <CardBaiTap key={bai.id} bai={bai} />)
        }
      </div>
    </main>
  )
}