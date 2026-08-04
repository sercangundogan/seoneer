import {
  assertUpdatePreservesBody,
  splitFrontmatter,
} from "@/modules/content-patch/frontmatter";

export type InternalLinkTarget = {
  path: string;
  title: string;
  href: string;
};

/** Map common content paths to public URLs. */
export function contentPathToHref(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const withoutExt = normalized.replace(/\.(md|mdx)$/i, "");
  const slug = withoutExt
    .replace(/^(content\/)?blog\//, "")
    .replace(/^src\/app\/blog\//, "")
    .replace(/^app\/blog\//, "")
    .replace(/^posts\//, "")
    .replace(/\/page$/i, "");
  return `/blog/${slug}`.replace(/\/+/g, "/");
}

export function titleFromContent(path: string, content: string): string {
  const { frontmatter, body } = splitFrontmatter(content);
  const fmTitle = frontmatter.match(/^title:\s*(.+)$/m)?.[1]?.replace(/^["']|["']$/g, "").trim();
  if (fmTitle) return fmTitle;
  const h1 = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (h1) return h1;
  return (
    path
      .split("/")
      .pop()
      ?.replace(/\.(md|mdx)$/i, "")
      .replace(/[-_]+/g, " ") ?? path
  );
}

/**
 * Append a Related reading section with markdown links.
 * Never rewrites existing article body.
 */
export function appendRelatedReadingLinks(
  content: string,
  links: { title: string; href: string }[],
): string {
  if (links.length === 0) return content;
  if (/##\s+Related reading/i.test(content)) {
    // Already has the section — leave alone rather than duplicating or rewriting
    return content;
  }
  const section = [
    "",
    "## Related reading",
    "",
    ...links.map((l) => `- [${l.title}](${l.href})`),
    "",
  ].join("\n");
  return `${content.replace(/\s*$/, "")}\n${section}`;
}

export function applyInternalLinkPatches(
  originals: Record<string, string>,
  updates: { path: string; links: { title: string; href: string }[] }[],
): { path: string; content: string; operation: "update" }[] {
  const files: { path: string; content: string; operation: "update" }[] = [];
  for (const update of updates) {
    const original = originals[update.path];
    if (!original || update.links.length === 0) continue;
    const content = appendRelatedReadingLinks(original, update.links);
    const check = assertUpdatePreservesBody(original, content);
    if (!check.ok) continue;
    if (content === original) continue;
    files.push({ path: update.path, content, operation: "update" });
  }
  return files;
}

/**
 * Heuristic: for each post, link to up to 2 other posts.
 */
export function buildHeuristicInternalLinkPlan(
  paths: string[],
  originals: Record<string, string>,
): { path: string; links: { title: string; href: string }[] }[] {
  const catalog: InternalLinkTarget[] = paths
    .filter((p) => originals[p])
    .map((path) => ({
      path,
      title: titleFromContent(path, originals[path]),
      href: contentPathToHref(path),
    }));

  return catalog.map((source, index) => {
    const links = catalog
      .filter((t) => t.path !== source.path)
      .slice(index % Math.max(catalog.length - 1, 1), index + 3)
      .concat(catalog.filter((t) => t.path !== source.path))
      .filter((t, i, arr) => arr.findIndex((x) => x.path === t.path) === i)
      .slice(0, 2)
      .map((t) => ({ title: t.title, href: t.href }));
    return { path: source.path, links };
  });
}
