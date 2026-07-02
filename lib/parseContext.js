export function renderContextBlock(raw, blockKey = 'c') {
  if (!raw) return null

  const parts = []
  const blockRegex = /\[(TABLE|BOX(?:[^\]]*)?)\]([\s\S]*?)\[\/(?:TABLE|BOX)\]/g
  let lastIndex = 0
  let match

  while ((match = blockRegex.exec(raw)) !== null) {
    if (match.index > lastIndex)
      parts.push({ type: 'text', content: raw.slice(lastIndex, match.index) })

    const tag = match[1]
    if (tag === 'TABLE') {
      parts.push({ type: 'table', content: match[2] })
    } else {
      // BOX hoặc BOX type=xxx
      const typeMatch = tag.match(/type=(\w+)/)
      parts.push({ type: 'box', boxType: typeMatch?.[1] || 'default', content: match[2] })
    }
    lastIndex = blockRegex.lastIndex
  }
  if (lastIndex < raw.length)
    parts.push({ type: 'text', content: raw.slice(lastIndex) })

  return parts.map((part, pi) => {
    const key = `${blockKey}-${pi}`
    if (part.type === 'table') return parseTable(part.content, key)
    if (part.type === 'box')   return parseBox(part.content, part.boxType, key)

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

function parseBox(content, boxType, keyPrefix) {
  const s = BOX_STYLES[boxType] || BOX_STYLES.default
  const lines = content.trim().split('\n').map(l => l.trim()).filter(Boolean)

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
      {lines.map((line, i) => (
        <p key={i} style={{ margin: 0, lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
          {parseInline(line, `${keyPrefix}-l-${i}`)}
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