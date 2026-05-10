'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'

export default function RootLayout({ children }) {
  const [userInfo, setUserInfo] = useState(null)
  const router = useRouter()

  useEffect(() => {
    const raw = Cookies.get('userInfo')
    if (raw) setUserInfo(JSON.parse(raw))
  }, [])

  const handleLogout = () => {
    Cookies.remove('isLoggedIn')
    Cookies.remove('userInfo')
    router.push('/')
  }

  const btnStyle = (hover) => ({
    padding: '6px 14px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: hover ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)',
    color: 'white',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  })

  const [hoverHome, setHoverHome] = useState(false)
  const [hoverLogout, setHoverLogout] = useState(false)

  return (
    <html lang="en">
      <body>
        <header style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          height: '56px',
          backgroundColor: '#3B9EE8',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '20px',
          paddingRight: '20px',
          zIndex: 1000,
        }}>
          {/* Bên trái */}
          <button
            onClick={() => router.push('/trang-chu')}
            onMouseEnter={() => setHoverHome(true)}
            onMouseLeave={() => setHoverHome(false)}
            style={btnStyle(hoverHome)}
          >
            Trang chủ
          </button>

          {/* Bên phải */}
          {userInfo && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ color: 'white', fontSize: '14px' }}>
                {userInfo.vaiTro}: {userInfo.ten}
              </span>
              <button
                onClick={handleLogout}
                onMouseEnter={() => setHoverLogout(true)}
                onMouseLeave={() => setHoverLogout(false)}
                style={btnStyle(hoverLogout)}
              >
                Đăng xuất
              </button>
            </div>
          )}
        </header>

        <main style={{ marginTop: '56px' }}>
          {children}
        </main>
      </body>
    </html>
  )
}