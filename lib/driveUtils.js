export const convertDriveLink = (url, type = 'image') => {
  if (!url || typeof url !== 'string') return url
  if (!url.includes('drive.google.com')) return url

  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (!match) return url
  const fileId = match[1]

  if (type === 'excel') {
    return `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`
  }
  
  if (type === 'audio') {
    return `https://drive.google.com/file/d/${fileId}/preview`
  }

  // Giữ nguyên thumbnail cho ảnh vì nó rất ổn định [cite: 1718]
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`
}