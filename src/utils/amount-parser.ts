const BANGLA_DIGIT_MAP: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

export function normalizeBanglaNumerals(text: string): string {
  return text.replace(/[০-৯]/g, (digit) => BANGLA_DIGIT_MAP[digit] ?? digit);
}

export function parseAmountsFromText(text: string): number[] {
  const normalized = normalizeBanglaNumerals(text.toLowerCase());
  const amounts = new Set<number>();

  const patterns = [
    /\b(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*(?:taka|tk|bdt)?\b/gi,
    /(?:taka|tk|bdt)\s*(\d{1,3}(?:,\d{3})+|\d+)/gi,
  ];

  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const raw = match[1]?.replace(/,/g, '');
      if (!raw) {
        continue;
      }

      const value = Number(raw);
      if (Number.isFinite(value) && value > 0) {
        amounts.add(value);
      }
    }
  }

  return [...amounts];
}
