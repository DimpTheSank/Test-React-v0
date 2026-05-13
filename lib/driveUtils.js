export const convertDriveLink = (url, type = 'image') => {
  if (!url || typeof url !== 'string') return url

  // Không phải link Drive → giữ nguyên
  if (!url.includes('drive.google.com')) return url

  // Extract FILE_ID
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) return url
  const fileId = match[1]

  if (type === 'audio' || type === 'excel') {
    return `https://drive.google.com/uc?export=download&id=${fileId}`
  }
  return `https://drive.google.com/uc?export=view&id=${fileId}`
}