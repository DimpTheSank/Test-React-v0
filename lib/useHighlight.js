'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

export function useHighlight(containerIds = []) {
  const [toolbar, setToolbar] = useState(null)

  const hideToolbar = useCallback(() => setToolbar(null), [])

  const isInsideContainers = useCallback((node) => {
    return containerIds.some(id => {
      const el = document.getElementById(id)
      return el && el.contains(node)
    })
  }, [containerIds])

  useEffect(() => {
    const handleMouseUp = (e) => {
      if (e.target.closest('#highlight-toolbar')) return
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.toString().trim() === '') {
        hideToolbar(); return
      }
      const range = sel.getRangeAt(0)
      if (!isInsideContainers(range.commonAncestorContainer)) {
        hideToolbar(); return
      }
      const rect = range.getBoundingClientRect()
      setToolbar({
        x: rect.left + rect.width / 2,
        y: rect.top + window.scrollY - 50,
        range: range.cloneRange(),
      })
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [containerIds, isInsideContainers, hideToolbar])

  // Ctrl+H dùng màu vàng mặc định
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault()
        if (toolbar) applyHighlight('#FFF176')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toolbar])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('#highlight-toolbar')) hideToolbar()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [hideToolbar])

  const applyHighlight = useCallback((color = '#FFF176') => {
    if (!toolbar?.range) return
    const range = toolbar.range

    const parentMark = getParentMark(range.commonAncestorContainer)
    if (parentMark) {
      // Nếu click cùng màu → bỏ highlight; khác màu → đổi màu
      if (parentMark.style.backgroundColor === hexToRgb(color) || parentMark.dataset.color === color) {
        unwrapMark(parentMark)
      } else {
        parentMark.style.backgroundColor = color
        parentMark.dataset.color = color
      }
      hideToolbar()
      return
    }

    try {
      const mark = document.createElement('mark')
      mark.style.backgroundColor = color
      mark.style.borderRadius = '2px'
      mark.style.padding = '0 1px'
      mark.style.cursor = 'pointer'
      mark.dataset.color = color
      mark.title = 'Click để bỏ highlight'
      mark.addEventListener('click', () => unwrapMark(mark))

      const fragment = range.extractContents()
      mark.appendChild(fragment)
      range.insertNode(mark)

      window.getSelection()?.removeAllRanges()
    } catch (err) {
      console.warn('Highlight error:', err)
    }

    hideToolbar()
  }, [toolbar, hideToolbar])

  return { toolbar, applyHighlight, hideToolbar }
}

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
  while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
  parent.removeChild(mark)
  parent.normalize()
}

// So sánh hex với giá trị rgb mà browser trả về
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgb(${r}, ${g}, ${b})`
}