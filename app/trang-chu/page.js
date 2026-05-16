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
  'Reading':   { bg: '#378ADD', text: 'white' },
  'Listening': { bg: '#1D9E75', text: 'white' },
  'Writing':   { bg: '#BA7517', text: 'white' },
  'Speaking':  { bg: '#A32D2D', text: 'white' },
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
      const raw = document.cookie.split('; ').find(r => r.startsWith('userInfo='))?.split('=')[1]
      const userInfo = JSON.parse(decodeURIComponent(raw))
      const taiKhoan = userInfo.taiKhoan

      // 1. Lấy assignments của user
      const assignSnap = await getDocs(query(
        collection(db, 'assignments'),
        where('userId', '==', taiKhoan)
      ))

      // 2. Lấy tất cả submissions của user (1 lần duy nhất)
      const subSnap = await getDocs(query(
        collection(db, 'submissions'),
        where('userId', '==', taiKhoan)
      ))
      // Map: exerciseId -> submission data
      const subMap = {}
      subSnap.docs.forEach(d => {
        subMap[d.data().exerciseId] = d.data()
      })

      // 3. Lấy chi tiết từng exercise
      const baiTapData = await Promise.all(
        assignSnap.docs.map(async (assignDoc) => {
          const assign = assignDoc.data()
          const exSnap = await getDoc(doc(db, 'exercises', assign.exerciseId))
          const sub = subMap[assign.exerciseId]

          return {
            id: assignDoc.id,
            exerciseId: assign.exerciseId,
            thoiGianGiao: assign.thoiGianGiao,
            ...exSnap.data(),
            trangThai: sub ? 'Đã làm' : (assign.trangThai || 'Chưa làm'),
            diem: sub?.diem ?? null,
            tongCau: sub?.tongCau ?? null,
            thoiGianNop: sub?.thoiGianNop ?? null,
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

  const daDam = baiTapList.filter(b => b.trangThai === 'Đã làm').length
  const chuaLam = baiTapList.filter(b => b.trangThai === 'Chưa làm').length

  return (
    <main style={{ padding: '24px 16px', maxWidth: '860px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, color: '#0C447C' }}>Bài tập của tôi</h2>
        {/* Tóm tắt nhanh */}
        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          <span style={{
            padding: '4px 12px', borderRadius: '20px',
            backgroundColor: '#E1F5EE', color: '#085041', fontSize: '13px', fontWeight: '500'
          }}>
            ✅ Đã làm: {daDam}
          </span>
          <span style={{
            padding: '4px 12px', borderRadius: '20px',
            backgroundColor: '#FCEBEB', color: '#791F1F', fontSize: '13px', fontWeight: '500'
          }}>
            ⏳ Chưa làm: {chuaLam}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
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
  const daDam = bai.trangThai === 'Đã làm'

  const formatNgay = (iso) => {
    if (!iso) return null
    const d = new Date(iso)
    return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div style={{
      border: `1px solid ${daDam ? '#9FE1CB' : '#B5D4F4'}`,
      borderRadius: '16px',
      width: '160px',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'white',
      overflow: 'hidden',
    }}>
      {/* Thanh tiêu đề kỹ năng */}
      <div style={{ backgroundColor: mauHeader.bg, padding: '8px 12px', textAlign: 'center' }}>
        <span style={{ color: mauHeader.text, fontSize: '12px', fontWeight: '600', letterSpacing: '0.5px' }}>
          {bai.loaiBai} · {bai.kyNang}
        </span>
      </div>

      {/* Nội dung */}
      <div style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
        <p style={{ margin: 0, fontWeight: '600', fontSize: '14px', color: '#0C447C', lineHeight: '1.4' }}>
          {bai.tenBaiTap}
        </p>

        {/* Trạng thái */}
        <div style={{
          padding: '3px 10px', borderRadius: '20px',
          backgroundColor: mau.bg, color: mau.text,
          fontSize: '12px', fontWeight: '500', alignSelf: 'flex-start',
        }}>
          {bai.trangThai}
        </div>

        {/* Thời gian nộp nếu đã làm */}
        {bai.thoiGianNop && (
          <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>
            🕐 {formatNgay(bai.thoiGianNop)}
          </p>
        )}

        {/* Điểm */}
        <p style={{
          margin: 0, fontSize: '13px',
          color: bai.diem !== null ? '#1D9E75' : '#B5D4F4', fontWeight: '500',
        }}>
          {bai.diem !== null ? `${bai.diem} / ${bai.tongCau}` : '— / —'}
        </p>

        {/* Nút làm bài / xem lại */}
        <button
          onClick={() => router.push(`/bai-tap/${bai.exerciseId}`)}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            marginTop: 'auto', padding: '8px', borderRadius: '8px', border: 'none',
            backgroundColor: daDam
              ? (hover ? '#085041' : '#1D9E75')
              : (hover ? '#0C447C' : '#378ADD'),
            color: 'white', fontSize: '13px', fontWeight: '500',
            cursor: 'pointer', transition: 'background-color 0.2s', width: '100%',
          }}
        >
          {daDam ? 'Xem lại' : 'Làm bài'}
        </button>
      </div>
    </div>
  )
}