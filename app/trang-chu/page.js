'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'

export default function TrangChu() {
  const router = useRouter()

  useEffect(() => {
    const isLoggedIn = Cookies.get('isLoggedIn')
    if (!isLoggedIn) {
      router.push('/') // chưa đăng nhập → quay về trang login
    }
  }, [])

  return (
    <main>
    </main>
  )
}