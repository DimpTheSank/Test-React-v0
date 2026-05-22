/**
 * Trả về base route phù hợp với loại bài tập.
 * Vocab Reading và Vocab Listening dùng /vocab/[id],
 * các loại còn lại dùng /bai-tap/[id].
 */
export function getExerciseRoute(loaiBai, exerciseId, extra = '') {
  const isVocab = loaiBai === 'Vocab Reading' || loaiBai === 'Vocab Listening'
  const base = isVocab ? `/vocab/${exerciseId}` : `/bai-tap/${exerciseId}`
  return extra ? `${base}${extra}` : base
}