export function pickQuestionText(
  text: string,
  textEn: string | null | undefined,
  locale: string
): string {
  if (locale === "en" && textEn && textEn.trim()) return textEn;
  return text;
}
