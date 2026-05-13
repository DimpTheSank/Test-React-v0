'use client'
import { useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'

export default function BaiTap({ params }) {
  const { id } = use(params)
  const router = useRouter()

  useEffect(() => {
    if (!Cookies.get('isLoggedIn')) router.push('/')
    console.log('Exercise ID:', id)
  }, [])

  return (
    <main>
    </main>
  )
}