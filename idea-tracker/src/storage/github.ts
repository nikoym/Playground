import { normalizeDataFile } from "../domain/merge";
import type { DataFile } from "../domain/types";
import type { GitHubConfig } from "./localCache";

export type GitHubErrorKind = "auth" | "not-found" | "conflict" | "network" | "other";

export class GitHubError extends Error {
  constructor(public kind: GitHubErrorKind, message: string, public status?: number) {
    super(message);
    this.name = "GitHubError";
  }
}

export function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function decodeBase64Utf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function url(c: GitHubConfig, withRef: boolean): string {
  const path = c.path.split("/").map(encodeURIComponent).join("/");
  const base = `https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${path}`;
  return withRef ? `${base}?ref=${encodeURIComponent(c.branch)}` : base;
}

function headers(c: GitHubConfig): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${c.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function request(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, { ...init, cache: "no-store" });
  } catch {
    throw new GitHubError("network", "Can't reach GitHub — you may be offline.");
  }
}

async function toError(res: Response): Promise<GitHubError> {
  let msg = res.statusText;
  try {
    const body = (await res.json()) as { message?: string };
    if (body.message) msg = body.message;
  } catch {
    /* ignore */
  }
  if (res.status === 401) return new GitHubError("auth", "Token rejected (expired or wrong).", 401);
  if (res.status === 403) return new GitHubError("auth", `Access denied: ${msg}`, 403);
  if (res.status === 404) return new GitHubError("not-found", "Repo or branch not found (or the token can't see it).", 404);
  if (res.status === 409 || res.status === 422) return new GitHubError("conflict", msg, res.status);
  return new GitHubError("other", `GitHub error ${res.status}: ${msg}`, res.status);
}

/** Returns null when the file doesn't exist yet. */
export async function getFile(c: GitHubConfig): Promise<{ data: DataFile; sha: string } | null> {
  const res = await request(url(c, true), { headers: headers(c) });
  if (res.status === 404) {
    // Distinguish "file missing" from "repo missing / no access".
    const repoRes = await request(
      `https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`,
      { headers: headers(c) },
    );
    if (repoRes.ok) return null;
    throw await toError(repoRes);
  }
  if (!res.ok) throw await toError(res);
  const body = (await res.json()) as { content?: string; sha: string; encoding?: string };
  if (body.encoding !== "base64" || body.content === undefined)
    throw new GitHubError("other", "Data file is too large for the contents API (>1 MB).");
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeBase64Utf8(body.content));
  } catch {
    throw new GitHubError("other", `${c.path} in the repo isn't valid JSON.`);
  }
  return { data: normalizeDataFile(parsed), sha: body.sha };
}

/** Writes the file; pass sha when updating. Returns the new sha. */
export async function putFile(c: GitHubConfig, data: DataFile, sha: string | null, message: string): Promise<string> {
  const res = await request(url(c, false), {
    method: "PUT",
    headers: { ...headers(c), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: encodeBase64Utf8(JSON.stringify(data, null, 2) + "\n"),
      branch: c.branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) throw await toError(res);
  const body = (await res.json()) as { content: { sha: string } };
  return body.content.sha;
}
