// Browser-native SHA-256 via Web Crypto API — zero external dependencies.
// Usage: const hash = await computeSHA256(pngBlob);
export async function computeSHA256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
