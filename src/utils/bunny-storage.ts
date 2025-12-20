type BunnyStorageConfig = {
  zone: string;
  hostname: string;
  accessKey: string;
  publicBaseUrl?: string;
};

function getConfigFromEnv(): BunnyStorageConfig {
  const zone = process.env.BUNNY_STORAGE_ZONE;
  const hostname = process.env.BUNNY_STORAGE_HOSTNAME;
  const accessKey = process.env.BUNNY_STORAGE_ACCESS_KEY;

  if (!zone) throw new Error('Missing BUNNY_STORAGE_ZONE');
  if (!hostname) throw new Error('Missing BUNNY_STORAGE_HOSTNAME');
  if (!accessKey) throw new Error('Missing BUNNY_STORAGE_ACCESS_KEY');

  const publicBaseUrl = process.env.BUNNY_PUBLIC_BASE_URL;

  return { zone, hostname, accessKey, publicBaseUrl };
}

function joinUrl(base: string, path: string) {
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return `${normalizedBase}/${normalizedPath}`;
}

export function getBunnyStorageUploadUrl(
  path: string,
  cfg?: BunnyStorageConfig,
) {
  const config = cfg ?? getConfigFromEnv();
  const base = `https://${config.hostname}/${config.zone}`;
  return joinUrl(base, path);
}

export function getBunnyPublicUrl(path: string, cfg?: BunnyStorageConfig) {
  const config = cfg ?? getConfigFromEnv();
  if (!config.publicBaseUrl) return null;
  return joinUrl(config.publicBaseUrl, path);
}

export async function uploadBufferToBunny(params: {
  path: string;
  contentType: string;
  data: Uint8Array;
  cfg?: BunnyStorageConfig;
}): Promise<{ path: string; storageUrl: string; publicUrl: string | null }> {
  const config = params.cfg ?? getConfigFromEnv();

  const storageUrl = getBunnyStorageUploadUrl(params.path, config);

  let res: Response;
  try {
    res = await fetch(storageUrl, {
      method: 'PUT',
      headers: {
        AccessKey: config.accessKey,
        'Content-Type': params.contentType,
      },
      body: Buffer.from(params.data),
    });
  } catch (err: unknown) {
    const details = {
      storageUrl,
      hostname: config.hostname,
      zone: config.zone,
      path: params.path,
    };
    throw new Error(
      `Bunny upload fetch failed: ${err instanceof Error ? err.message : String(err)} | ${JSON.stringify(details)}`,
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Bunny upload failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`,
    );
  }

  return {
    path: params.path,
    storageUrl,
    publicUrl: getBunnyPublicUrl(params.path, config),
  };
}

export async function uploadJsonToBunny(params: {
  path: string;
  json: unknown;
  cfg?: BunnyStorageConfig;
}): Promise<{ path: string; storageUrl: string; publicUrl: string | null }> {
  const data = new TextEncoder().encode(JSON.stringify(params.json));
  return uploadBufferToBunny({
    path: params.path,
    contentType: 'application/json; charset=utf-8',
    data,
    cfg: params.cfg,
  });
}

export async function deleteFromBunny(params: {
  path: string;
  cfg?: BunnyStorageConfig;
}): Promise<void> {
  const config = params.cfg ?? getConfigFromEnv();
  const storageUrl = getBunnyStorageUploadUrl(params.path, config);

  let res: Response;
  try {
    res = await fetch(storageUrl, {
      method: 'DELETE',
      headers: {
        AccessKey: config.accessKey,
      },
    });
  } catch (err: unknown) {
    const details = {
      storageUrl,
      hostname: config.hostname,
      zone: config.zone,
      path: params.path,
    };
    throw new Error(
      `Bunny delete fetch failed: ${err instanceof Error ? err.message : String(err)} | ${JSON.stringify(details)}`,
    );
  }

  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Bunny delete failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`,
    );
  }
}
