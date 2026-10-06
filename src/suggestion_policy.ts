export type RankedFaq = {
  id: string;
  question: string;
  answer: string;
  area: string;
  score: number;
};

export function publishSuggestions(candidates: RankedFaq[], limit: number): RankedFaq[] {
  const seen = new Set<string>();
  return candidates
    .filter((entry) => entry.question.trim().length > 0 && entry.answer.trim().length > 0)
    .filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
