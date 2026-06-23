import { db } from './db'

export async function storeAsset(projectId: string, blob: Blob, mimeType: string): Promise<string> {
  const id = 'asset_' + Date.now().toString(36)
  await db.assets.put({ id, projectId, blob, mimeType, createdAt: Date.now() })
  return id
}

export async function getAsset(id: string): Promise<Blob | undefined> {
  const row = await db.assets.get(id)
  return row?.blob
}

export async function deleteAsset(id: string): Promise<void> {
  await db.assets.delete(id)
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
