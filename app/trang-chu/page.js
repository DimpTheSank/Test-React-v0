'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { getExerciseRoute } from '@/lib/exerciseRoute'

const mauTrangThai = {
  'Đã làm':   { bg: 'var(--c-success-bg)', text: 'var(--c-success-text)' },
  'Đang làm': { bg: 'var(--c-warn-bg)', text: 'var(--c-warn-text)' },
  'Chưa làm': { bg: 'var(--c-danger-bg)', text: 'var(--c-danger-text)' },
}

const mauKyNang = {
  'Reading':   { bg: 'var(--c-primary-mid)', text: 'var(--c-surface)' },
  'Listening': { bg: 'var(--c-success)', text: 'var(--c-surface)' },
  'Writing':   { bg: 'var(--c-writing)', text: 'var(--c-surface)' },
  'Speaking':  { bg: 'var(--c-speaking)', text: 'var(--c-surface)' },
}

const mauMucDo = {
  'Cơ bản':    { bg: 'var(--c-success-bg)', text: 'var(--c-success-text)' },
  'Trung bình':{ bg: 'var(--c-warn-bg)', text: 'var(--c-warn-text)' },
  'Nâng cao':  { bg: 'var(--c-danger-bg)', text: 'var(--c-danger-text)' },
}

const cacMucDo = ['Tất cả', 'Cơ bản', 'Trung bình', 'Nâng cao']
const cacTrangThai = ['Tất cả', 'Chưa làm', 'Đã làm']

export default function TrangChu() {
  const router = useRouter()
  const [baiTapList, setBaiTapList] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterMucDo, setFilterMucDo] = useState('Tất cả')
  const [filterTrangThai, setFilterTrangThai] = useState('Tất cả')

  useEffect(() => {
    if (!Cookies.get('isLoggedIn')) { router.push('/'); return }
    loadBaiTap()
  }, [])

  const loadBaiTap = async () => {
    try {
      const raw = document.cookie.split('; ').find(r => r.startsWith('userInfo='))?.split('=')[1]
      const userInfo = JSON.parse(decodeURIComponent(raw))
      const taiKhoan = userInfo.taiKhoan

      const assignSnap = await getDocs(query(
        collection(db, 'assignments'),
        where('userId', '==', taiKhoan)
      ))
      

      const subSnap = await getDocs(query(
        collection(db, 'submissions'),
        where('userId', '==', taiKhoan)
      ))

      const subMap = {}
      subSnap.docs.forEach(d => {
        const data = d.data()
        const existing = subMap[data.exerciseId]
        if (!existing || (data.diem ?? -1) > (existing.diem ?? -1)) {
          subMap[data.exerciseId] = data
        }
      })

      const baiTapData = await Promise.all(
        assignSnap.docs.map(async (assignDoc) => {
          const assign = assignDoc.data()
          const exSnap = await getDoc(doc(db, 'exercises', assign.exerciseId))
          if (!exSnap.exists()) return null
          const bestSub = subMap[assign.exerciseId]

          return {
            id: assignDoc.id,
            exerciseId: assign.exerciseId,
            thoiGianGiao: assign.thoiGianGiao,
            ...exSnap.data(),
            trangThai: bestSub ? 'Đã làm' : (assign.trangThai || 'Chưa làm'),
            diem: bestSub?.diem ?? null,
            tongCau: bestSub?.tongCau ?? null,
            thoiGianNop: bestSub?.thoiGianNop ?? null,
            duocXemLai: bestSub
              ? (bestSub.diem ?? 0) >= (bestSub.tongCau ?? 1) * 0.5
              : false,
          }
        })
      )

      const sorted = baiTapData
        .filter(Boolean)
        .sort((a, b) => new Date(b.thoiGianGiao) - new Date(a.thoiGianGiao))

      setBaiTapList(sorted)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const daDam = baiTapList.filter(b => b.trangThai === 'Đã làm').length
  const chuaLam = baiTapList.filter(b => b.trangThai === 'Chưa làm').length

  const filtered = baiTapList.filter(b => {
    const okMucDo = filterMucDo === 'Tất cả' || b.mucDo === filterMucDo
    const okTrangThai = filterTrangThai === 'Tất cả' || b.trangThai === filterTrangThai
    return okMucDo && okTrangThai
  })

  if (loading) return (
    <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 56px)' }}>
      <p style={{ color: 'var(--c-primary)' }}>Đang tải...</p>
    </main>
  )

  return (
    <main style={{ padding: '24px 16px', maxWidth: '960px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, color: 'var(--c-primary-dark)' }}>Bài tập của tôi</h2>
        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          <span style={{
            padding: '4px 12px', borderRadius: '20px',
            backgroundColor: 'var(--c-success-bg)', color: 'var(--c-success-text)', fontSize: '13px', fontWeight: '500'
          }}>✅ Đã làm: {daDam}</span>
          <span style={{
            padding: '4px 12px', borderRadius: '20px',
            backgroundColor: 'var(--c-danger-bg)', color: 'var(--c-danger-text)', fontSize: '13px', fontWeight: '500'
          }}>⏳ Chưa làm: {chuaLam}</span>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: '24px', marginBottom: '20px',
        padding: '14px 16px', backgroundColor: 'var(--c-surface)',
        borderRadius: '12px', border: '1px solid var(--c-primary-pale)',
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: 'var(--c-primary)', fontWeight: '500', whiteSpace: 'nowrap' }}>Mức độ:</span>
          {cacMucDo.map(m => (
            <button key={m} onClick={() => setFilterMucDo(m)} style={{
              padding: '5px 14px', borderRadius: '20px', fontSize: '13px',
              border: `1.5px solid ${filterMucDo === m ? 'var(--c-primary)' : 'var(--c-primary-pale)'}`,
              backgroundColor: filterMucDo === m ? 'var(--c-primary)' : 'var(--c-surface)',
              color: filterMucDo === m ? 'var(--c-surface)' : 'var(--c-text-soft)',
              fontWeight: filterMucDo === m ? '600' : '400',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>{m}</button>
          ))}
        </div>

        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--c-primary-pale)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: 'var(--c-primary)', fontWeight: '500', whiteSpace: 'nowrap' }}>Trạng thái:</span>
          {cacTrangThai.map(t => (
            <button key={t} onClick={() => setFilterTrangThai(t)} style={{
              padding: '5px 14px', borderRadius: '20px', fontSize: '13px',
              border: `1.5px solid ${filterTrangThai === t ? 'var(--c-primary)' : 'var(--c-primary-pale)'}`,
              backgroundColor: filterTrangThai === t ? 'var(--c-primary)' : 'var(--c-surface)',
              color: filterTrangThai === t ? 'var(--c-surface)' : 'var(--c-text-soft)',
              fontWeight: filterTrangThai === t ? '600' : '400',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Danh sách */}
      {filtered.length === 0 ? (
        <p style={{ color: 'var(--c-text-muted)', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>
          Không có bài tập nào phù hợp.
        </p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          {filtered.map(bai => <CardBaiTap key={bai.id} bai={bai} />)}
        </div>
      )}
    </main>
  )
}

function CardBaiTap({ bai }) {
  const [hoverLam, setHoverLam] = useState(false)
  const [hoverXem, setHoverXem] = useState(false)
  const mau = mauTrangThai[bai.trangThai] || mauTrangThai['Chưa làm']
  const mauHeader = mauKyNang[bai.kyNang] || { bg: 'var(--c-primary)', text: 'var(--c-surface)' }
  const mauDo = mauMucDo[bai.mucDo] || null
  const router = useRouter()
  const daDam = bai.trangThai === 'Đã làm'

  const formatNgay = (iso) => {
    if (!iso) return null
    const d = new Date(iso)
    return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div style={{
      border: `1px solid ${daDam ? 'var(--c-success-border)' : 'var(--c-primary-pale)'}`,
      borderRadius: '16px', width: '160px',
      display: 'flex', flexDirection: 'column',
      backgroundColor: 'var(--c-surface)', overflow: 'hidden',
    }}>
      <div style={{ backgroundColor: mauHeader.bg, padding: '8px 12px', textAlign: 'center' }}>
        <span style={{ color: mauHeader.text, fontSize: '12px', fontWeight: '600', letterSpacing: '0.5px' }}>
          {bai.loaiBai} · {bai.kyNang}
        </span>
      </div>

      <div style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <p style={{ margin: 0, fontWeight: '600', fontSize: '14px', color: 'var(--c-primary-dark)', lineHeight: '1.4' }}>
          {bai.tenBaiTap}
        </p>

        {mauDo && (
          <span style={{
            padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500',
            backgroundColor: mauDo.bg, color: mauDo.text, alignSelf: 'flex-start',
          }}>
            {bai.mucDo}
          </span>
        )}

        <div style={{
          padding: '3px 10px', borderRadius: '20px',
          backgroundColor: mau.bg, color: mau.text,
          fontSize: '12px', fontWeight: '500', alignSelf: 'flex-start',
        }}>
          {bai.trangThai}
        </div>

        {bai.thoiGianNop && (
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--c-text-muted)' }}>
            🕐 {formatNgay(bai.thoiGianNop)}
          </p>
        )}

        <p style={{
          margin: 0, fontSize: '13px', fontWeight: '500',
          color: bai.diem !== null ? 'var(--c-success)' : 'var(--c-primary-pale)',
        }}>
          {bai.diem !== null ? `${bai.diem} / ${bai.tongCau}` : '— / —'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto' }}>
          <button
            onClick={() => router.push(getExerciseRoute(bai.kyNang, bai.exerciseId))}
            onMouseEnter={() => setHoverLam(true)}
            onMouseLeave={() => setHoverLam(false)}
            style={{
              padding: '8px', borderRadius: '8px', border: 'none',
              backgroundColor: hoverLam ? 'var(--c-primary-dark)' : 'var(--c-primary-mid)',
              color: 'var(--c-surface)', fontSize: '13px', fontWeight: '500',
              cursor: 'pointer', transition: 'background-color 0.2s', width: '100%',
            }}
          >Làm bài</button>

          {bai.duocXemLai && (
            <button
              onClick={() => router.push(getExerciseRoute(bai.kyNang, bai.exerciseId, '?review=true'))}
              onMouseEnter={() => setHoverXem(true)}
              onMouseLeave={() => setHoverXem(false)}
              style={{
                padding: '8px', borderRadius: '8px',
                border: '1px solid var(--c-success)',
                backgroundColor: hoverXem ? 'var(--c-success-bg)' : 'var(--c-surface)',
                color: 'var(--c-success)', fontSize: '13px', fontWeight: '500',
                cursor: 'pointer', transition: 'background-color 0.2s', width: '100%',
              }}
            >Xem lại</button>
          )}
        </div>
      </div>
    </div>
  )
}