const PATTERNS: { id: string; re: RegExp }[] = [
  { id: "aws_key", re: /AKIA[0-9A-Z]{16}/ },
  { id: "generic_api_key", re: /(?:api[_-]?key|secret|token)["']?\s*[:=]\s*["'][A-Za-z0-9_\-]{20,}["']/i },
  { id: "private_key", re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  { id: "github_pat", re: /ghp_[A-Za-z0-9]{36}/ },
];

export const SECRET_PATTERNS = PATTERNS;

export function scanForSecrets(text: string): string[] {
  return PATTERNS.filter((p) => p.re.test(text)).map((p) => p.id);
}
