import * as XLSX from 'xlsx'
import { convertDriveLink } from './driveUtils'

export const readExcelFromDrive = async (driveUrl) => {
  const fileUrl = convertDriveLink(driveUrl, 'excel')
  const response = await fetch(fileUrl)
  const arrayBuffer = await response.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet)
  return processRows(rows)
}

const processRows = (rows) => {
  let currentGroup = null
  let currentContext = null
  let currentAudio = null
  let currentType = null

  return rows.map((row, index) => {
    if (row.Group !== currentGroup) {
      currentGroup = row.Group
      currentType = row.Type || currentType
      currentContext = row.Context
        ? convertDriveLink(row.Context, 'image')
        : currentContext
      currentAudio = row.Audio
        ? convertDriveLink(row.Audio, 'audio')
        : currentAudio
    }

    return {
      index: index + 1,
      group: currentGroup,
      type: currentType,
      context: currentContext,
      audio: currentAudio,
      questionType: row.Question_Type,
      numAnswers: row.Num_Answers || 1,
      question: row.Question || null,
      options: processOptions(row),
      correctAnswers: processCorrectAnswers(row),
    }
  })
}

const processOptions = (row) => {
  if (row.Question_Type === 'mcq') {
    return ['A', 'B', 'C', 'D', 'E']
      .map(key => ({ key, value: row[`Opt_${key}`] }))
      .filter(opt => opt.value && opt.value.toString().trim() !== '')
  }
  if (row.Question_Type === 'mcq_blank') {
    return Array.from({ length: row.Num_Answers || 4 }, (_, i) => ({
      key: String.fromCharCode(65 + i), // A, B, C...
      value: null,
    }))
  }
  return []
}

const processCorrectAnswers = (row) => {
  if (row.Correct_Ans) return [row.Correct_Ans.toString().trim()]
  return []
}