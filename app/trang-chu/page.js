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
  'Đã làm':   { bg: '#E1F5EE', text: '#085041' },
  'Đang làm': { bg: '#FAEEDA', text: '#633806' },
  'Chưa làm': { bg: '#FCEBEB', text: '#791F1F' },
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
      <h2 style={{ marginBottom: '20px', color: '#0C447C' }}>Bài tập của tôi</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
      border: '1px solid #B5D4F4',
      borderRadius: '16px',
      padding: '20px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      backgroundColor: 'white',
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: '500', fontSize: '15px', color: '#0C447C' }}>
          {bai.ten}
        </p>
      </div>

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

      <div style={{
        minWidth: '70px',
        textAlign: 'center',
        fontSize: '15px',
        fontWeight: '500',
        color: bai.diem !== null ? '#1D9E75' : '#B5D4F4',
      }}>
        {bai.diem !== null ? `${bai.diem} / ${bai.diemToiDa}` : `— / ${bai.diemToiDa}`}
      </div>

      <button
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          padding: '8px 18px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: hover ? '#0C447C' : '#378ADD',
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