'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'

export default function Home() {
  const [hover, setHover] = useState(false)
  const [taiKhoan, setTaiKhoan] = useState('')
  const [matKhau, setMatKhau] = useState('')
  const [loi, setLoi] = useState('')
  const router = useRouter()

  const handleLogin = () => {
    if (taiKhoan === 'try' && matKhau === 'try') {
      Cookies.set('isLoggedIn', 'true', { expires: 7 }) // lưu 7 ngày
      router.push('/trang-chu')
    } else {
      setLoi('Thông tin đăng nhập sai')
    }
  }
  useEffect(() => {
    const isLoggedIn = Cookies.get('isLoggedIn')
    if (isLoggedIn) {
      router.push('/trang-chu') // đã đăng nhập → vào thẳng trang chủ
    }
  }, [])
  return (
    <main style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 'calc(100vh - 56px)',
    }}>
      <div style={{
        border: '1px solid #ddd',
        borderRadius: '16px',
        padding: '40px',
        width: '360px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <h2 style={{ margin: 0, textAlign: 'center' }}>Đăng nhập</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label>Tài khoản</label>
          <input
            type="text"
            placeholder="Nhập tài khoản"
            value={taiKhoan}
            onChange={(e) => { setTaiKhoan(e.target.value); setLoi('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #ccc',
              fontSize: '14px',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label>Mật khẩu</label>
          <input
            type="password"
            placeholder="Nhập mật khẩu"
            value={matKhau}
            onChange={(e) => { setMatKhau(e.target.value); setLoi('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #ccc',
              fontSize: '14px',
            }}
          />
        </div>

        {loi && (
          <p style={{ margin: 0, color: 'red', fontSize: '14px', textAlign: 'center' }}>
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
            backgroundColor: hover ? '#1a7fd4' : '#3B9EE8',
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

