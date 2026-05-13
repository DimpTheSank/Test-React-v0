import Papa from 'papaparse'

export const readExcelFromDrive = async (driveUrl) => {
  const fileUrl = convertDriveLink(driveUrl, 'excel')
  console.log('Fetching:', fileUrl)

  const response = await fetch(fileUrl)
  const text = await response.text()
  console.log('Status:', response.status)

  const { data } = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  })

  console.log('Rows:', data)
  return processRows(data)
}