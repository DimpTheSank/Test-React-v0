'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * useHighlight — highlight tạm thời trong session, không lưu DB.
 * Dùng window.getSelection() + Range + <mark> wrapping.
 * Hỗ trợ: click floating toolbar hoặc Ctrl+H.
 *
 * @param {string[]} containerIds — mảng id của các div cần enable highlight
 */
export function useHighlight(containerIds = []) {
  const [toolbar, setToolbar] = useState(null) // { x, y, range }
  const markColor = '#FFF176' // vàng nhạt

  // Ẩn toolbar
  const hideToolbar = useCallback(() => setToolbar(null), [])

  // Kiểm tra selection có nằm trong container không
  const isInsideContainers = useCallback((node) => {
    return containerIds.some(id => {
      const el = document.getElementById(id)
      return el && el.contains(node)
    })
  }, [containerIds])

  // Hiện toolbar khi bôi text
  useEffect(() => {
    const handleMouseUp = (e) => {
      // Bỏ qua nếu click vào chính toolbar
      if (e.target.closest('#highlight-toolbar')) return

      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.toString().trim() === '') {
        hideToolbar()
        return
      }

      const range = sel.getRangeAt(0)

      // Kiểm tra cả start và end node có trong container không
      if (!isInsideContainers(range.commonAncestorContainer)) {
        hideToolbar()
        return
      }

      const rect = range.getBoundingClientRect()
      setToolbar({
        x: rect.left + rect.width / 2,
        y: rect.top + window.scrollY - 44,
        range: range.cloneRange(),
      })
    }

    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [containerIds, isInsideContainers, hideToolbar])

  // Ctrl+H shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault()
        if (toolbar) applyHighlight()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toolbar])

  // Click ngoài → ẩn toolbar
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('#highlight-toolbar')) hideToolbar()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [hideToolbar])

  // Áp dụng / gỡ highlight
  const applyHighlight = useCallback(() => {
    if (!toolbar?.range) return
    const range = toolbar.range

    // Kiểm tra xem selection có đang nằm trong <mark> không → toggle off
    const parentMark = getParentMark(range.commonAncestorContainer)
    if (parentMark) {
      unwrapMark(parentMark)
      hideToolbar()
      return
    }

    // Wrap selection trong <mark>
    try {
      const mark = document.createElement('mark')
      mark.style.backgroundColor = markColor
      mark.style.borderRadius = '2px'
      mark.style.padding = '0 1px'
      mark.style.cursor = 'pointer'
      mark.title = 'Click để bỏ highlight'

      // Xử lý trường hợp selection span nhiều node
      const fragment = range.extractContents()
      mark.appendChild(fragment)
      range.insertNode(mark)

      // Click vào mark để bỏ highlight
      mark.addEventListener('click', () => unwrapMark(mark))

      // Clear selection
      window.getSelection()?.removeAllRanges()
    } catch (err) {
      console.warn('Highlight error:', err)
    }

    hideToolbar()
  }, [toolbar, hideToolbar])

  return { toolbar, applyHighlight, hideToolbar }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getParentMark(node) {
  let current = node
  while (current) {
    if (current.nodeName === 'MARK') return current
    current = current.parentNode
  }
  return null
}

function unwrapMark(mark) {
  const parent = mark.parentNode
  if (!parent) return
  while (mark.firstChild) {
    parent.insertBefore(mark.firstChild, mark)
  }
  parent.removeChild(mark)
  // Normalize để merge text nodes liền kề
  parent.normalize()
}