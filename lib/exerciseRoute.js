/**
 * Trả về base route phù hợp với loại bài tập.
 * Vocab Reading và Vocab Listening dùng /vocab/[id],
 * IELTS dùng /bai-tap-ielts/[id],
 * các loại còn lại dùng /bai-tap/[id].
 */
export function getExerciseRoute(kyNang, exerciseId, loaiBai = '', extra = '') {
  const isVocab = kyNang === 'Vocab Reading' || kyNang === 'Vocab Listening'
  const isIELTS = loaiBai === 'IELTS'

  const base = isVocab
    ? `/vocab/${exerciseId}`
    : isIELTS
      ? `/bai-tap-ielts/${exerciseId}`
      : `/bai-tap/${exerciseId}`

  return extra ? `${base}${extra}` : base
}