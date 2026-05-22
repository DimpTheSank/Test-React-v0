/**
 * Trả về base route phù hợp với loại bài tập.
 * Vocab Reading và Vocab Listening dùng /vocab/[id],
 * các loại còn lại dùng /bai-tap/[id].
 */
export function getExerciseRoute(kyNang, exerciseId, extra = '') {
  const isVocab = kyNang === 'Vocab Reading' || kyNang === 'Vocab Listening'
  const base = isVocab ? `/vocab/${exerciseId}` : `/bai-tap/${exerciseId}`
  return extra ? `${base}${extra}` : base
}