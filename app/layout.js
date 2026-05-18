'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Cookies from 'js-cookie'
import { Be_Vietnam_Pro } from 'next/font/google'

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700'],
})

export default function RootLayout({ children }) {
  const [userInfo, setUserInfo] = useState(null)
  const [hoverHome, setHoverHome] = useState(false)
  const [hoverLogout, setHoverLogout] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const raw = document.cookie
      .split('; ')
      .find(row => row.startsWith('userInfo='))
      ?.split('=')[1]
    if (raw) setUserInfo(JSON.parse(decodeURIComponent(raw)))
    else setUserInfo(null)
  }, [pathname])

  const handleLogout = () => {
    Cookies.remove('isLoggedIn')
    Cookies.remove('userInfo')
    router.push('/')
  }

  const btnStyle = (hover) => ({
    padding: '6px 14px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: hover ? '#0C447C' : 'rgba(255,255,255,0.15)',
    color: 'white',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  })

  return (
    <html lang="vi" className={beVietnamPro.className}>
      <body>
        <header style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          height: '56px',
          backgroundColor: '#185FA5',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '20px',
          paddingRight: '20px',
          zIndex: 1000,
        }}>
          {/* Bên trái */}
          {userInfo && (
            <button
              onClick={() => router.push(userInfo.vaiTro === 'Giáo viên' ? '/trang-chu-gv' : '/trang-chu')}
              onMouseEnter={() => setHoverHome(true)}
              onMouseLeave={() => setHoverHome(false)}
              style={btnStyle(hoverHome)}
            >
              Trang chủ
            </button>
          )}
          {userInfo && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ color: 'white', fontSize: '14px' }}>
                <span style={{ fontWeight: '700' }}>
                  {userInfo.vaiTro}
                </span>
                {': '}
                <span style={{ fontStyle: 'italic' }}>
                  {userInfo.ten}
                </span>
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