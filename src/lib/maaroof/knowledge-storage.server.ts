import type { KnowledgeStorageSettings } from "./settings.server";

export type KnowledgeStorageProvider = "supabase" | "google_drive";

export type KnowledgeStorageStatus = {
  provider: KnowledgeStorageProvider;
  available: boolean;
  connected: boolean;
  requiresUserOAuth: boolean;
  reason: string;
};

export type DriveWorkspaceLayout = {
  rootName: string;
  userFolderName: string;
  workspaceFolderName: string;
  branches: string[];
};

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

function safeName(value: string, fallback: string): string {
  const cleaned = String(value || "")
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || fallback;
}

export function buildDriveWorkspaceLayout(input: {
  brandName?: string | null;
  specialty?: string | null;
  userId: string;
  workspaceId?: string | null;
}): DriveWorkspaceLayout {
  const brand = safeName(input.brandName || "Maaroof workspace", "Maaroof workspace");
  const specialty = safeName(input.specialty || "General", "General");
  const owner = safeName(input.userId, "user");
  const workspace = safeName(input.workspaceId || "default", "default");
  return {
    rootName: "MAAROOF Knowledge",
    userFolderName: `${owner} — ${brand}`,
    workspaceFolderName: `${workspace} — ${specialty}`,
    branches: ["promotion", "knowledge", "visibility", "optimization", "research", "evidence"],
  };
}

export function resolveKnowledgeStorageStatus(
  settings: KnowledgeStorageSettings,
  accessToken?: string | null,
): KnowledgeStorageStatus {
  if (settings.provider === "supabase") {
    return {
      provider: "supabase",
      available: true,
      connected: true,
      requiresUserOAuth: false,
      reason: "Supabase remains the active first-party knowledge source.",
    };
  }

  const enabled = settings.google_drive_enabled === true;
  const connected = enabled && Boolean(accessToken);
  return {
    provider: "google_drive",
    available: connected,
    connected,
    requiresUserOAuth: !connected,
    reason: connected
      ? "Google Drive OAuth token is present for this request."
      : enabled
        ? "Google Drive is opt-in and requires a user OAuth connection."
        : "Google Drive adapter is disabled by settings.",
  };
}

function driveHeaders(accessToken: string, json = false): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

function quoteQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function driveJson<T>(accessToken: string, url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...driveHeaders(accessToken, Boolean(init.body)), ...(init.headers || {}) },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`google_drive_${response.status}`);
  return body ? (JSON.parse(body) as T) : ({} as T);
}

export type GoogleDriveAdapter = {
  listFiles(input: { parentId?: string; name?: string; pageSize?: number }): Promise<Array<{ id: string; name: string; mimeType: string }>>;
  ensureFolder(name: string, parentId?: string): Promise<string>;
  readText(fileId: string): Promise<string>;
  writeText(input: { name: string; text: string; parentId: string; fileId?: string }): Promise<string>;
};

/**
 * Real Drive v3 adapter. The OAuth token is request-scoped and never persisted
 * here. Callers must obtain it through an explicit user consent flow.
 */
export function createGoogleDriveAdapter(accessToken: string): GoogleDriveAdapter {
  if (!accessToken) throw new Error("google_drive_oauth_required");

  async function listFiles(input: { parentId?: string; name?: string; pageSize?: number }) {
    const clauses = ["trashed = false"];
    if (input.parentId) clauses.push(`'${quoteQuery(input.parentId)}' in parents`);
    if (input.name) clauses.push(`name = '${quoteQuery(input.name)}'`);
    const params = new URLSearchParams({
      q: clauses.join(" and "),
      fields: "files(id,name,mimeType)",
      pageSize: String(Math.min(Math.max(input.pageSize || 100, 1), 1000)),
      orderBy: "name",
    });
    const result = await driveJson<{ files?: Array<{ id: string; name: string; mimeType: string }> }>(
      accessToken,
      `${DRIVE_API}/files?${params.toString()}`,
    );
    return result.files || [];
  }

  async function ensureFolder(name: string, parentId?: string): Promise<string> {
    const existing = await listFiles({ parentId, name, pageSize: 10 });
    const folder = existing.find((file) => file.mimeType === "application/vnd.google-apps.folder");
    if (folder) return folder.id;
    const result = await driveJson<{ id: string }>(accessToken, `${DRIVE_API}/files`, {
      method: "POST",
      headers: driveHeaders(accessToken, true),
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        ...(parentId ? { parents: [parentId] } : {}),
      }),
    });
    return result.id;
  }

  async function readText(fileId: string): Promise<string> {
    const response = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: driveHeaders(accessToken),
    });
    if (!response.ok) throw new Error(`google_drive_${response.status}`);
    return response.text();
  }

  async function writeText(input: { name: string; text: string; parentId: string; fileId?: string }): Promise<string> {
    const metadata = { name: input.name, mimeType: "text/plain", parents: [input.parentId] };
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", new Blob([input.text], { type: "text/plain" }));
    const endpoint = input.fileId
      ? `${DRIVE_UPLOAD_API}/${encodeURIComponent(input.fileId)}?uploadType=multipart`
      : `${DRIVE_UPLOAD_API}?uploadType=multipart`;
    const response = await fetch(endpoint, {
      method: input.fileId ? "PATCH" : "POST",
      headers: driveHeaders(accessToken),
      body: form,
    });
    if (!response.ok) throw new Error(`google_drive_${response.status}`);
    const result = (await response.json()) as { id: string };
    return result.id;
  }

  return { listFiles, ensureFolder, readText, writeText };
}
