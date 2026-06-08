'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { db } from '@/lib/firebase'
import {
  collection, query, where, getDocs, getDoc, addDoc, doc, deleteDoc
} from 'firebase/firestore'
import {
  SkeletonTrangChuGV,
  SkeletonGVExerciseList,
  SkeletonGVClassButtons,
  SkeletonGVExerciseDropdown,
  SkeletonGVProgressTable,
} from '@/app/components/Skeleton'
import Papa from 'papaparse'
import { convertDriveLink } from '@/lib/driveUtils'

const accentKyNang = {
  'Reading':          'var(--c-primary-mid)',
  'Listening':        'var(--c-success)',
  'Writing':          'var(--c-writing)',
  'Speaking':         'var(--c-speaking)',
  'Vocab Reading':    'var(--c-primary-mid)',
  'Vocab Listening':  'var(--c-success)',
}

const iconKyNang = {
  'Reading':         '📖',
  'Listening':       '🎧',
  'Writing':         '✍️',
  'Speaking':        '🗣️',
  'Vocab Reading':   '🔤',
  'Vocab Listening': '🔊',
}

const mauKyNang = {
  'Reading':   { bg: 'var(--c-primary-mid)', text: 'var(--c-surface)' },
  'Listening': { bg: 'var(--c-success)',     text: 'var(--c-surface)' },
  'Writing':   { bg: 'var(--c-writing)',     text: 'var(--c-surface)' },
  'Speaking':  { bg: 'var(--c-speaking)',    text: 'var(--c-surface)' },
}

const mauMucDo = {
  'Cơ bản':    { bg: 'var(--c-success-bg)', text: 'var(--c-success-text)' },
  'Trung bình':{ bg: 'var(--c-warn-bg)',    text: 'var(--c-warn-text)'    },
  'Nâng cao':  { bg: 'var(--c-danger-bg)',  text: 'var(--c-danger-text)'  },
}

const cacMucDo  = ['Tất cả', 'Cơ bản', 'Trung bình', 'Nâng cao']
const cacKyNang = ['Tất cả', 'Reading', 'Listening', 'Writing', 'Speaking']

const getUserInfo = () => {
  try {
    const raw = document.cookie.split('; ').find(r => r.startsWith('userInfo='))?.split('=')[1]
    return JSON.parse(decodeURIComponent(raw))
  } catch { return null }
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function TrangChuGV() {
  const router = useRouter()
  const [tab, setTab]         = useState('baiTap')
  const [userInfo, setUserInfo] = useState(null)

  useEffect(() => {
    if (!Cookies.get('isLoggedIn')) { router.push('/'); return }
    const info = getUserInfo()
    if (!info || info.vaiTro !== 'Giáo viên') { router.push('/trang-chu'); return }
    setUserInfo(info)
  }, [])

  if (!userInfo) return <SkeletonTrangChuGV />

  return (
    <main style={{ minHeight: 'calc(100vh - 56px)', backgroundColor: 'var(--c-primary-bgsoft)' }}>
      <div style={{
        backgroundColor: 'var(--c-surface)',
        borderBottom: '1px solid var(--c-primary-pale)',
        display: 'flex', paddingLeft: '24px',
      }}>
        {[{ key: 'baiTap', label: '📚 Bài tập' }, { key: 'tienDo', label: '📊 Tiến độ' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '14px 24px', border: 'none',
            borderBottom: tab === t.key ? '3px solid var(--c-primary)' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: tab === t.key ? 'var(--c-primary)' : 'var(--c-text-muted)',
            fontWeight: tab === t.key ? '600' : '400',
            fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
        {tab === 'baiTap' && <TabBaiTap userInfo={userInfo} />}
        {tab === 'tienDo' && <TabTienDo userInfo={userInfo} />}
      </div>
    </main>
  )
}

// ─── TAB BÀI TẬP ─────────────────────────────────────────────────────────────
function TabBaiTap({ userInfo }) {
  const [exercises, setExercises]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [selected, setSelected]     = useState(new Set())
  const [filterMucDo, setFilterMucDo]   = useState('Tất cả')
  const [filterKyNang, setFilterKyNang] = useState('Tất cả')
  const [showDelete, setShowDelete]   = useState(false)
  const [deletingEx, setDeletingEx]   = useState(null)
  const [isDeleting, setIsDeleting]   = useState(false)

  const loadExercises = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'exercises'))
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      const kyNangOrder = { 'Listening': 0, 'Reading': 1, 'Speaking': 2, 'Writing': 3 }
      list.sort((a, b) => {
        const loaiA = a.loaiBai === 'TOEIC' ? '' : a.loaiBai
        const loaiB = b.loaiBai === 'TOEIC' ? '' : b.loaiBai
        if (loaiA !== loaiB) return loaiA.localeCompare(loaiB)
        const kyA = kyNangOrder[a.kyNang] ?? 99
        const kyB = kyNangOrder[b.kyNang] ?? 99
        if (kyA !== kyB) return kyA - kyB
        return a.tenBaiTap.localeCompare(b.tenBaiTap, 'vi')
      })
      setExercises(list)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleXoaBai = async () => {
    if (!deletingEx) return
    setIsDeleting(true)
    try {
      const assignSnap = await getDocs(query(
        collection(db, 'assignments'), where('exerciseId', '==', deletingEx.id)
      ))
      await Promise.all(assignSnap.docs.map(d => deleteDoc(d.ref)))
      await deleteDoc(doc(db, 'exercises', deletingEx.id))
      setShowDelete(false); setDeletingEx(null)
      loadExercises()
    } catch (err) {
      console.error('Lỗi khi xoá bài:', err)
      alert('Có lỗi khi xoá bài. Thử lại sau!')
    } finally { setIsDeleting(false) }
  }

  useEffect(() => { loadExercises() }, [])

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filtered = exercises.filter(ex => {
    const okMucDo  = filterMucDo  === 'Tất cả' || ex.mucDo  === filterMucDo
    const okKyNang = filterKyNang === 'Tất cả' || ex.kyNang === filterKyNang
    return okMucDo && okKyNang
  })

  const selectedExercises = exercises.filter(ex => selected.has(ex.id))

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--c-primary-dark)', lineHeight: 1.2 }}>
            Danh sách bài tập
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--c-text-muted)', lineHeight: 1 }}>
            {exercises.length} bài · {filtered.length} đang hiển thị
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
          {selected.size > 0 && (
            <button
              onClick={() => setShowAssign(true)}
              style={{
                padding: '10px 20px', borderRadius: '9px', border: 'none',
                backgroundColor: 'var(--c-success)', color: '#fff',
                fontSize: '14px', fontWeight: '600', cursor: 'pointer',
              }}
            >
              Giao {selected.size} bài đã chọn
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: '10px 20px', borderRadius: '9px', border: 'none',
              backgroundColor: 'var(--c-primary)', color: '#fff',
              fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            }}
          >
            + Tạo bài mới
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: '20px', marginBottom: '20px',
        padding: '14px 18px', backgroundColor: 'var(--c-surface)',
        borderRadius: '12px', border: '1px solid var(--c-primary-pale)',
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        <FilterGroup label="Mức độ"  options={cacMucDo}  value={filterMucDo}  onChange={setFilterMucDo} />
        <div style={{ width: '1px', height: '22px', backgroundColor: 'var(--c-primary-pale)' }} />
        <FilterGroup label="Kỹ năng" options={cacKyNang} value={filterKyNang} onChange={setFilterKyNang} />
      </div>

      {loading ? <SkeletonGVExerciseList /> : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(186px, 1fr))',
          gap: '16px',
        }}>
          {filtered.map(ex => (
            <CardBaiTapGV
              key={ex.id}
              ex={ex}
              isSelected={selected.has(ex.id)}
              onToggle={() => toggleSelect(ex.id)}
              onGiaoNhanh={() => { setSelected(new Set([ex.id])); setShowAssign(true) }}
              onXoa={() => { setDeletingEx(ex); setShowDelete(true) }}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <ModalTaoBai
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadExercises() }}
        />
      )}

      {showDelete && deletingEx && (
        <Overlay onClose={() => { setShowDelete(false); setDeletingEx(null) }}>
          <h3 style={{ margin: 0, color: 'var(--c-primary-dark)' }}>Xác nhận xoá bài tập</h3>
          <div style={{ backgroundColor: 'var(--c-danger-bg)', borderRadius: '10px', padding: '12px 16px', textAlign: 'center' }}>
            <span style={{ color: 'var(--c-danger-text)', fontSize: '14px', fontWeight: '500' }}>
              ⚠️ Bạn sắp xoá bài <strong>"{deletingEx.tenBaiTap}"</strong>.<br />
              Tất cả assignment liên quan cũng sẽ bị xoá vĩnh viễn.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => { setShowDelete(false); setDeletingEx(null) }} style={btnSecondary}>Huỷ</button>
            <button onClick={handleXoaBai} disabled={isDeleting}
              style={{ ...btnPrimary, backgroundColor: 'var(--c-danger)', opacity: isDeleting ? 0.7 : 1 }}>
              {isDeleting ? 'Đang xoá...' : 'Xoá bài'}
            </button>
          </div>
        </Overlay>
      )}

      {showAssign && (
        <ModalGiaoBai
          exercises={selectedExercises}
          userInfo={userInfo}
          onClose={() => { setShowAssign(false); setSelected(new Set()) }}
        />
      )}
    </div>
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
        <button key={opt} onClick={() => onChange(opt)} style={{
          padding: '5px 13px', borderRadius: '9999px', fontSize: '13px',
          border: `1.5px solid ${value === opt ? 'var(--c-primary)' : 'var(--c-primary-pale)'}`,
          backgroundColor: value === opt ? 'var(--c-primary)' : 'transparent',
          color: value === opt ? '#fff' : 'var(--c-text-soft)',
          fontWeight: value === opt ? '600' : '400',
          cursor: 'pointer', transition: 'all 0.15s',
        }}>{opt}</button>
      ))}
    </div>
  )
}

/* ── CardBaiTapGV ─────────────────────────────────────────────────── */
function CardBaiTapGV({ ex, isSelected, onToggle, onGiaoNhanh, onXoa }) {
  const [hovered,    setHovered]    = useState(false)
  const [hoverGiao,  setHoverGiao]  = useState(false)
  const [hoverXoa,   setHoverXoa]   = useState(false)

  const accent = accentKyNang[ex.kyNang] || 'var(--c-primary-mid)'
  const icon   = iconKyNang[ex.kyNang]   || '📝'
  const mauDo  = mauMucDo[ex.mucDo]     || null

  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column',
        backgroundColor: isSelected ? 'var(--c-primary-bgsoft)' : 'var(--c-surface)',
        borderRadius: '14px', overflow: 'hidden', cursor: 'pointer',
        boxShadow: hovered ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
        border: isSelected
          ? '2px solid var(--c-primary)'
          : '1px solid var(--c-border-soft)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.15s, background-color 0.15s',
      }}
    >
      {/* Accent bar + selected checkmark */}
      <div style={{ position: 'relative' }}>
        <div style={{ height: '4px', backgroundColor: accent }} />
        {/* Checkbox */}
        <div style={{
          position: 'absolute', top: '-28px', right: '10px',
          width: '18px', height: '18px', borderRadius: '5px',
          border: `2px solid ${isSelected ? 'var(--c-primary)' : 'var(--c-primary-pale)'}`,
          backgroundColor: isSelected ? 'var(--c-primary)' : 'var(--c-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
          /* float it above the accent bar */
          marginTop: '28px',
          zIndex: 1,
        }}>
          {isSelected && <span style={{ color: '#fff', fontSize: '11px', fontWeight: '700', lineHeight: 1 }}>✓</span>}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>

        {/* Icon + skill label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '17px', lineHeight: 1 }}>{icon}</span>
          <span style={{
            fontSize: '10.5px', fontWeight: '700', letterSpacing: '0.04em',
            color: 'var(--c-text-muted)', textTransform: 'uppercase',
          }}>
            {ex.loaiBai} · {ex.kyNang}
          </span>
        </div>

        {/* Title */}
        <p style={{
          margin: 0, fontSize: '13.5px', fontWeight: '600',
          color: 'var(--c-primary-dark)', lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {ex.tenBaiTap}
        </p>

        {/* Difficulty badge */}
        {mauDo && (
          <span style={{
            padding: '2px 9px', borderRadius: '9999px', alignSelf: 'flex-start',
            fontSize: '11px', fontWeight: '600',
            backgroundColor: mauDo.bg, color: mauDo.text,
          }}>
            {ex.mucDo}
          </span>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: 'auto', paddingTop: '4px' }}>
          <button
            onClick={e => { e.stopPropagation(); onGiaoNhanh() }}
            onMouseEnter={() => setHoverGiao(true)}
            onMouseLeave={() => setHoverGiao(false)}
            style={{
              padding: '9px 0', borderRadius: '9px', border: 'none',
              backgroundColor: hoverGiao ? 'var(--c-primary-dark)' : 'var(--c-primary-mid)',
              color: '#fff', fontSize: '13px', fontWeight: '600',
              cursor: 'pointer', transition: 'background-color 0.15s',
              width: '100%', letterSpacing: '0.01em',
            }}
          >
            Giao bài
          </button>
          <button
            onClick={e => { e.stopPropagation(); onXoa() }}
            onMouseEnter={() => setHoverXoa(true)}
            onMouseLeave={() => setHoverXoa(false)}
            style={{
              padding: '8px 0', borderRadius: '9px',
              border: `1.5px solid ${hoverXoa ? 'var(--c-danger)' : 'var(--c-danger-border)'}`,
              backgroundColor: hoverXoa ? 'var(--c-danger-bg)' : 'transparent',
              color: hoverXoa ? 'var(--c-danger-text)' : 'var(--c-text-muted)',
              fontSize: '13px', fontWeight: '500',
              cursor: 'pointer', transition: 'all 0.15s',
              width: '100%', letterSpacing: '0.01em',
            }}
          >
            Xoá bài
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MODAL TẠO BÀI ───────────────────────────────────────────────────────────
function ModalTaoBai({ onClose, onCreated }) {
  const [form, setForm] = useState({
    tenBaiTap: '', kyNang: 'Reading', loaiBai: 'IELTS',
    mucDo: 'Cơ bản', linkDrive: ''
  })
  const [saving, setSaving] = useState(false)
  const [loi, setLoi]       = useState('')

  const handleSave = async () => {
    if (!form.tenBaiTap.trim() || !form.linkDrive.trim()) {
      setLoi('Vui lòng điền đầy đủ thông tin'); return
    }
    setSaving(true)
    try {
      await addDoc(collection(db, 'exercises'), {
        tenBaiTap: form.tenBaiTap.trim(),
        kyNang:    form.kyNang,
        loaiBai:   form.loaiBai,
        mucDo:     form.mucDo,
        linkDrive: form.linkDrive.trim(),
      })
      onCreated()
    } catch (err) {
      setLoi('Lỗi khi tạo bài, thử lại sau')
      console.error(err)
    } finally { setSaving(false) }
  }

  const inputStyle = {
    padding: '10px 12px', borderRadius: '8px',
    border: '1px solid var(--c-primary-pale)', fontSize: '14px',
    backgroundColor: 'var(--c-surface)', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  }
  const labelStyle = { color: 'var(--c-primary)', fontSize: '13px', fontWeight: '500' }

  return (
    <Overlay onClose={onClose}>
      <h3 style={{ margin: 0, color: 'var(--c-primary-dark)' }}>Tạo bài tập mới</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={labelStyle}>Tên bài tập</label>
        <input style={inputStyle} placeholder="Nhập tên bài tập"
          value={form.tenBaiTap} onChange={e => setForm(f => ({ ...f, tenBaiTap: e.target.value }))} />
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <label style={labelStyle}>Loại bài</label>
          <select style={inputStyle} value={form.loaiBai}
            onChange={e => setForm(f => ({ ...f, loaiBai: e.target.value }))}>
            {['IELTS', 'TOEIC', 'TOEFL', 'Khác'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <label style={labelStyle}>Kỹ năng</label>
          <select style={inputStyle} value={form.kyNang}
            onChange={e => setForm(f => ({ ...f, kyNang: e.target.value }))}>
            {['Reading', 'Listening', 'Writing', 'Speaking', 'Vocab Reading', 'Vocab Listening'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={labelStyle}>Mức độ</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['Cơ bản', 'Trung bình', 'Nâng cao'].map(m => {
            const mau = mauMucDo[m]
            const isSelected = form.mucDo === m
            return (
              <button key={m} onClick={() => setForm(f => ({ ...f, mucDo: m }))} style={{
                flex: 1, padding: '8px', borderRadius: '8px',
                border: `1.5px solid ${isSelected ? mau.text : 'var(--c-primary-pale)'}`,
                backgroundColor: isSelected ? mau.bg : 'var(--c-surface)',
                color: isSelected ? mau.text : 'var(--c-text-muted)',
                fontSize: '13px', fontWeight: isSelected ? '600' : '400',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>{m}</button>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={labelStyle}>Link Google Drive (Excel)</label>
        <input style={inputStyle} placeholder="https://docs.google.com/spreadsheets/..."
          value={form.linkDrive} onChange={e => setForm(f => ({ ...f, linkDrive: e.target.value }))} />
      </div>

      {loi && <p style={{ margin: 0, color: 'var(--c-danger)', fontSize: '13px' }}>{loi}</p>}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onClose} style={btnSecondary}>Huỷ</button>
        <button onClick={handleSave} disabled={saving} style={btnPrimary}>
          {saving ? 'Đang lưu...' : 'Tạo bài'}
        </button>
      </div>
    </Overlay>
  )
}

// ─── MODAL GIAO BÀI ───────────────────────────────────────────────────────────
function ModalGiaoBai({ exercises, userInfo, onClose }) {
  const [classes, setClasses]             = useState([])
  const [selectedLops, setSelectedLops]   = useState(new Set())
  const [hocViensByLop, setHocViensByLop] = useState({})
  const [selectedHVs, setSelectedHVs]     = useState(new Set())
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [done, setDone]                   = useState(false)

  useEffect(() => { loadClasses() }, [])

  const loadClasses = async () => {
    try {
      const snap = await getDocs(query(
        collection(db, 'classes'), where('giaoVienId', '==', userInfo.taiKhoan)
      ))
      setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleToggleLop = async (cls) => {
    const lopName = cls.lop
    const next = new Set(selectedLops)
    if (next.has(lopName)) {
      next.delete(lopName)
      const hvIds = (hocViensByLop[lopName] || []).map(h => h.id)
      setSelectedHVs(prev => { const s = new Set(prev); hvIds.forEach(id => s.delete(id)); return s })
    } else {
      next.add(lopName)
      if (!hocViensByLop[lopName] && cls.hocVienIds?.length) {
        const hvData = await Promise.all(
          cls.hocVienIds.map(async uid => {
            const snap = await getDoc(doc(db, 'users', uid))
            return snap.exists() ? { id: uid, ...snap.data() } : null
          })
        )
        const hvs = hvData.filter(Boolean)
        setHocViensByLop(prev => ({ ...prev, [lopName]: hvs }))
        setSelectedHVs(prev => { const s = new Set(prev); hvs.forEach(h => s.add(h.id)); return s })
      } else if (hocViensByLop[lopName]) {
        setSelectedHVs(prev => { const s = new Set(prev); hocViensByLop[lopName].forEach(h => s.add(h.id)); return s })
      }
    }
    setSelectedLops(next)
  }

  const toggleHV = (uid) => {
    setSelectedHVs(prev => { const s = new Set(prev); s.has(uid) ? s.delete(uid) : s.add(uid); return s })
  }

  const allHVs    = [...selectedLops].flatMap(lopName => hocViensByLop[lopName] || [])
  const uniqueHVs = [...new Map(allHVs.map(h => [h.id, h])).values()]

  const handleGiao = async () => {
    if (!selectedHVs.size || !exercises.length) return
    setSaving(true)
    try {
      const thoiGianGiao = new Date().toISOString()
      await Promise.all(
        exercises.flatMap(ex =>
          [...selectedHVs].map(uid => {
            const lopName = [...selectedLops].find(lopName =>
              (hocViensByLop[lopName] || []).some(h => h.id === uid)
            ) || ''
            return addDoc(collection(db, 'assignments'), {
              userId: uid, exerciseId: ex.id, lopId: lopName,
              thoiGianGiao, trangThai: 'Chưa làm',
            })
          })
        )
      )
      setDone(true)
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  return (
    <Overlay onClose={onClose} width="520px">
      {done ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '48px' }}>✅</div>
          <h3 style={{ margin: 0, color: 'var(--c-primary-dark)' }}>Giao bài thành công!</h3>
          <p style={{ margin: 0, color: 'var(--c-text-soft)', fontSize: '14px', textAlign: 'center' }}>
            Đã giao <strong>{exercises.length}</strong> bài cho <strong>{selectedHVs.size}</strong> học viên.
          </p>
          <button onClick={onClose} style={{ ...btnPrimary, width: '100%' }}>Đóng</button>
        </div>
      ) : (
        <>
          <h3 style={{ margin: 0, color: 'var(--c-primary-dark)' }}>
            Giao bài ({exercises.length} bài đã chọn)
          </h3>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {exercises.map(ex => {
              const mau = mauKyNang[ex.kyNang] || { bg: 'var(--c-primary)', text: '#fff' }
              return (
                <span key={ex.id} style={{
                  padding: '4px 10px', borderRadius: '9999px',
                  backgroundColor: mau.bg, color: mau.text,
                  fontSize: '12px', fontWeight: '500',
                }}>{ex.tenBaiTap}</span>
              )
            })}
          </div>

          {loading ? (
            <p style={{ color: 'var(--c-primary)', fontSize: '14px' }}>Đang tải lớp...</p>
          ) : (
            <>
              <div>
                <p style={{ margin: '0 0 8px', color: 'var(--c-primary)', fontSize: '13px', fontWeight: '500' }}>Chọn lớp</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {classes.map(cls => (
                    <button key={cls.id} onClick={() => handleToggleLop(cls)} style={{
                      padding: '7px 16px', borderRadius: '9999px',
                      border: `1.5px solid ${selectedLops.has(cls.lop) ? 'var(--c-primary)' : 'var(--c-primary-pale)'}`,
                      backgroundColor: selectedLops.has(cls.lop) ? 'var(--c-primary)' : 'var(--c-surface)',
                      color: selectedLops.has(cls.lop) ? '#fff' : 'var(--c-primary-mid)',
                      fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.15s',
                    }}>{cls.lop}</button>
                  ))}
                </div>
              </div>

              {uniqueHVs.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <p style={{ margin: 0, color: 'var(--c-primary)', fontSize: '13px', fontWeight: '500' }}>
                      Học viên ({selectedHVs.size}/{uniqueHVs.length})
                    </p>
                    <button
                      onClick={() => {
                        if (selectedHVs.size === uniqueHVs.length) setSelectedHVs(new Set())
                        else setSelectedHVs(new Set(uniqueHVs.map(h => h.id)))
                      }}
                      style={{
                        marginLeft: 'auto', padding: '4px 12px', borderRadius: '6px',
                        border: '1px solid var(--c-primary-pale)', backgroundColor: 'var(--c-surface)',
                        color: 'var(--c-primary-mid)', fontSize: '12px', cursor: 'pointer',
                      }}
                    >
                      {selectedHVs.size === uniqueHVs.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                  </div>

                  <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid var(--c-primary-pale)', borderRadius: '10px' }}>
                    {uniqueHVs.map((hv, i) => (
                      <div key={hv.id} onClick={() => toggleHV(hv.id)} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 14px', cursor: 'pointer',
                        borderBottom: i < uniqueHVs.length - 1 ? '1px solid var(--c-primary-bg)' : 'none',
                        backgroundColor: selectedHVs.has(hv.id) ? 'var(--c-primary-bgsoft)' : 'var(--c-surface)',
                        transition: 'background-color 0.15s',
                      }}>
                        <div style={{
                          width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                          border: `2px solid ${selectedHVs.has(hv.id) ? 'var(--c-primary)' : 'var(--c-primary-pale)'}`,
                          backgroundColor: selectedHVs.has(hv.id) ? 'var(--c-primary)' : 'var(--c-surface)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}>
                          {selectedHVs.has(hv.id) && <span style={{ color: '#fff', fontSize: '11px', fontWeight: '700' }}>✓</span>}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: 'var(--c-primary-dark)' }}>{hv.ho} {hv.ten}</p>
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--c-text-muted)' }}>{hv.lop} · {hv.taiKhoan}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={onClose} style={btnSecondary}>Huỷ</button>
                <button onClick={handleGiao} disabled={saving || !selectedHVs.size || !selectedLops.size}
                  style={{ ...btnPrimary, opacity: (!selectedHVs.size || !selectedLops.size) ? 0.5 : 1 }}>
                  {saving ? 'Đang giao...' : `Giao cho ${selectedHVs.size} học viên`}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Overlay>
  )
}

// ─── TAB TIẾN ĐỘ ─────────────────────────────────────────────────────────────
function TabTienDo({ userInfo }) {
  const [classes, setClasses]           = useState([])
  const [selectedLop, setSelectedLop]   = useState(null)
  const [exercises, setExercises]       = useState([])
  const [selectedExId, setSelectedExId] = useState('')
  const [rows, setRows]                 = useState([])
  const [loading, setLoading]           = useState(false)
  const [loadingLop, setLoadingLop]     = useState(false)
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [showThongKe, setShowThongKe] = useState(false)

  useEffect(() => { loadClasses() }, [])

  const loadClasses = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'classes'), where('giaoVienId', '==', userInfo.taiKhoan)))
      setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) { console.error(err) }
    finally { setLoadingClasses(false) }
  }

  const loadRows = async (ex, lop) => {
    setLoading(true); setRows([])
    try {
      const hvData = await Promise.all(
        (lop.hocVienIds || []).map(async uid => {
          const s = await getDoc(doc(db, 'users', uid))
          return s.exists() ? { id: uid, ...s.data() } : null
        })
      )
      const hvs = hvData.filter(Boolean)
      const subSnap = await getDocs(query(collection(db, 'submissions'), where('exerciseId', '==', ex.id)))
      const subMap = {}
      subSnap.docs.forEach(d => {
        const data = d.data()
        if (!subMap[data.userId] || (data.diem ?? -1) > (subMap[data.userId].diem ?? -1)) subMap[data.userId] = data
      })
      setRows(hvs.map(hv => ({ ...hv, sub: subMap[hv.id] || null })))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleChonLop = async (cls) => {
    if (selectedLop?.id === cls.id) return
    setSelectedLop(cls); setSelectedExId(''); setExercises([]); setRows([])
    setLoadingLop(true)
    try {
      const snap = await getDocs(query(collection(db, 'assignments'), where('lopId', '==', cls.lop)))
      const exTimeMap = {}
      snap.docs.forEach(d => {
        const { exerciseId, thoiGianGiao } = d.data()
        if (!exTimeMap[exerciseId] || (thoiGianGiao || '') > exTimeMap[exerciseId]) exTimeMap[exerciseId] = thoiGianGiao || ''
      })
      const exData = await Promise.all(
        Object.keys(exTimeMap).map(async exId => {
          const s = await getDoc(doc(db, 'exercises', exId))
          return s.exists() ? { id: exId, ...s.data(), thoiGianGiao: exTimeMap[exId] } : null
        })
      )
      const sorted = exData.filter(Boolean).sort((a, b) => (b.thoiGianGiao || '').localeCompare(a.thoiGianGiao || ''))
      setExercises(sorted)
      if (sorted.length > 0) { setSelectedExId(sorted[0].id); await loadRows(sorted[0], cls) }
    } catch (err) { console.error(err) }
    finally { setLoadingLop(false) }
  }

  const handleChangeEx = async (exId) => {
    if (exId === selectedExId) return
    setSelectedExId(exId)
    const ex = exercises.find(e => e.id === exId)
    if (ex && selectedLop) await loadRows(ex, selectedLop)
  }

  const selectedEx  = exercises.find(e => e.id === selectedExId) || null
  const daDam       = rows.filter(r =>  r.sub).length
  const chuaLam     = rows.filter(r => !r.sub).length
  const diemTB      = (() => {
    const co = rows.filter(r => r.sub?.diem != null)
    if (!co.length) return null
    return (co.reduce((s, r) => s + r.sub.diem / r.sub.tongCau * 100, 0) / co.length).toFixed(0)
  })()

  const formatNgay = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const mauEx = selectedEx ? (mauKyNang[selectedEx.kyNang] || { bg: 'var(--c-primary)', text: '#fff' }) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--c-primary-dark)', lineHeight: 1.2 }}>
          Tiến độ học viên
        </h2>
      </div>

      {loadingClasses ? <SkeletonGVClassButtons /> : (
        <div>
          <p style={{ margin: '0 0 8px', color: 'var(--c-primary)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Chọn lớp
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {classes.map(cls => (
              <button key={cls.id} onClick={() => handleChonLop(cls)} style={{
                padding: '8px 20px', borderRadius: '9999px', fontSize: '14px',
                fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s',
                border: `1.5px solid ${selectedLop?.id === cls.id ? 'var(--c-primary)' : 'var(--c-primary-pale)'}`,
                backgroundColor: selectedLop?.id === cls.id ? 'var(--c-primary)' : 'var(--c-surface)',
                color: selectedLop?.id === cls.id ? '#fff' : 'var(--c-primary-mid)',
              }}>{cls.lop}</button>
            ))}
          </div>
        </div>
      )}

      {loadingLop && <SkeletonGVExerciseDropdown />}

      {!loadingLop && selectedLop && exercises.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
          padding: '14px 18px', borderRadius: '12px',
          backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-primary-pale)',
        }}>
          <label style={{ fontSize: '13px', color: 'var(--c-primary)', fontWeight: '500', whiteSpace: 'nowrap' }}>
            Bài tập:
          </label>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <select value={selectedExId} onChange={e => handleChangeEx(e.target.value)} style={{
              width: '100%', padding: '9px 36px 9px 14px',
              borderRadius: '8px', border: '1.5px solid var(--c-primary-pale)',
              backgroundColor: 'var(--c-surface)', color: 'var(--c-primary-dark)',
              fontSize: '14px', fontWeight: '500', cursor: 'pointer',
              outline: 'none', appearance: 'none', WebkitAppearance: 'none',
            }}>
              {exercises.map((ex, idx) => (
                <option key={ex.id} value={ex.id}>
                  {idx === 0 ? '★ ' : ''}{ex.kyNang} · {ex.tenBaiTap}
                  {ex.thoiGianGiao ? `  —  ${formatNgay(ex.thoiGianGiao)}` : ''}
                </option>
              ))}
            </select>
            <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--c-primary-mid)', fontSize: '11px' }}>▼</span>
          </div>
          {mauEx && (
            <span style={{ padding: '5px 14px', borderRadius: '9999px', whiteSpace: 'nowrap', backgroundColor: mauEx.bg, color: mauEx.text, fontSize: '12px', fontWeight: '600' }}>
              {selectedEx.loaiBai} · {selectedEx.kyNang}
            </span>
          )}
          {selectedEx?.thoiGianGiao && (
            <span style={{ fontSize: '12px', color: 'var(--c-text-muted)', whiteSpace: 'nowrap' }}>
              🕐 Giao: {formatNgay(selectedEx.thoiGianGiao)}
            </span>
          )}
        </div>
      )}

      {!loadingLop && selectedLop && exercises.length === 0 && (
        <p style={{ color: 'var(--c-text-muted)', fontSize: '14px' }}>Lớp này chưa được giao bài tập nào.</p>
      )}

      {selectedEx && (
        <div>
          {loading ? <SkeletonGVProgressTable /> : (
            <>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Tổng học viên', value: rows.length,                  bg: 'var(--c-primary-bg)',  color: 'var(--c-primary-dark)'  },
                  { label: 'Đã làm',        value: daDam,                        bg: 'var(--c-success-bg)', color: 'var(--c-success-text)'  },
                  { label: 'Chưa làm',      value: chuaLam,                      bg: 'var(--c-danger-bg)',  color: 'var(--c-danger-text)'   },
                  { label: 'Điểm TB',       value: diemTB ? `${diemTB}%` : '—', bg: 'var(--c-warn-bg)',    color: 'var(--c-warn-text)'     },
                ].map(s => (
                  <div key={s.label} style={{ padding: '12px 20px', borderRadius: '12px', backgroundColor: s.bg, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '12px', color: s.color, fontWeight: '500' }}>{s.label}</span>
                    <span style={{ fontSize: '22px', fontWeight: '700', color: s.color }}>{s.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginLeft: 'auto', alignSelf: 'flex-start' }}>
                <button
                  onClick={() => setShowThongKe(true)}
                  style={{
                    padding: '10px 20px', borderRadius: '9px', border: 'none',
                    backgroundColor: 'var(--c-primary)', color: '#fff',
                    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  📊 Xem đề & thống kê
                </button>
              </div>

              <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--c-primary-pale)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', backgroundColor: 'var(--c-primary)', padding: '10px 16px', gap: '8px' }}>
                  {['Học viên', 'Lớp', 'Trạng thái', 'Điểm cao nhất', 'Thời gian nộp'].map(h => (
                    <span key={h} style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>{h}</span>
                  ))}
                </div>
                {rows.map((r, i) => {
                  const daDamRow  = !!r.sub
                  const phanTram  = r.sub?.diem != null ? Math.round(r.sub.diem / r.sub.tongCau * 100) : null
                  return (
                    <div key={r.id} style={{
                      display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                      padding: '10px 16px', gap: '8px', alignItems: 'center',
                      backgroundColor: i % 2 === 0 ? 'var(--c-surface)' : 'var(--c-primary-barest)',
                      borderTop: '1px solid var(--c-primary-bg)',
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--c-primary-dark)' }}>{r.ho} {r.ten}</span>
                      <span style={{ fontSize: '13px', color: 'var(--c-text-soft)' }}>{r.lop}</span>
                      <span style={{
                        fontSize: '12px', fontWeight: '500', padding: '3px 10px', borderRadius: '9999px',
                        backgroundColor: daDamRow ? 'var(--c-success-bg)' : 'var(--c-danger-bg)',
                        color: daDamRow ? 'var(--c-success-text)' : 'var(--c-danger-text)',
                        alignSelf: 'center', justifySelf: 'start',
                      }}>
                        {daDamRow ? 'Đã làm' : 'Chưa làm'}
                      </span>
                      <span style={{
                        fontSize: '14px', fontWeight: '600',
                        color: phanTram >= 50 ? 'var(--c-success)' : phanTram != null ? 'var(--c-danger)' : 'var(--c-primary-pale)',
                      }}>
                        {r.sub?.diem != null ? `${r.sub.diem}/${r.sub.tongCau} (${phanTram}%)` : '—'}
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--c-text-muted)' }}>{formatNgay(r.sub?.thoiGianNop)}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
      {showThongKe && selectedEx && (
        <ModalThongKe
          exercise={selectedEx}
          submissions={rows.filter(r => r.sub).map(r => r.sub)}
          onClose={() => setShowThongKe(false)}
        />
      )}
    </div>
  )
}

// ─── MODAL THỐNG KÊ ĐỀ BÀI ───────────────────────────────────────────────────
function ModalThongKe({ exercise, submissions, onClose }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    loadQuestions()
  }, [])

  const loadQuestions = async () => {
    try {
      const fileId = exercise.linkDrive.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1]
      if (!fileId) return
      const csvUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`
      const res  = await fetch(csvUrl)
      const text = await res.text()
      const { data } = Papa.parse(text, { header: true, skipEmptyLines: true })
      setQuestions(data.map((row, i) => ({ ...row, globalIndex: i })))
    } catch (err) {
      console.error('Lỗi khi tải đề:', err)
    } finally {
      setLoading(false)
    }
  }

  // Tính phân phối đáp án cho 1 câu
  const getDistribution = (q) => {
    const idx = q.globalIndex
    const type = q.Question_Type

    if (type === 'mcq' || type === 'mcq_blank') {
      const counts = {}
      submissions.forEach(sub => {
        const ans = sub.answers?.[idx]
        if (ans) counts[ans] = (counts[ans] || 0) + 1
      })
      const total = submissions.length || 1
      const correct = q.Correct_Ans?.trim()
      return { type: 'choice', counts, total, correct }
    }

    if (type === 'fill_blank') {
      const correct = (q.Correct_Ans || '').split('|').map(s => s.trim())
      const slotCounts = correct.map((c, si) => {
        const counts = {}
        submissions.forEach(sub => {
          const ans = (sub.answers?.[idx] || [])[si]
          if (ans) counts[ans.trim()] = (counts[ans.trim()] || 0) + 1
        })
        return { slot: si, correct: c, counts, total: submissions.length || 1 }
      })
      return { type: 'fill_blank', slotCounts }
    }

    if (type === 'fill_short') {
      const correct = (q.Correct_Ans || '').split('|').map(s => s.trim())
      const slotCounts = correct.map((c, si) => {
        const counts = {}
        submissions.forEach(sub => {
          const ans = (sub.answers?.[idx] || [])[si]
          if (ans) counts[ans.trim()] = (counts[ans.trim()] || 0) + 1
        })
        return { slot: si, correct: c, counts, total: submissions.length || 1 }
      })
      return { type: 'fill_short', slotCounts }
    }

    // fill_long: hiển thị tất cả bài làm
    const allAnswers = submissions
      .map(sub => sub.answers?.[idx])
      .filter(Boolean)
    return { type: 'fill_long', allAnswers }
  }

  const getOptions = (q) =>
    ['A', 'B', 'C', 'D', 'E']
      .map(k => ({ key: k, value: q[`Opt_${k}`] }))
      .filter(o => o.value?.trim())

  const totalSubs = submissions.length

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      backgroundColor: 'var(--c-overlay)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        backgroundColor: 'var(--c-surface)',
        borderRadius: '16px',
        width: '100%', maxWidth: '720px',
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow-modal)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--c-primary-pale)',
          display: 'flex', alignItems: 'center', gap: '12px',
          flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--c-primary-dark)' }}>
              📊 Thống kê đáp án
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--c-text-muted)' }}>
              {exercise.tenBaiTap} · {totalSubs} học viên đã nộp
            </p>
          </div>
          <button onClick={onClose} style={{
            width: '32px', height: '32px', borderRadius: '8px',
            border: '1px solid var(--c-primary-pale)',
            backgroundColor: 'var(--c-surface)',
            color: 'var(--c-text-muted)', fontSize: '16px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{
                  padding: '16px', borderRadius: '12px',
                  border: '1px solid var(--c-primary-pale)',
                  display: 'flex', flexDirection: 'column', gap: '10px',
                }}>
                  <div style={{ height: '14px', width: '70%', borderRadius: '4px', backgroundColor: 'var(--c-primary-pale)', animation: 'sk-pulse 1.6s ease-in-out infinite' }} />
                  {[100, 80, 90, 85].map((w, j) => (
                    <div key={j} style={{ height: '32px', width: `${w}%`, borderRadius: '6px', backgroundColor: 'var(--c-primary-bg)', animation: 'sk-pulse 1.6s ease-in-out infinite' }} />
                  ))}
                </div>
              ))}
            </div>
          ) : questions.length === 0 ? (
            <p style={{ color: 'var(--c-text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>
              Không thể tải đề bài.
            </p>
          ) : (
            questions.map((q) => {
              const dist = getDistribution(q)
              return (
                <div key={q.globalIndex} style={{
                  padding: '16px 18px',
                  borderRadius: '12px',
                  border: '1px solid var(--c-primary-pale)',
                  backgroundColor: 'var(--c-surface)',
                  display: 'flex', flexDirection: 'column', gap: '12px',
                }}>
                  {/* Câu hỏi */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{
                      minWidth: '26px', height: '26px', borderRadius: '6px',
                      backgroundColor: 'var(--c-primary-bg)',
                      color: 'var(--c-primary)', fontSize: '12px', fontWeight: '700',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: '1px',
                    }}>
                      {q.globalIndex + 1}
                    </span>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--c-primary-dark)', lineHeight: 1.5 }}>
                      {q.Question}
                    </p>
                  </div>

                  {/* MCQ */}
                  {(dist.type === 'choice') && (() => {
                    const opts = (q.Question_Type === 'mcq') ? getOptions(q) : ['A','B','C','D'].slice(0, parseInt(q.Num_Answers)||4).map(k=>({key:k,value:k}))
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {opts.map(opt => {
                          const count = dist.counts[opt.key] || 0
                          const pct   = Math.round(count / dist.total * 100)
                          const isCorrect = opt.key === dist.correct
                          const hasVotes  = count > 0
                          return (
                            <div key={opt.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  minWidth: '24px', height: '24px', borderRadius: '5px',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '11px', fontWeight: '700',
                                  backgroundColor: isCorrect ? 'var(--c-success-bg)' : 'var(--c-primary-bg)',
                                  color: isCorrect ? 'var(--c-success-text)' : 'var(--c-primary-mid)',
                                  border: isCorrect ? '1.5px solid var(--c-success-border)' : 'none',
                                  flexShrink: 0,
                                }}>{opt.key}</span>
                                {q.Question_Type === 'mcq' && (
                                  <span style={{ fontSize: '13px', color: 'var(--c-text-soft)', flex: 1 }}>{opt.value}</span>
                                )}
                                <span style={{ fontSize: '12px', fontWeight: '600', color: isCorrect ? 'var(--c-success)' : hasVotes ? 'var(--c-danger)' : 'var(--c-text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                                  {count} người ({pct}%)
                                </span>
                              </div>
                              {/* Progress bar */}
                              <div style={{ height: '6px', borderRadius: '99px', backgroundColor: 'var(--c-primary-bg)', overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%',
                                  width: `${pct}%`,
                                  borderRadius: '99px',
                                  backgroundColor: isCorrect ? 'var(--c-success)' : hasVotes ? 'var(--c-danger)' : 'var(--c-primary-pale)',
                                  transition: 'width 0.4s ease',
                                }} />
                              </div>
                            </div>
                          )
                        })}
                        {/* Chưa làm */}
                        {(() => {
                          const answered = Object.values(dist.counts).reduce((a,b)=>a+b,0)
                          const chuaLam  = dist.total - answered
                          if (chuaLam <= 0) return null
                          const pct = Math.round(chuaLam / dist.total * 100)
                          return (
                            <div style={{ fontSize: '12px', color: 'var(--c-text-muted)', marginTop: '2px' }}>
                              ⚠️ {chuaLam} học viên chưa trả lời ({pct}%)
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })()}

                  {/* Fill blank / fill short */}
                  {(dist.type === 'fill_blank' || dist.type === 'fill_short') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {dist.slotCounts.map(({ slot, correct, counts, total }) => {
                        const allAnswers = Object.entries(counts).sort((a,b)=>b[1]-a[1])
                        const answered   = Object.values(counts).reduce((a,b)=>a+b,0)
                        return (
                          <div key={slot} style={{
                            padding: '10px 14px', borderRadius: '10px',
                            backgroundColor: 'var(--c-primary-barest)',
                            border: '1px solid var(--c-primary-bg)',
                          }}>
                            {dist.slotCounts.length > 1 && (
                              <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--c-primary)', fontWeight: '600' }}>
                                Ô trống {slot + 1} — Đáp án: <span style={{ color: 'var(--c-success)' }}>{correct}</span>
                              </p>
                            )}
                            {dist.slotCounts.length === 1 && (
                              <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--c-primary)', fontWeight: '600' }}>
                                Đáp án đúng: <span style={{ color: 'var(--c-success)' }}>{correct}</span>
                              </p>
                            )}
                            {allAnswers.length === 0 ? (
                              <span style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>Chưa có ai trả lời</span>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {allAnswers.map(([ans, cnt]) => {
                                  const isCorrect = ans.toLowerCase() === correct.toLowerCase()
                                  const pct       = Math.round(cnt / total * 100)
                                  return (
                                    <div key={ans} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{
                                        fontSize: '13px', fontWeight: isCorrect ? '600' : '400',
                                        color: isCorrect ? 'var(--c-success-text)' : 'var(--c-danger-text)',
                                        backgroundColor: isCorrect ? 'var(--c-success-bg)' : 'var(--c-danger-bg)',
                                        padding: '2px 10px', borderRadius: '6px',
                                        minWidth: '80px',
                                      }}>
                                        {isCorrect ? '✓ ' : '✗ '}{ans}
                                      </span>
                                      <div style={{ flex: 1, height: '6px', borderRadius: '99px', backgroundColor: 'var(--c-primary-bg)', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${pct}%`, borderRadius: '99px', backgroundColor: isCorrect ? 'var(--c-success)' : 'var(--c-danger)', transition: 'width 0.4s ease' }} />
                                      </div>
                                      <span style={{ fontSize: '12px', color: 'var(--c-text-muted)', whiteSpace: 'nowrap' }}>{cnt} ({pct}%)</span>
                                    </div>
                                  )
                                })}
                                {answered < total && (
                                  <span style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>⚠️ {total - answered} chưa trả lời</span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Fill long */}
                  {dist.type === 'fill_long' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--c-text-muted)', fontWeight: '500' }}>
                        {dist.allAnswers.length} bài làm đã nộp
                      </p>
                      <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {dist.allAnswers.map((ans, i) => (
                          <div key={i} style={{
                            padding: '10px 14px', borderRadius: '8px',
                            backgroundColor: 'var(--c-primary-barest)',
                            border: '1px solid var(--c-primary-bg)',
                            fontSize: '13px', color: 'var(--c-text-soft)', lineHeight: 1.6,
                            whiteSpace: 'pre-wrap',
                          }}>
                            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--c-primary-pale)', marginRight: '6px' }}>#{i+1}</span>
                            {ans}
                          </div>
                        ))}
                        {dist.allAnswers.length === 0 && (
                          <span style={{ fontSize: '13px', color: 'var(--c-text-muted)' }}>Chưa có bài nộp</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Shared ───────────────────────────────────────────────────────────────────
function Overlay({ onClose, children, width = '420px' }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, backgroundColor: 'var(--c-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        backgroundColor: 'var(--c-surface)', borderRadius: '16px',
        padding: '32px', width, maxWidth: '95vw',
        display: 'flex', flexDirection: 'column', gap: '16px',
        boxShadow: 'var(--shadow-modal)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {children}
      </div>
    </div>
  )
}

const btnPrimary = {
  flex: 1, padding: '12px', borderRadius: '9px', border: 'none',
  backgroundColor: 'var(--c-primary)', color: '#fff',
  fontWeight: '600', cursor: 'pointer', fontSize: '14px',
}

const btnSecondary = {
  flex: 1, padding: '12px', borderRadius: '9px',
  border: '1px solid var(--c-primary-pale)', backgroundColor: 'var(--c-surface)',
  color: 'var(--c-primary-mid)', fontWeight: '500', cursor: 'pointer', fontSize: '14px',
}