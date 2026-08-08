'use client'

const HIGHLIGHT_COLORS = [
  { color: '#FFF176', label: 'Vàng' },
  { color: '#A5F3A0', label: 'Xanh lá' },
  { color: '#93C5FD', label: 'Xanh dương' },
  { color: '#FCA5A5', label: 'Đỏ' },
  { color: '#F9A8D4', label: 'Hồng' },
  { color: '#C4B5FD', label: 'Tím' },
]

export default function HighlightToolbar({ toolbar, onHighlight, onClose }) {
  if (!toolbar) return null

  return (
    <div
      id="highlight-toolbar"
      style={{
        position: 'absolute',
        left: toolbar.x,
        top: toolbar.y,
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: '#1E293B',
        borderRadius: '10px',
        padding: '7px 10px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        pointerEvents: 'auto',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Mũi tên nhỏ phía dưới */}
      <div style={{
        position: 'absolute',
        bottom: -5,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop: '5px solid #1E293B',
      }} />

      {/* Label */}
      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', paddingRight: '2px' }}>
        🖊
      </span>

      {/* Color swatches */}
      {HIGHLIGHT_COLORS.map(({ color, label }) => (
        <button
          key={color}
          onMouseDown={(e) => {
            e.preventDefault()
            onHighlight(color)
          }}
          title={label}
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.25)',
            backgroundColor: color,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'transform 0.1s, border-color 0.1s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.25)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.8)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'
          }}
        />
      ))}

      {/* Divider */}
      <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />

      {/* Phím tắt hint */}
      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px' }}>
        Ctrl+H
      </span>

      {/* Nút đóng */}
      <button
        onMouseDown={(e) => { e.preventDefault(); onClose() }}
        style={{
          background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.45)',
          cursor: 'pointer', fontSize: '15px',
          padding: '0 0 0 2px', lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}