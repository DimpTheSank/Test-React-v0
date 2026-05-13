export const convertDriveLink = (url, type = 'image') => {
  if (!url || typeof url !== 'string') return url
  if (!url.includes('drive.google.com')) return url

  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) return url
  const fileId = match[1]

  if (type === 'excel') {
    return `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`
  }
  if (type === 'audio') {
    return `https://drive.google.com/uc?export=download&id=${fileId}`
  }
  return `https://drive.google.com/uc?export=view&id=${fileId}`
}