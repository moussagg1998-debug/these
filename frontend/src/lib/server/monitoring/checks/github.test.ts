import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkGithub } from './github';

beforeEach(() => {
  vi.stubEnv('GITHUB_TOKEN', 'ghp_test');
  vi.stubEnv('GITHUB_REPO', 'acme/thesefacile');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('checkGithub', () => {
  it('reports unverified when GITHUB_TOKEN/GITHUB_REPO are not configured', async () => {
    vi.unstubAllEnvs();
    const result = await checkGithub();
    expect(result.unverified).toBe(true);
    expect(result.ok).toBe(false);
  });

  it('ok=true when the latest workflow run concluded "success"', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          workflow_runs: [
            { name: 'CI', status: 'completed', conclusion: 'success', head_sha: 'abcdef1234567' },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await checkGithub();
    expect(result.ok).toBe(true);
    expect(result.detail).toMatchObject({ conclusion: 'success' });
  });

  it('ok=false when the latest workflow run failed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          workflow_runs: [{ name: 'CI', status: 'completed', conclusion: 'failure' }],
        }),
        { status: 200 },
      ),
    );
    const result = await checkGithub();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('failure');
  });

  it('ok=true when a run is still in progress (not yet a failure)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          workflow_runs: [{ name: 'CI', status: 'in_progress', conclusion: null }],
        }),
        { status: 200 },
      ),
    );
    const result = await checkGithub();
    expect(result.ok).toBe(true);
  });

  it('ok=false when the GitHub API rejects the token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Bad credentials', { status: 401 }),
    );
    const result = await checkGithub();
    expect(result.ok).toBe(false);
  });
});
