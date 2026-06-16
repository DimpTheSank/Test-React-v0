'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { getExerciseRoute } from '@/lib/exerciseRoute'
import { SkeletonTrangChu } from '@/app/components/Skeleton'

const mauTrangThai = {
  'Đã làm':   { bg: 'var(--c-success-bg)',  text: 'var(--c-success-text)' },
  'Đang làm': { bg: 'var(--c-warn-bg)',     text: 'var(--c-warn-text)'    },
  'Chưa làm': { bg: 'var(--c-danger-bg)',   text: 'var(--c-danger-text)'  },
}

const accentKyNang = {
  'Reading':          'var(--c-primary-mid)',
  'Listening':        'var(--c-success)',
  'Writing':          'var(--c-writing)',
  'Speaking':         'var(--c-speaking)',
  'Vocab Reading':    'var(--c-vocab-reading)',
  'Vocab Listening':  'var(--c-vocab-listening)',
  'Tổng hợp':         'var(--c-tonghop)',
}

const iconKyNang = {
  'Reading':         '📖',
  'Listening':       '🎧',
  'Writing':         '✍️',
  'Speaking':        '🗣️',
  'Vocab Reading':   '🔤',
  'Vocab Listening': '🔊',
  'Tổng hợp':        '🧩',
}

const mauMucDo = {
  'Cơ bản':    { bg: 'var(--c-success-bg)', text: 'var(--c-success-text)' },
  'Trung bình':{ bg: 'var(--c-warn-bg)',    text: 'var(--c-warn-text)'    },
  'Nâng cao':  { bg: 'var(--c-danger-bg)',  text: 'var(--c-danger-text)'  },
}

const cacMucDo     = ['Tất cả', 'Cơ bản', 'Trung bình', 'Nâng cao']
const cacTrangThai = ['Tất cả', 'Chưa làm', 'Đang làm', 'Đã làm']

export default function TrangChu() {
  const router = useRouter()
  const [baiTapList, setBaiTapList]           = useState([])
  const [loading, setLoading]                 = useState(true)
  const [filterMucDo, setFilterMucDo]         = useState('Tất cả')
  const [filterTrangThai, setFilterTrangThai] = useState('Tất cả')

  useEffect(() => {
    if (!Cookies.get('isLoggedIn')) { router.push('/'); return }
    loadBaiTap()
  }, [])

  const loadBaiTap = async () => {
    try {
      const raw      = document.cookie.split('; ').find(r => r.startsWith('userInfo='))?.split('=')[1]
      const userInfo = JSON.parse(decodeURIComponent(raw))
      const taiKhoan = userInfo.taiKhoan

      const assignSnap = await getDocs(query(collection(db, 'assignments'), where('userId', '==', taiKhoan)))
      const subSnap    = await getDocs(query(collection(db, 'submissions'),  where('userId', '==', taiKhoan)))

      const subMap = {}
      subSnap.docs.forEach(d => {
        const data = d.data()
        const existing = subMap[data.exerciseId]
        if (!existing || (data.diem ?? -1) > (existing.diem ?? -1)) subMap[data.exerciseId] = data
      })

      const baiTapData = await Promise.all(assignSnap.docs.map(async (assignDoc) => {
        const assign = assignDoc.data()
        const exSnap = await getDoc(doc(db, 'exercises', assign.exerciseId))
        if (!exSnap.exists()) return null
        const bestSub = subMap[assign.exerciseId]

        // Đếm số câu đã làm trong nháp (bỏ qua nếu đã nộp)
        const draftAnswerCount = !bestSub && assign.answers
          ? Object.keys(assign.answers).filter(k => {
              const v = assign.answers[k]
              return Array.isArray(v) ? v.some(Boolean) : !!v
            }).length
          : 0

        return {
          id: assignDoc.id, exerciseId: assign.exerciseId, thoiGianGiao: assign.thoiGianGiao,
          ...exSnap.data(),
          trangThai:        bestSub ? 'Đã làm' : (assign.trangThai || 'Chưa làm'),
          diem:             bestSub?.diem ?? null,
          tongCau:          bestSub?.tongCau ?? null,
          thoiGianNop:      bestSub?.thoiGianNop ?? null,
          duocXemLai:       bestSub ? (bestSub.diem ?? 0) >= (bestSub.tongCau ?? 1) * 0.3 : false,
          draftAnswerCount,
          draftTongCau:     assign.tongCauDraft ?? null,
        }
      }))

      const sorted = baiTapData
        .filter(Boolean)
        .sort((a, b) => {
          const timeDiff = new Date(b.thoiGianGiao) - new Date(a.thoiGianGiao)
          if (timeDiff !== 0) return timeDiff
          return (a.tenBaiTap ?? '').localeCompare(b.tenBaiTap ?? '', 'vi')
        })
      setBaiTapList(sorted)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const daLam   = baiTapList.filter(b => b.trangThai === 'Đã làm').length
  const dangLam = baiTapList.filter(b => b.trangThai === 'Đang làm').length
  const chuaLam = baiTapList.filter(b => b.trangThai === 'Chưa làm').length

  const filtered = baiTapList.filter(b => {
    const okMucDo     = filterMucDo     === 'Tất cả' || b.mucDo     === filterMucDo
    const okTrangThai = filterTrangThai === 'Tất cả' || b.trangThai === filterTrangThai
    return okMucDo && okTrangThai
  })

  if (loading) return <SkeletonTrangChu />

  return (
    <main style={{
      padding: '28px 20px',
      maxWidth: '1040px',
      margin: '0 auto',
      backgroundColor: 'var(--c-bg-page)',
      minHeight: 'calc(100vh - 56px)',
    }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--c-primary-dark)', lineHeight: 1.2 }}>
            Bài tập của tôi
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--c-text-muted)', lineHeight: 1 }}>
            {baiTapList.length} bài được giao
          </p>
        </div>

        {/* Stats pills */}
        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '6px 14px', borderRadius: '9999px',
            backgroundColor: 'var(--c-success-bg)', color: 'var(--c-success-text)',
            fontSize: '13px', fontWeight: '600',
          }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--c-success)', display: 'inline-block' }} />
            Đã làm: {daLam}
          </span>
          {dangLam > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: '9999px',
              backgroundColor: 'var(--c-warn-bg)', color: 'var(--c-warn-text)',
              fontSize: '13px', fontWeight: '600',
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--c-warn)', display: 'inline-block' }} />
              Đang làm: {dangLam}
            </span>
          )}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '6px 14px', borderRadius: '9999px',
            backgroundColor: 'var(--c-danger-bg)', color: 'var(--c-danger-text)',
            fontSize: '13px', fontWeight: '600',
          }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--c-danger)', display: 'inline-block' }} />
            Chưa làm: {chuaLam}
          </span>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{
        display: 'flex', gap: '20px', marginBottom: '24px',
        padding: '14px 18px',
        backgroundColor: 'var(--c-primary-barest)',
        borderRadius: '12px',
        border: '1px solid var(--c-primary-bg)',
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        <FilterGroup
          label="Mức độ"
          options={cacMucDo}
          value={filterMucDo}
          onChange={setFilterMucDo}
        />
        <div style={{ width: '1px', height: '22px', backgroundColor: 'var(--c-primary-pale)', alignSelf: 'center' }} />
        <FilterGroup
          label="Trạng thái"
          options={cacTrangThai}
          value={filterTrangThai}
          onChange={setFilterTrangThai}
        />
      </div>

      {/* ── Card grid ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--c-text-muted)', fontSize: '14px' }}>
          Không có bài tập nào phù hợp.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '16px',
        }}>
          {filtered.map(bai => <CardBaiTap key={bai.id} bai={bai} />)}
        </div>
      )}
    </main>
  )
}

/* ── FilterGroup ─────────────────────────────────────────────────── */
function FilterGroup({ label, options, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <span style={{
        fontSize: '12px', color: 'var(--c-primary)', fontWeight: '600',
        whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {label}
      </span>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            padding: '5px 13px', borderRadius: '9999px', fontSize: '13px',
            border: `1.5px solid ${value === opt ? 'var(--c-primary)' : 'var(--c-primary-pale)'}`,
            backgroundColor: value === opt ? 'var(--c-primary)' : 'transparent',
            color: value === opt ? '#fff' : 'var(--c-text-soft)',
            fontWeight: value === opt ? '600' : '400',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

/* ── CardBaiTap ──────────────────────────────────────────────────── */
function CardBaiTap({ bai }) {
  const [hovered, setHovered] = useState(false)
  const router = useRouter()

  const daLam  = bai.trangThai === 'Đã làm'
  const mau    = mauTrangThai[bai.trangThai] || mauTrangThai['Chưa làm']
  const mauDo  = mauMucDo[bai.mucDo] || null
  const accent = accentKyNang[bai.kyNang] || 'var(--c-primary-mid)'
  const icon   = iconKyNang[bai.kyNang]   || '📝'

  const pctStr = bai.diem !== null && bai.tongCau
    ? `${Math.round(bai.diem / bai.tongCau * 100)}%`
    : null

  const draftPct = bai.draftTongCau
    ? Math.round(bai.draftAnswerCount / bai.draftTongCau * 100)
    : null

  const formatNgay = (iso) => {
    if (!iso) return null
    const d = new Date(iso)
    return `${d.getDate()}/${d.getMonth() + 1} lúc ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--c-surface)',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: daLam
          ? (hovered ? 'var(--shadow-card-hover)' : 'var(--shadow-card-done)')
          : (hovered ? 'var(--shadow-card-hover)' : 'var(--shadow-card)'),
        border: daLam
          ? '1px solid var(--c-success-border)'
          : '1px solid var(--c-border-soft)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        cursor: 'default',
      }}
    >
      {/* Accent bar */}
      <div style={{ height: '4px', backgroundColor: accent, flexShrink: 0 }} />

      {/* Body */}
      <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>

        {/* Icon + skill label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '18px', lineHeight: 1 }}>{icon}</span>
          <span style={{
            fontSize: '11px', fontWeight: '700', letterSpacing: '0.04em',
            color: 'var(--c-text-muted)', textTransform: 'uppercase',
          }}>
            {bai.loaiBai} · {bai.kyNang}
          </span>
        </div>

        {/* Title */}
        <p style={{
          margin: 0,
          fontSize: '14px',
          fontWeight: '600',
          color: 'var(--c-primary-dark)',
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {bai.tenBaiTap}
        </p>

        {/* Badges row */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {mauDo && (
            <span style={{
              padding: '2px 8px', borderRadius: '9999px',
              fontSize: '11px', fontWeight: '600',
              backgroundColor: mauDo.bg, color: mauDo.text,
            }}>
              {bai.mucDo}
            </span>
          )}
          <span style={{
            padding: '2px 8px', borderRadius: '9999px',
            fontSize: '11px', fontWeight: '600',
            backgroundColor: mau.bg, color: mau.text,
          }}>
            {bai.trangThai}
          </span>
        </div>

        {/* Draft progress bar — chỉ hiện khi chưa/đang làm và có dữ liệu nháp */}
        {!daLam && bai.draftAnswerCount > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--c-warn-text)', fontWeight: '600' }}>
                ✏️ Đang làm
              </span>
              <span style={{ fontSize: '11px', color: 'var(--c-warn-text)', fontWeight: '700' }}>
                {bai.draftAnswerCount}{bai.draftTongCau ? `/${bai.draftTongCau}` : ''} câu
                {draftPct !== null ? ` · ${draftPct}%` : ''}
              </span>
            </div>
            {draftPct !== null && (
              <div style={{ height: '5px', borderRadius: '99px', backgroundColor: 'var(--c-warn-bg)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${draftPct}%`,
                  borderRadius: '99px',
                  backgroundColor: 'var(--c-warn)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            )}
          </div>
        )}

        {/* Score + date — chỉ hiện khi đã làm */}
        {daLam && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 10px',
            borderRadius: '8px',
            backgroundColor: 'var(--c-success-bg)',
          }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-success-text)' }}>
              {bai.diem} / {bai.tongCau}
            </span>
            {pctStr && (
              <span style={{
                fontSize: '12px', fontWeight: '700',
                color: parseInt(pctStr) >= 50 ? 'var(--c-success)' : 'var(--c-danger)',
              }}>
                {pctStr}
              </span>
            )}
          </div>
        )}

        {bai.thoiGianNop && (
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--c-text-muted)', lineHeight: 1.3 }}>
            🕐 {formatNgay(bai.thoiGianNop)}
          </p>
        )}

        {/* CTA buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: 'auto', paddingTop: '4px' }}>
          {bai.duocXemLai && (
            <button
              onClick={() => router.push(getExerciseRoute(bai.kyNang, bai.exerciseId, '?review=true'))}
              style={{
                padding: '8px 0', borderRadius: '9px',
                border: '1.5px solid var(--c-success-border)',
                backgroundColor: hovered ? 'var(--c-success-bg)' : 'transparent',
                color: 'var(--c-success)', fontSize: '13px', fontWeight: '600',
                cursor: 'pointer', transition: 'background-color 0.15s',
                width: '100%', letterSpacing: '0.01em',
              }}
            >
              Xem lại ✓
            </button>
          )}

          <button
            onClick={() => router.push(getExerciseRoute(bai.kyNang, bai.exerciseId))}
            style={{
              padding: '9px 0', borderRadius: '9px', border: 'none',
              backgroundColor: hovered ? 'var(--c-primary-dark)' : 'var(--c-primary-mid)',
              color: '#fff', fontSize: '13px', fontWeight: '600',
              cursor: 'pointer', transition: 'background-color 0.15s',
              width: '100%', letterSpacing: '0.01em',
            }}
          >
            {daLam ? 'Làm lại' : bai.draftAnswerCount > 0 ? 'Làm tiếp' : 'Làm bài'}
          </button>
        </div>
      </div>
    </div>
  )
}