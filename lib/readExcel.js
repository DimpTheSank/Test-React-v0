export const readExcelFromDrive = async (driveUrl) => {
  const fileUrl = convertDriveLink(driveUrl, 'excel')
  
  console.log('Đang fetch:', fileUrl) // kiểm tra URL

  const response = await fetch(fileUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  })

  console.log('Status:', response.status) // kiểm tra response
  console.log('Content-Type:', response.headers.get('content-type'))

  const arrayBuffer = await response.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet)
  return processRows(rows)
}