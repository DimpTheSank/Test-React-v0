'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, getDoc,updateDoc } from 'firebase/firestore'
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

// Số bài hiện mỗi lần (mặc định 10 — trên khung 1040px với card min 180px, lưới thường
// ra 5 cột => 10 bài = đúng 2 dòng. Chỉnh số này nếu muốn khít hơn với layout thực tế.)
const SO_LUONG_MOI_LAN = 10

export default function TrangChu() {
  const router = useRouter()
  const [view, setView]                       = useState('baiTap')
  const [baiTapList, setBaiTapList]           = useState([])
  const [loading, setLoading]                 = useState(true)
  const [filterMucDo, setFilterMucDo]         = useState('Tất cả')
  const [filterTrangThai, setFilterTrangThai] = useState('Tất cả')
  const [visibleCount, setVisibleCount]       = useState(SO_LUONG_MOI_LAN)

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

  // Reset về số lượng mặc định mỗi khi đổi filter
  useEffect(() => {
    setVisibleCount(SO_LUONG_MOI_LAN)
  }, [filterMucDo, filterTrangThai])

  // Tự động hiện thêm khi cuộn gần chạm đáy trang
  useEffect(() => {
    const handleScroll = () => {
      const scrollBottom = window.innerHeight + window.scrollY
      const pageHeight = document.documentElement.scrollHeight
      if (scrollBottom >= pageHeight - 300) {
        setVisibleCount(prev => Math.min(prev + SO_LUONG_MOI_LAN, filtered.length))
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [filtered.length])

  const visibleList = filtered.slice(0, visibleCount)

  if (loading) return <SkeletonTrangChu />

  return (
    <main
      style={{
        padding: '28px 20px',
        maxWidth: '1040px',
        margin: '0 auto',
        backgroundColor: 'var(--c-bg-page)',
        minHeight: 'calc(100vh - 56px)',
      }}
    >
      {/* ── Tab switcher ── */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--c-primary-pale)',
        }}
      >
        {[
          { key: 'baiTap', label: '📚 Bài tập' },
          { key: 'ghiChu', label: '📓 Ghi chú' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom:
                view === t.key
                  ? '3px solid var(--c-primary)'
                  : '3px solid transparent',
              backgroundColor: 'transparent',
              color:
                view === t.key
                  ? 'var(--c-primary)'
                  : 'var(--c-text-muted)',
              fontWeight: view === t.key ? '600' : '400',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'baiTap' ? (
        <>
          {/* ── Page header ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '24px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '22px',
                  fontWeight: '700',
                  color: 'var(--c-primary-dark)',
                  lineHeight: 1.2,
                }}
              >
                Bài tập của tôi
              </h2>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: '13px',
                  color: 'var(--c-text-muted)',
                  lineHeight: 1,
                }}
              >
                {baiTapList.length} bài được giao
              </p>
            </div>

            {/* Stats pills */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginLeft: 'auto',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--c-success-bg)',
                  color: 'var(--c-success-text)',
                  fontSize: '13px',
                  fontWeight: '600',
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--c-success)',
                    display: 'inline-block',
                  }}
                />
                Đã làm: {daLam}
              </span>

              {dangLam > 0 && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--c-warn-bg)',
                    color: 'var(--c-warn-text)',
                    fontSize: '13px',
                    fontWeight: '600',
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--c-warn)',
                      display: 'inline-block',
                    }}
                  />
                  Đang làm: {dangLam}
                </span>
              )}

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--c-danger-bg)',
                  color: 'var(--c-danger-text)',
                  fontSize: '13px',
                  fontWeight: '600',
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--c-danger)',
                    display: 'inline-block',
                  }}
                />
                Chưa làm: {chuaLam}
              </span>
            </div>
          </div>

          {/* ── Filter bar ── */}
          <div
            style={{
              display: 'flex',
              gap: '20px',
              marginBottom: '24px',
              padding: '14px 18px',
              backgroundColor: 'var(--c-primary-barest)',
              borderRadius: '12px',
              border: '1px solid var(--c-primary-bg)',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <FilterGroup
              label="Mức độ"
              options={cacMucDo}
              value={filterMucDo}
              onChange={setFilterMucDo}
            />

            <div
              style={{
                width: '1px',
                height: '22px',
                backgroundColor: 'var(--c-primary-pale)',
                alignSelf: 'center',
              }}
            />

            <FilterGroup
              label="Trạng thái"
              options={cacTrangThai}
              value={filterTrangThai}
              onChange={setFilterTrangThai}
            />
          </div>

          {/* Phần Card grid + Load more giữ nguyên 100% như code hiện tại */}

          {filtered.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: 'var(--c-text-muted)',
                fontSize: '14px',
              }}
            >
              Không có bài tập nào phù hợp.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '16px',
                }}
              >
                {visibleList.map((bai) => (
                  <CardBaiTap key={bai.id} bai={bai} />
                ))}
              </div>

              {visibleCount < filtered.length && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '24px',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      color: 'var(--c-text-muted)',
                    }}
                  >
                    Đang hiện {visibleCount} / {filtered.length} bài
                  </p>

                  <button
                    onClick={() =>
                      setVisibleCount((v) =>
                        Math.min(v + SO_LUONG_MOI_LAN, filtered.length)
                      )
                    }
                    style={{
                      padding: '9px 24px',
                      borderRadius: '9999px',
                      border: '1.5px solid var(--c-primary-pale)',
                      backgroundColor: 'var(--c-surface)',
                      color: 'var(--c-primary-mid)',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        'var(--c-primary-bg)';
                      e.currentTarget.style.borderColor =
                        'var(--c-primary-mid)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        'var(--c-surface)';
                      e.currentTarget.style.borderColor =
                        'var(--c-primary-pale)';
                    }}
                  >
                    Xem thêm ↓
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <TabGhiChu />
      )}
    </main>
  );
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
              onClick={() => router.push(getExerciseRoute(bai.kyNang, bai.exerciseId, bai.loaiBai, '?review=true'))}
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
            onClick={() => router.push(getExerciseRoute(bai.kyNang, bai.exerciseId, bai.loaiBai))}
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
/* ── TabGhiChu ───────────────────────────────────────────────────── */
function TabGhiChu() {
  const [loading, setLoading]       = useState(true)
  const [items, setItems]           = useState([])   // [{ id, type: 'toeic'|'ielts', notes?, ghiChuBai?, exercise }]
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => { loadNotes() }, [])

  const loadNotes = async () => {
    setLoading(true)
    try {
      const raw = document.cookie.split('; ').find(r => r.startsWith('userInfo='))?.split('=')[1]
      const userInfo = JSON.parse(decodeURIComponent(raw))
      const taiKhoan = userInfo.taiKhoan

      const assignSnap = await getDocs(query(collection(db, 'assignments'), where('userId', '==', taiKhoan)))

      const withNotes = assignSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(a =>
          (a.notes && Object.values(a.notes).some(n => n && n.trim())) ||   // TOEIC
          (a.ghiChuBai && a.ghiChuBai.trim())                              // IELTS
        )

      const enriched = await Promise.all(withNotes.map(async (a) => {
        const exSnap = await getDoc(doc(db, 'exercises', a.exerciseId))
        if (!exSnap.exists()) return null
        const isIELTS = !!(a.ghiChuBai && a.ghiChuBai.trim())
        return {
          id: a.id,
          type: isIELTS ? 'ielts' : 'toeic',
          notes: a.notes || null,
          ghiChuBai: a.ghiChuBai || '',
          exercise: exSnap.data(),
        }
      }))

      const list = enriched.filter(Boolean)
      setItems(list)
      if (list.length > 0) setSelectedId(list[0].id)
    } catch (err) { console.error('Lỗi khi tải ghi chú:', err) }
    finally { setLoading(false) }
  }

  const selected = items.find(i => i.id === selectedId)

  const handleChangeIELTS = (val) => {
    setItems(prev => prev.map(it => it.id === selectedId ? { ...it, ghiChuBai: val } : it))
    scheduleSave(selectedId, { ghiChuBai: val })
  }

  const handleChangeTOEIC = (idx, val) => {
    const newNotes = { ...selected.notes, [idx]: val }
    setItems(prev => prev.map(it => it.id === selectedId ? { ...it, notes: newNotes } : it))
    scheduleSave(selectedId, { notes: newNotes })
  }

  const noteEntries = selected?.type === 'toeic'
    ? Object.entries(selected.notes)
        .filter(([, v]) => v && v.trim())
        .sort((a, b) => Number(a[0]) - Number(b[0]))
    : []

  if (loading) {
    return <p style={{ color: 'var(--c-primary)', fontSize: '14px', textAlign: 'center', padding: '60px 0' }}>Đang tải ghi chú...</p>
  }

  if (items.length === 0) {
    return <p style={{ color: 'var(--c-text-muted)', fontSize: '14px', textAlign: 'center', padding: '60px 0' }}>Bạn chưa có ghi chú nào.</p>
  }

  return (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>

      {/* Mục lục bên trái */}
      <div style={{
        width: '260px', flexShrink: 0,
        borderRadius: '12px', border: '1px solid var(--c-primary-pale)',
        backgroundColor: 'var(--c-surface)', overflow: 'hidden',
      }}>
        {items.map((it, i) => {
          const accent = accentKyNang[it.exercise.kyNang] || 'var(--c-primary-mid)'
          const isSel  = it.id === selectedId
          const count  = it.type === 'toeic'
            ? Object.values(it.notes).filter(n => n && n.trim()).length
            : null

          return (
            <div key={it.id} onClick={() => setSelectedId(it.id)} style={{
              padding: '12px 14px', cursor: 'pointer',
              borderLeft: `3px solid ${isSel ? accent : 'transparent'}`,
              backgroundColor: isSel ? 'var(--c-primary-barest)' : 'transparent',
              borderBottom: i < items.length - 1 ? '1px solid var(--c-primary-bg)' : 'none',
              transition: 'background-color 0.15s',
            }}>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {it.exercise.loaiBai} · {it.exercise.kyNang}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '13.5px', fontWeight: '600', color: 'var(--c-primary-dark)', lineHeight: 1.4 }}>
                {it.exercise.tenBaiTap}
              </p>
              <span style={{
                display: 'inline-block', marginTop: '6px', padding: '2px 8px', borderRadius: '9999px',
                fontSize: '11px', fontWeight: '600',
                backgroundColor: it.type === 'ielts' ? 'var(--c-primary-bg)' : 'var(--c-warn-bg)',
                color: it.type === 'ielts' ? 'var(--c-primary)' : 'var(--c-warn-text)',
              }}>
                {it.type === 'ielts' ? '📓 Ghi chú cả bài' : `${count} ghi chú`}
              </span>
            </div>
          )
        })}
      </div>

      {/* Vùng hiện note bên phải */}
      <div style={{ flex: 1, borderRadius: '12px', border: '1px solid var(--c-primary-pale)', backgroundColor: 'var(--c-surface)', padding: '20px 24px', minHeight: '300px' }}>
        {selected && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--c-primary-dark)' }}>
                {selected.exercise.tenBaiTap}
              </h3>
              {saved && (
                <span style={{ fontSize: '12px', color: 'var(--c-success)', fontWeight: '600' }}>✓ Đã lưu</span>
              )}
            </div>

            {selected.type === 'ielts' ? (
              <textarea
                value={selected.ghiChuBai}
                onChange={e => handleChangeIELTS(e.target.value)}
                style={{
                  width: '100%', minHeight: '240px', padding: '16px 18px', borderRadius: '10px',
                  border: '1px solid var(--c-primary-bg)', backgroundColor: 'var(--c-primary-barest)',
                  fontSize: '13.5px', color: 'var(--c-primary-dark)', lineHeight: 1.7,
                  outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {noteEntries.map(([idx, text]) => (
                  <div key={idx} style={{
                    padding: '12px 16px', borderRadius: '10px',
                    border: '1px solid var(--c-warn-border)', backgroundColor: 'var(--c-warn-bgsoft)',
                    display: 'flex', gap: '12px', alignItems: 'flex-start',
                  }}>
                    <span style={{
                      minWidth: '26px', height: '26px', borderRadius: '6px', flexShrink: 0,
                      backgroundColor: 'var(--c-warn)', color: '#fff',
                      fontSize: '11px', fontWeight: '700',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px',
                    }}>{Number(idx) + 1}</span>
                    <textarea
                      value={text}
                      onChange={e => handleChangeTOEIC(idx, e.target.value)}
                      style={{
                        flex: 1, border: 'none', background: 'transparent', outline: 'none',
                        resize: 'vertical', minHeight: '44px',
                        fontSize: '13.5px', color: 'var(--c-warn-textsoft)', lineHeight: 1.6,
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}