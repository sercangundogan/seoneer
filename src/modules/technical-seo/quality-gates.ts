import { SECRET_PATTERNS, scanForSecrets } from "@/modules/technical-seo/secret-scan";

export { SECRET_PATTERNS, scanForSecrets };

export type QualityGateResult = {
  id: string;
  status: "pass" | "fail" | "warn";
  detail: string;
};

export function runContentQualityGates(input: {
  files: { path: string; content: string }[];
  productName?: string;
}): QualityGateResult[] {
  const gates: QualityGateResult[] = [];
  const joined = input.files.map((f) => f.content).join("\n");

  const secretHits = scanForSecrets(joined);
  gates.push({
    id: "secrets",
    status: secretHits.length ? "fail" : "pass",
    detail: secretHits.length ? `Possible secrets: ${secretHits.join(", ")}` : "No secrets detected",
  });

  const fabricated =
    /\b(\d{2,3}%\s+(increase|growth|boost)|according to (a )?study|our customers say)\b/i.test(
      joined,
    );
  gates.push({
    id: "unverified_claims",
    status: fabricated ? "fail" : "pass",
    detail: fabricated
      ? "Possible unverified statistics or testimonials detected"
      : "No obvious fabricated claim patterns",
  });

  for (const file of input.files) {
    if (/\.(md|mdx)$/i.test(file.path)) {
      const hasTitle = /^#\s+.+/m.test(file.content) || /^title:\s+/m.test(file.content);
      gates.push({
        id: `heading:${file.path}`,
        status: hasTitle ? "pass" : "fail",
        detail: hasTitle ? "Heading/title present" : "Missing H1 or frontmatter title",
      });
    }
  }

  if (input.productName) {
    const relevant = joined.toLowerCase().includes(input.productName.toLowerCase().slice(0, 12));
    gates.push({
      id: "product_relevance",
      status: relevant ? "pass" : "warn",
      detail: relevant ? "Product name referenced" : "Product name not clearly referenced",
    });
  }

  return gates;
}

export function gatesPassed(gates: QualityGateResult[]): boolean {
  return gates.every((g) => g.status !== "fail");
}
