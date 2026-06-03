'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { db } from '@/lib/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'

export default function Home() {
  const [hover, setHover] = useState(false)
  const [taiKhoan, setTaiKhoan] = useState('')
  const [matKhau, setMatKhau] = useState('')
  const [loi, setLoi] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (Cookies.get('isLoggedIn')) {
      const raw = document.cookie.split('; ').find(r => r.startsWith('userInfo='))?.split('=')[1]
      if (raw) {
        const info = JSON.parse(decodeURIComponent(raw))
        router.push(info.vaiTro === 'Giáo viên' ? '/trang-chu-gv' : '/trang-chu')
      }
    }
  }, [])

  const handleLogin = async () => {
    setLoading(true)
    setLoi('')
    try {
      const userRef = doc(db, 'users', taiKhoan)
      const userSnap = await getDoc(userRef)
      if (userSnap.exists() && userSnap.data().matKhau === matKhau) {
        const user = userSnap.data()
        await updateDoc(userRef, { lanCuoiTruyCap: new Date().toISOString() })
        Cookies.set('isLoggedIn', 'true', { expires: 7 })
        Cookies.set('userInfo', JSON.stringify({
          taiKhoan: user.taiKhoan, ho: user.ho, ten: user.ten,
          vaiTro: user.vaiTro, lop: user.lop, mucTieu: user.mucTieu,
        }), { expires: 7 })
        router.push(user.vaiTro === 'Giáo viên' ? '/trang-chu-gv' : '/trang-chu')
      } else {
        setLoi('Thông tin đăng nhập sai')
      }
    } catch (err) {
      setLoi('Có lỗi xảy ra, thử lại sau')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: 'calc(100vh - 56px)',
      backgroundColor: 'var(--c-bg-page)',
    }}>
      <div style={{
        border: '1px solid var(--c-primary-pale)', borderRadius: '16px', padding: '40px', width: '360px',
        display: 'flex', flexDirection: 'column', gap: '16px',
        backgroundColor: 'var(--c-primary-bg)',
      }}>
        <h2 style={{ margin: 0, textAlign: 'center', color: 'var(--c-primary-dark)' }}>Đăng nhập</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ color: 'var(--c-primary)', fontSize: '14px' }}>Tài khoản</label>
          <input type="text" placeholder="Nhập tài khoản" value={taiKhoan}
            onChange={(e) => { setTaiKhoan(e.target.value); setLoi('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--c-primary-light)', fontSize: '14px', backgroundColor: 'var(--c-surface)', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ color: 'var(--c-primary)', fontSize: '14px' }}>Mật khẩu</label>
          <input type="password" placeholder="Nhập mật khẩu" value={matKhau}
            onChange={(e) => { setMatKhau(e.target.value); setLoi('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--c-primary-light)', fontSize: '14px', backgroundColor: 'var(--c-surface)', outline: 'none' }}
          />
        </div>
        {loi && <p style={{ margin: 0, color: 'var(--c-danger)', fontSize: '14px', textAlign: 'center' }}>{loi}</p>}
        <button onClick={handleLogin} disabled={loading}
          onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
          style={{ padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: hover ? 'var(--c-primary-dark)' : 'var(--c-primary-mid)', color: 'var(--c-surface)', fontSize: '15px', fontWeight: '500', cursor: 'pointer', transition: 'background-color 0.2s' }}
        >
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </div>
    </main>
  )
}