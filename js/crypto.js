// crypto.js —— 加密公开版的解锁与配图解密
// 密码只在浏览器内存中用于派生密钥；服务器与页面源码都不包含密码。

let key = null;
let assets = {};
let metaPromise = null;

const urlCache = new Map();
const pendingCache = new Map();
const MAX_CACHED_URLS = 32;
const decoder = new TextDecoder();

function b64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function loadMeta() {
  if (!metaPromise) {
    metaPromise = fetch('./pages-data/bundle.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('加密数据缺失');
        return response.json();
      })
      .catch((error) => {
        metaPromise = null;
        throw error;
      });
  }
  return metaPromise;
}

function clearCache() {
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
  pendingCache.clear();
}

function rememberUrl(path, url) {
  urlCache.set(path, url);
  while (urlCache.size > MAX_CACHED_URLS) {
    const oldestPath = urlCache.keys().next().value;
    URL.revokeObjectURL(urlCache.get(oldestPath));
    urlCache.delete(oldestPath);
  }
}

export async function unlock(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('密码为空');
  }

  const meta = await loadMeta();
  if (meta.version !== 1 || !meta.salt || !meta.iv || !meta.file) {
    throw new Error('加密数据格式不正确');
  }

  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const nextKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: b64ToBytes(meta.salt),
      iterations: meta.iterations,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const response = await fetch('./' + meta.file, { cache: 'no-store' });
  if (!response.ok) throw new Error('加密数据缺失');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(meta.iv) },
    nextKey,
    await response.arrayBuffer()
  );

  const data = JSON.parse(decoder.decode(plain));
  key = nextKey;
  assets = data.assets || {};
  clearCache();
  return data;
}

export async function resolveAsset(path) {
  if (!key || !assets[path]) return null;

  const cached = urlCache.get(path);
  if (cached) return cached;

  let pending = pendingCache.get(path);
  if (!pending) {
    pending = (async () => {
      const entry = assets[path];
      const response = await fetch('./' + entry.file, { cache: 'force-cache' });
      if (!response.ok) throw new Error('配图缺失');
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64ToBytes(entry.iv) },
        key,
        await response.arrayBuffer()
      );
      return URL.createObjectURL(
        new Blob([plain], { type: entry.type || 'application/octet-stream' })
      );
    })();
    pendingCache.set(path, pending);
  }

  try {
    const url = await pending;
    pendingCache.delete(path);
    rememberUrl(path, url);
    return url;
  } catch (error) {
    pendingCache.delete(path);
    console.warn('配图解密失败：' + path, error);
    return null;
  }
}
