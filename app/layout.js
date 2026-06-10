'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Cookies from 'js-cookie'
import { Be_Vietnam_Pro } from 'next/font/google'
import './globals.css'

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700'],
})

// ── Inject theme trước khi render để tránh flash ──────────────────
const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (!stored && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  } catch(e) {}
})();
`

export default function RootLayout({ children }) {
  const [userInfo,    setUserInfo]    = useState(null)
  const [hoverHome,   setHoverHome]   = useState(false)
  const [hoverLogout, setHoverLogout] = useState(false)
  const [hoverTheme,  setHoverTheme]  = useState(false)
  const [isDark,      setIsDark]      = useState(false)
  const router   = useRouter()
  const pathname = usePathname()

  // Sync isDark state từ class trên <html>
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  // Listen system theme change
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => {
      // Chỉ follow system nếu user chưa manually chọn
      if (!localStorage.getItem('theme')) applyTheme(e.matches ? 'dark' : 'light', false)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const titles = {
      '/':              'Đăng nhập',
      '/trang-chu':     'Bài tập của tôi',
      '/trang-chu-gv':  'Quản lý lớp',
    }
    const title =
      titles[pathname] ??
      (pathname.startsWith('/bai-tap/') ? 'Làm bài' :
      pathname.startsWith('/vocab/')   ? 'Từ vựng' :
      'EnglishApp')
    document.title = title
  }, [pathname])

  const applyTheme = (theme, save = true) => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
      setIsDark(true)
    } else {
      document.documentElement.classList.remove('dark')
      setIsDark(false)
    }
    if (save) localStorage.setItem('theme', theme)
  }

  const toggleTheme = () => applyTheme(isDark ? 'light' : 'dark')

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
    backgroundColor: hover ? 'var(--c-header-btnhov)' : 'var(--c-header-btn)',
    color: 'var(--c-header-text)',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  })

  return (
    <html lang="vi" className={beVietnamPro.className}>
      <head>
        {/* Inject sớm để tránh flash trắng khi dark mode */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body style={{ margin: 0, backgroundColor: 'var(--c-bg-page)', color: 'var(--c-text)' }}>
        <header style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          height: '56px',
          backgroundColor: 'var(--c-header-bg)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '20px',
          paddingRight: '20px',
          zIndex: 1000,
          borderBottom: '1px solid var(--c-primary-pale)',
          transition: 'background-color 0.2s',
        }}>
          {/* Trang chủ */}
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

          {/* Bên phải: user info + theme toggle + logout */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {userInfo && (
              <span style={{ color: 'var(--c-header-text)', fontSize: '14px', opacity: 0.9 }}>
                <span style={{ fontWeight: '700' }}>{userInfo.vaiTro}</span>
                {': '}
                <span style={{ fontStyle: 'italic' }}>{userInfo.ten}</span>
              </span>
            )}

            {/* Nút toggle theme */}
            <button
              onClick={toggleTheme}
              onMouseEnter={() => setHoverTheme(true)}
              onMouseLeave={() => setHoverTheme(false)}
              title={isDark ? 'Chuyển sang sáng' : 'Chuyển sang tối'}
              style={{
                ...btnStyle(hoverTheme),
                padding: '6px 10px',
                fontSize: '16px',
                lineHeight: 1,
              }}
            >
              {isDark ? '☀️' : '🌙'}
            </button>

            {userInfo && (
              <button
                onClick={handleLogout}
                onMouseEnter={() => setHoverLogout(true)}
                onMouseLeave={() => setHoverLogout(false)}
                style={btnStyle(hoverLogout)}
              >
                Đăng xuất
              </button>
            )}
          </div>
        </header>

        <main style={{ marginTop: '56px' }}>
          {children}
        </main>
      </body>
    </html>
  )
}