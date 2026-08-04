import { App } from "@octokit/app";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { env } from "@/lib/env";

function getPrivateKey(): string | undefined {
  if (!env.GITHUB_APP_PRIVATE_KEY) return undefined;
  return env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n");
}

export function createGitHubApp(): App | null {
  const privateKey = getPrivateKey();
  if (!env.GITHUB_APP_ID || !privateKey) return null;
  return new App({
    appId: env.GITHUB_APP_ID,
    privateKey,
    oauth: env.GITHUB_APP_CLIENT_ID
      ? {
          clientId: env.GITHUB_APP_CLIENT_ID,
          clientSecret: env.GITHUB_APP_CLIENT_SECRET ?? "",
        }
      : undefined,
    webhooks: env.GITHUB_APP_WEBHOOK_SECRET
      ? { secret: env.GITHUB_APP_WEBHOOK_SECRET }
      : undefined,
  });
}

function createAppOctokit(): Octokit {
  const privateKey = getPrivateKey();
  if (!env.GITHUB_APP_ID || !privateKey) {
    throw new Error("GitHub App is not configured");
  }
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.GITHUB_APP_ID,
      privateKey,
      clientId: env.GITHUB_APP_CLIENT_ID,
      clientSecret: env.GITHUB_APP_CLIENT_SECRET,
    },
  });
}

export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
  const privateKey = getPrivateKey();
  if (!env.GITHUB_APP_ID || !privateKey) {
    throw new Error("GitHub App is not configured");
  }
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.GITHUB_APP_ID,
      privateKey,
      installationId,
      clientId: env.GITHUB_APP_CLIENT_ID,
      clientSecret: env.GITHUB_APP_CLIENT_SECRET,
    },
  });
}

export function githubAppInstallUrl(state?: string): string {
  const slug = env.GITHUB_APP_SLUG ?? "seoneer";
  const url = new URL(`https://github.com/apps/${slug}/installations/new`);
  if (state) url.searchParams.set("state", state);
  return url.toString();
}

/** List installations of this GitHub App (app-authenticated). */
export async function listGithubAppInstallations(): Promise<
  {
    installationId: number;
    accountLogin: string;
    accountType: string;
    suspended: boolean;
  }[]
> {
  const octokit = createAppOctokit();
  const installations = await octokit.paginate(octokit.rest.apps.listInstallations, {
    per_page: 100,
  });

  return installations.map((installation) => {
    const account = installation.account as {
      login?: string;
      slug?: string;
      type?: string;
    } | null;
    return {
      installationId: installation.id,
      accountLogin: account?.login ?? account?.slug ?? "unknown",
      accountType: account?.type ?? "Organization",
      suspended: Boolean(installation.suspended_at),
    };
  });
}

export type RepoFileChange = {
  path: string;
  content: string;
  operation: "create" | "update";
};

export async function createBranchAndCommit(input: {
  installationId: number;
  owner: string;
  repo: string;
  baseBranch: string;
  branch: string;
  files: RepoFileChange[];
  commitMessage: string;
}): Promise<{ commitSha: string }> {
  const octokit = await getInstallationOctokit(input.installationId);

  const { data: ref } = await octokit.rest.git.getRef({
    owner: input.owner,
    repo: input.repo,
    ref: `heads/${input.baseBranch}`,
  });
  const baseSha = ref.object.sha;

  try {
    await octokit.rest.git.createRef({
      owner: input.owner,
      repo: input.repo,
      ref: `refs/heads/${input.branch}`,
      sha: baseSha,
    });
  } catch {
    // branch may already exist in retries — continue and update
  }

  const { data: baseCommit } = await octokit.rest.git.getCommit({
    owner: input.owner,
    repo: input.repo,
    commit_sha: baseSha,
  });

  const blobs = await Promise.all(
    input.files.map(async (file) => {
      const { data: blob } = await octokit.rest.git.createBlob({
        owner: input.owner,
        repo: input.repo,
        content: Buffer.from(file.content, "utf8").toString("base64"),
        encoding: "base64",
      });
      return { path: file.path, sha: blob.sha, mode: "100644" as const, type: "blob" as const };
    }),
  );

  const { data: tree } = await octokit.rest.git.createTree({
    owner: input.owner,
    repo: input.repo,
    base_tree: baseCommit.tree.sha,
    tree: blobs,
  });

  const { data: commit } = await octokit.rest.git.createCommit({
    owner: input.owner,
    repo: input.repo,
    message: input.commitMessage,
    tree: tree.sha,
    parents: [baseSha],
  });

  await octokit.rest.git.updateRef({
    owner: input.owner,
    repo: input.repo,
    ref: `heads/${input.branch}`,
    sha: commit.sha,
    force: true,
  });

  return { commitSha: commit.sha };
}

export async function openPullRequest(input: {
  installationId: number;
  owner: string;
  repo: string;
  baseBranch: string;
  branch: string;
  prTitle: string;
  prBody: string;
}): Promise<{ prNumber: number; prUrl: string }> {
  const octokit = await getInstallationOctokit(input.installationId);

  try {
    const { data: pr } = await octokit.rest.pulls.create({
      owner: input.owner,
      repo: input.repo,
      title: input.prTitle,
      head: input.branch,
      base: input.baseBranch,
      body: input.prBody,
    });
    return { prNumber: pr.number, prUrl: pr.html_url };
  } catch (error) {
    // Retry with owner:branch form (required in some org setups)
    try {
      const { data: pr } = await octokit.rest.pulls.create({
        owner: input.owner,
        repo: input.repo,
        title: input.prTitle,
        head: `${input.owner}:${input.branch}`,
        base: input.baseBranch,
        body: input.prBody,
      });
      return { prNumber: pr.number, prUrl: pr.html_url };
    } catch (retryError) {
      const message =
        retryError instanceof Error
          ? retryError.message
          : error instanceof Error
            ? error.message
            : "Failed to create pull request";
      if (/Resource not accessible|403|Permission/i.test(message)) {
        throw new Error(
          "GitHub App cannot open pull requests. Grant Pull requests: Read and write on the app, then accept the permission update on the installation.",
        );
      }
      throw new Error(message);
    }
  }
}

/** Compare URL so the user can open a PR manually if the app lacks PR permission. */
export function githubCompareUrl(input: {
  owner: string;
  repo: string;
  baseBranch: string;
  branch: string;
}): string {
  return `https://github.com/${input.owner}/${input.repo}/compare/${encodeURIComponent(input.baseBranch)}...${encodeURIComponent(input.branch)}?quick_pull=1`;
}

/** Prefer a real PR URL; otherwise build a compare link from branch metadata. */
export function resolveGithubReviewUrl(input: {
  prUrl?: string | null;
  owner?: string | null;
  repo?: string | null;
  baseBranch?: string | null;
  branch?: string | null;
}): string | null {
  const prUrl = input.prUrl?.trim() || null;
  if (
    prUrl &&
    !prUrl.startsWith("dry-run://") &&
    /^https?:\/\/github\.com\//i.test(prUrl)
  ) {
    return prUrl;
  }
  if (input.owner && input.repo && input.baseBranch && input.branch) {
    return githubCompareUrl({
      owner: input.owner,
      repo: input.repo,
      baseBranch: input.baseBranch,
      branch: input.branch,
    });
  }
  return null;
}

export async function createBranchCommitAndPr(input: {
  installationId: number;
  owner: string;
  repo: string;
  baseBranch: string;
  branch: string;
  files: RepoFileChange[];
  commitMessage: string;
  prTitle: string;
  prBody: string;
}): Promise<{ commitSha: string; prNumber: number; prUrl: string }> {
  const { commitSha } = await createBranchAndCommit(input);
  const pr = await openPullRequest(input);
  return { commitSha, prNumber: pr.prNumber, prUrl: pr.prUrl };
}

export async function mergePullRequest(input: {
  installationId: number;
  owner: string;
  repo: string;
  prNumber: number;
  commitSha: string;
}): Promise<void> {
  const octokit = await getInstallationOctokit(input.installationId);
  const { data: pr } = await octokit.rest.pulls.get({
    owner: input.owner,
    repo: input.repo,
    pull_number: input.prNumber,
  });
  if (pr.head.sha !== input.commitSha) {
    throw new Error("PR head SHA mismatch");
  }
  if (pr.state !== "open") {
    throw new Error("PR is not open");
  }
  await octokit.rest.pulls.merge({
    owner: input.owner,
    repo: input.repo,
    pull_number: input.prNumber,
    merge_method: "squash",
    sha: input.commitSha,
  });
}

export async function listInstallationRepos(installationId: number) {
  const octokit = await getInstallationOctokit(installationId);
  const repos = await octokit.paginate(
    octokit.rest.apps.listReposAccessibleToInstallation,
    { per_page: 100 },
  );
  return repos.map((r) => ({
    id: r.id,
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    defaultBranch: r.default_branch,
    htmlUrl: r.html_url,
    private: r.private,
  }));
}

export async function getRepoTreePaths(input: {
  installationId: number;
  owner: string;
  repo: string;
  ref: string;
}): Promise<{ sha: string; paths: string[] }> {
  const octokit = await getInstallationOctokit(input.installationId);
  const { data: refData } = await octokit.rest.git.getRef({
    owner: input.owner,
    repo: input.repo,
    ref: `heads/${input.ref}`,
  });
  const sha = refData.object.sha;
  const { data: tree } = await octokit.rest.git.getTree({
    owner: input.owner,
    repo: input.repo,
    tree_sha: sha,
    recursive: "true",
  });
  const paths = (tree.tree ?? [])
    .filter((n) => n.type === "blob" && n.path)
    .map((n) => n.path!)
    .filter(
      (p) =>
        !p.startsWith("node_modules/") &&
        !p.startsWith(".next/") &&
        !p.includes("/.git/") &&
        !p.endsWith(".lock"),
    );
  return { sha, paths };
}

export async function getFileContent(input: {
  installationId: number;
  owner: string;
  repo: string;
  path: string;
  ref: string;
}): Promise<string | null> {
  const octokit = await getInstallationOctokit(input.installationId);
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: input.owner,
      repo: input.repo,
      path: input.path,
      ref: input.ref,
    });
    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) return null;
    return Buffer.from(data.content, "base64").toString("utf8");
  } catch {
    return null;
  }
}
