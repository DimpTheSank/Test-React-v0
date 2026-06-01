'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { db } from '@/lib/firebase'
import {
  collection, query, where, getDocs, getDoc, addDoc, doc, deleteDoc
} from 'firebase/firestore'

const mauKyNang = {
  'Reading':   { bg: '#378ADD', text: 'white' },
  'Listening': { bg: '#1D9E75', text: 'white' },
  'Writing':   { bg: '#BA7517', text: 'white' },
  'Speaking':  { bg: '#A32D2D', text: 'white' },
}

const mauMucDo = {
  'Cơ bản':    { bg: '#E1F5EE', text: '#085041' },
  'Trung bình':{ bg: '#FAEEDA', text: '#633806' },
  'Nâng cao':  { bg: '#FCEBEB', text: '#791F1F' },
}

const cacMucDo = ['Tất cả', 'Cơ bản', 'Trung bình', 'Nâng cao']
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
  const [tab, setTab] = useState('baiTap')
  const [userInfo, setUserInfo] = useState(null)

  useEffect(() => {
    if (!Cookies.get('isLoggedIn')) { router.push('/'); return }
    const info = getUserInfo()
    if (!info || info.vaiTro !== 'Giáo viên') { router.push('/trang-chu'); return }
    setUserInfo(info)
  }, [])

  if (!userInfo) return (
    <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 56px)' }}>
      <p style={{ color: '#185FA5' }}>Đang tải...</p>
    </main>
  )

  return (
    <main style={{ minHeight: 'calc(100vh - 56px)', backgroundColor: '#F0F7FF' }}>
      <div style={{
        backgroundColor: 'white', borderBottom: '1px solid #B5D4F4',
        display: 'flex', paddingLeft: '24px',
      }}>
        {[{ key: 'baiTap', label: '📚 Bài tập' }, { key: 'tienDo', label: '📊 Tiến độ' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '14px 24px', border: 'none',
            borderBottom: tab === t.key ? '3px solid #185FA5' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: tab === t.key ? '#185FA5' : '#888',
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
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [selected, setSelected] = useState(new Set()) // exerciseId được chọn
  const [filterMucDo, setFilterMucDo] = useState('Tất cả')
  const [filterKyNang, setFilterKyNang] = useState('Tất cả')
  const [showDelete, setShowDelete] = useState(false)
  const [deletingEx, setDeletingEx] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadExercises = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'exercises'))
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      const kyNangOrder = { 'Listening': 0, 'Reading': 1, 'Speaking': 2, 'Writing': 3 }

      list.sort((a, b) => {
        // 1. TOEIC lên đầu, còn lại alphabet
        const loaiA = a.loaiBai === 'TOEIC' ? '' : a.loaiBai
        const loaiB = b.loaiBai === 'TOEIC' ? '' : b.loaiBai
        if (loaiA !== loaiB) return loaiA.localeCompare(loaiB)

        // 2. Kỹ năng theo thứ tự L-R-S-W
        const kyA = kyNangOrder[a.kyNang] ?? 99
        const kyB = kyNangOrder[b.kyNang] ?? 99
        if (kyA !== kyB) return kyA - kyB

        // 3. Tên bài theo alphabet
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
      // Xoá tất cả assignments liên quan
      const assignSnap = await getDocs(query(
        collection(db, 'assignments'),
        where('exerciseId', '==', deletingEx.id)
      ))
      await Promise.all(assignSnap.docs.map(d => deleteDoc(d.ref)))

      // Xoá exercise
      await deleteDoc(doc(db, 'exercises', deletingEx.id))

      setShowDelete(false)
      setDeletingEx(null)
      loadExercises()
    } catch (err) {
      console.error('Lỗi khi xoá bài:', err)
      alert('Có lỗi khi xoá bài. Thử lại sau!')
    } finally {
      setIsDeleting(false)
    }
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
    const okMucDo = filterMucDo === 'Tất cả' || ex.mucDo === filterMucDo
    const okKyNang = filterKyNang === 'Tất cả' || ex.kyNang === filterKyNang
    return okMucDo && okKyNang
  })

  const selectedExercises = exercises.filter(ex => selected.has(ex.id))

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, color: '#0C447C' }}>Danh sách bài tập</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
          {selected.size > 0 && (
            <button
              onClick={() => setShowAssign(true)}
              style={{
                padding: '10px 20px', borderRadius: '8px', border: 'none',
                backgroundColor: '#1D9E75', color: 'white',
                fontSize: '14px', fontWeight: '600', cursor: 'pointer',
              }}
            >
              Giao {selected.size} bài đã chọn
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: '10px 20px', borderRadius: '8px', border: 'none',
              backgroundColor: '#185FA5', color: 'white',
              fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            }}
          >
            + Tạo bài mới
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: '24px', marginBottom: '20px',
        padding: '14px 16px', backgroundColor: 'white',
        borderRadius: '12px', border: '1px solid #B5D4F4',
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: '#185FA5', fontWeight: '500', whiteSpace: 'nowrap' }}>Mức độ:</span>
          {cacMucDo.map(m => (
            <button key={m} onClick={() => setFilterMucDo(m)} style={{
              padding: '5px 14px', borderRadius: '20px', fontSize: '13px',
              border: `1.5px solid ${filterMucDo === m ? '#185FA5' : '#B5D4F4'}`,
              backgroundColor: filterMucDo === m ? '#185FA5' : 'white',
              color: filterMucDo === m ? 'white' : '#555',
              fontWeight: filterMucDo === m ? '600' : '400',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>{m}</button>
          ))}
        </div>

        <div style={{ width: '1px', height: '24px', backgroundColor: '#B5D4F4' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: '#185FA5', fontWeight: '500', whiteSpace: 'nowrap' }}>Kỹ năng:</span>
          {cacKyNang.map(k => (
            <button key={k} onClick={() => setFilterKyNang(k)} style={{
              padding: '5px 14px', borderRadius: '20px', fontSize: '13px',
              border: `1.5px solid ${filterKyNang === k ? '#185FA5' : '#B5D4F4'}`,
              backgroundColor: filterKyNang === k ? '#185FA5' : 'white',
              color: filterKyNang === k ? 'white' : '#555',
              fontWeight: filterKyNang === k ? '600' : '400',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>{k}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#185FA5' }}>Đang tải...</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          {filtered.map(ex => (
            <CardBaiTapGV
              key={ex.id}
              ex={ex}
              isSelected={selected.has(ex.id)}
              onToggle={() => toggleSelect(ex.id)}
              onGiaoNhanh={() => {
                setSelected(new Set([ex.id]))
                setShowAssign(true)
              }}
              onXoa={() => {
                setDeletingEx(ex)
                setShowDelete(true)
              }}
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
          <h3 style={{ margin: 0, color: '#0C447C' }}>Xác nhận xoá bài tập</h3>
          <div style={{
            backgroundColor: '#FCEBEB', borderRadius: '10px',
            padding: '12px 16px', textAlign: 'center',
          }}>
            <span style={{ color: '#791F1F', fontSize: '14px', fontWeight: '500' }}>
              ⚠️ Bạn sắp xoá bài <strong>"{deletingEx.tenBaiTap}"</strong>.<br/>
              Tất cả assignment liên quan cũng sẽ bị xoá vĩnh viễn.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => { setShowDelete(false); setDeletingEx(null) }}
              style={btnSecondary}
            >
              Huỷ
            </button>
            <button
              onClick={handleXoaBai}
              disabled={isDeleting}
              style={{
                ...btnPrimary,
                backgroundColor: '#E24B4A',
                opacity: isDeleting ? 0.7 : 1,
              }}
            >
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

function CardBaiTapGV({ ex, isSelected, onToggle, onGiaoNhanh, onXoa }) {
  const [hover, setHover] = useState(false)
  const mauHeader = mauKyNang[ex.kyNang] || { bg: '#185FA5', text: 'white' }
  const mauDo = mauMucDo[ex.mucDo] || null
  const [hoverXoa, setHoverXoa] = useState(false)

  return (
    <div
      onClick={onToggle}
      style={{
        border: `2px solid ${isSelected ? '#185FA5' : '#B5D4F4'}`,
        borderRadius: '16px', width: '180px',
        display: 'flex', flexDirection: 'column',
        backgroundColor: isSelected ? '#F0F7FF' : 'white',
        overflow: 'hidden', cursor: 'pointer',
        transition: 'all 0.15s',
        boxShadow: isSelected ? '0 0 0 3px rgba(24,95,165,0.15)' : 'none',
      }}
    >
      {/* Checkbox góc + header */}
      <div style={{ position: 'relative' }}>
        <div style={{ backgroundColor: mauHeader.bg, padding: '8px 12px', textAlign: 'center' }}>
          <span style={{ color: mauHeader.text, fontSize: '12px', fontWeight: '600' }}>
            {ex.loaiBai} · {ex.kyNang}
          </span>
        </div>
        {/* Checkbox */}
        <div style={{
          position: 'absolute', top: '6px', right: '8px',
          width: '16px', height: '16px', borderRadius: '4px',
          border: `2px solid ${isSelected ? 'white' : 'rgba(255,255,255,0.6)'}`,
          backgroundColor: isSelected ? 'white' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isSelected && <span style={{ color: '#185FA5', fontSize: '10px', fontWeight: '700' }}>✓</span>}
        </div>
      </div>

      <div style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <p style={{ margin: 0, fontWeight: '600', fontSize: '14px', color: '#0C447C', lineHeight: '1.4' }}>
          {ex.tenBaiTap}
        </p>

        {mauDo && (
          <span style={{
            padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500',
            backgroundColor: mauDo.bg, color: mauDo.text, alignSelf: 'flex-start',
          }}>
            {ex.mucDo}
          </span>
        )}

        <button
          onClick={e => { e.stopPropagation(); onGiaoNhanh() }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            marginTop: 'auto', padding: '8px', borderRadius: '8px', border: 'none',
            backgroundColor: hover ? '#0C447C' : '#378ADD',
            color: 'white', fontSize: '13px', fontWeight: '500',
            cursor: 'pointer', transition: 'background-color 0.2s',
          }}
        >
          Giao bài
        </button>
        <button
          onClick={e => { e.stopPropagation(); onXoa() }}
          onMouseEnter={() => setHoverXoa(true)}
          onMouseLeave={() => setHoverXoa(false)}
          style={{
            marginTop: '8px', padding: '8px', borderRadius: '8px', border: 'none',
            backgroundColor: hoverXoa ? '#E24B4A' : '#F0F0F0',
            color: hoverXoa ? 'white' : '#333',
            fontSize: '13px', fontWeight: '500',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          Xoá bài
        </button>
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
  const [loi, setLoi] = useState('')

  const handleSave = async () => {
    if (!form.tenBaiTap.trim() || !form.linkDrive.trim()) {
      setLoi('Vui lòng điền đầy đủ thông tin'); return
    }
    setSaving(true)
    try {
      await addDoc(collection(db, 'exercises'), {
        tenBaiTap: form.tenBaiTap.trim(),
        kyNang: form.kyNang,
        loaiBai: form.loaiBai,
        mucDo: form.mucDo,
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
    border: '1px solid #85B7EB', fontSize: '14px',
    backgroundColor: 'white', outline: 'none', width: '100%',
    boxSizing: 'border-box',
  }
  const labelStyle = { color: '#185FA5', fontSize: '13px', fontWeight: '500' }

  return (
    <Overlay onClose={onClose}>
      <h3 style={{ margin: 0, color: '#0C447C' }}>Tạo bài tập mới</h3>

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
                border: `1.5px solid ${isSelected ? mau.text : '#B5D4F4'}`,
                backgroundColor: isSelected ? mau.bg : 'white',
                color: isSelected ? mau.text : '#888',
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

      {loi && <p style={{ margin: 0, color: '#E24B4A', fontSize: '13px' }}>{loi}</p>}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onClose} style={btnSecondary}>Huỷ</button>
        <button onClick={handleSave} disabled={saving} style={btnPrimary}>
          {saving ? 'Đang lưu...' : 'Tạo bài'}
        </button>
      </div>
    </Overlay>
  )
}

// ─── MODAL GIAO BÀI (nhiều bài, nhiều lớp) ───────────────────────────────────
function ModalGiaoBai({ exercises, userInfo, onClose }) {
  const [classes, setClasses] = useState([])
  const [selectedLops, setSelectedLops] = useState(new Set()) // lop names
  const [hocViensByLop, setHocViensByLop] = useState({})     // lopId -> [{id, ...}]
  const [selectedHVs, setSelectedHVs] = useState(new Set())  // userId
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => { loadClasses() }, [])

  const loadClasses = async () => {
    try {
      const snap = await getDocs(query(
        collection(db, 'classes'),
        where('giaoVienId', '==', userInfo.taiKhoan)
      ))
      setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleToggleLop = async (cls) => {
    const lopName = cls.lop
    const next = new Set(selectedLops)

    if (next.has(lopName)) {
      // Bỏ chọn lớp → bỏ học viên của lớp đó
      next.delete(lopName)
      const hvIds = (hocViensByLop[lopName] || []).map(h => h.id)
      setSelectedHVs(prev => {
        const s = new Set(prev)
        hvIds.forEach(id => s.delete(id))
        return s
      })
    } else {
      next.add(lopName)
      // Load học viên nếu chưa có
      if (!hocViensByLop[lopName] && cls.hocVienIds?.length) {
        const hvData = await Promise.all(
          cls.hocVienIds.map(async uid => {
            const snap = await getDoc(doc(db, 'users', uid))
            return snap.exists() ? { id: uid, ...snap.data() } : null
          })
        )
        const hvs = hvData.filter(Boolean)
        setHocViensByLop(prev => ({ ...prev, [lopName]: hvs }))
        // Mặc định chọn tất cả học viên của lớp mới
        setSelectedHVs(prev => {
          const s = new Set(prev)
          hvs.forEach(h => s.add(h.id))
          return s
        })
      } else if (hocViensByLop[lopName]) {
        // Đã load rồi, chọn lại tất cả
        setSelectedHVs(prev => {
          const s = new Set(prev)
          hocViensByLop[lopName].forEach(h => s.add(h.id))
          return s
        })
      }
    }
    setSelectedLops(next)
  }

  const toggleHV = (uid) => {
    setSelectedHVs(prev => {
      const s = new Set(prev)
      s.has(uid) ? s.delete(uid) : s.add(uid)
      return s
    })
  }

  // Tất cả học viên đã load từ các lớp được chọn
  const allHVs = [...selectedLops].flatMap(lopName => hocViensByLop[lopName] || [])
  // Dedupe theo id
  const uniqueHVs = [...new Map(allHVs.map(h => [h.id, h])).values()]

  const handleGiao = async () => {
    if (!selectedHVs.size || !exercises.length) return
    setSaving(true)
    try {
      const thoiGianGiao = new Date().toISOString()
      // Với mỗi bài × mỗi học viên → tạo assignment
      await Promise.all(
        exercises.flatMap(ex =>
          [...selectedHVs].map(uid => {
            // Tìm lớp của học viên này trong các lớp đã chọn
            const lopName = [...selectedLops].find(lopName =>
              (hocViensByLop[lopName] || []).some(h => h.id === uid)
            ) || ''
            return addDoc(collection(db, 'assignments'), {
              userId: uid,
              exerciseId: ex.id,
              lopId: lopName,
              thoiGianGiao,
              trangThai: 'Chưa làm',
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
          <h3 style={{ margin: 0, color: '#0C447C' }}>Giao bài thành công!</h3>
          <p style={{ margin: 0, color: '#555', fontSize: '14px', textAlign: 'center' }}>
            Đã giao <strong>{exercises.length}</strong> bài cho <strong>{selectedHVs.size}</strong> học viên.
          </p>
          <button onClick={onClose} style={{ ...btnPrimary, width: '100%' }}>Đóng</button>
        </div>
      ) : (
        <>
          <h3 style={{ margin: 0, color: '#0C447C' }}>
            Giao bài ({exercises.length} bài đã chọn)
          </h3>

          {/* Danh sách bài được giao */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {exercises.map(ex => {
              const mau = mauKyNang[ex.kyNang] || { bg: '#185FA5', text: 'white' }
              return (
                <span key={ex.id} style={{
                  padding: '4px 10px', borderRadius: '20px',
                  backgroundColor: mau.bg, color: mau.text,
                  fontSize: '12px', fontWeight: '500',
                }}>
                  {ex.tenBaiTap}
                </span>
              )
            })}
          </div>

          {loading ? (
            <p style={{ color: '#185FA5', fontSize: '14px' }}>Đang tải lớp...</p>
          ) : (
            <>
              {/* Chọn lớp (multi) */}
              <div>
                <p style={{ margin: '0 0 8px', color: '#185FA5', fontSize: '13px', fontWeight: '500' }}>
                  Chọn lớp
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {classes.map(cls => (
                    <button
                      key={cls.id}
                      onClick={() => handleToggleLop(cls)}
                      style={{
                        padding: '7px 16px', borderRadius: '20px',
                        border: `1.5px solid ${selectedLops.has(cls.lop) ? '#185FA5' : '#B5D4F4'}`,
                        backgroundColor: selectedLops.has(cls.lop) ? '#185FA5' : 'white',
                        color: selectedLops.has(cls.lop) ? 'white' : '#378ADD',
                        fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {cls.lop}
                    </button>
                  ))}
                </div>
              </div>

              {/* Danh sách học viên */}
              {uniqueHVs.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <p style={{ margin: 0, color: '#185FA5', fontSize: '13px', fontWeight: '500' }}>
                      Học viên ({selectedHVs.size}/{uniqueHVs.length})
                    </p>
                    <button
                      onClick={() => {
                        if (selectedHVs.size === uniqueHVs.length) setSelectedHVs(new Set())
                        else setSelectedHVs(new Set(uniqueHVs.map(h => h.id)))
                      }}
                      style={{
                        marginLeft: 'auto', padding: '4px 12px', borderRadius: '6px',
                        border: '1px solid #B5D4F4', backgroundColor: 'white',
                        color: '#378ADD', fontSize: '12px', cursor: 'pointer',
                      }}
                    >
                      {selectedHVs.size === uniqueHVs.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                  </div>

                  <div style={{
                    maxHeight: '260px', overflowY: 'auto',
                    border: '1px solid #B5D4F4', borderRadius: '10px',
                  }}>
                    {uniqueHVs.map((hv, i) => (
                      <div
                        key={hv.id}
                        onClick={() => toggleHV(hv.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '10px 14px', cursor: 'pointer',
                          borderBottom: i < uniqueHVs.length - 1 ? '1px solid #E6F1FB' : 'none',
                          backgroundColor: selectedHVs.has(hv.id) ? '#F0F7FF' : 'white',
                          transition: 'background-color 0.15s',
                        }}
                      >
                        <div style={{
                          width: '18px', height: '18px', borderRadius: '4px',
                          border: `2px solid ${selectedHVs.has(hv.id) ? '#185FA5' : '#B5D4F4'}`,
                          backgroundColor: selectedHVs.has(hv.id) ? '#185FA5' : 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, transition: 'all 0.15s',
                        }}>
                          {selectedHVs.has(hv.id) && (
                            <span style={{ color: 'white', fontSize: '11px', fontWeight: '700' }}>✓</span>
                          )}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#0C447C' }}>
                            {hv.ho} {hv.ten}
                          </p>
                          <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>
                            {hv.lop} · {hv.taiKhoan}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={onClose} style={btnSecondary}>Huỷ</button>
                <button
                  onClick={handleGiao}
                  disabled={saving || !selectedHVs.size || !selectedLops.size}
                  style={{ ...btnPrimary, opacity: (!selectedHVs.size || !selectedLops.size) ? 0.5 : 1 }}
                >
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
  const [classes, setClasses] = useState([])
  const [selectedLop, setSelectedLop] = useState(null)
  const [exercises, setExercises] = useState([])
  const [selectedEx, setSelectedEx] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingClasses, setLoadingClasses] = useState(true)

  useEffect(() => { loadClasses() }, [])

  const loadClasses = async () => {
    try {
      const snap = await getDocs(query(
        collection(db, 'classes'),
        where('giaoVienId', '==', userInfo.taiKhoan)
      ))
      setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) { console.error(err) }
    finally { setLoadingClasses(false) }
  }

  const handleChonLop = async (cls) => {
    setSelectedLop(cls)
    setSelectedEx(null)
    setRows([])
    setExercises([])
    try {
      const snap = await getDocs(query(
        collection(db, 'assignments'),
        where('lopId', '==', cls.lop)
      ))
      const exIds = [...new Set(snap.docs.map(d => d.data().exerciseId))]
      const exData = await Promise.all(
        exIds.map(async exId => {
          const s = await getDoc(doc(db, 'exercises', exId))
          return s.exists() ? { id: exId, ...s.data() } : null
        })
      )
      setExercises(exData.filter(Boolean))
    } catch (err) { console.error(err) }
  }

  const handleChonBai = async (ex) => {
    setSelectedEx(ex)
    setRows([])
    setLoading(true)
    try {
      const hvData = await Promise.all(
        (selectedLop.hocVienIds || []).map(async uid => {
          const s = await getDoc(doc(db, 'users', uid))
          return s.exists() ? { id: uid, ...s.data() } : null
        })
      )
      const hvs = hvData.filter(Boolean)

      const subSnap = await getDocs(query(
        collection(db, 'submissions'),
        where('exerciseId', '==', ex.id)
      ))
      const subMap = {}
      subSnap.docs.forEach(d => {
        const data = d.data()
        if (!subMap[data.userId] || (data.diem ?? -1) > (subMap[data.userId].diem ?? -1)) {
          subMap[data.userId] = data
        }
      })

      setRows(hvs.map(hv => ({ ...hv, sub: subMap[hv.id] || null })))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const daDam = rows.filter(r => r.sub).length
  const chuaLam = rows.filter(r => !r.sub).length
  const diemTB = rows.filter(r => r.sub?.diem != null).length > 0
    ? (rows.filter(r => r.sub?.diem != null)
        .reduce((s, r) => s + r.sub.diem / r.sub.tongCau * 100, 0)
      / rows.filter(r => r.sub?.diem != null).length).toFixed(0)
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2 style={{ margin: 0, color: '#0C447C' }}>Tiến độ học viên</h2>

      {loadingClasses ? (
        <p style={{ color: '#185FA5', fontSize: '14px' }}>Đang tải lớp...</p>
      ) : (
        <div>
          <p style={{ margin: '0 0 8px', color: '#185FA5', fontSize: '13px', fontWeight: '500' }}>Chọn lớp</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {classes.map(cls => (
              <button key={cls.id} onClick={() => handleChonLop(cls)} style={{
                padding: '8px 20px', borderRadius: '20px',
                border: `1.5px solid ${selectedLop?.id === cls.id ? '#185FA5' : '#B5D4F4'}`,
                backgroundColor: selectedLop?.id === cls.id ? '#185FA5' : 'white',
                color: selectedLop?.id === cls.id ? 'white' : '#378ADD',
                fontSize: '14px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s',
              }}>{cls.lop}</button>
            ))}
          </div>
        </div>
      )}

      {selectedLop && exercises.length > 0 && (
        <div>
          <p style={{ margin: '0 0 8px', color: '#185FA5', fontSize: '13px', fontWeight: '500' }}>Chọn bài tập</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {exercises.map(ex => {
              const mau = mauKyNang[ex.kyNang] || { bg: '#185FA5', text: 'white' }
              const isSelected = selectedEx?.id === ex.id
              return (
                <button key={ex.id} onClick={() => handleChonBai(ex)} style={{
                  padding: '8px 16px', borderRadius: '20px',
                  border: `1.5px solid ${isSelected ? mau.bg : '#B5D4F4'}`,
                  backgroundColor: isSelected ? mau.bg : 'white',
                  color: isSelected ? mau.text : '#378ADD',
                  fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s',
                }}>
                  {ex.kyNang} · {ex.tenBaiTap}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {selectedLop && exercises.length === 0 && !loading && (
        <p style={{ color: '#888', fontSize: '14px' }}>Lớp này chưa được giao bài tập nào.</p>
      )}

      {selectedEx && (
        <div>
          {loading ? (
            <p style={{ color: '#185FA5', fontSize: '14px' }}>Đang tải...</p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Tổng học viên', value: rows.length, bg: '#E6F1FB', color: '#0C447C' },
                  { label: 'Đã làm', value: daDam, bg: '#E1F5EE', color: '#085041' },
                  { label: 'Chưa làm', value: chuaLam, bg: '#FCEBEB', color: '#791F1F' },
                  { label: 'Điểm TB', value: diemTB ? `${diemTB}%` : '—', bg: '#FAEEDA', color: '#633806' },
                ].map(s => (
                  <div key={s.label} style={{
                    padding: '12px 20px', borderRadius: '12px',
                    backgroundColor: s.bg, display: 'flex', flexDirection: 'column', gap: '2px',
                  }}>
                    <span style={{ fontSize: '12px', color: s.color, fontWeight: '500' }}>{s.label}</span>
                    <span style={{ fontSize: '22px', fontWeight: '700', color: s.color }}>{s.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #B5D4F4' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                  backgroundColor: '#185FA5', padding: '10px 16px', gap: '8px',
                }}>
                  {['Học viên', 'Lớp', 'Trạng thái', 'Điểm cao nhất', 'Thời gian nộp'].map(h => (
                    <span key={h} style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>{h}</span>
                  ))}
                </div>

                {rows.map((r, i) => {
                  const daDamRow = !!r.sub
                  const phanTram = r.sub?.diem != null
                    ? Math.round(r.sub.diem / r.sub.tongCau * 100) : null
                  const formatNgay = (iso) => {
                    if (!iso) return '—'
                    const d = new Date(iso)
                    return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
                  }
                  return (
                    <div key={r.id} style={{
                      display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                      padding: '10px 16px', gap: '8px',
                      backgroundColor: i % 2 === 0 ? 'white' : '#F8FBFF',
                      borderTop: '1px solid #E6F1FB', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#0C447C' }}>
                        {r.ho} {r.ten}
                      </span>
                      <span style={{ fontSize: '13px', color: '#555' }}>{r.lop}</span>
                      <span style={{
                        fontSize: '12px', fontWeight: '500', padding: '3px 10px', borderRadius: '20px',
                        backgroundColor: daDamRow ? '#E1F5EE' : '#FCEBEB',
                        color: daDamRow ? '#085041' : '#791F1F',
                        alignSelf: 'center', justifySelf: 'start',
                      }}>
                        {daDamRow ? 'Đã làm' : 'Chưa làm'}
                      </span>
                      <span style={{
                        fontSize: '14px', fontWeight: '600',
                        color: phanTram >= 50 ? '#1D9E75' : phanTram != null ? '#E24B4A' : '#B5D4F4',
                      }}>
                        {r.sub?.diem != null ? `${r.sub.diem}/${r.sub.tongCau} (${phanTram}%)` : '—'}
                      </span>
                      <span style={{ fontSize: '13px', color: '#888' }}>
                        {formatNgay(r.sub?.thoiGianNop)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Shared ───────────────────────────────────────────────────────────────────
function Overlay({ onClose, children, width = '420px' }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      backgroundColor: 'rgba(12,68,124,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        backgroundColor: 'white', borderRadius: '16px',
        padding: '32px', width, maxWidth: '95vw',
        display: 'flex', flexDirection: 'column', gap: '16px',
        boxShadow: '0 8px 32px rgba(12,68,124,0.2)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {children}
      </div>
    </div>
  )
}

const btnPrimary = {
  flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
  backgroundColor: '#185FA5', color: 'white',
  fontWeight: '600', cursor: 'pointer', fontSize: '14px',
}

const btnSecondary = {
  flex: 1, padding: '12px', borderRadius: '8px',
  border: '1px solid #B5D4F4', backgroundColor: 'white',
  color: '#378ADD', fontWeight: '500', cursor: 'pointer', fontSize: '14px',
}