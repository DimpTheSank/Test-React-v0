'use client'
import { useState } from 'react'

export default function Home() {
  const [hover, setHover] = useState(false)

  const handleLogin = () => {
    console.log('Đăng nhập!')
    // Sau này xử lý logic đăng nhập ở đây
  }

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
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #ccc',
              fontSize: '14px',
            }}
          />
        </div>

        <button
          onClick={handleLogin}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            marginTop: '8px',
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