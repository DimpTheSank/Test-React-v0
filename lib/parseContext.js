export function renderContextBlock(raw, blockKey = 'c') {
  if (!raw) return null

  const parts = []
  // Bắt đúng cặp mở/đóng tương ứng nhờ backreference \1 (hỗ trợ lồng nhau, vd TABLE trong BOX)
  const blockRegex = /\[(TABLE|BOX|COL)(?:\s+type=(\w+))?\]([\s\S]*?)\[\/\1\]/g
  let lastIndex = 0
  let match

  while ((match = blockRegex.exec(raw)) !== null) {
    if (match.index > lastIndex)
      parts.push({ type: 'text', content: raw.slice(lastIndex, match.index) })

    const tag = match[1]
    if (tag === 'TABLE') {
      parts.push({ type: 'table', content: match[3] })
    } else if (tag === 'COL') {
      parts.push({ type: 'col', content: match[3] })
    } else {
      // BOX hoặc BOX type=xxx
      parts.push({ type: 'box', boxType: match[2] || 'default', content: match[3] })
    }
    lastIndex = blockRegex.lastIndex
  }
  if (lastIndex < raw.length)
    parts.push({ type: 'text', content: raw.slice(lastIndex) })

  return parts.map((part, pi) => {
    const key = `${blockKey}-${pi}`
    if (part.type === 'table') return parseTable(part.content, key)
    if (part.type === 'box')   return parseBox(part.content, part.boxType, key)
    if (part.type === 'col')   return parseColumns(part.content, key)

    const paragraphs = part.content.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
    return paragraphs.map((p, pai) => (
      <p key={`${key}-p-${pai}`} style={{ margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>
        {parseInline(p, `${key}-p-${pai}`)}
      </p>
    ))
  })
}

// ─── Box styles ───────────────────────────────────────────────────────────────
const BOX_STYLES = {
  default: {
    border:     '1.5px solid var(--c-primary-pale)',
    background: 'var(--c-primary-barest)',
    accent:     'var(--c-primary-mid)',
  },
  note: {
    border:     '1.5px solid var(--c-primary-light)',
    background: 'var(--c-primary-bg)',
    accent:     'var(--c-primary)',
  },
  warn: {
    border:     '1.5px solid var(--c-warn-border)',
    background: 'var(--c-warn-bgsoft)',
    accent:     'var(--c-warn)',
  },
  quote: {
    border:     '1.5px solid var(--c-primary-pale)',
    background: 'var(--c-surface)',
    accent:     'var(--c-primary-light)',
    italic:     true,
  },
  success: {
    border:     '1.5px solid var(--c-success-border)',
    background: 'var(--c-success-bg)',
    accent:     'var(--c-success)',
  },
}

// parseBox giờ gọi đệ quy renderContextBlock, nên [TABLE]/[COL] lồng bên trong [BOX] sẽ được parse đúng
// thay vì bị nuốt thành text thô như trước.
function parseBox(content, boxType, keyPrefix) {
  const s = BOX_STYLES[boxType] || BOX_STYLES.default

  return (
    <div key={keyPrefix} style={{
      border:       s.border,
      borderLeft:   `4px solid ${s.accent}`,
      borderRadius: '8px',
      backgroundColor: s.background,
      padding:      '12px 16px',
      margin:       '4px 0 14px',
      display:      'flex',
      flexDirection:'column',
      gap:          '6px',
      breakInside:  'avoid',
      fontStyle:    s.italic ? 'italic' : 'normal',
    }}>
      {renderContextBlock(content.trim(), keyPrefix)}
    </div>
  )
}

// ─── Column block (layout 2 cột cho bài báo/article) ──────────────────────────
// Dùng cho passage in 2 cột trong bản gốc: bọc [COL]...[/COL] quanh phần nội dung
// cần chia cột. Tắt hyphens để tránh trình duyệt tự tách sai giữa từ (vd Apple -> App le).
function parseColumns(content, keyPrefix) {
  const paragraphs = content.trim().split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  return (
    <div key={keyPrefix} className="ctx-2col" style={{
      columnCount: 2,
      columnGap: '28px',
      hyphens: 'none',
      WebkitHyphens: 'none',
      wordBreak: 'normal',
      overflowWrap: 'normal',
      margin: '4px 0 14px',
    }}>
      {paragraphs.map((p, pai) => (
        <p key={`${keyPrefix}-p-${pai}`} style={{
          margin: '0 0 12px', whiteSpace: 'pre-wrap',
          breakInside: 'avoid-column', // hạn chế cắt ngang 1 đoạn giữa 2 cột khi có thể
        }}>
          {parseInline(p, `${keyPrefix}-p-${pai}`)}
        </p>
      ))}
    </div>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────
function parseTable(tableText, keyPrefix) {
  const rows = tableText.trim().split('\n').map(r => r.trim()).filter(Boolean)
  return (
    <table key={keyPrefix} style={{ borderCollapse: 'collapse', width: '100%', margin: '4px 0 14px' }}>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>
            {row.split(';;').map(c => c.trim()).map((cell, ci) => (
              <td key={ci} style={{
                border: '1px solid var(--c-primary-pale)', padding: '6px 10px',
                verticalAlign: 'top', fontSize: 'inherit',
              }}>
                {parseInline(cell, `${keyPrefix}-${ri}-${ci}`)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Inline parser ────────────────────────────────────────────────────────────
function parseInline(text, keyPrefix) {
  const nodes = []
  const regex = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g
  let lastIndex = 0, match, key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    if (match[1]) nodes.push(<strong key={`${keyPrefix}-b-${key++}`}>{match[2]}</strong>)
    else          nodes.push(<em     key={`${keyPrefix}-i-${key++}`}>{match[4]}</em>)
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}