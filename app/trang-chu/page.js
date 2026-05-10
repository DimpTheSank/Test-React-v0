'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'

const BAI_TAP = [
  { id: 1, ten: 'Bài tập Toán chương 1', trangThai: 'Đã làm', diem: 8, diemToiDa: 10 },
  { id: 2, ten: 'Bài tập Văn tuần 3', trangThai: 'Đang làm', diem: null, diemToiDa: 10 },
  { id: 3, ten: 'Bài tập Anh Unit 5', trangThai: 'Chưa làm', diem: null, diemToiDa: 10 },
]

const mauTrangThai = {
  'Đã làm':   { bg: '#E6F4EA', text: '#2E7D32' },
  'Đang làm': { bg: '#FFF8E1', text: '#F57F17' },
  'Chưa làm': { bg: '#F3F3F3', text: '#757575' },
}

export default function TrangChu() {
  const router = useRouter()

  useEffect(() => {
    if (!Cookies.get('isLoggedIn')) router.push('/')
  }, [])

  return (
    <main style={{
      padding: '24px 16px',
      maxWidth: '800px',
      margin: '0 auto',
    }}>
      <h2 style={{ marginBottom: '20px' }}>Bài tập của tôi</h2>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {BAI_TAP.map(bai => (
          <CardBaiTap key={bai.id} bai={bai} />
        ))}
      </div>
    </main>
  )
}

function CardBaiTap({ bai }) {
  const [hover, setHover] = useState(false)
  const mau = mauTrangThai[bai.trangThai]

  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '16px',
      padding: '20px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      backgroundColor: 'white',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>

      {/* Tên bài tập */}
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: '600', fontSize: '15px' }}>{bai.ten}</p>
      </div>

      {/* Trạng thái */}
      <div style={{
        padding: '4px 12px',
        borderRadius: '20px',
        backgroundColor: mau.bg,
        color: mau.text,
        fontSize: '13px',
        fontWeight: '500',
        whiteSpace: 'nowrap',
      }}>
        {bai.trangThai}
      </div>

      {/* Điểm */}
      <div style={{
        minWidth: '70px',
        textAlign: 'center',
        fontSize: '15px',
        fontWeight: '600',
        color: bai.diem !== null ? '#3B9EE8' : '#bbb',
      }}>
        {bai.diem !== null ? `${bai.diem} / ${bai.diemToiDa}` : `— / ${bai.diemToiDa}`}
      </div>

      {/* Nút làm bài */}
      <button
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          padding: '8px 18px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: hover ? '#1a7fd4' : '#3B9EE8',
          color: 'white',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          whiteSpace: 'nowrap',
        }}
      >
        Làm bài
      </button>
    </div>
  )
}