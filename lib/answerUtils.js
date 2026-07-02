// So sánh đáp án học viên với Correct_Ans.
// Cho phép Correct_Ans chứa nhiều đáp án được chấp nhận, cách nhau bởi "/"
// Ví dụ: Correct_Ans = "abc/xyz/def" -> cả 3 đều đúng

export   function normalizeAns(s) {
  return (s ?? '').toString().trim().toLowerCase()
}

export function getAcceptedAnswers(correctRaw) {
  return (correctRaw || '')
    .split('/')
    .map(s => s.trim())
    .filter(Boolean)
}

export function isAnswerCorrect(userAns, correctRaw) {
  const u = normalizeAns(userAns)
  if (!u) return false
  const accepted = getAcceptedAnswers(correctRaw)
  if (accepted.length === 0) return false
  return accepted.some(a => normalizeAns(a) === u)
}