'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { db } from '@/lib/firebase'
import {
  collection, query, where, getDocs, getDoc, addDoc, doc, deleteDoc, updateDoc, setDoc
} from 'firebase/firestore'
import {
  SkeletonTrangChuGV,
  SkeletonGVExerciseList,
  SkeletonGVClassButtons,
  SkeletonGVExerciseDropdown,
  SkeletonGVProgressTable,
} from '@/app/components/Skeleton'
import Papa from 'papaparse'
import { isAnswerCorrect } from '@/lib/answerUtils'

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

const mauKyNang = {
  'Reading':          { bg: 'var(--c-primary-mid)',      text: 'var(--c-surface)' },
  'Listening':        { bg: 'var(--c-success)',          text: 'var(--c-surface)' },
  'Writing':          { bg: 'var(--c-writing)',          text: 'var(--c-surface)' },
  'Speaking':         { bg: 'var(--c-speaking)',         text: 'var(--c-surface)' },
  'Vocab Reading':    { bg: 'var(--c-vocab-reading)',    text: 'var(--c-surface)' },
  'Vocab Listening':  { bg: 'var(--c-vocab-listening)',  text: 'var(--c-surface)' },
  'Tổng hợp':         { bg: 'var(--c-tonghop)',          text: 'var(--c-surface)' },
}

const mauMucDo = {
  'Cơ bản':    { bg: 'var(--c-success-bg)', text: 'var(--c-success-text)' },
  'Trung bình':{ bg: 'var(--c-warn-bg)',    text: 'var(--c-warn-text)'    },
  'Nâng cao':  { bg: 'var(--c-danger-bg)',  text: 'var(--c-danger-text)'  },
}

const cacLoaiBai = ['Tất cả', 'TOEIC', 'IELTS', 'Khác']
const cacMucDo   = ['Tất cả', 'Cơ bản', 'Trung bình', 'Nâng cao']
const cacKyNang  = ['Tất cả', 'Reading', 'Listening', 'Writing', 'Speaking', 'Vocab Reading', 'Vocab Listening', 'Tổng hợp']

const getUserInfo = () => {
  try {
    const raw = document.cookie.split('; ').find(r => r.startsWith('userInfo='))?.split('=')[1]
    return JSON.parse(decodeURIComponent(raw))
  } catch { return null }
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function TrangChuGV() {
  const router = useRouter()
  const [tab, setTab]           = useState('baiTap')
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
        {[{ key: 'baiTap', label: '📚 Bài tập' }, { key: 'tienDo', label: '📊 Tiến độ' }, { key: 'taiKhoan', label: '👤 Tài khoản' }, { key: 'matKhau', label: '🔑 Mật khẩu' }].map(t => (
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
        {tab === 'taiKhoan' && <TabTaiKhoan userInfo={userInfo} />} 
        {tab === 'matKhau' && <TabMatKhau />}
      </div>
    </main>
  )
}

// ─── TAB BÀI TẬP ─────────────────────────────────────────────────────────────
function TabBaiTap({ userInfo }) {
  const [exercises, setExercises]         = useState([])
  const [loading, setLoading]             = useState(true)
  const [showCreate, setShowCreate]       = useState(false)
  const [showAssign, setShowAssign]       = useState(false)
  const [selected, setSelected]           = useState(new Set())
  const [filterMucDo, setFilterMucDo]     = useState('Tất cả')
  const [filterKyNang, setFilterKyNang]   = useState('Tất cả')
  const [showDelete, setShowDelete]       = useState(false)
  const [deletingEx, setDeletingEx]       = useState(null)
  const [isDeleting, setIsDeleting]       = useState(false)
  const [filterKeyword, setFilterKeyword] = useState('')
  const [filterLoaiBai, setFilterLoaiBai] = useState('Tất cả')
  const [editingEx, setEditingEx] = useState(null)
  const [showEdit, setShowEdit]   = useState(false)

  const loadExercises = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'exercises'))
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => {
        const tA = a.thoiGianTao?.toDate?.() ?? new Date(a.thoiGianTao || 0)
        const tB = b.thoiGianTao?.toDate?.() ?? new Date(b.thoiGianTao || 0)
        if (tB - tA !== 0) return tB - tA
        return (a.tenBaiTap || '').localeCompare(b.tenBaiTap || '', 'vi')
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
    const okMucDo   = filterMucDo   === 'Tất cả' || ex.mucDo   === filterMucDo
    const okKyNang  = filterKyNang  === 'Tất cả' || ex.kyNang  === filterKyNang
    const okLoaiBai = filterLoaiBai === 'Tất cả' || ex.loaiBai === filterLoaiBai
    const kw        = filterKeyword.trim().toLowerCase()
    const okKeyword = !kw
      || ex.tenBaiTap?.toLowerCase().includes(kw)
      || ex.kyNang?.toLowerCase().includes(kw)
      || ex.loaiBai?.toLowerCase().includes(kw)
    return okMucDo && okKyNang && okLoaiBai && okKeyword
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
            <button onClick={() => setShowAssign(true)} style={{
              padding: '10px 20px', borderRadius: '9px', border: 'none',
              backgroundColor: 'var(--c-success)', color: '#fff',
              fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            }}>
              Giao {selected.size} bài đã chọn
            </button>
          )}
          <button onClick={() => setShowCreate(true)} style={{
            padding: '10px 20px', borderRadius: '9px', border: 'none',
            backgroundColor: 'var(--c-primary)', color: '#fff',
            fontSize: '14px', fontWeight: '600', cursor: 'pointer',
          }}>
            + Tạo bài mới
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px',
        padding: '14px 18px', backgroundColor: 'var(--c-surface)',
        borderRadius: '12px', border: '1px solid var(--c-primary-pale)',
      }}>
        <FilterGroup label="Mức độ"   options={cacMucDo}   value={filterMucDo}   onChange={setFilterMucDo} />
        <div style={{ height: '1px', backgroundColor: 'var(--c-primary-pale)' }} />
        <FilterGroup label="Kỹ năng"  options={cacKyNang}  value={filterKyNang}  onChange={setFilterKyNang} />
        <div style={{ height: '1px', backgroundColor: 'var(--c-primary-pale)' }} />
        <FilterGroup label="Loại bài" options={cacLoaiBai} value={filterLoaiBai} onChange={setFilterLoaiBai} />
        <div style={{ height: '1px', backgroundColor: 'var(--c-primary-pale)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '12px', color: 'var(--c-primary)', fontWeight: '600',
            whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em',
            minWidth: '72px',
          }}>Tìm kiếm</span>
          <div style={{ position: 'relative' }}>
            <input
              type="text" placeholder="Tên bài, kỹ năng..."
              value={filterKeyword} onChange={e => setFilterKeyword(e.target.value)}
              style={{
                padding: '5px 28px 5px 12px', borderRadius: '9999px', fontSize: '13px',
                border: `1.5px solid ${filterKeyword ? 'var(--c-primary)' : 'var(--c-primary-pale)'}`,
                backgroundColor: 'var(--c-surface)', color: 'var(--c-primary-dark)',
                outline: 'none', width: '220px', transition: 'border-color 0.15s',
              }}
            />
            {filterKeyword && (
              <button onClick={() => setFilterKeyword('')} style={{
                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--c-text-muted)', fontSize: '14px', padding: 0, lineHeight: 1,
              }}>×</button>
            )}
          </div>
        </div>
      </div>

      {loading ? <SkeletonGVExerciseList /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(186px, 1fr))', gap: '16px' }}>
          {filtered.map(ex => (
            <CardBaiTapGV
              key={ex.id} ex={ex}
              isSelected={selected.has(ex.id)}
              onToggle={() => toggleSelect(ex.id)}
              onGiaoNhanh={() => { setSelected(new Set([ex.id])); setShowAssign(true) }}
              onSua={() => { setEditingEx(ex); setShowEdit(true) }}
              onXoa={() => { setDeletingEx(ex); setShowDelete(true) }}
            />
          ))}
        </div>
      )}
      {showEdit && editingEx && (
        <ModalSuaBai
          exercise={editingEx}
          onClose={() => { setShowEdit(false); setEditingEx(null) }}
          onSaved={() => { setShowEdit(false); setEditingEx(null); loadExercises() }}
        />
      )}
      {showCreate && (
        <ModalTaoBai onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadExercises() }} />
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
        <ModalGiaoBai exercises={selectedExercises} userInfo={userInfo}
          onClose={() => { setShowAssign(false); setSelected(new Set()) }} />
      )}
    </div>
  )
}
// ─── TAB TÀI KHOẢN ───────────────────────────────────────────────────────────
function TabTaiKhoan({ userInfo }) {
  const [users, setUsers]           = useState([])
  const [classes, setClasses]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [filterKeyword, setFilterKeyword] = useState('')
  const [filterLop, setFilterLop]   = useState('Tất cả')
  const [showModal, setShowModal]   = useState(false)
  const [editingUser, setEditingUser] = useState(null) // null = tạo mới
  const [showDelete, setShowDelete] = useState(false)
  const [deletingUser, setDeletingUser] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadAll = async () => {
    setLoading(true)
    try {
      const [userSnap, classSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'classes'), where('giaoVienId', '==', userInfo.taiKhoan))),
      ])
      const list = userSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.vaiTro !== 'Giáo viên')
      list.sort((a, b) => (a.ho + a.ten).localeCompare(b.ho + b.ten, 'vi'))
      setUsers(list)
      setClasses(classSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadAll() }, [])

  const handleXoaUser = async () => {
    if (!deletingUser) return
    setIsDeleting(true)
    try {
      await deleteDoc(doc(db, 'users', deletingUser.id))
      setShowDelete(false); setDeletingUser(null)
      loadAll()
    } catch (err) {
      console.error(err)
      alert('Có lỗi khi xoá tài khoản.')
    } finally { setIsDeleting(false) }
  }

  const danhSachLop = ['Tất cả', ...new Set(classes.map(c => c.lop))]

  const filtered = users.filter(u => {
    const okLop = filterLop === 'Tất cả' || u.lop === filterLop
    const kw = filterKeyword.trim().toLowerCase()
    const okKw = !kw
      || `${u.ho} ${u.ten}`.toLowerCase().includes(kw)
      || u.taiKhoan?.toLowerCase().includes(kw)
    return okLop && okKw
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--c-primary-dark)', lineHeight: 1.2 }}>
            Tài khoản học viên
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--c-text-muted)', lineHeight: 1 }}>
            {users.length} tài khoản · {filtered.length} đang hiển thị
          </p>
        </div>
        <button onClick={() => { setEditingUser(null); setShowModal(true) }} style={{
          marginLeft: 'auto', padding: '10px 20px', borderRadius: '9px', border: 'none',
          backgroundColor: 'var(--c-primary)', color: '#fff',
          fontSize: '14px', fontWeight: '600', cursor: 'pointer',
        }}>
          + Tạo tài khoản
        </button>
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center',
        padding: '14px 18px', backgroundColor: 'var(--c-surface)',
        borderRadius: '12px', border: '1px solid var(--c-primary-pale)',
      }}>
        <span style={{
          fontSize: '12px', color: 'var(--c-primary)', fontWeight: '600',
          textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: '48px',
        }}>Lớp</span>
        {danhSachLop.map(lop => (
          <button key={lop} onClick={() => setFilterLop(lop)} style={{
            padding: '5px 13px', borderRadius: '9999px', fontSize: '13px',
            border: `1.5px solid ${filterLop === lop ? 'var(--c-primary)' : 'var(--c-primary-pale)'}`,
            backgroundColor: filterLop === lop ? 'var(--c-primary)' : 'transparent',
            color: filterLop === lop ? '#fff' : 'var(--c-text-soft)',
            fontWeight: filterLop === lop ? '600' : '400',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>{lop}</button>
        ))}
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <input
            type="text" placeholder="Tìm tên, tài khoản..."
            value={filterKeyword} onChange={e => setFilterKeyword(e.target.value)}
            style={{
              padding: '6px 28px 6px 14px', borderRadius: '9999px', fontSize: '13px',
              border: `1.5px solid ${filterKeyword ? 'var(--c-primary)' : 'var(--c-primary-pale)'}`,
              backgroundColor: 'var(--c-surface)', color: 'var(--c-primary-dark)',
              outline: 'none', width: '220px',
            }}
          />
          {filterKeyword && (
            <button onClick={() => setFilterKeyword('')} style={{
              position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--c-text-muted)', fontSize: '14px', padding: 0, lineHeight: 1,
            }}>×</button>
          )}
        </div>
      </div>

      {loading ? <SkeletonGVExerciseList /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
          {filtered.length === 0 ? (
            <p style={{ color: 'var(--c-text-muted)', fontSize: '14px', gridColumn: '1 / -1', textAlign: 'center', padding: '30px 0' }}>
              Không có tài khoản nào phù hợp.
            </p>
          ) : filtered.map(u => (
            <div key={u.id} style={{
              padding: '16px', borderRadius: '14px', backgroundColor: 'var(--c-surface)',
              border: '1px solid var(--c-border-soft)', boxShadow: 'var(--shadow-card)',
              display: 'flex', flexDirection: 'column', gap: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: 'var(--c-primary-bg)', color: 'var(--c-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '700', fontSize: '15px',
                }}>{(u.ten || '?')[0]?.toUpperCase()}</div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--c-primary-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.ho} {u.ten}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--c-text-muted)' }}>@{u.taiKhoan}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {u.lop && (
                  <span style={{ padding: '2px 9px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600', backgroundColor: 'var(--c-primary-bg)', color: 'var(--c-primary)' }}>
                    {u.lop}
                  </span>
                )}
                {u.mucTieu && (
                  <span style={{ padding: '2px 9px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600', backgroundColor: 'var(--c-warn-bg)', color: 'var(--c-warn-text)' }}>
                    🎯 {u.mucTieu}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
                <button onClick={() => { setEditingUser(u); setShowModal(true) }} style={{
                  flex: 1, padding: '7px 0', borderRadius: '8px', border: 'none',
                  backgroundColor: 'var(--c-primary-mid)', color: '#fff',
                  fontSize: '12.5px', fontWeight: '600', cursor: 'pointer',
                }}>Sửa</button>
                <button onClick={() => { setDeletingUser(u); setShowDelete(true) }} style={{
                  padding: '7px 12px', borderRadius: '8px',
                  border: '1.5px solid var(--c-danger-border)', backgroundColor: 'transparent',
                  color: 'var(--c-danger)', fontSize: '12.5px', fontWeight: '500', cursor: 'pointer',
                }}>Xoá</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ModalTaiKhoan
          user={editingUser}
          classes={classes}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadAll() }}
        />
      )}

      {showDelete && deletingUser && (
        <Overlay onClose={() => { setShowDelete(false); setDeletingUser(null) }}>
          <h3 style={{ margin: 0, color: 'var(--c-primary-dark)' }}>Xác nhận xoá tài khoản</h3>
          <div style={{ backgroundColor: 'var(--c-danger-bg)', borderRadius: '10px', padding: '12px 16px', textAlign: 'center' }}>
            <span style={{ color: 'var(--c-danger-text)', fontSize: '14px', fontWeight: '500' }}>
              ⚠️ Xoá tài khoản <strong>{deletingUser.ho} {deletingUser.ten}</strong>?<br />
              (Assignments/submissions liên quan sẽ không bị xoá theo)
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => { setShowDelete(false); setDeletingUser(null) }} style={btnSecondary}>Huỷ</button>
            <button onClick={handleXoaUser} disabled={isDeleting}
              style={{ ...btnPrimary, backgroundColor: 'var(--c-danger)', opacity: isDeleting ? 0.7 : 1 }}>
              {isDeleting ? 'Đang xoá...' : 'Xoá'}
            </button>
          </div>
        </Overlay>
      )}
    </div>
  )
}

// ─── MODAL TẠO/SỬA TÀI KHOẢN ─────────────────────────────────────────────────
function ModalTaiKhoan({ user, classes, onClose, onSaved }) {
  const isEdit = !!user
  const [form, setForm] = useState({
    taiKhoan: user?.taiKhoan || '',
    matKhau:  user?.matKhau  || '',
    ho:       user?.ho       || '',
    ten:      user?.ten      || '',
    lop:      user?.lop      || (classes[0]?.lop || ''),
    mucTieu:  user?.mucTieu  || '',
  })
  const [saving, setSaving] = useState(false)
  const [loi, setLoi]       = useState('')

  const inputStyle = {
    padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--c-primary-pale)',
    fontSize: '14px', backgroundColor: 'var(--c-surface)', outline: 'none', width: '100%', boxSizing: 'border-box',
  }
  const labelStyle = { color: 'var(--c-primary)', fontSize: '13px', fontWeight: '500' }

  const handleSave = async () => {
    if (!form.taiKhoan.trim() || !form.matKhau.trim() || !form.ten.trim()) {
      setLoi('Vui lòng điền tài khoản, mật khẩu và tên'); return
    }
    setSaving(true)
    try {
      const userRef = doc(db, 'users', form.taiKhoan.trim())

      // Khi tạo mới: kiểm tra trùng tài khoản
      if (!isEdit) {
        const existing = await getDoc(userRef)
        if (existing.exists()) { setLoi('Tài khoản đã tồn tại'); setSaving(false); return }
      }

      await setDoc(userRef, {
        taiKhoan: form.taiKhoan.trim(),
        matKhau:  form.matKhau,
        ho:       form.ho.trim(),
        ten:      form.ten.trim(),
        lop:      form.lop,
        mucTieu:  form.mucTieu.trim(),
        vaiTro:   'Học viên',
        ...(isEdit ? {} : { thoiGianTao: new Date().toISOString() }),
      }, { merge: true })

      onSaved()
    } catch (err) { console.error(err); setLoi('Lỗi khi lưu, thử lại sau') }
    finally { setSaving(false) }
  }

  return (
    <Overlay onClose={onClose}>
      <h3 style={{ margin: 0, color: 'var(--c-primary-dark)' }}>
        {isEdit ? 'Sửa tài khoản' : 'Tạo tài khoản học viên'}
      </h3>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <label style={labelStyle}>Tài khoản (username)</label>
          <input style={inputStyle} disabled={isEdit} placeholder="vd: hocvien01"
            value={form.taiKhoan} onChange={e => setForm(f => ({ ...f, taiKhoan: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <label style={labelStyle}>Mật khẩu</label>
          <input style={inputStyle} placeholder="Mật khẩu"
            value={form.matKhau} onChange={e => setForm(f => ({ ...f, matKhau: e.target.value }))} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <label style={labelStyle}>Họ</label>
          <input style={inputStyle} value={form.ho} onChange={e => setForm(f => ({ ...f, ho: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <label style={labelStyle}>Tên</label>
          <input style={inputStyle} value={form.ten} onChange={e => setForm(f => ({ ...f, ten: e.target.value }))} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <label style={labelStyle}>Lớp</label>
          <select style={inputStyle} value={form.lop} onChange={e => setForm(f => ({ ...f, lop: e.target.value }))}>
            <option value="">— Chưa xếp lớp —</option>
            {classes.map(c => <option key={c.id} value={c.lop}>{c.lop}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <label style={labelStyle}>Mục tiêu</label>
          <input style={inputStyle} placeholder="vd: IELTS 6.5" value={form.mucTieu} onChange={e => setForm(f => ({ ...f, mucTieu: e.target.value }))} />
        </div>
      </div>
      {loi && <p style={{ margin: 0, color: 'var(--c-danger)', fontSize: '13px' }}>{loi}</p>}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onClose} style={btnSecondary}>Huỷ</button>
        <button onClick={handleSave} disabled={saving} style={btnPrimary}>
          {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo tài khoản'}
        </button>
      </div>
    </Overlay>
  )
}

// ─── TAB MẬT KHẨU ────────────────────────────────────────────────────────────
function generateRandomPass(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

function TabMatKhau() {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading]     = useState(true)
  const [creatingId, setCreatingId] = useState(null)
  const [filterKeyword, setFilterKeyword] = useState('')
  const [visibleIds, setVisibleIds] = useState(new Set())

  const loadExercises = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'exercises'))
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => {
        const tA = a.thoiGianTao?.toDate?.() ?? new Date(a.thoiGianTao || 0)
        const tB = b.thoiGianTao?.toDate?.() ?? new Date(b.thoiGianTao || 0)
        if (tB - tA !== 0) return tB - tA
        return (a.tenBaiTap || '').localeCompare(b.tenBaiTap || '', 'vi')
      })
      setExercises(list)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadExercises() }, [])

  const handleTaoMoi = async (ex) => {
    setCreatingId(ex.id)
    try {
      const newPass = generateRandomPass(6)
      await updateDoc(doc(db, 'exercises', ex.id), { pass: newPass })
      setExercises(prev => prev.map(e => e.id === ex.id ? { ...e, pass: newPass } : e))
      // Tự động hiện mật khẩu vừa tạo
      setVisibleIds(prev => new Set(prev).add(ex.id))
    } catch (err) {
      console.error('Lỗi khi tạo mật khẩu:', err)
      alert('Có lỗi khi tạo mật khẩu. Thử lại sau!')
    } finally {
      setCreatingId(null)
    }
  }

  const toggleVisible = (id) => {
    setVisibleIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filtered = exercises.filter(ex => {
    const kw = filterKeyword.trim().toLowerCase()
    if (!kw) return true
    return ex.tenBaiTap?.toLowerCase().includes(kw)
      || ex.kyNang?.toLowerCase().includes(kw)
      || ex.loaiBai?.toLowerCase().includes(kw)
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--c-primary-dark)', lineHeight: 1.2 }}>
            Mật khẩu bài tập
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--c-text-muted)', lineHeight: 1 }}>
            {exercises.length} bài · {filtered.length} đang hiển thị
          </p>
        </div>
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <input
            type="text" placeholder="Tìm tên bài, kỹ năng..."
            value={filterKeyword} onChange={e => setFilterKeyword(e.target.value)}
            style={{
              padding: '8px 28px 8px 14px', borderRadius: '9999px', fontSize: '13px',
              border: `1.5px solid ${filterKeyword ? 'var(--c-primary)' : 'var(--c-primary-pale)'}`,
              backgroundColor: 'var(--c-surface)', color: 'var(--c-primary-dark)',
              outline: 'none', width: '240px',
            }}
          />
          {filterKeyword && (
            <button onClick={() => setFilterKeyword('')} style={{
              position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--c-text-muted)', fontSize: '14px', padding: 0, lineHeight: 1,
            }}>×</button>
          )}
        </div>
      </div>

      {loading ? (
        <SkeletonGVExerciseList />
      ) : (
        <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--c-primary-pale)' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr auto auto',
            backgroundColor: 'var(--c-primary)', padding: '10px 16px', gap: '8px', alignItems: 'center',
          }}>
            {['Tên bài', 'Loại · Kỹ năng', 'Mức độ', 'Mật khẩu', '', ''].map((h, i) => (
              <span key={i} style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>{h}</span>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--c-text-muted)', fontSize: '14px', backgroundColor: 'var(--c-surface)' }}>
              Không có bài tập nào phù hợp.
            </div>
          ) : filtered.map((ex, i) => {
            const accent  = accentKyNang[ex.kyNang] || 'var(--c-primary-mid)'
            const mauDo   = mauMucDo[ex.mucDo] || null
            const isVisible = visibleIds.has(ex.id)
            const hasPass   = !!ex.pass

            return (
              <div key={ex.id} style={{
                display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr auto auto',
                padding: '12px 16px', gap: '8px', alignItems: 'center',
                backgroundColor: i % 2 === 0 ? 'var(--c-surface)' : 'var(--c-primary-barest)',
                borderTop: '1px solid var(--c-primary-bg)',
              }}>
                <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--c-primary-dark)' }}>
                  {ex.tenBaiTap}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: accent, flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: 'var(--c-text-soft)' }}>{ex.loaiBai} · {ex.kyNang}</span>
                </span>
                <span>
                  {mauDo && (
                    <span style={{
                      padding: '2px 9px', borderRadius: '9999px',
                      fontSize: '11px', fontWeight: '600',
                      backgroundColor: mauDo.bg, color: mauDo.text,
                    }}>{ex.mucDo}</span>
                  )}
                </span>

                {/* Mật khẩu + nút mắt */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontFamily: 'monospace', fontSize: '14px', fontWeight: '700',
                    letterSpacing: '0.08em', minWidth: '78px',
                    color: hasPass ? 'var(--c-primary-dark)' : 'var(--c-text-muted)',
                    userSelect: isVisible ? 'text' : 'none',
                  }}>
                    {hasPass ? (isVisible ? ex.pass : '•'.repeat(ex.pass.length)) : '—'}
                  </span>
                  {hasPass && (
                    <button
                      onClick={() => toggleVisible(ex.id)}
                      title={isVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      style={{
                        width: '28px', height: '28px', borderRadius: '6px',
                        border: '1px solid var(--c-primary-pale)',
                        backgroundColor: isVisible ? 'var(--c-primary-bg)' : 'var(--c-surface)',
                        color: 'var(--c-primary)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '14px', flexShrink: 0, transition: 'all 0.15s',
                      }}
                    >
                      {isVisible ? '🙈' : '👁️'}
                    </button>
                  )}
                </div>

                <button
                  onClick={() => handleTaoMoi(ex)}
                  disabled={creatingId === ex.id}
                  style={{
                    padding: '7px 16px', borderRadius: '8px', border: 'none',
                    backgroundColor: 'var(--c-primary)', color: '#fff',
                    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                    opacity: creatingId === ex.id ? 0.6 : 1, whiteSpace: 'nowrap',
                  }}
                >
                  {creatingId === ex.id ? 'Đang tạo...' : 'Tạo mới'}
                </button>
              </div>
            )
          })}
        </div>
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
        minWidth: '72px',
      }}>{label}</span>
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
function CardBaiTapGV({ ex, isSelected, onToggle, onGiaoNhanh, onSua, onXoa }) {
  const [hovered,   setHovered]   = useState(false)
  const [hoverGiao, setHoverGiao] = useState(false)
  const [hoverXoa,  setHoverXoa]  = useState(false)

  const accent = accentKyNang[ex.kyNang] || 'var(--c-primary-mid)'
  const icon   = iconKyNang[ex.kyNang]   || '📝'
  const mauDo  = mauMucDo[ex.mucDo]     || null

  return (
    <div onClick={onToggle} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column',
        backgroundColor: isSelected ? 'var(--c-primary-bgsoft)' : 'var(--c-surface)',
        borderRadius: '14px', overflow: 'hidden', cursor: 'pointer',
        boxShadow: hovered ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
        border: isSelected ? '2px solid var(--c-primary)' : '1px solid var(--c-border-soft)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.15s, background-color 0.15s',
      }}
    >
      <div style={{ position: 'relative' }}>
        <div style={{ height: '4px', backgroundColor: accent }} />
        <div style={{
          position: 'absolute', top: '-28px', right: '10px',
          width: '18px', height: '18px', borderRadius: '5px',
          border: `2px solid ${isSelected ? 'var(--c-primary)' : 'var(--c-primary-pale)'}`,
          backgroundColor: isSelected ? 'var(--c-primary)' : 'var(--c-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s', marginTop: '28px', zIndex: 1,
        }}>
          {isSelected && <span style={{ color: '#fff', fontSize: '11px', fontWeight: '700', lineHeight: 1 }}>✓</span>}
        </div>
      </div>

      <div style={{ padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '17px', lineHeight: 1 }}>{icon}</span>
          <span style={{ fontSize: '10.5px', fontWeight: '700', letterSpacing: '0.04em', color: 'var(--c-text-muted)', textTransform: 'uppercase' }}>
            {ex.loaiBai} · {ex.kyNang}
          </span>
        </div>
        <p style={{
          margin: 0, fontSize: '13.5px', fontWeight: '600', color: 'var(--c-primary-dark)', lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{ex.tenBaiTap}</p>
        {mauDo && (
          <span style={{
            padding: '2px 9px', borderRadius: '9999px', alignSelf: 'flex-start',
            fontSize: '11px', fontWeight: '600', backgroundColor: mauDo.bg, color: mauDo.text,
          }}>{ex.mucDo}</span>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: 'auto', paddingTop: '4px' }}>
          <button onClick={e => { e.stopPropagation(); onGiaoNhanh() }}
            onMouseEnter={() => setHoverGiao(true)} onMouseLeave={() => setHoverGiao(false)}
            style={{
              padding: '9px 0', borderRadius: '9px', border: 'none',
              backgroundColor: hoverGiao ? 'var(--c-primary-dark)' : 'var(--c-primary-mid)',
              color: '#fff', fontSize: '13px', fontWeight: '600',
              cursor: 'pointer', transition: 'background-color 0.15s', width: '100%',
            }}>Giao bài</button>
          <button onClick={e => { e.stopPropagation(); onSua() }}
            style={{
              padding: '8px 0', borderRadius: '9px', border: '1.5px solid var(--c-primary-pale)',
              backgroundColor: 'transparent', color: 'var(--c-primary-mid)',
              fontSize: '13px', fontWeight: '500', cursor: 'pointer', width: '100%',
            }}>Sửa thông tin</button>
          <button onClick={e => { e.stopPropagation(); onXoa() }}
            onMouseEnter={() => setHoverXoa(true)} onMouseLeave={() => setHoverXoa(false)}
            style={{
              padding: '8px 0', borderRadius: '9px',
              border: `1.5px solid ${hoverXoa ? 'var(--c-danger)' : 'var(--c-danger-border)'}`,
              backgroundColor: hoverXoa ? 'var(--c-danger-bg)' : 'transparent',
              color: hoverXoa ? 'var(--c-danger-text)' : 'var(--c-text-muted)',
              fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.15s', width: '100%',
            }}>Xoá bài</button>
        </div>
      </div>
    </div>
  )
}
function ModalSuaBai({ exercise, onClose, onSaved }) {
  const [form, setForm] = useState({
    tenBaiTap: exercise.tenBaiTap || '',
    kyNang: exercise.kyNang || 'Reading',
    loaiBai: exercise.loaiBai || 'TOEIC',
    mucDo: exercise.mucDo || 'Cơ bản',
    linkDrive: exercise.linkDrive || '',
  })
  const [saving, setSaving] = useState(false)
  const [loi, setLoi] = useState('')

  const handleSave = async () => {
    if (!form.tenBaiTap.trim() || !form.linkDrive.trim()) { setLoi('Vui lòng điền đầy đủ thông tin'); return }
    setSaving(true)
    try {
      await updateDoc(doc(db, 'exercises', exercise.id), {
        tenBaiTap: form.tenBaiTap.trim(), kyNang: form.kyNang, loaiBai: form.loaiBai,
        mucDo: form.mucDo, linkDrive: form.linkDrive.trim(),
      })
      onSaved()
    } catch (err) { setLoi('Lỗi khi lưu, thử lại sau'); console.error(err) }
    finally { setSaving(false) }
  }

  const inputStyle = {
    padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--c-primary-pale)',
    fontSize: '14px', backgroundColor: 'var(--c-surface)', outline: 'none', width: '100%', boxSizing: 'border-box',
  }
  const labelStyle = { color: 'var(--c-primary)', fontSize: '13px', fontWeight: '500' }

  return (
    <Overlay onClose={onClose}>
      <h3 style={{ margin: 0, color: 'var(--c-primary-dark)' }}>Sửa bài tập</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={labelStyle}>Tên bài tập</label>
        <input style={inputStyle} value={form.tenBaiTap} onChange={e => setForm(f => ({ ...f, tenBaiTap: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <label style={labelStyle}>Loại bài</label>
          <select style={inputStyle} value={form.loaiBai} onChange={e => setForm(f => ({ ...f, loaiBai: e.target.value }))}>
            {['TOEIC', 'IELTS', 'Khác'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <label style={labelStyle}>Kỹ năng</label>
          <select style={inputStyle} value={form.kyNang} onChange={e => setForm(f => ({ ...f, kyNang: e.target.value }))}>
            {['Reading', 'Listening', 'Writing', 'Speaking', 'Vocab Reading', 'Vocab Listening', 'Tổng hợp'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={labelStyle}>Mức độ</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['Cơ bản', 'Trung bình', 'Nâng cao'].map(m => {
            const isSelected = form.mucDo === m
            return (
              <button key={m} onClick={() => setForm(f => ({ ...f, mucDo: m }))} style={{
                flex: 1, padding: '8px', borderRadius: '8px',
                border: `1.5px solid ${isSelected ? 'var(--c-primary)' : 'var(--c-primary-pale)'}`,
                backgroundColor: isSelected ? 'var(--c-primary-bg)' : 'var(--c-surface)',
                color: isSelected ? 'var(--c-primary)' : 'var(--c-text-muted)',
                fontSize: '13px', fontWeight: isSelected ? '600' : '400', cursor: 'pointer',
              }}>{m}</button>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={labelStyle}>Link Google Drive (Excel)</label>
        <input style={inputStyle} value={form.linkDrive} onChange={e => setForm(f => ({ ...f, linkDrive: e.target.value }))} />
      </div>
      {loi && <p style={{ margin: 0, color: 'var(--c-danger)', fontSize: '13px' }}>{loi}</p>}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onClose} style={btnSecondary}>Huỷ</button>
        <button onClick={handleSave} disabled={saving} style={btnPrimary}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
      </div>
    </Overlay>
  )
}
// ─── MODAL TẠO BÀI ───────────────────────────────────────────────────────────
function ModalTaoBai({ onClose, onCreated }) {
  const [form, setForm] = useState({ tenBaiTap: '', kyNang: 'Reading', loaiBai: 'TOEIC', mucDo: 'Cơ bản', linkDrive: '' })
  const [saving, setSaving] = useState(false)
  const [loi, setLoi]       = useState('')

  const handleSave = async () => {
    if (!form.tenBaiTap.trim() || !form.linkDrive.trim()) { setLoi('Vui lòng điền đầy đủ thông tin'); return }
    setSaving(true)
    try {
      await addDoc(collection(db, 'exercises'), {
        tenBaiTap: form.tenBaiTap.trim(), kyNang: form.kyNang, loaiBai: form.loaiBai,
        mucDo: form.mucDo, linkDrive: form.linkDrive.trim(), thoiGianTao: new Date().toISOString(),
      })
      onCreated()
    } catch (err) { setLoi('Lỗi khi tạo bài, thử lại sau'); console.error(err) }
    finally { setSaving(false) }
  }

  const inputStyle = {
    padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--c-primary-pale)',
    fontSize: '14px', backgroundColor: 'var(--c-surface)', outline: 'none', width: '100%', boxSizing: 'border-box',
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
          <select style={inputStyle} value={form.loaiBai} onChange={e => setForm(f => ({ ...f, loaiBai: e.target.value }))}>
            {['TOEIC', 'IELTS', 'Khác'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <label style={labelStyle}>Kỹ năng</label>
          <select style={inputStyle} value={form.kyNang} onChange={e => setForm(f => ({ ...f, kyNang: e.target.value }))}>
            {['Reading', 'Listening', 'Writing', 'Speaking', 'Vocab Reading', 'Vocab Listening', 'Tổng hợp'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={labelStyle}>Mức độ</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['Cơ bản', 'Trung bình', 'Nâng cao'].map(m => {
            const mau = mauMucDo[m]; const isSelected = form.mucDo === m
            return (
              <button key={m} onClick={() => setForm(f => ({ ...f, mucDo: m }))} style={{
                flex: 1, padding: '8px', borderRadius: '8px',
                border: `1.5px solid ${isSelected ? mau.text : 'var(--c-primary-pale)'}`,
                backgroundColor: isSelected ? mau.bg : 'var(--c-surface)',
                color: isSelected ? mau.text : 'var(--c-text-muted)',
                fontSize: '13px', fontWeight: isSelected ? '600' : '400', cursor: 'pointer', transition: 'all 0.15s',
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
        <button onClick={handleSave} disabled={saving} style={btnPrimary}>{saving ? 'Đang lưu...' : 'Tạo bài'}</button>
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
      const snap = await getDocs(query(collection(db, 'classes'), where('giaoVienId', '==', userInfo.taiKhoan)))
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
        const hvData = await Promise.all(cls.hocVienIds.map(async uid => {
          const snap = await getDoc(doc(db, 'users', uid))
          return snap.exists() ? { id: uid, ...snap.data() } : null
        }))
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
      await Promise.all(exercises.flatMap(ex =>
        [...selectedHVs].map(uid => {
          const lopName = [...selectedLops].find(l => (hocViensByLop[l] || []).some(h => h.id === uid)) || ''
          return addDoc(collection(db, 'assignments'), { userId: uid, exerciseId: ex.id, lopId: lopName, thoiGianGiao, trangThai: 'Chưa làm' })
        })
      ))
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
          <h3 style={{ margin: 0, color: 'var(--c-primary-dark)' }}>Giao bài ({exercises.length} bài đã chọn)</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {exercises.map(ex => {
              const mau = mauKyNang[ex.kyNang] || { bg: 'var(--c-primary)', text: '#fff' }
              return (
                <span key={ex.id} style={{ padding: '4px 10px', borderRadius: '9999px', backgroundColor: mau.bg, color: mau.text, fontSize: '12px', fontWeight: '500' }}>
                  {ex.tenBaiTap}
                </span>
              )
            })}
          </div>
          {loading ? <p style={{ color: 'var(--c-primary)', fontSize: '14px' }}>Đang tải lớp...</p> : (
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
                    <button onClick={() => { if (selectedHVs.size === uniqueHVs.length) setSelectedHVs(new Set()); else setSelectedHVs(new Set(uniqueHVs.map(h => h.id))) }}
                      style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--c-primary-pale)', backgroundColor: 'var(--c-surface)', color: 'var(--c-primary-mid)', fontSize: '12px', cursor: 'pointer' }}>
                      {selectedHVs.size === uniqueHVs.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                  </div>
                  <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid var(--c-primary-pale)', borderRadius: '10px' }}>
                    {uniqueHVs.map((hv, i) => (
                      <div key={hv.id} onClick={() => toggleHV(hv.id)} style={{
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', cursor: 'pointer',
                        borderBottom: i < uniqueHVs.length - 1 ? '1px solid var(--c-primary-bg)' : 'none',
                        backgroundColor: selectedHVs.has(hv.id) ? 'var(--c-primary-bgsoft)' : 'var(--c-surface)',
                        transition: 'background-color 0.15s',
                      }}>
                        <div style={{
                          width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                          border: `2px solid ${selectedHVs.has(hv.id) ? 'var(--c-primary)' : 'var(--c-primary-pale)'}`,
                          backgroundColor: selectedHVs.has(hv.id) ? 'var(--c-primary)' : 'var(--c-surface)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
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
// ─── TAB TIẾN ĐỘ ─────────────────────────────────────────────────────────────
function TabTienDo({ userInfo }) {
  const [classes, setClasses]               = useState([])
  const [selectedLop, setSelectedLop]       = useState(null)
  const [exercises, setExercises]           = useState([])   // tất cả bài của lớp, sort theo ngày giao
  const [hocViens, setHocViens]             = useState([])   // danh sách HV của lớp
  const [matrixSubs, setMatrixSubs]         = useState({})   // { userId: { exerciseId: sub } }
  const [selectedExId, setSelectedExId]     = useState('')
  const [rows, setRows]                     = useState([])
  const [loading, setLoading]               = useState(false)
  const [loadingLop, setLoadingLop]         = useState(false)
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [showThongKe, setShowThongKe]       = useState(false)
  const [selectedHV, setSelectedHV]         = useState(null)

  useEffect(() => { loadClasses() }, [])

  const loadClasses = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'classes'), where('giaoVienId', '==', userInfo.taiKhoan)))
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.lop || '').localeCompare(b.lop || '', 'vi'))
      setClasses(list)
    } catch (err) { console.error(err) }
    finally { setLoadingClasses(false) }
  }

  const loadRows = async (ex, lop, hvList) => {
    setLoading(true); setRows([])
    try {
      const hvs = hvList || hocViens
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
    setSelectedLop(cls); setSelectedExId(''); setExercises([]); setRows([]); setHocViens([]); setMatrixSubs({})
    setLoadingLop(true)
    try {
      // Load HV của lớp
      const hvData = await Promise.all((cls.hocVienIds || []).map(async uid => {
        const s = await getDoc(doc(db, 'users', uid))
        return s.exists() ? { id: uid, ...s.data() } : null
      }))
      const hvs = hvData.filter(Boolean)
      setHocViens(hvs)

      // Load assignments của lớp
      const snap = await getDocs(query(collection(db, 'assignments'), where('lopId', '==', cls.lop)))
      const exTimeMap = {}
      snap.docs.forEach(d => {
        const { exerciseId, thoiGianGiao } = d.data()
        if (!exTimeMap[exerciseId] || (thoiGianGiao || '') > exTimeMap[exerciseId]) exTimeMap[exerciseId] = thoiGianGiao || ''
      })

      // Load exercise info
      const exData = await Promise.all(Object.keys(exTimeMap).map(async exId => {
        const s = await getDoc(doc(db, 'exercises', exId))
        return s.exists() ? { id: exId, ...s.data(), thoiGianGiao: exTimeMap[exId] } : null
      }))
      const sorted = exData.filter(Boolean).sort((a, b) => (b.thoiGianGiao || '').localeCompare(a.thoiGianGiao || ''))
      setExercises(sorted)

      // Load tất cả submissions của lớp cho matrix
      if (sorted.length > 0 && hvs.length > 0) {
        const allSubs = {}
        hvs.forEach(hv => { allSubs[hv.id] = {} })
        await Promise.all(sorted.map(async ex => {
          const subSnap = await getDocs(query(collection(db, 'submissions'), where('exerciseId', '==', ex.id)))
          subSnap.docs.forEach(d => {
            const data = d.data()
            if (!allSubs[data.userId]) return
            const existing = allSubs[data.userId][ex.id]
            if (!existing || (data.diem ?? -1) > (existing.diem ?? -1)) {
              allSubs[data.userId][ex.id] = data
            }
          })
        }))
        setMatrixSubs(allSubs)
      }

      // Load chi tiết bảng 2 cho bài gần nhất
      if (sorted.length > 0) {
        setSelectedExId(sorted[0].id)
        await loadRows(sorted[0], cls, hvs)
      }
    } catch (err) { console.error(err) }
    finally { setLoadingLop(false) }
  }

  const handleChangeEx = async (exId) => {
    if (exId === selectedExId) return
    setSelectedExId(exId)
    const ex = exercises.find(e => e.id === exId)
    if (ex && selectedLop) await loadRows(ex, selectedLop, hocViens)
  }

  const handleClickHV = async (row) => {
    if (!row.sub) return
    const ex = exercises.find(e => e.id === selectedExId)
    if (!ex) return
    try {
      const fileId = ex.linkDrive.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1]
      if (!fileId) return
      const csvUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`
      const res  = await fetch(csvUrl)
      const text = await res.text()
      const { data } = Papa.parse(text, { header: true, skipEmptyLines: true })
      const questions = data.map((q, i) => ({ ...q, globalIndex: i }))
      setSelectedHV({ row, exercise: ex, questions })
    } catch (err) { console.error('Lỗi tải đề:', err) }
  }

  const selectedEx = exercises.find(e => e.id === selectedExId) || null
  const daDam      = rows.filter(r =>  r.sub).length
  const chuaLam    = rows.filter(r => !r.sub).length
  const diemTB     = (() => {
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

  // Kiểm tra HV có được giao bài này không (dựa vào matrixSubs key tồn tại)
  // Ta dùng assignments để biết HV nào được giao, nhưng để đơn giản:
  // nếu matrixSubs[hv.id][ex.id] có key thì đã từng sub, nếu không có key thì cần check assignment
  // → dùng một set assignedMap: { exId: Set<userId> }
  const [assignedMap, setAssignedMap] = useState({}) // { exId: Set<userId> }

  // Cập nhật assignedMap khi chọn lớp
  useEffect(() => {
    if (!selectedLop || exercises.length === 0) return
    const loadAssigned = async () => {
      const snap = await getDocs(query(collection(db, 'assignments'), where('lopId', '==', selectedLop.lop)))
      const map = {}
      snap.docs.forEach(d => {
        const { exerciseId, userId } = d.data()
        if (!map[exerciseId]) map[exerciseId] = new Set()
        map[exerciseId].add(userId)
      })
      setAssignedMap(map)
    }
    loadAssigned()
  }, [selectedLop, exercises])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--c-primary-dark)', lineHeight: 1.2 }}>
        Tiến độ học viên
      </h2>

      {/* Chọn lớp */}
      {loadingClasses ? <SkeletonGVClassButtons /> : (
        <div>
          <p style={{ margin: '0 0 8px', color: 'var(--c-primary)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chọn lớp</p>
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

      {/* ── BẢNG 1: Ma trận tổng quan ── */}
      {!loadingLop && selectedLop && exercises.length > 0 && hocViens.length > 0 && (
        <div>
          <p style={{ margin: '0 0 10px', color: 'var(--c-primary)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Tổng quan · {hocViens.length} học viên · {exercises.length} bài
          </p>
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--c-primary-pale)' }}>
            <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--c-primary)' }}>
                  {/* Cột họ tên */}
                  <th style={{
                    padding: '10px 16px', textAlign: 'left', fontSize: '13px',
                    fontWeight: '600', color: '#fff', whiteSpace: 'nowrap',
                    position: 'sticky', left: 0, backgroundColor: 'var(--c-primary)', zIndex: 2,
                    minWidth: '160px',
                  }}>Học viên</th>
                  {/* Cột từng bài — gần nhất bên trái */}
                  {exercises.map(ex => {
                    const mau = mauKyNang[ex.kyNang] || { bg: 'var(--c-primary-mid)', text: '#fff' }
                    return (
                      <th key={ex.id} style={{
                        padding: '8px 12px', textAlign: 'center', fontSize: '12px',
                        fontWeight: '600', color: '#fff', whiteSpace: 'nowrap',
                        borderLeft: '1px solid rgba(255,255,255,0.15)',
                        minWidth: '130px', maxWidth: '180px',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: '9999px',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            fontSize: '10px', fontWeight: '600',
                          }}>{ex.kyNang}</span>
                          <span style={{
                            fontSize: '12px', fontWeight: '600',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            maxWidth: '160px', display: 'block',
                          }} title={ex.tenBaiTap}>{ex.tenBaiTap}</span>
                          <span style={{ fontSize: '10px', opacity: 0.7 }}>{formatNgay(ex.thoiGianGiao)}</span>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {hocViens.map((hv, i) => (
                  <tr key={hv.id} style={{
                    backgroundColor: i % 2 === 0 ? 'var(--c-surface)' : 'var(--c-primary-barest)',
                  }}>
                    {/* Tên HV — sticky */}
                    <td style={{
                      padding: '10px 16px', fontSize: '14px', fontWeight: '500',
                      color: 'var(--c-primary-dark)', whiteSpace: 'nowrap',
                      position: 'sticky', left: 0, zIndex: 1,
                      backgroundColor: i % 2 === 0 ? 'var(--c-surface)' : 'var(--c-primary-barest)',
                      borderRight: '1px solid var(--c-primary-pale)',
                    }}>
                      {hv.ho} {hv.ten}
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--c-text-muted)', fontWeight: '400' }}>{hv.lop}</span>
                    </td>
                    {/* Ô điểm từng bài */}
                    {exercises.map(ex => {
                      const isAssigned = assignedMap[ex.id]?.has(hv.id)
                      const sub        = matrixSubs[hv.id]?.[ex.id]

                      // Chưa được giao
                      if (!isAssigned) {
                        return (
                          <td key={ex.id} style={{
                            padding: '8px 12px', textAlign: 'center',
                            borderLeft: '1px solid var(--c-primary-bg)',
                          }}>
                            <span style={{ fontSize: '12px', color: 'var(--c-text-muted)', fontStyle: 'italic' }}>Không</span>
                          </td>
                        )
                      }

                      // Đã được giao — có sub
                      if (sub) {
                        const pct = sub.diem != null ? Math.round(sub.diem / sub.tongCau * 100) : null
                        const good = pct >= 50
                        return (
                          <td key={ex.id} style={{
                            padding: '8px 12px', textAlign: 'center',
                            borderLeft: '1px solid var(--c-primary-bg)',
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                              <span style={{
                                fontSize: '13px', fontWeight: '700',
                                color: good ? 'var(--c-success)' : 'var(--c-danger)',
                              }}>
                                {sub.diem}/{sub.tongCau}
                              </span>
                              {pct != null && (
                                <span style={{
                                  fontSize: '11px', fontWeight: '600',
                                  padding: '1px 7px', borderRadius: '9999px',
                                  backgroundColor: good ? 'var(--c-success-bg)' : 'var(--c-danger-bg)',
                                  color: good ? 'var(--c-success-text)' : 'var(--c-danger-text)',
                                }}>{pct}%</span>
                              )}
                            </div>
                          </td>
                        )
                      }

                      // Được giao, chưa làm hoặc đang làm
                      return (
                        <td key={ex.id} style={{
                          padding: '8px 12px', textAlign: 'center',
                          borderLeft: '1px solid var(--c-primary-bg)',
                        }}>
                          <span style={{
                            fontSize: '11px', fontWeight: '500',
                            padding: '2px 8px', borderRadius: '9999px',
                            backgroundColor: 'var(--c-danger-bg)',
                            color: 'var(--c-danger-text)',
                          }}>Chưa làm</span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loadingLop && selectedLop && exercises.length === 0 && (
        <p style={{ color: 'var(--c-text-muted)', fontSize: '14px' }}>Lớp này chưa được giao bài tập nào.</p>
      )}

      {/* ── BẢNG 2: Chi tiết 1 bài ── */}
      {!loadingLop && selectedLop && exercises.length > 0 && (
        <>
          <div style={{ borderTop: '2px solid var(--c-primary-pale)', paddingTop: '20px' }}>
            <p style={{ margin: '0 0 12px', color: 'var(--c-primary)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chi tiết theo bài</p>

            {/* Dropdown chọn bài */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
              padding: '14px 18px', borderRadius: '12px',
              backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-primary-pale)',
              marginBottom: '16px',
            }}>
              <label style={{ fontSize: '13px', color: 'var(--c-primary)', fontWeight: '500', whiteSpace: 'nowrap' }}>Bài tập:</label>
              <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                <select value={selectedExId} onChange={e => handleChangeEx(e.target.value)} style={{
                  width: '100%', padding: '9px 36px 9px 14px', borderRadius: '8px',
                  border: '1.5px solid var(--c-primary-pale)', backgroundColor: 'var(--c-surface)',
                  color: 'var(--c-primary-dark)', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
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
          </div>

          {selectedEx && (
            <div>
              {loading ? <SkeletonGVProgressTable /> : (
                <>
                  {/* Stats */}
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

                  <div style={{ marginBottom: '16px' }}>
                    <button onClick={() => setShowThongKe(true)} style={{
                      padding: '10px 20px', borderRadius: '9px', border: 'none',
                      backgroundColor: 'var(--c-primary)', color: '#fff',
                      fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}>📊 Xem đề & thống kê</button>
                  </div>

                  {/* Bảng chi tiết */}
                  <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--c-primary-pale)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', backgroundColor: 'var(--c-primary)', padding: '10px 16px', gap: '8px' }}>
                      {['Học viên', 'Lớp', 'Trạng thái', 'Điểm cao nhất', 'Thời gian nộp'].map(h => (
                        <span key={h} style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>{h}</span>
                      ))}
                    </div>
                    {rows.map((r, i) => {
                      const daDamRow = !!r.sub
                      const phanTram = r.sub?.diem != null ? Math.round(r.sub.diem / r.sub.tongCau * 100) : null
                      return (
                        <div key={r.id} style={{
                          display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                          padding: '10px 16px', gap: '8px', alignItems: 'center',
                          backgroundColor: i % 2 === 0 ? 'var(--c-surface)' : 'var(--c-primary-barest)',
                          borderTop: '1px solid var(--c-primary-bg)',
                        }}>
                          <span
                            onClick={() => daDamRow && handleClickHV(r)}
                            style={{
                              fontSize: '14px', fontWeight: '500',
                              color: daDamRow ? 'var(--c-primary)' : 'var(--c-primary-dark)',
                              cursor: daDamRow ? 'pointer' : 'default',
                              textDecoration: daDamRow ? 'underline' : 'none',
                              textDecorationStyle: 'dotted', textUnderlineOffset: '3px',
                            }}
                            title={daDamRow ? 'Xem chi tiết bài làm' : undefined}
                          >{r.ho} {r.ten}</span>
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
        </>
      )}

      {showThongKe && selectedEx && (
        <ModalThongKe
          exercise={selectedEx}
          submissions={rows.filter(r => r.sub).map(r => r.sub)}
          allRows={rows}
          onClose={() => setShowThongKe(false)}
        />
      )}

      {selectedHV && (
        <ModalChiTietHV
          row={selectedHV.row}
          exercise={selectedHV.exercise}
          questions={selectedHV.questions}
          onClose={() => setSelectedHV(null)}
        />
      )}
    </div>
  )
}

// ─── MODAL CHI TIẾT HỌC VIÊN ─────────────────────────────────────────────────
function ModalChiTietHV({ row, exercise, questions, onClose }) {
  const sub      = row.sub
  const answers  = sub?.answers || {}
  const phanTram = sub?.diem != null ? Math.round(sub.diem / sub.tongCau * 100) : null
  const mauEx    = mauKyNang[exercise.kyNang] || { bg: 'var(--c-primary)', text: '#fff' }

  const getOptions = (q) =>
    ['A', 'B', 'C', 'D', 'E'].map(k => ({ key: k, value: q[`Opt_${k}`] })).filter(o => o.value?.trim())

  // Kiểm tra đúng/sai cho từng câu
  const getCauResult = (q) => {
    const idx     = q.globalIndex
    const correct = q.Correct_Ans?.trim()
    const userAns = answers[idx]
    const type    = q.Question_Type

    if (type === 'fill_long') return { type: 'long', userAns }

    if (type === 'mcq' || type === 'mcq_blank') {
      if (!userAns) return { type: 'choice', isCorrect: false, isEmpty: true, userAns: null, correct }
      return { type: 'choice', isCorrect: isAnswerCorrect(userAns, correct), isEmpty: false, userAns, correct }
    }
    if (type === 'fill_short' || type === 'fill_blank') {
      const correctParts = (correct || '').split('|').map(s => s.trim())
      const userParts    = (userAns || []).map(s => (s || '').trim())
      const slotResults  = correctParts.map((c, i) => ({
        correct: c,
        user: userParts[i] || '',
        isCorrect: isAnswerCorrect(userParts[i], c),
      }))
      const allCorrect = slotResults.every(s => s.isCorrect)
      return { type: 'slots', slotResults, allCorrect }
    }

    return { type: 'unknown' }
  }

  const formatNgay = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 4000, backgroundColor: 'var(--c-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        backgroundColor: 'var(--c-surface)', borderRadius: '16px',
        width: '100%', maxWidth: '640px', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow-modal)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid var(--c-primary-pale)',
          display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
          backgroundColor: 'var(--c-primary-barest)',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '16px' }}>👤</span>
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--c-primary-dark)' }}>
                {row.ho} {row.ten}
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>· {row.lop}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ padding: '2px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600', backgroundColor: mauEx.bg, color: mauEx.text }}>
                {exercise.loaiBai} · {exercise.kyNang}
              </span>
              <span style={{ fontSize: '13px', fontWeight: '700', color: phanTram >= 50 ? 'var(--c-success)' : 'var(--c-danger)' }}>
                {sub.diem}/{sub.tongCau} ({phanTram}%)
              </span>
              <span style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>
                🕐 {formatNgay(sub.thoiGianNop)}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: '32px', height: '32px', borderRadius: '8px',
            border: '1px solid var(--c-primary-pale)', backgroundColor: 'var(--c-surface)',
            color: 'var(--c-text-muted)', fontSize: '16px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {questions.map((q) => {
            const result = getCauResult(q)

            // Border màu theo đúng/sai
            let borderColor = 'var(--c-primary-pale)'
            let bgColor     = 'var(--c-surface)'
            if (result.type === 'choice') {
              if (result.isEmpty)      { borderColor = 'var(--c-warn)';    bgColor = 'var(--c-warn-bgsoft)' }
              else if (result.isCorrect){ borderColor = 'var(--c-success)'; bgColor = 'var(--c-success-bg)'  }
              else                      { borderColor = 'var(--c-danger)';  bgColor = 'var(--c-danger-bg)'   }
            } else if (result.type === 'slots') {
              if (result.allCorrect) { borderColor = 'var(--c-success)'; bgColor = 'var(--c-success-bg)' }
              else                   { borderColor = 'var(--c-danger)';  bgColor = 'var(--c-danger-bg)'  }
            }

            return (
              <div key={q.globalIndex} style={{
                borderRadius: '12px', border: `1.5px solid ${borderColor}`,
                backgroundColor: bgColor, padding: '14px 16px',
                display: 'flex', flexDirection: 'column', gap: '10px',
              }}>
                {/* Số câu + câu hỏi */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{
                    minWidth: '24px', height: '24px', borderRadius: '6px', flexShrink: 0,
                    backgroundColor: 'var(--c-primary-bg)', color: 'var(--c-primary)',
                    fontSize: '11px', fontWeight: '700',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{q.globalIndex + 1}</span>
                  <p style={{ margin: 0, fontSize: '13.5px', fontWeight: '600', color: 'var(--c-primary-dark)', lineHeight: 1.5 }}>
                    {q.Question_Type !== 'fill_blank' ? q.Question : q.Question}
                  </p>
                  {/* Icon kết quả */}
                  <span style={{ marginLeft: 'auto', fontSize: '16px', flexShrink: 0 }}>
                    {result.type === 'choice' && (result.isEmpty ? '⚠️' : result.isCorrect ? '✅' : '❌')}
                    {result.type === 'slots'  && (result.allCorrect ? '✅' : '❌')}
                    {result.type === 'long'   && '📝'}
                  </span>
                </div>

                {/* MCQ */}
                {result.type === 'choice' && q.Question_Type === 'mcq' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {getOptions(q).map(opt => {
                      const isUserAns  = opt.key === result.userAns
                      const isCorrect  = opt.key === result.correct
                      let bg = 'transparent', border = 'var(--c-primary-pale)', color = 'var(--c-text-soft)'
                      if (isCorrect)                    { bg = 'var(--c-success-bg)'; border = 'var(--c-success)'; color = 'var(--c-success-text)' }
                      else if (isUserAns && !isCorrect) { bg = 'var(--c-danger-bg)';  border = 'var(--c-danger)';  color = 'var(--c-danger-text)'  }
                      return (
                        <div key={opt.key} style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '7px 12px', borderRadius: '8px',
                          border: `1.5px solid ${border}`, backgroundColor: bg,
                        }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color, minWidth: '18px' }}>{opt.key}.</span>
                          <span style={{ fontSize: '13px', color, flex: 1 }}>{opt.value}</span>
                          {isCorrect  && <span style={{ fontSize: '13px' }}>✅</span>}
                          {isUserAns && !isCorrect && <span style={{ fontSize: '13px' }}>❌</span>}
                        </div>
                      )
                    })}
                    {result.isEmpty && (
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--c-warn-text)', fontStyle: 'italic' }}>⚠️ Học viên chưa trả lời</p>
                    )}
                  </div>
                )}

                {/* MCQ Blank */}
                {result.type === 'choice' && q.Question_Type === 'mcq_blank' && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {['A','B','C','D'].slice(0, parseInt(q.Num_Answers)||4).map(key => {
                      const isUserAns = key === result.userAns
                      const isCorrect = key === result.correct
                      let bg = 'var(--c-surface)', border = 'var(--c-primary-pale)', color = 'var(--c-text-muted)'
                      if (isCorrect)                    { bg = 'var(--c-success-bg)'; border = 'var(--c-success)'; color = 'var(--c-success-text)' }
                      else if (isUserAns && !isCorrect) { bg = 'var(--c-danger-bg)';  border = 'var(--c-danger)';  color = 'var(--c-danger-text)'  }
                      return (
                        <div key={key} style={{
                          padding: '6px 16px', borderRadius: '8px', border: `1.5px solid ${border}`,
                          backgroundColor: bg, color, fontSize: '13px', fontWeight: '600',
                          display: 'flex', alignItems: 'center', gap: '5px',
                        }}>
                          {key}
                          {isCorrect   && <span>✅</span>}
                          {isUserAns && !isCorrect && <span>❌</span>}
                        </div>
                      )
                    })}
                    {result.isEmpty && <p style={{ margin: 0, fontSize: '12px', color: 'var(--c-warn-text)', fontStyle: 'italic' }}>⚠️ Chưa trả lời</p>}
                  </div>
                )}

                {/* Fill short / Fill blank */}
                {result.type === 'slots' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {result.slotResults.map((slot, si) => (
                      <div key={si} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {result.slotResults.length > 1 && (
                          <span style={{ fontSize: '11px', color: 'var(--c-text-muted)', minWidth: '52px' }}>Ô {si + 1}:</span>
                        )}
                        <span style={{
                          padding: '4px 12px', borderRadius: '7px', fontSize: '13px', fontWeight: '600',
                          backgroundColor: slot.isCorrect ? 'var(--c-success-bg)' : slot.user ? 'var(--c-danger-bg)' : 'var(--c-warn-bgsoft)',
                          color: slot.isCorrect ? 'var(--c-success-text)' : slot.user ? 'var(--c-danger-text)' : 'var(--c-warn-text)',
                          border: `1px solid ${slot.isCorrect ? 'var(--c-success-border)' : slot.user ? 'var(--c-danger-border)' : 'var(--c-warn-border)'}`,
                        }}>
                          {slot.user || '(trống)'}
                        </span>
                        {!slot.isCorrect && (
                          <span style={{ fontSize: '12px', color: 'var(--c-success)', fontWeight: '600' }}>→ {slot.correct}</span>
                        )}
                        <span style={{ fontSize: '14px', marginLeft: 'auto' }}>{slot.isCorrect ? '✅' : slot.user ? '❌' : '⚠️'}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Fill long */}
                {result.type === 'long' && (
                  <div style={{
                    padding: '10px 14px', borderRadius: '8px',
                    backgroundColor: 'var(--c-primary-barest)', border: '1px solid var(--c-primary-bg)',
                    fontSize: '13px', color: 'var(--c-text-soft)', lineHeight: 1.7, whiteSpace: 'pre-wrap',
                  }}>
                    {result.userAns || <span style={{ fontStyle: 'italic', color: 'var(--c-text-muted)' }}>Chưa trả lời</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── MODAL THỐNG KÊ ĐỀ BÀI ───────────────────────────────────────────────────
function ModalThongKe({ exercise, submissions, allRows, onClose }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading]     = useState(true)
  const [tooltip, setTooltip]     = useState(null)

  const nameMap = {}
  allRows.forEach(r => { nameMap[r.id] = `${r.ho} ${r.ten}`.trim() })

  const getWhoChose = (qIdx, optKey) =>
    allRows.filter(r => r.sub && r.sub.answers?.[qIdx] === optKey).map(r => nameMap[r.id] || r.id)

  const getWhoUnanswered = (qIdx) =>
    allRows.filter(r => !r.sub || !r.sub.answers?.[qIdx]).map(r => nameMap[r.id] || r.id)

  const getWhoChoseSlot = (qIdx, slotIdx, answer) =>
    allRows.filter(r => {
      const ans = r.sub?.answers?.[qIdx]
      return Array.isArray(ans) && (ans[slotIdx] || '').trim() === answer
    }).map(r => nameMap[r.id] || r.id)

  const getWhoUnansweredSlot = (qIdx, slotIdx) =>
    allRows.filter(r => {
      const ans = r.sub?.answers?.[qIdx]
      return !r.sub || !Array.isArray(ans) || !(ans[slotIdx] || '').trim()
    }).map(r => nameMap[r.id] || r.id)

  useEffect(() => { loadQuestions() }, [])

  const loadQuestions = async () => {
    try {
      const fileId = exercise.linkDrive.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1]
      if (!fileId) return
      const csvUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`
      const res  = await fetch(csvUrl)
      const text = await res.text()
      const { data } = Papa.parse(text, { header: true, skipEmptyLines: true })
      setQuestions(data.map((row, i) => ({ ...row, globalIndex: i })))
    } catch (err) { console.error('Lỗi khi tải đề:', err) }
    finally { setLoading(false) }
  }

  const getDistribution = (q) => {
    const idx  = q.globalIndex
    const type = q.Question_Type

    if (type === 'mcq' || type === 'mcq_blank') {
      const counts = {}
      submissions.forEach(sub => { const ans = sub.answers?.[idx]; if (ans) counts[ans] = (counts[ans] || 0) + 1 })
      return { type: 'choice', counts, total: submissions.length || 1, correct: q.Correct_Ans?.trim() }
    }
    if (type === 'fill_blank' || type === 'fill_short') {
      const correct = (q.Correct_Ans || '').split('|').map(s => s.trim())
      const slotCounts = correct.map((c, si) => {
        const counts = {}
        submissions.forEach(sub => { const ans = (sub.answers?.[idx] || [])[si]; if (ans) counts[ans.trim()] = (counts[ans.trim()] || 0) + 1 })
        return { slot: si, correct: c, counts, total: submissions.length || 1 }
      })
      return { type, slotCounts }
    }
    return { type: 'fill_long', allAnswers: submissions.map(sub => sub.answers?.[idx]).filter(Boolean) }
  }

  const getOptions = (q) => ['A','B','C','D','E'].map(k => ({ key: k, value: q[`Opt_${k}`] })).filter(o => o.value?.trim())

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, backgroundColor: 'var(--c-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ backgroundColor: 'var(--c-surface)', borderRadius: '16px', width: '100%', maxWidth: '720px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-modal)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--c-primary-pale)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--c-primary-dark)' }}>📊 Thống kê đáp án</h3>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--c-text-muted)' }}>{exercise.tenBaiTap} · {submissions.length} học viên đã nộp</p>
          </div>
          <button onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--c-primary-pale)', backgroundColor: 'var(--c-surface)', color: 'var(--c-text-muted)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--c-primary-pale)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ height: '14px', width: '70%', borderRadius: '4px', backgroundColor: 'var(--c-primary-pale)', animation: 'sk-pulse 1.6s ease-in-out infinite' }} />
                  {[100, 80, 90, 85].map((w, j) => (
                    <div key={j} style={{ height: '32px', width: `${w}%`, borderRadius: '6px', backgroundColor: 'var(--c-primary-bg)', animation: 'sk-pulse 1.6s ease-in-out infinite' }} />
                  ))}
                </div>
              ))}
            </div>
          ) : questions.length === 0 ? (
            <p style={{ color: 'var(--c-text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>Không thể tải đề bài.</p>
          ) : questions.map((q) => {
            const dist = getDistribution(q)
            return (
              <div key={q.globalIndex} style={{ padding: '16px 18px', borderRadius: '12px', border: '1px solid var(--c-primary-pale)', backgroundColor: 'var(--c-surface)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ minWidth: '26px', height: '26px', borderRadius: '6px', backgroundColor: 'var(--c-primary-bg)', color: 'var(--c-primary)', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>{q.globalIndex + 1}</span>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--c-primary-dark)', lineHeight: 1.5 }}>{q.Question}</p>
                </div>

                {dist.type === 'choice' && (() => {
                  const opts = q.Question_Type === 'mcq' ? getOptions(q) : ['A','B','C','D'].slice(0, parseInt(q.Num_Answers)||4).map(k=>({key:k,value:k}))
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {opts.map(opt => {
                        const count = dist.counts[opt.key] || 0
                        const pct   = Math.round(count / dist.total * 100)
                        const isCorrect = isAnswerCorrect(opt.key, dist.correct)
                        const hasVotes  = count > 0
                        return (
                          <div key={opt.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ minWidth: '24px', height: '24px', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', backgroundColor: isCorrect ? 'var(--c-success-bg)' : 'var(--c-primary-bg)', color: isCorrect ? 'var(--c-success-text)' : 'var(--c-primary-mid)', border: isCorrect ? '1.5px solid var(--c-success-border)' : 'none', flexShrink: 0 }}>{opt.key}</span>
                              {q.Question_Type === 'mcq' && <span style={{ fontSize: '13px', color: 'var(--c-text-soft)', flex: 1 }}>{opt.value}</span>}
                              <span onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, names: getWhoChose(q.globalIndex, opt.key), label: `Chọn ${opt.key}` })} onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)} onMouseLeave={() => setTooltip(null)}
                                style={{ fontSize: '12px', fontWeight: '600', cursor: 'default', color: isCorrect ? 'var(--c-success)' : hasVotes ? 'var(--c-danger)' : 'var(--c-text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap', borderBottom: '1px dashed currentColor' }}>
                                {count} người ({pct}%)
                              </span>
                            </div>
                            <div style={{ height: '6px', borderRadius: '99px', backgroundColor: 'var(--c-primary-bg)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, borderRadius: '99px', backgroundColor: isCorrect ? 'var(--c-success)' : hasVotes ? 'var(--c-danger)' : 'var(--c-primary-pale)', transition: 'width 0.4s ease' }} />
                            </div>
                          </div>
                        )
                      })}
                      {(() => {
                        const answered = Object.values(dist.counts).reduce((a,b)=>a+b,0)
                        const chuaLam  = dist.total - answered
                        if (chuaLam <= 0) return null
                        return (
                          <div onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, names: getWhoUnanswered(q.globalIndex), label: 'Chưa trả lời' })} onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)} onMouseLeave={() => setTooltip(null)}
                            style={{ fontSize: '12px', color: 'var(--c-text-muted)', marginTop: '2px', cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            ⚠️ {chuaLam} học viên chưa trả lời ({Math.round(chuaLam / dist.total * 100)}%)
                          </div>
                        )
                      })()}
                    </div>
                  )
                })()}

                {(dist.type === 'fill_blank' || dist.type === 'fill_short') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {dist.slotCounts.map(({ slot, correct, counts, total }) => {
                      const allAnswers = Object.entries(counts).sort((a,b)=>b[1]-a[1])
                      const answered   = Object.values(counts).reduce((a,b)=>a+b,0)
                      return (
                        <div key={slot} style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'var(--c-primary-barest)', border: '1px solid var(--c-primary-bg)' }}>
                          <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--c-primary)', fontWeight: '600' }}>
                            {dist.slotCounts.length > 1 ? `Ô trống ${slot + 1} — ` : ''}Đáp án đúng: <span style={{ color: 'var(--c-success)' }}>{correct}</span>
                          </p>
                          {allAnswers.length === 0 ? <span style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>Chưa có ai trả lời</span> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                              {allAnswers.map(([ans, cnt]) => {
                                const isCorrect = isAnswerCorrect(ans, correct)
                                const pct       = Math.round(cnt / total * 100)
                                return (
                                  <div key={ans} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: isCorrect ? '600' : '400', color: isCorrect ? 'var(--c-success-text)' : 'var(--c-danger-text)', backgroundColor: isCorrect ? 'var(--c-success-bg)' : 'var(--c-danger-bg)', padding: '2px 10px', borderRadius: '6px', minWidth: '80px' }}>
                                      {isCorrect ? '✓ ' : '✗ '}{ans}
                                    </span>
                                    <div style={{ flex: 1, height: '6px', borderRadius: '99px', backgroundColor: 'var(--c-primary-bg)', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: '99px', backgroundColor: isCorrect ? 'var(--c-success)' : 'var(--c-danger)', transition: 'width 0.4s ease' }} />
                                    </div>
                                    <span onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, names: getWhoChoseSlot(q.globalIndex, slot, ans), label: `Điền "${ans}"` })} onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)} onMouseLeave={() => setTooltip(null)}
                                      style={{ fontSize: '12px', color: 'var(--c-text-muted)', whiteSpace: 'nowrap', cursor: 'default', borderBottom: '1px dashed var(--c-text-muted)' }}>
                                      {cnt} ({pct}%)
                                    </span>
                                  </div>
                                )
                              })}
                              {answered < total && (
                                <span onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, names: getWhoUnansweredSlot(q.globalIndex, slot), label: 'Chưa trả lời' })} onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)} onMouseLeave={() => setTooltip(null)}
                                  style={{ fontSize: '12px', color: 'var(--c-text-muted)', cursor: 'default', borderBottom: '1px dashed var(--c-text-muted)' }}>
                                  ⚠️ {total - answered} chưa trả lời
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {dist.type === 'fill_long' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--c-text-muted)', fontWeight: '500' }}>{dist.allAnswers.length} bài làm đã nộp</p>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {dist.allAnswers.map((ans, i) => (
                        <div key={i} style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--c-primary-barest)', border: '1px solid var(--c-primary-bg)', fontSize: '13px', color: 'var(--c-text-soft)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--c-primary-pale)', marginRight: '6px' }}>#{i+1}</span>{ans}
                        </div>
                      ))}
                      {dist.allAnswers.length === 0 && <span style={{ fontSize: '13px', color: 'var(--c-text-muted)' }}>Chưa có bài nộp</span>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <NameTooltip tooltip={tooltip} />
    </div>
  )
}

function NameTooltip({ tooltip }) {
  if (!tooltip) return null
  return (
    <div style={{ position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 8, zIndex: 9999, backgroundColor: '#1E293B', borderRadius: '10px', padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', maxWidth: '220px', pointerEvents: 'none' }}>
      <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tooltip.label}</p>
      {tooltip.names.length === 0
        ? <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Không có ai</p>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {tooltip.names.map((n, i) => <span key={i} style={{ fontSize: '13px', color: '#fff', fontWeight: '500' }}>· {n}</span>)}
          </div>
      }
    </div>
  )
}

// ─── Shared ───────────────────────────────────────────────────────────────────
function Overlay({ onClose, children, width = '420px' }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, backgroundColor: 'var(--c-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ backgroundColor: 'var(--c-surface)', borderRadius: '16px', padding: '32px', width, maxWidth: '95vw', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--shadow-modal)', maxHeight: '90vh', overflowY: 'auto' }}>
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