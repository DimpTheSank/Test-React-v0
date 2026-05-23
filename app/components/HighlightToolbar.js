'use client'
/**
 * HighlightToolbar — floating toolbar hiện khi bôi text.
 * Đặt file này tại: app/components/HighlightToolbar.js
 */
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
        gap: '4px',
        backgroundColor: '#1E293B',
        borderRadius: '8px',
        padding: '5px 8px',
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

      {/* Nút Highlight */}
      <button
        onMouseDown={(e) => {
          e.preventDefault() // Quan trọng: không làm mất selection
          onHighlight()
        }}
        title="Highlight (Ctrl+H)"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: '4px 10px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: '#FFF176',
          color: '#1E293B',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        <span style={{ fontSize: '14px' }}>🖊</span>
        Highlight
      </button>

      {/* Divider */}
      <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255,255,255,0.15)' }} />

      {/* Phím tắt hint */}
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', paddingRight: '2px' }}>
        Ctrl+H
      </span>

      {/* Nút đóng */}
      <button
        onMouseDown={(e) => { e.preventDefault(); onClose() }}
        style={{
          background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer', fontSize: '14px',
          padding: '0 2px', lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}