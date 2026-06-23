export interface SafeFetchError {
  message: string
  status: number
  statusText: string
  contentType: string | null
  textPreview: string
}

export async function safeFetchJson<T = Record<string, unknown>>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, options)
  } catch (err) {
    const msg = err instanceof TypeError ? '接口请求失败，请检查接口地址或网络状态' : String(err)
    throw { message: msg, status: 0, statusText: '', contentType: null, textPreview: '' } satisfies SafeFetchError
  }

  const text = await response.text()
  const contentType = response.headers.get('content-type')

  let json: T | null = null
  try {
    json = JSON.parse(text) as T
  } catch {
    const err: SafeFetchError = {
      message: 'AutoDL 接口返回非 JSON，请检查接口地址、Token 或实例 UUID',
      status: response.status,
      statusText: response.statusText,
      contentType,
      textPreview: text.slice(0, 500),
    }
    throw err
  }

  if (!response.ok) {
    const data = json as Record<string, unknown>
    const err: SafeFetchError & { data?: unknown } = {
      message: (data?.error as string) || (data?.message as string) || `请求失败：HTTP ${response.status}`,
      status: response.status,
      statusText: response.statusText,
      contentType,
      textPreview: '',
      data: json,
    }
    throw err
  }

  return json
}

export function normalizeApiError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return (err as SafeFetchError).message
  }
  if (err instanceof Error) return err.message
  return String(err)
}

export function getErrorDetail(err: unknown): Record<string, unknown> | null {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    return {
      message: e.message || '',
      status: e.status || '',
      statusText: e.statusText || '',
      contentType: e.contentType || '',
      textPreview: e.textPreview || '',
    }
  }
  return null
}
