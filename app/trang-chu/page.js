'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'

const mauTrangThai = {
  'Đã làm':   { bg: '#E1F5EE', text: '#085041' },
  'Đang làm': { bg: '#FAEEDA', text: '#633806' },
  'Chưa làm': { bg: '#FCEBEB', text: '#791F1F' },
}

const mauKyNang = {
  'Reading':  { bg: '#378ADD', text: 'white' },
  'Listening': { bg: '#1D9E75', text: 'white' },
  'Writing':  { bg: '#BA7517', text: 'white' },
  'Speaking': { bg: '#A32D2D', text: 'white' },
}

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
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',  // xuống hàng khi hết chỗ
        gap: '16px',
      }}>
        {baiTapList.map(bai => <CardBaiTap key={bai.id} bai={bai} />)}
      </div>
    </main>
  )
}


function CardBaiTap({ bai }) {
  const [hover, setHover] = useState(false)
  const mau = mauTrangThai[bai.trangThai] || mauTrangThai['Chưa làm']
  const mauHeader = mauKyNang[bai.kyNang] || { bg: '#185FA5', text: 'white' }
  const router = useRouter()

  return (
    <div style={{
      border: '1px solid #B5D4F4',
      borderRadius: '16px',
      width: '160px',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'white',
      overflow: 'hidden',
    }}>
      {/* Thanh tiêu đề */}
      <div style={{
        backgroundColor: mauHeader.bg,
        padding: '8px 12px',
        textAlign: 'center',
      }}>
        <span style={{
          color: mauHeader.text,
          fontSize: '12px',
          fontWeight: '600',
          letterSpacing: '0.5px',
        }}>
          {bai.loaiBai} · {bai.kyNang}
        </span>
      </div>

      {/* Nội dung */}
      <div style={{
        padding: '14px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        flex: 1,
      }}>
        {/* Tên bài */}
        <p style={{
          margin: 0,
          fontWeight: '600',
          fontSize: '14px',
          color: '#0C447C',
          lineHeight: '1.4',
        }}>
          {bai.tenBaiTap}
        </p>

        {/* Trạng thái */}
        <div style={{
          padding: '3px 10px',
          borderRadius: '20px',
          backgroundColor: mau.bg,
          color: mau.text,
          fontSize: '12px',
          fontWeight: '500',
          alignSelf: 'flex-start',
        }}>
          {bai.trangThai}
        </div>

        {/* Điểm */}
        <p style={{
          margin: 0,
          fontSize: '13px',
          color: bai.diem !== null ? '#1D9E75' : '#B5D4F4',
          fontWeight: '500',
        }}>
          {bai.diem !== null ? `${bai.diem} / ${bai.diemToiDa}` : '— / —'}
        </p>

        {/* Nút làm bài */}
        <button
          onClick={() => router.push(`/bai-tap/${bai.exerciseId}`)}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            marginTop: 'auto',
            padding: '8px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: hover ? '#0C447C' : '#378ADD',
            color: 'white',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            width: '100%',
          }}
        >
          Làm bài
        </button>
      </div>
    </div>
  )
}