'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'

export default function BaiTap({ params }) {
  const router = useRouter()

  useEffect(() => {
    if (!Cookies.get('isLoggedIn')) router.push('/')
  }, [])

  return (
    <main>
    </main>
  )
}