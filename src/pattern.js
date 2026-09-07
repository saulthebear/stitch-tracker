/**
 * Understand a single bracketed repeat, counting output stitches.
 * An increase makes two stitches; a decrease makes one.
 * @param {string} note
 */
export function parseRepeat(note) {
  const match = note.trim().match(/^\[([^\[\]]+)\]\s*[x×]\s*(\d+)\s*(?:\(\s*\d+\s*\))?$/i);
  if (!match) return null;
  const repeats = Number(match[2]);
  if (!Number.isSafeInteger(repeats) || repeats < 1) return null;
  let stitchesPerRepeat = 0;
  for (const part of match[1].split(',')) {
    const stitch = part.trim().match(/^(?:(\d+)\s*)?(sc|inc|dec|hdc|dc|tr|ch|sl\s*st)$/i);
    if (!stitch) return null;
    const count = stitch[1] ? Number(stitch[1]) : 1;
    if (!Number.isSafeInteger(count) || count < 1) return null;
    stitchesPerRepeat += count * (stitch[2].toLowerCase() === 'inc' ? 2 : 1);
  }
  const total = repeats * stitchesPerRepeat;
  if (!Number.isSafeInteger(total) || total > 100000) return null;
  return { repeats, stitchesPerRepeat, total };
}

/** @param {string} note */
export function parsePatternTotal(note) {
  const explicit = note.match(/\(\s*(\d+)\s*\)\s*$/);
  if (explicit) {
    const total = Number(explicit[1]);
    return Number.isSafeInteger(total) && total > 0 && total <= 100000 ? total : null;
  }
  return parseRepeat(note)?.total ?? null;
}

/**
 * Unknown patterns or totals that disagree with the repeat get one continuous bar.
 * Very dense repeats also use one bar, keeping the mobile display readable.
 * @param {string} note
 * @param {number} total
 * @param {number} current
 */
export function progressSections(note, total, current) {
  const repeat = parseRepeat(note);
  const explicitTotal = parsePatternTotal(note);
  const segmented = repeat && repeat.total === total && explicitTotal === total && repeat.repeats <= 60;
  const count = segmented ? repeat.repeats : 1;
  const size = total / count;
  return Array.from({ length: count }, (_, index) =>
    size > 0 ? Math.max(0, Math.min(1, (current - index * size) / size)) : 0);
}
