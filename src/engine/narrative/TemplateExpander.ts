// Recursive template expander: $[key] via snippet library, [VAR] via variables map.
// Source: docs/spec/design.md §6.2.

import { IRng } from '@/engine/core/RNG';
import { SnippetLibrary, pickSnippet } from './SnippetLibrary';

export interface ExpandContext {
  library: SnippetLibrary;
  variables: Readonly<Record<string, string>>;
  preferredTags: ReadonlyArray<string>;
  rng: IRng;
}

const MAX_DEPTH = 8;
const VAR_TOKEN = /\[([A-Z_][A-Z0-9_]*)\]/g;
const SNIPPET_TOKEN_OPEN = '$[';

/**
 * Expand a template string:
 *   - [VAR]: literal substitution from ctx.variables. Missing → left intact.
 *   - $[key]: resolved via snippet library (keys may contain nested $[…] tokens).
 *     Unknown keys resolve to empty string. Recursion is capped at MAX_DEPTH.
 */
export function expandTemplate(template: string, ctx: ExpandContext, depth: number = 0): string {
  if (depth > MAX_DEPTH) return '';

  // First, resolve $[…] tokens (innermost first) until none remain or depth cap hit.
  let s = template;
  let iterations = 0;
  while (s.includes(SNIPPET_TOKEN_OPEN) && iterations < MAX_DEPTH) {
    s = resolveOneSnippetToken(s, ctx, depth);
    iterations++;
  }

  // Then, substitute [VAR] tokens (single pass; literals don't recurse).
  s = s.replace(VAR_TOKEN, (match, varName: string) => {
    const v = ctx.variables[varName];
    return v !== undefined ? v : match;
  });

  return s;
}

/** Find and resolve the innermost $[…] token in the string. One pass. */
function resolveOneSnippetToken(s: string, ctx: ExpandContext, depth: number): string {
  // Find the last "$[" — this gives us the innermost (deepest-nested) token.
  const open = s.lastIndexOf(SNIPPET_TOKEN_OPEN);
  if (open === -1) return s;
  const close = s.indexOf(']', open + 2);
  if (close === -1) return s;

  const rawKey = s.substring(open + 2, close);
  // The raw key may itself contain [VAR] tokens (but not $[…] because we picked innermost).
  const key = rawKey.replace(VAR_TOKEN, (_, v: string) => ctx.variables[v] ?? '');

  // Try snippet library first; fall back to variable lookup for bare variable names.
  const snippetText = pickSnippet(ctx.library, key, ctx.preferredTags, ctx.rng);
  const resolved = snippetText ?? ctx.variables[key] ?? '';
  // Recurse into resolved content — a snippet may contain more $[…] or [VAR] tokens.
  const expanded = expandTemplate(resolved, ctx, depth + 1);

  return s.substring(0, open) + expanded + s.substring(close + 1);
}
