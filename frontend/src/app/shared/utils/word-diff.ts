export interface DiffSegment {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
}

/**
 * Compute a word-level diff between two strings using LCS.
 */
export function computeWordDiff(
  oldText: string,
  newText: string,
): DiffSegment[] {
  const oldWords = tokenize(oldText);
  const newWords = tokenize(newText);

  if (oldWords.length === 0 && newWords.length === 0) return [];
  if (oldWords.length === 0) {
    return [{ type: 'added', text: newText }];
  }
  if (newWords.length === 0) {
    return [{ type: 'removed', text: oldText }];
  }

  const lcs = computeLCS(oldWords, newWords);
  return buildDiffSegments(oldWords, newWords, lcs);
}

/**
 * Render diff segments as HTML with colored backgrounds.
 */
export function renderDiffHtml(segments: DiffSegment[]): string {
  return segments
    .map((seg) => {
      switch (seg.type) {
        case 'added':
          return `<span class="bg-green-100 text-[var(--success)] px-0.5 rounded">${escapeHtml(seg.text)}</span>`;
        case 'removed':
          return `<span class="bg-[var(--destructive)]/10 text-[var(--destructive)]ed-800 line-through px-0.5 rounded">${escapeHtml(seg.text)}</span>`;
        case 'unchanged':
          return escapeHtml(seg.text);
      }
    })
    .join('');
}

function tokenize(text: string): string[] {
  if (!text) return [];
  return text.split(/(\s+)/);
}

function computeLCS(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

function buildDiffSegments(
  oldWords: string[],
  newWords: string[],
  dp: number[][],
): DiffSegment[] {
  const segments: DiffSegment[] = [];
  let i = oldWords.length;
  let j = newWords.length;

  const stack: DiffSegment[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      stack.push({ type: 'unchanged', text: oldWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: 'added', text: newWords[j - 1] });
      j--;
    } else {
      stack.push({ type: 'removed', text: oldWords[i - 1] });
      i--;
    }
  }

  stack.reverse();

  // Merge consecutive segments of the same type
  for (const seg of stack) {
    const last = segments[segments.length - 1];
    if (last && last.type === seg.type) {
      segments[segments.length - 1] = {
        ...last,
        text: last.text + seg.text,
      };
    } else {
      segments.push(seg);
    }
  }

  return segments;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
