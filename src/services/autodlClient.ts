import { safeFetchJson, normalizeApiError } from '../utils/safeFetch'
import { maskToken } from '../utils/maskToken'

const DEFAULT_AUTODL_HOST = 'https://www.autodl.art'
const DEFAULT_START_COMMAND = 'bash /root/zealman-app/scripts/improved-autostart.sh'

export type AutodlInstanceStatus = {
  instance_uuid: string
  status: string
  detail?: string
  source?: 'list' | 'status'
}

export type AutodlSnapshot = {
  service_6008_domain?: string
  service_6008_port_protocol?: string
  service_6006_domain?: string
  service_6006_port_protocol?: string
  zealmanUrl?: string
  comfyUrl?: string
  raw: Record<string, unknown>
}

export interface AutodlInstanceItem {
  uuid: string
  name?: string
  status?: string
  start_mode?: string
  gpu_spec_uuid?: string
  application_name?: string
  started_at?: string
  service_6008_domain?: string
}

const STATUS_LABELS: Record<string, string> = {
  running: 'Running',
  stopped: 'Stopped',
  shutdown: 'Stopped',
  starting: 'Starting',
  stopping: 'Stopping',
  rebuilding: 'Rebuilding',
  no_machine: 'No machine',
  unknown: 'Unknown',
}

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status
}

function getHeaders(token: string): Record<string, string> {
  return {
    Authorization: token,
    'Content-Type': 'application/json',
  }
}

function normalizeHost(host: string): string {
  return host.trim().replace(/\/+$/, '') || DEFAULT_AUTODL_HOST
}

function isFileProtocol(): boolean {
  return typeof window !== 'undefined' && window.location?.protocol === 'file:'
}

function buildProxyUrl(host: string, action: string): string {
  const h = normalizeHost(host)
  if (!isFileProtocol() && (h === DEFAULT_AUTODL_HOST || h === 'https://autodl.art')) {
    return `/api/autodl/${action}`
  }
  return `${h}/api/v1/adl_dev/dev/instance/pro/${action}`
}

function validateSettings(settings: { host?: string; token?: string; instanceUuid?: string; startCommand?: string }) {
  const errors: string[] = []
  if (!settings.host?.trim()) errors.push('AutoDL Host cannot be empty')
  if (!settings.token?.trim()) errors.push('Please enter AutoDL Token')
  if (!settings.instanceUuid?.trim()) errors.push('Please enter AutoDL Instance UUID, or select one from the instance list')
  return errors
}

// ── listInstances ──────────────────────────────────────────────────────

export async function listInstances(
  host: string,
  token: string,
  pageIndex = 1,
  pageSize = 100,
  signal?: AbortSignal,
): Promise<AutodlInstanceItem[]> {
  const url = buildProxyUrl(host, 'list')
  console.log('[AutoDL] listInstances', { host: normalizeHost(host), token: maskToken(token) })

  const data = await safeFetchJson<Record<string, unknown>>(url, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ page_index: pageIndex, page_size: pageSize }),
    signal,
  })

  const inner = (data.data ?? data) as Record<string, unknown>
  const list = inner.list as Array<Record<string, unknown>> | undefined

  if (!Array.isArray(list)) return []

  return list.map((item) => ({
    uuid: (item.instance_uuid as string) || (item.uuid as string) || '',
    name: (item.name as string) || undefined,
    status: (item.status as string) || undefined,
    start_mode: (item.start_mode as string) || undefined,
    gpu_spec_uuid: (item.gpu_spec_uuid as string) || undefined,
    application_name: (item.application_name as string) || undefined,
    started_at: (item.started_at as string) || undefined,
    service_6008_domain: (item.service_6008_domain as string) || undefined,
  }))
}

// ── getInstanceStatus (list-first, status-fallback) ────────────────────

export async function getInstanceStatus(
  host: string,
  token: string,
  instanceUuid: string,
  signal?: AbortSignal,
): Promise<AutodlInstanceStatus> {
  console.log('[AutoDL] getInstanceStatus', { host: normalizeHost(host), token: maskToken(token), uuid: instanceUuid })

  // Step 1: Try list-first — find the instance by uuid in the list
  try {
    const list = await listInstances(host, token, 1, 100, signal)
    const found = list.find((item) => item.uuid === instanceUuid)
    if (found && found.status) {
      console.log('[AutoDL] status from list:', found.status)
      return {
        instance_uuid: found.uuid,
        status: found.status,
        detail: getStatusLabel(found.status),
        source: 'list',
      }
    }
  } catch (listErr) {
    console.warn('[AutoDL] list query failed, falling back to /status:', normalizeApiError(listErr))
  }

  // Step 2: Fallback to direct /status endpoint
  try {
    const url = buildProxyUrl(host, 'status')
    const data = await safeFetchJson<Record<string, unknown>>(url, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ instance_uuid: instanceUuid }),
      signal,
    })

    const inner = (data.data ?? data) as Record<string, unknown>
    return {
      instance_uuid: (inner.instance_uuid as string) || instanceUuid,
      status: (inner.status as string) || 'unknown',
      detail: (inner.detail as string) || (inner.msg as string),
      source: 'status',
    }
  } catch (statusErr) {
    // Both list and status failed
    throw statusErr
  }
}

// ── getInstanceSnapshot ────────────────────────────────────────────────

export async function getInstanceSnapshot(
  host: string,
  token: string,
  instanceUuid: string,
  signal?: AbortSignal,
): Promise<AutodlSnapshot> {
  const url = buildProxyUrl(host, 'snapshot')
  console.log('[AutoDL] getInstanceSnapshot', { host: normalizeHost(host), token: maskToken(token), uuid: instanceUuid })

  const data = await safeFetchJson<Record<string, unknown>>(url, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ instance_uuid: instanceUuid }),
    signal,
  })

  const inner = (data.data ?? data) as Record<string, unknown>

  const domain6008 = inner.service_6008_domain as string | undefined
  const protocol6008 = inner.service_6008_port_protocol as string | undefined
  let zealmanUrl = ''
  if (domain6008) {
    if (/^https?:\/\//i.test(domain6008)) {
      zealmanUrl = domain6008
    } else {
      const proto = protocol6008 === 'https' ? 'https' : 'http'
      zealmanUrl = `${proto}://${domain6008}`
    }
  }

  const domain6006 = inner.service_6006_domain as string | undefined
  const protocol6006 = inner.service_6006_port_protocol as string | undefined
  let comfyUrl = ''
  if (domain6006) {
    if (/^https?:\/\//i.test(domain6006)) {
      comfyUrl = domain6006
    } else {
      const proto = protocol6006 === 'https' ? 'https' : 'http'
      comfyUrl = `${proto}://${domain6006}`
    }
  }

  return {
    service_6008_domain: domain6008,
    service_6008_port_protocol: protocol6008,
    service_6006_domain: domain6006,
    service_6006_port_protocol: protocol6006,
    zealmanUrl,
    comfyUrl,
    raw: inner,
  }
}

// ── powerOnInstance ────────────────────────────────────────────────────

export async function powerOnInstance(
  host: string,
  token: string,
  instanceUuid: string,
  startCommand?: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const url = buildProxyUrl(host, 'power_on')
  const cmd = startCommand?.trim() || DEFAULT_START_COMMAND
  console.log('[AutoDL] powerOnInstance', { host: normalizeHost(host), token: maskToken(token), uuid: instanceUuid })

  const data = await safeFetchJson<Record<string, unknown>>(url, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({
      instance_uuid: instanceUuid,
      payload: 'gpu',
      start_command: cmd,
    }),
    signal,
  })

  return data
}

// ── powerOffInstance ───────────────────────────────────────────────────

export async function powerOffInstance(
  host: string,
  token: string,
  instanceUuid: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const url = buildProxyUrl(host, 'power_off')
  console.log('[AutoDL] powerOffInstance', { host: normalizeHost(host), token: maskToken(token), uuid: instanceUuid })

  const data = await safeFetchJson<Record<string, unknown>>(url, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ instance_uuid: instanceUuid }),
    signal,
  })

  return data
}

// ── extractZealmanBaseUrlFromSnapshot ──────────────────────────────────

export function extractZealmanBaseUrlFromSnapshot(snapshot: AutodlSnapshot): string {
  return snapshot.zealmanUrl || ''
}

export function extractComfyBaseUrlFromSnapshot(snapshot: AutodlSnapshot): string {
  return snapshot.comfyUrl || ''
}

// ── Poll status until running (uses list-first) ────────────────────────

export async function pollUntilRunning(
  host: string,
  token: string,
  instanceUuid: string,
  options?: { intervalMs?: number; timeoutMs?: number },
  signal?: AbortSignal,
): Promise<AutodlInstanceStatus> {
  const intervalMs = options?.intervalMs ?? 5000
  const timeoutMs = options?.timeoutMs ?? 300000
  const start = Date.now()

  while (true) {
    const elapsed = Date.now() - start
    if (elapsed >= timeoutMs) {
      throw new Error('AutoDL instance startup timed out. Please try again later.')
    }

    const status = await getInstanceStatus(host, token, instanceUuid, signal)
    if (status.status === 'running') return status

    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs))
  }
}

export { normalizeApiError, validateSettings, DEFAULT_START_COMMAND }
