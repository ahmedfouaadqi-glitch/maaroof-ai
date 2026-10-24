/**
 * IndexNow — free protocol to ping Bing, Yandex, Seznam, Naver to refresh a URL.
 * https://www.indexnow.org/documentation
 * Uses a self-hosted key file. The key is the host (not secret), so we derive it deterministically per project.
 */

function deriveKey(host: string): string {
  // 32+ hex chars, deterministic per host. Public on purpose.
  // Format: 32 hex chars. Constructed from a stable hash of the host.
  let h = 5381;
  for (let i = 0; i < host.length; i++) h = ((h << 5) + h + host.charCodeAt(i)) | 0;
  const seed = Math.abs(h).toString(16).padStart(8, "0");
  // pad to 32 hex chars by repeating
  return (seed + seed + seed + seed).slice(0, 32);
}

export function getIndexNowKey(host: string): string {
  return deriveKey(host);
}

export async function pingIndexNow(urls: string[], host: string): Promise<{ ok: boolean; status: number; key: string }> {
  const key = deriveKey(host);
  try {
    const res = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `https://${host}/${key}.txt`,
        urlList: urls,
      }),
    });
    return { ok: res.ok, status: res.status, key };
  } catch {
    return { ok: false, status: 0, key };
  }
}
