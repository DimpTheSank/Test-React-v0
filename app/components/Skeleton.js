'use client'

/**
 * Skeleton loading components
 * Dùng CSS variables của app, không cần import thêm gì.
 *
 * Export:
 *  - SkeletonPulse         — block nhấp nháy cơ bản
 *  - SkeletonTrangChu      — trang chủ học viên
 *  - SkeletonTrangChuGV    — trang chủ giáo viên
 *  - SkeletonBaiTap        — trang làm bài (3 vùng)
 *  - SkeletonVocab         — trang vocab
 */

/* ─── Animation ─────────────────────────────────────────────────── */
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
export function SkeletonPulse({
  width = '100%',
  height = '16px',
  radius = '6px',
  style = {},
}) {
  if (typeof window !== 'undefined') injectKeyframes()
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: 'var(--c-primary-pale)',
        animation: 'sk-pulse 1.6s ease-in-out infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}

/* ─── Trang chủ học viên ─────────────────────────────────────────── */
export function SkeletonTrangChu() {
  if (typeof window !== 'undefined') injectKeyframes()

  const cards = Array.from({ length: 8 })

  return (
    <main
      style={{
        padding: '24px 16px',
        maxWidth: '960px',
        margin: '0 auto',
        minHeight: 'calc(100vh - 56px)',
        backgroundColor: 'var(--c-bg-page)',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <SkeletonPulse width="180px" height="28px" radius="8px" />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <SkeletonPulse width="110px" height="28px" radius="20px" />
          <SkeletonPulse width="120px" height="28px" radius="20px" />
        </div>
      </div>

      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px',
          padding: '14px 16px',
          backgroundColor: 'var(--c-primary-barest)',
          borderRadius: '12px',
          border: '1px solid var(--c-primary-pale)',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <SkeletonPulse width="60px" height="20px" radius="4px" />
        {[80, 70, 90, 80].map((w, i) => (
          <SkeletonPulse key={i} width={`${w}px`} height="28px" radius="20px" />
        ))}
        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--c-primary-pale)' }} />
        <SkeletonPulse width="70px" height="20px" radius="4px" />
        {[70, 90, 70].map((w, i) => (
          <SkeletonPulse key={i} width={`${w}px`} height="28px" radius="20px" />
        ))}
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        {cards.map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </main>
  )
}

function SkeletonCard() {
  return (
    <div
      style={{
        border: '1px solid var(--c-primary-pale)',
        borderRadius: '16px',
        width: '160px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--c-primary-barest)',
        overflow: 'hidden',
      }}
    >
      {/* Header strip */}
      <SkeletonPulse height="36px" radius="0" />

      {/* Body */}
      <div style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <SkeletonPulse height="14px" radius="4px" />
        <SkeletonPulse width="70%" height="14px" radius="4px" />
        <SkeletonPulse width="60px" height="20px" radius="20px" />
        <SkeletonPulse width="80px" height="20px" radius="20px" />
        <SkeletonPulse height="32px" radius="8px" style={{ marginTop: '8px' }} />
      </div>
    </div>
  )
}

/* ─── Trang chủ giáo viên ────────────────────────────────────────── */
export function SkeletonTrangChuGV() {
  if (typeof window !== 'undefined') injectKeyframes()

  const cards = Array.from({ length: 6 })

  return (
    <main style={{ minHeight: 'calc(100vh - 56px)', backgroundColor: 'var(--c-primary-bgsoft)' }}>
      {/* Tab bar */}
      <div
        style={{
          backgroundColor: 'var(--c-surface)',
          borderBottom: '1px solid var(--c-primary-pale)',
          display: 'flex',
          paddingLeft: '24px',
          gap: '8px',
          paddingTop: '4px',
        }}
      >
        <SkeletonPulse width="100px" height="44px" radius="4px" />
        <SkeletonPulse width="110px" height="44px" radius="4px" />
      </div>

      <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '10px' }}>
          <SkeletonPulse width="200px" height="28px" radius="8px" />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
            <SkeletonPulse width="130px" height="38px" radius="8px" />
          </div>
        </div>

        {/* Filter */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '20px',
            padding: '14px 16px',
            backgroundColor: 'var(--c-surface)',
            borderRadius: '12px',
            border: '1px solid var(--c-primary-pale)',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {[60, 80, 90, 100, 80].map((w, i) => (
            <SkeletonPulse key={i} width={`${w}px`} height="28px" radius="20px" />
          ))}
        </div>

        {/* Cards */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          {cards.map((_, i) => (
            <div
              key={i}
              style={{
                border: '2px solid var(--c-primary-pale)',
                borderRadius: '16px',
                width: '180px',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--c-surface)',
                overflow: 'hidden',
              }}
            >
              <SkeletonPulse height="36px" radius="0" />
              <div style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <SkeletonPulse height="14px" radius="4px" />
                <SkeletonPulse width="65%" height="14px" radius="4px" />
                <SkeletonPulse width="60px" height="20px" radius="20px" />
                <SkeletonPulse height="32px" radius="8px" style={{ marginTop: '6px' }} />
                <SkeletonPulse height="32px" radius="8px" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

/* ─── Trang làm bài (3 vùng) ─────────────────────────────────────── */
export function SkeletonBaiTap() {
  if (typeof window !== 'undefined') injectKeyframes()

  const questionNums = Array.from({ length: 10 })

  return (
    <main
      style={{
        height: 'calc(100vh - 56px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header strip */}
      <div
        style={{
          backgroundColor: 'var(--c-primary-bg)',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
          borderBottom: '1px solid var(--c-primary-pale)',
        }}
      >
        <SkeletonPulse width="120px" height="18px" radius="6px" />
        <SkeletonPulse width="160px" height="18px" radius="6px" />
        <div style={{ marginLeft: 'auto' }}>
          <SkeletonPulse width="80px" height="18px" radius="6px" />
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Vùng 1 — số câu */}
        <div
          style={{
            width: '72px',
            minWidth: '72px',
            borderRight: '1px solid var(--c-primary-pale)',
            backgroundColor: 'var(--c-primary-bg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '12px 0',
            gap: '6px',
            overflowY: 'auto',
          }}
        >
          {questionNums.map((_, i) => (
            <SkeletonPulse
              key={i}
              width="36px"
              height="36px"
              radius="6px"
            />
          ))}
        </div>

        {/* Vùng 2 + 3 */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Vùng 2 — nội dung */}
          <div
            style={{
              flex: 1.2,
              borderRight: '1px solid var(--c-primary-pale)',
              padding: '20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {/* Fake audio bar */}
            <SkeletonPulse height="48px" radius="8px" />
            {/* Fake text paragraph */}
            {[100, 90, 100, 85, 95, 80, 100, 75, 90, 100, 85, 60].map((w, i) => (
              <SkeletonPulse key={i} width={`${w}%`} height="14px" radius="4px" />
            ))}
          </div>

          {/* Vùng 3 — câu hỏi */}
          <div
            style={{
              flex: 1,
              padding: '20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '28px',
            }}
          >
            {[0, 1, 2].map((q) => (
              <div key={q} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Câu hỏi */}
                <SkeletonPulse height="16px" radius="4px" />
                <SkeletonPulse width="75%" height="16px" radius="4px" />
                {/* Options */}
                {[0, 1, 2, 3].map((o) => (
                  <SkeletonPulse key={o} height="40px" radius="8px" />
                ))}
              </div>
            ))}

            {/* Nav buttons */}
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
      {/* Header */}
      <div
        style={{
          backgroundColor: 'var(--c-primary-bg)',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
          borderBottom: '1px solid var(--c-primary-pale)',
        }}
      >
        <SkeletonPulse width="120px" height="18px" radius="6px" />
        <SkeletonPulse width="160px" height="18px" radius="6px" />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <SkeletonPulse width="100px" height="16px" radius="6px" />
          <SkeletonPulse width="90px" height="30px" radius="8px" />
        </div>
      </div>

      {/* Progress bar placeholder */}
      <div style={{ height: '4px', backgroundColor: 'var(--c-primary-pale)' }} />

      {/* Word list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div
          style={{
            maxWidth: '720px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {rows.map((_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '14px 18px',
                borderRadius: '12px',
                border: '1.5px solid var(--c-primary-pale)',
                backgroundColor: 'var(--c-surface)',
              }}
            >
              {/* Index */}
              <SkeletonPulse width="20px" height="14px" radius="4px" />
              {/* Word / speaker */}
              <SkeletonPulse width="140px" height="16px" radius="4px" />
              {/* Input */}
              <SkeletonPulse height="36px" radius="8px" style={{ flex: 1, maxWidth: '220px', marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}