'use client'

/**
 * Skeleton loading components — updated to match new row-list design.
 *
 * Export:
 *  - SkeletonPulse
 *  - SkeletonTrangChu
 *  - SkeletonTrangChuGV
 *  - SkeletonGVExerciseList
 *  - SkeletonGVClassButtons
 *  - SkeletonGVExerciseDropdown
 *  - SkeletonGVProgressTable
 *  - SkeletonBaiTap
 *  - SkeletonVocab
 */

const KEYFRAMES = `
@keyframes sk-pulse {
  0%   { opacity: 1; }
  50%  { opacity: 0.4; }
  100% { opacity: 1; }
}
`

let injected = false
function injectKeyframes() {
  if (injected || typeof document === 'undefined') return
  const s = document.createElement('style')
  s.textContent = KEYFRAMES
  document.head.appendChild(s)
  injected = true
}

/* ─── Base pulse block ───────────────────────────────────────────── */
export function SkeletonPulse({ width = '100%', height = '16px', radius = '6px', style = {} }) {
  if (typeof window !== 'undefined') injectKeyframes()
  return (
    <div style={{
      width, height,
      borderRadius: radius,
      backgroundColor: 'var(--c-primary-pale)',
      animation: 'sk-pulse 1.6s ease-in-out infinite',
      flexShrink: 0,
      ...style,
    }} />
  )
}

/* ─── Trang chủ học viên ─────────────────────────────────────────── */
export function SkeletonTrangChu() {
  if (typeof window !== 'undefined') injectKeyframes()
  const rows = Array.from({ length: 8 })

  return (
    <main style={{
      padding: '28px 20px', maxWidth: '1040px',
      margin: '0 auto', minHeight: 'calc(100vh - 56px)',
      backgroundColor: 'var(--c-bg-page)',
    }}>
      {/* Tab switcher (Bài tập / Ghi chú) */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '20px',
        borderBottom: '1px solid var(--c-primary-pale)',
      }}>
        <div style={{ padding: '10px 20px 14px' }}>
          <SkeletonPulse width="76px" height="16px" radius="4px" />
        </div>
        <div style={{ padding: '10px 20px 14px' }}>
          <SkeletonPulse width="76px" height="16px" radius="4px" />
        </div>
      </div>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SkeletonPulse width="200px" height="26px" radius="8px" />
          <SkeletonPulse width="100px" height="14px" radius="4px" />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <SkeletonPulse width="120px" height="30px" radius="9999px" />
          <SkeletonPulse width="130px" height="30px" radius="9999px" />
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: '10px', marginBottom: '24px',
        padding: '14px 18px', backgroundColor: 'var(--c-primary-barest)',
        borderRadius: '12px', border: '1px solid var(--c-primary-bg)',
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        <SkeletonPulse width="56px" height="16px" radius="4px" />
        {[70, 68, 82, 72].map((w, i) => (
          <SkeletonPulse key={i} width={`${w}px`} height="28px" radius="9999px" />
        ))}
        <div style={{ width: '1px', height: '22px', backgroundColor: 'var(--c-primary-pale)' }} />
        <SkeletonPulse width="72px" height="16px" radius="4px" />
        {[66, 80, 66].map((w, i) => (
          <SkeletonPulse key={i} width={`${w}px`} height="28px" radius="9999px" />
        ))}
      </div>

      {/* Row list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {rows.map((_, i) => <SkeletonRow key={i} />)}
      </div>
    </main>
  )
}

function SkeletonRow() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '14px',
      padding: '12px 16px', borderRadius: '12px',
      backgroundColor: 'var(--c-surface)',
      boxShadow: 'var(--shadow-card)',
      border: '1px solid var(--c-border-soft)',
      flexWrap: 'wrap',
    }}>
      {/* 1. Trạng thái */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <SkeletonPulse width="4px" height="36px" radius="4px" />
        <SkeletonPulse width="18px" height="18px" radius="9999px" />
      </div>

      {/* 2. Icon + tên bài */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '2 1 220px', minWidth: 0 }}>
        <SkeletonPulse width="20px" height="20px" radius="4px" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
          <SkeletonPulse width="70%" height="14px" radius="4px" />
          <div style={{ display: 'flex', gap: '6px' }}>
            <SkeletonPulse width="90px" height="11px" radius="4px" />
            <SkeletonPulse width="50px" height="16px" radius="9999px" />
          </div>
        </div>
      </div>

      {/* 3. Tiến độ / điểm số */}
      <div style={{ width: '150px', flexShrink: 0 }}>
        <SkeletonPulse height="24px" radius="7px" />
      </div>

      {/* 4. Thời gian */}
      <div style={{ width: '100px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
        <SkeletonPulse width="80px" height="11px" radius="4px" />
      </div>

      {/* 5. Hành động */}
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: 'auto' }}>
        <SkeletonPulse width="90px" height="34px" radius="8px" />
      </div>
    </div>
  )
}

/* ─── Trang chủ GV ───────────────────────────────────────────────── */
export function SkeletonTrangChuGV() {
  if (typeof window !== 'undefined') injectKeyframes()
  const cards = Array.from({ length: 6 })

  return (
    <main style={{ minHeight: 'calc(100vh - 56px)', backgroundColor: 'var(--c-primary-bgsoft)' }}>
      <div style={{
        backgroundColor: 'var(--c-surface)',
        borderBottom: '1px solid var(--c-primary-pale)',
        display: 'flex', paddingLeft: '24px', gap: '8px', paddingTop: '4px',
      }}>
        <SkeletonPulse width="100px" height="44px" radius="4px" />
        <SkeletonPulse width="110px" height="44px" radius="4px" />
      </div>

      <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '10px' }}>
          <SkeletonPulse width="200px" height="28px" radius="8px" />
          <div style={{ marginLeft: 'auto' }}>
            <SkeletonPulse width="130px" height="38px" radius="8px" />
          </div>
        </div>

        <div style={{
          display: 'flex', gap: '12px', marginBottom: '20px',
          padding: '14px 16px', backgroundColor: 'var(--c-surface)',
          borderRadius: '12px', border: '1px solid var(--c-primary-pale)',
          flexWrap: 'wrap', alignItems: 'center',
        }}>
          {[60, 80, 90, 100, 80].map((w, i) => (
            <SkeletonPulse key={i} width={`${w}px`} height="28px" radius="9999px" />
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
          {cards.map((_, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column',
              backgroundColor: 'var(--c-surface)', borderRadius: '14px',
              overflow: 'hidden', boxShadow: 'var(--shadow-card)',
              border: '1px solid var(--c-border-soft)',
            }}>
              <SkeletonPulse height="4px" radius="0" />
              <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <SkeletonPulse width="20px" height="20px" radius="4px" />
                  <SkeletonPulse width="90px" height="12px" radius="4px" />
                </div>
                <SkeletonPulse height="14px" radius="4px" />
                <SkeletonPulse width="75%" height="14px" radius="4px" />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <SkeletonPulse width="56px" height="20px" radius="9999px" />
                </div>
                <SkeletonPulse height="34px" radius="9px" style={{ marginTop: '6px' }} />
                <SkeletonPulse height="34px" radius="9px" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

/* ─── GV: danh sách bài tập ──────────────────────────────────────── */
export function SkeletonGVExerciseList() {
  if (typeof window !== 'undefined') injectKeyframes()
  const cards = Array.from({ length: 6 })
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
      {cards.map((_, i) => (
        <div key={i} style={{
          display: 'flex', flexDirection: 'column',
          backgroundColor: 'var(--c-surface)', borderRadius: '14px',
          overflow: 'hidden', boxShadow: 'var(--shadow-card)',
          border: '1px solid var(--c-border-soft)',
        }}>
          <SkeletonPulse height="4px" radius="0" />
          <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <SkeletonPulse width="20px" height="20px" radius="4px" />
              <SkeletonPulse width="90px" height="12px" radius="4px" />
            </div>
            <SkeletonPulse height="14px" radius="4px" />
            <SkeletonPulse width="75%" height="14px" radius="4px" />
            <div style={{ display: 'flex', gap: '6px' }}>
              <SkeletonPulse width="56px" height="20px" radius="9999px" />
            </div>
            <SkeletonPulse height="34px" radius="9px" style={{ marginTop: '6px' }} />
            <SkeletonPulse height="34px" radius="9px" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── GV: class buttons ──────────────────────────────────────────── */
export function SkeletonGVClassButtons() {
  if (typeof window !== 'undefined') injectKeyframes()
  return (
    <div>
      <SkeletonPulse width="60px" height="14px" radius="4px" style={{ marginBottom: '10px' }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {[90, 80, 100, 85].map((w, i) => (
          <SkeletonPulse key={i} width={`${w}px`} height="36px" radius="9999px" />
        ))}
      </div>
    </div>
  )
}

/* ─── GV: exercise dropdown ──────────────────────────────────────── */
export function SkeletonGVExerciseDropdown() {
  if (typeof window !== 'undefined') injectKeyframes()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
      padding: '14px 18px', borderRadius: '12px',
      backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-primary-pale)',
    }}>
      <SkeletonPulse width="50px" height="16px" radius="4px" />
      <SkeletonPulse height="38px" radius="8px" style={{ flex: 1, minWidth: '220px' }} />
      <SkeletonPulse width="110px" height="28px" radius="9999px" />
      <SkeletonPulse width="130px" height="16px" radius="4px" />
    </div>
  )
}

/* ─── GV: progress table ─────────────────────────────────────────── */
export function SkeletonGVProgressTable() {
  if (typeof window !== 'undefined') injectKeyframes()
  const rows = Array.from({ length: 6 })
  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[120, 100, 110, 100].map((w, i) => (
          <div key={i} style={{
            padding: '12px 20px', borderRadius: '12px',
            backgroundColor: 'var(--c-primary-bg)',
            display: 'flex', flexDirection: 'column', gap: '6px', width: `${w}px`,
          }}>
            <SkeletonPulse width="70%" height="12px" radius="4px" />
            <SkeletonPulse width="50%" height="24px" radius="4px" />
          </div>
        ))}
      </div>

      <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--c-primary-pale)' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
          backgroundColor: 'var(--c-primary-bg)', padding: '10px 16px', gap: '8px',
        }}>
          {[160, 60, 80, 100, 110].map((w, i) => (
            <SkeletonPulse key={i} width={`${w}px`} height="14px" radius="4px" />
          ))}
        </div>

        {rows.map((_, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
            padding: '12px 16px', gap: '8px', alignItems: 'center',
            backgroundColor: i % 2 === 0 ? 'var(--c-surface)' : 'var(--c-primary-barest)',
            borderTop: '1px solid var(--c-primary-bg)',
          }}>
            <SkeletonPulse height="14px" radius="4px" />
            <SkeletonPulse width="50px" height="14px" radius="4px" />
            <SkeletonPulse width="60px" height="22px" radius="9999px" />
            <SkeletonPulse width="80px" height="14px" radius="4px" />
            <SkeletonPulse width="90px" height="14px" radius="4px" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Trang làm bài (3 vùng) ─────────────────────────────────────── */
export function SkeletonBaiTap() {
  if (typeof window !== 'undefined') injectKeyframes()
  const questionNums = Array.from({ length: 10 })

  return (
    <main style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        backgroundColor: 'var(--c-primary-bg)', padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
        borderBottom: '1px solid var(--c-primary-pale)',
      }}>
        <SkeletonPulse width="120px" height="18px" radius="6px" />
        <SkeletonPulse width="160px" height="18px" radius="6px" />
        <div style={{ marginLeft: 'auto' }}>
          <SkeletonPulse width="80px" height="18px" radius="6px" />
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{
          width: '72px', minWidth: '72px',
          borderRight: '1px solid var(--c-primary-pale)',
          backgroundColor: 'var(--c-primary-bg)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '12px 0', gap: '6px', overflowY: 'auto',
        }}>
          {questionNums.map((_, i) => (
            <SkeletonPulse key={i} width="36px" height="36px" radius="6px" />
          ))}
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{
            flex: 1.2, borderRight: '1px solid var(--c-primary-pale)',
            padding: '20px', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: '14px',
          }}>
            <SkeletonPulse height="48px" radius="8px" />
            {[100, 90, 100, 85, 95, 80, 100, 75, 90, 100, 85, 60].map((w, i) => (
              <SkeletonPulse key={i} width={`${w}%`} height="14px" radius="4px" />
            ))}
          </div>

          <div style={{
            flex: 1, padding: '20px', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: '28px',
          }}>
            {[0, 1, 2].map((q) => (
              <div key={q} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <SkeletonPulse height="16px" radius="4px" />
                <SkeletonPulse width="75%" height="16px" radius="4px" />
                {[0, 1, 2, 3].map((o) => (
                  <SkeletonPulse key={o} height="40px" radius="8px" />
                ))}
              </div>
            ))}
            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
              <SkeletonPulse height="44px" radius="8px" />
              <SkeletonPulse height="44px" radius="8px" />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

/* ─── Trang vocab ────────────────────────────────────────────────── */
export function SkeletonVocab() {
  if (typeof window !== 'undefined') injectKeyframes()
  const rows = Array.from({ length: 10 })

  return (
    <main style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        backgroundColor: 'var(--c-primary-bg)', padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
        borderBottom: '1px solid var(--c-primary-pale)',
      }}>
        <SkeletonPulse width="120px" height="18px" radius="6px" />
        <SkeletonPulse width="160px" height="18px" radius="6px" />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <SkeletonPulse width="100px" height="16px" radius="6px" />
          <SkeletonPulse width="90px" height="30px" radius="8px" />
        </div>
      </div>

      <div style={{ height: '4px', backgroundColor: 'var(--c-primary-pale)' }} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {rows.map((_, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              padding: '14px 18px', borderRadius: '12px',
              border: '1.5px solid var(--c-primary-pale)', backgroundColor: 'var(--c-surface)',
            }}>
              <SkeletonPulse width="20px" height="14px" radius="4px" />
              <SkeletonPulse width="140px" height="16px" radius="4px" />
              <SkeletonPulse height="36px" radius="8px" style={{ flex: 1, maxWidth: '220px', marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}