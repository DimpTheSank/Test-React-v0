'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'

const USERS = [
  {
    taiKhoan: 'try',
    matKhau: 'try',
    ho: 'Nguyễn Văn',
    ten: 'An',
    vaiTro: 'Học viên',
    lop: '10A1',
  },
]

export default function Home() {
  const [hover, setHover] = useState(false)
  const [taiKhoan, setTaiKhoan] = useState('')
  const [matKhau, setMatKhau] = useState('')
  const [loi, setLoi] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (Cookies.get('isLoggedIn')) router.push('/trang-chu')
  }, [])

  const handleLogin = () => {
    const user = USERS.find(u => u.taiKhoan === taiKhoan && u.matKhau === matKhau)
    if (user) {
      Cookies.set('isLoggedIn', 'true', { expires: 7 })
      Cookies.set('userInfo', JSON.stringify({
        ho: user.ho,
        ten: user.ten,
        vaiTro: user.vaiTro,
        lop: user.lop,
        lanCuoiTruyCap: new Date().toISOString(),
      }), { expires: 7 })
      router.push('/trang-chu')
    } else {
      setLoi('Thông tin đăng nhập sai')
    }
  }

  return (
    <main style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 'calc(100vh - 56px)',
    }}>
      <div style={{
        border: '1px solid #B5D4F4',
        borderRadius: '16px',
        padding: '40px',
        width: '360px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        backgroundColor: '#E6F1FB',
      }}>
        <h2 style={{ margin: 0, textAlign: 'center', color: '#0C447C' }}>Đăng nhập</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ color: '#185FA5', fontSize: '14px' }}>Tài khoản</label>
          <input
            type="text"
            placeholder="Nhập tài khoản"
            value={taiKhoan}
            onChange={(e) => { setTaiKhoan(e.target.value); setLoi('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #85B7EB',
              fontSize: '14px',
              backgroundColor: 'white',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ color: '#185FA5', fontSize: '14px' }}>Mật khẩu</label>
          <input
            type="password"
            placeholder="Nhập mật khẩu"
            value={matKhau}
            onChange={(e) => { setMatKhau(e.target.value); setLoi('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #85B7EB',
              fontSize: '14px',
              backgroundColor: 'white',
              outline: 'none',
            }}
          />
        </div>

        {loi && (
          <p style={{ margin: 0, color: '#E24B4A', fontSize: '14px', textAlign: 'center' }}>
            {loi}
          </p>
        )}

        <button
          onClick={handleLogin}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            padding: '12px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: hover ? '#0C447C' : '#378ADD',
            color: 'white',
            fontSize: '15px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          Đăng nhập
        </button>
      </div>
    </main>
  )
}