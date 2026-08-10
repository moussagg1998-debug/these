// Admin monitoring — GitHub Actions check.
//
// Requires a PAT with `actions:read` (or classic `repo`) scope — this repo
// has no GitHub credentials configured today, so this check reports
// `unverified` out of the box until GITHUB_TOKEN + GITHUB_REPO are set.
// Latest workflow run's status/conclusion covers "échecs des GitHub
// Actions", "échecs des tests CI/CD" (this repo's only workflow IS the CI
// suite — see .github/workflows/ci.yml), and "état du dernier workflow".
import 'server-only';
import { fetchWithTimeout, errorMessage, sanitizeCheckError } from '../sanitize';
import type { CheckResult } from '../types';

interface WorkflowRun {
  name?: string;
  status?: string; // queued | in_progress | completed
  conclusion?: string | null; // success | failure | cancelled | ... (null while not completed)
  head_sha?: string;
  html_url?: string;
  updated_at?: string;
}

interface WorkflowRunsResponse {
  workflow_runs?: WorkflowRun[];
}

export async function checkGithub(): Promise<CheckResult> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // "owner/repo"
  if (!token || !repo) {
    return {
      ok: false,
      unverified: true,
      latencyMs: 0,
      error: 'GITHUB_TOKEN / GITHUB_REPO not configured',
    };
  }

  const t0 = Date.now();
  try {
    const res = await fetchWithTimeout(
      `https://api.github.com/repos/${repo}/actions/runs?per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      return { ok: false, latencyMs, error: `GitHub API returned HTTP ${res.status}` };
    }

    const data = (await res.json()) as WorkflowRunsResponse;
    const run = data.workflow_runs?.[0];
    if (!run) {
      return { ok: true, latencyMs, detail: { message: 'No workflow runs found' } };
    }

    const ok =
      run.conclusion === 'success' || run.status === 'in_progress' || run.status === 'queued';

    const detail = {
      workflowName: run.name ?? null,
      status: run.status ?? null,
      conclusion: run.conclusion ?? null,
      headSha: run.head_sha?.slice(0, 7) ?? null,
      htmlUrl: run.html_url ?? null,
      updatedAt: run.updated_at ?? null,
    };

    return {
      ok,
      latencyMs,
      ...(ok
        ? {}
        : {
            error: `Latest workflow run "${run.name ?? 'unknown'}" ${run.conclusion ?? run.status}`,
          }),
      detail,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      error: sanitizeCheckError(errorMessage(err)),
    };
  }
}
