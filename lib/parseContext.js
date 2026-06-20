export function renderContextBlock(raw, blockKey = 'c') {
  if (!raw) return null

  const parts = []
  const tableRegex = /\[TABLE\]([\s\S]*?)\[\/TABLE\]/g
  let lastIndex = 0
  let match

  while ((match = tableRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) parts.push({ type: 'text', content: raw.slice(lastIndex, match.index) })
    parts.push({ type: 'table', content: match[1] })
    lastIndex = tableRegex.lastIndex
  }
  if (lastIndex < raw.length) parts.push({ type: 'text', content: raw.slice(lastIndex) })

  return parts.map((part, pi) => {
    const key = `${blockKey}-${pi}`
    if (part.type === 'table') return parseTable(part.content, key)

    const paragraphs = part.content.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
    return paragraphs.map((p, pai) => (
      <p key={`${key}-p-${pai}`} style={{ margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>
        {parseInline(p, `${key}-p-${pai}`)}
      </p>
    ))
  })
}

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

function parseInline(text, keyPrefix) {
  const nodes = []
  const regex = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g
  let lastIndex = 0
  let match
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    if (match[1]) nodes.push(<strong key={`${keyPrefix}-b-${key++}`}>{match[2]}</strong>)
    else nodes.push(<em key={`${keyPrefix}-i-${key++}`}>{match[4]}</em>)
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}