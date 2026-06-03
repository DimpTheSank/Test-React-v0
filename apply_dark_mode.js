/**
 * Chạy script này để tự động thay thế màu hardcoded → CSS variables
 * Cách dùng (từ thư mục gốc dự án):
 *   node apply_dark_mode.js
 */

const fs   = require('fs')
const path = require('path')

const pairs = [
  [/'#0C447C'/g,   "'var(--c-primary-dark)'"],
  [/'#185FA5'/g,   "'var(--c-primary)'"],
  [/'#378ADD'/g,   "'var(--c-primary-mid)'"],
  [/'#85B7EB'/g,   "'var(--c-primary-light)'"],
  [/'#B5D4F4'/g,   "'var(--c-primary-pale)'"],
  [/'#E6F1FB'/g,   "'var(--c-primary-bg)'"],
  [/'#F0F7FF'/g,   "'var(--c-primary-bgsoft)'"],
  [/'#F8FBFF'/g,   "'var(--c-primary-barest)'"],
  [/'#EFF6FF'/g,   "'var(--c-primary-bgsoft)'"],
  [/'#1D9E75'/g,   "'var(--c-success)'"],
  [/'#E1F5EE'/g,   "'var(--c-success-bg)'"],
  [/'#085041'/g,   "'var(--c-success-text)'"],
  [/'#9FE1CB'/g,   "'var(--c-success-border)'"],
  [/'#F0A500'/g,   "'var(--c-warn)'"],
  [/'#FAEEDA'/g,   "'var(--c-warn-bg)'"],
  [/'#633806'/g,   "'var(--c-warn-text)'"],
  [/'#FFFBEB'/g,   "'var(--c-warn-bgsoft)'"],
  [/'#92400E'/g,   "'var(--c-warn-textsoft)'"],
  [/'#FEF3C7'/g,   "'var(--c-warn-bg)'"],
  [/'#E24B4A'/g,   "'var(--c-danger)'"],
  [/'#FCEBEB'/g,   "'var(--c-danger-bg)'"],
  [/'#791F1F'/g,   "'var(--c-danger-text)'"],
  [/'#F9A8A8'/g,   "'var(--c-danger-border)'"],
  [/'#BA7517'/g,   "'var(--c-writing)'"],
  [/'#A32D2D'/g,   "'var(--c-speaking)'"],
  [/'#6B7280'/g,   "'var(--c-text-muted)'"],
  [/'#1a1a1a'/g,   "'var(--c-text)'"],
  [/'white'/g,     "'var(--c-surface)'"],
  [/'#555'/g,      "'var(--c-text-soft)'"],
  [/'#888'/g,      "'var(--c-text-muted)'"],
  [/'#333'/g,      "'var(--c-text)'"],
  // unquoted trong CSS template strings
  [/#0C447C/g,   'var(--c-primary-dark)'],
  [/#185FA5/g,   'var(--c-primary)'],
  [/#378ADD/g,   'var(--c-primary-mid)'],
  [/#B5D4F4/g,   'var(--c-primary-pale)'],
  [/#E6F1FB/g,   'var(--c-primary-bg)'],
  [/#F0F7FF/g,   'var(--c-primary-bgsoft)'],
  [/#F8FBFF/g,   'var(--c-primary-barest)'],
  [/#1D9E75/g,   'var(--c-success)'],
  [/#E1F5EE/g,   'var(--c-success-bg)'],
  [/#085041/g,   'var(--c-success-text)'],
  [/#9FE1CB/g,   'var(--c-success-border)'],
  [/#FAEEDA/g,   'var(--c-warn-bg)'],
  [/#633806/g,   'var(--c-warn-text)'],
  [/#F0A500/g,   'var(--c-warn)'],
  [/#E24B4A/g,   'var(--c-danger)'],
  [/#FCEBEB/g,   'var(--c-danger-bg)'],
  [/#791F1F/g,   'var(--c-danger-text)'],
  [/#6B7280/g,   'var(--c-text-muted)'],
  [/rgba\(12,68,124,0\.4\)/g, 'var(--c-overlay)'],
]

// Walk thư mục, trả về tất cả file .js/.jsx
function walk(dir) {
  if (!fs.existsSync(dir)) return []
  let results = []
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f)
    try {
      const stat = fs.statSync(full)
      if (stat.isDirectory() && f !== 'node_modules' && f !== '.next') {
        results = results.concat(walk(full))
      } else if (stat.isFile() && (f.endsWith('.js') || f.endsWith('.jsx'))) {
        results.push(full)
      }
    } catch(e) {}
  })
  return results
}

const files = [...walk('./app'), ...walk('./lib')]
let changed = 0

files.forEach(file => {
  let src
  try { src = fs.readFileSync(file, 'utf8') } catch(e) { return }
  const orig = src
  pairs.forEach(([p, r]) => { src = src.replace(p, r) })
  if (src !== orig) {
    fs.writeFileSync(file, src)
    console.log('✓', file)
    changed++
  }
})

console.log(`\nDone: ${changed} file(s) updated.`)