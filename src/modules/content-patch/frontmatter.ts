/**
 * Surgical MD/MDX frontmatter edits — never rewrite the article body.
 */

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function splitFrontmatter(content: string): {
  hasFrontmatter: boolean;
  frontmatter: string;
  body: string;
} {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return { hasFrontmatter: false, frontmatter: "", body: content };
  }
  return {
    hasFrontmatter: true,
    frontmatter: match[1],
    body: match[2],
  };
}

function quoteYamlScalar(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function setYamlField(frontmatter: string, key: string, value: string): string {
  const lines = frontmatter.split(/\r?\n/);
  const keyRe = new RegExp(`^${key}\\s*:`);
  const quoted = quoteYamlScalar(value);
  let found = false;
  const next = lines.map((line) => {
    if (!keyRe.test(line)) return line;
    found = true;
    return `${key}: ${quoted}`;
  });
  if (!found) next.push(`${key}: ${quoted}`);
  return next.join("\n");
}

/**
 * Update title/description in YAML frontmatter while keeping the body byte-for-byte
 * (aside from normalizing the closing frontmatter newline).
 */
export function upsertFrontmatterFields(
  content: string,
  fields: { title?: string; description?: string },
): string {
  const { hasFrontmatter, frontmatter, body } = splitFrontmatter(content);
  let fm = hasFrontmatter ? frontmatter : "";
  if (fields.title !== undefined) fm = setYamlField(fm, "title", fields.title);
  if (fields.description !== undefined) {
    fm = setYamlField(fm, "description", fields.description);
  }
  if (!fm.trim() && !hasFrontmatter) {
    // No frontmatter and nothing to set
    return content;
  }
  const bodyPart = hasFrontmatter ? body : content;
  // Preserve whether original body started immediately after --- or with blank lines
  return `---\n${fm.trimEnd()}\n---\n${bodyPart.startsWith("\n") || bodyPart.length === 0 ? bodyPart : `\n${bodyPart}`}`;
}

export function bodyFingerprint(content: string): string {
  return splitFrontmatter(content).body.replace(/\s+/g, " ").trim();
}

/**
 * Reject updates that wipe or heavily shrink the article body.
 */
export function assertUpdatePreservesBody(
  original: string,
  updated: string,
): { ok: boolean; reason?: string } {
  const originalBody = splitFrontmatter(original).body.trim();
  const updatedBody = splitFrontmatter(updated).body.trim();

  if (originalBody.length === 0) {
    return { ok: true };
  }

  if (updatedBody.length === 0) {
    return { ok: false, reason: "Update removed the entire article body" };
  }

  // Allow small whitespace differences but not content deletion
  const origFp = bodyFingerprint(original);
  const nextFp = bodyFingerprint(updated);
  if (origFp === nextFp) {
    return { ok: true };
  }

  // Body changed (e.g. UPDATE_ARTICLE) — still reject catastrophic shrinkage
  if (updatedBody.length < Math.max(80, Math.floor(originalBody.length * 0.5))) {
    return {
      ok: false,
      reason: `Update shrunk the article body from ${originalBody.length} to ${updatedBody.length} chars`,
    };
  }

  return { ok: true };
}

export type MetadataSuggestion = {
  path: string;
  title: string;
  description: string;
};

/**
 * Apply metadata suggestions onto original file contents.
 * Skips paths missing from the original map.
 */
export function applyMetadataPatches(
  originals: Record<string, string>,
  suggestions: MetadataSuggestion[],
): { path: string; content: string; operation: "update" }[] {
  const files: { path: string; content: string; operation: "update" }[] = [];
  for (const suggestion of suggestions) {
    const original = originals[suggestion.path];
    if (!original) continue;
    const content = upsertFrontmatterFields(original, {
      title: suggestion.title,
      description: suggestion.description,
    });
    const check = assertUpdatePreservesBody(original, content);
    if (!check.ok) continue;
    if (content === original) continue;
    files.push({ path: suggestion.path, content, operation: "update" });
  }
  return files;
}
