import React, { useCallback, useEffect, useState, useRef } from 'react'
import { Eye, EyeOff, RefreshCw, Zap, X, Server, Power, PowerOff, Search, List, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, XCircle, Loader, Activity } from 'lucide-react'
import {
  useApiSettingsStore,
  isValidBaseUrl,
  DEFAULT_API_BASE_URL,
  fetchAvailableModels,
} from '../../store/apiSettingsStore'
import { useRemoteServiceStore } from '../../store/remoteServiceStore'
import { useI18n } from '../../i18n/useI18n'
import {
  getInstanceStatus,
  getInstanceSnapshot,
  powerOnInstance,
  powerOffInstance,
  listInstances,
  pollUntilRunning,
  normalizeApiError,
  type AutodlInstanceItem,
} from '../../services/autodlClient'
import { checkPanelHealth } from '../../services/zealmanClient'
import { maskToken } from '../../utils/maskToken'
import { getErrorDetail } from '../../utils/safeFetch'

type SettingsTab = 'api' | 'remote'

export function ApiSettingsModal() {
  const isOpen = useApiSettingsStore((s) => s.isSettingsOpen)
  const closeSettings = useApiSettingsStore((s) => s.closeSettings)
  const savedApiKey = useApiSettingsStore((s) => s.apiKey)
  const savedBaseUrl = useApiSettingsStore((s) => s.baseUrl)
  const saveSettings = useApiSettingsStore((s) => s.saveSettings)
  const resetBaseUrl = useApiSettingsStore((s) => s.resetBaseUrl)
  const { t } = useI18n()

  const [tab, setTab] = useState<SettingsTab>('api')

  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setApiKey(savedApiKey)
      setBaseUrl(savedBaseUrl)
      setError('')
      setTestResult('idle')
      setTab('api')
    }
  }, [isOpen, savedApiKey, savedBaseUrl])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSettings() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, closeSettings])

  const handleSave = useCallback(() => {
    const trimmed = baseUrl.trim()
    if (!isValidBaseUrl(trimmed)) {
      setError(t('apiSettings.error.invalidUrl'))
      return
    }
    saveSettings(apiKey, trimmed)
    setError('')
    closeSettings()
  }, [apiKey, baseUrl, saveSettings, closeSettings, t])

  const handleCancel = useCallback(() => { closeSettings() }, [closeSettings])
  const handleResetDefault = useCallback(() => { setBaseUrl(DEFAULT_API_BASE_URL); setError('') }, [])

  const handleTestConnection = useCallback(async () => {
    if (testing) return
    const trimmed = baseUrl.trim()
    if (!isValidBaseUrl(trimmed)) {
      setTestResult('error')
      return
    }
    setTesting(true)
    setTestResult('testing')
    try {
      // Force-refresh /v1/models and overwrite the cache (writes the current
      // model registry version + timestamp). Never reuse a stale cache here.
      await fetchAvailableModels({ forceRefresh: true, baseUrl: trimmed, apiKey: apiKey.trim() })
      setTestResult('success')
    } catch {
      setTestResult('error')
    } finally {
      setTesting(false)
    }
  }, [baseUrl, apiKey, testing])

  if (!isOpen) return null

  return (
    <>
      <div className="api-settings-backdrop" onClick={handleCancel} />
      <div className="api-settings-modal" style={{ width: 560 }}>
        <div className="api-settings-header">
          <span className="api-settings-title">{t('apiSettings.title')}</span>
          <button className="api-settings-close-btn" onClick={handleCancel}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', padding: '0 16px' }}>
          <TabBtn active={tab === 'api'} onClick={() => setTab('api')}><Zap size={12} /> {t('apiSettings.tabApi')}</TabBtn>
          <TabBtn active={tab === 'remote'} onClick={() => setTab('remote')}><Server size={12} /> {t('apiSettings.tabRemote')}</TabBtn>
        </div>

        <div className="api-settings-body" style={{ maxHeight: 600, overflowY: 'auto' }}>
          {tab === 'api' ? (
            <ApiTab
              apiKey={apiKey} setApiKey={setApiKey}
              baseUrl={baseUrl} setBaseUrl={(v) => { setBaseUrl(v); setError('') }}
              showKey={showKey} setShowKey={setShowKey}
              error={error} testResult={testResult}
              testing={testing}
              onTest={handleTestConnection}
              onResetDefault={handleResetDefault}
              t={t}
            />
          ) : (
            <RemoteServiceTab />
          )}
        </div>

        <div className="api-settings-footer">
          <button className="cf-btn" onClick={handleCancel}>{t('common.close')}</button>
          {tab === 'api' && (
            <button className="cf-btn cf-btn-primary" onClick={handleSave}>{t('apiSettings.save')}</button>
          )}
        </div>
      </div>
    </>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px', fontSize: 12, cursor: 'pointer',
        background: 'transparent', border: 'none', borderBottom: active ? '2px solid var(--accent-blue)' : '2px solid transparent',
        color: active ? 'var(--accent-blue)' : 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: 6, fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </button>
  )
}

function ApiTab({ apiKey, setApiKey, baseUrl, setBaseUrl, showKey, setShowKey, error, testResult, testing, onTest, onResetDefault, t }: {
  apiKey: string; setApiKey: (v: string) => void
  baseUrl: string; setBaseUrl: (v: string) => void
  showKey: boolean; setShowKey: React.Dispatch<React.SetStateAction<boolean>>
  error: string; testResult: 'idle' | 'testing' | 'success' | 'error'
  testing: boolean
  onTest: () => void; onResetDefault: () => void
  t: (k: string) => string
}) {
  const resultText = testResult === 'testing'
    ? t('apiSettings.testing')
    : testResult === 'success'
      ? t('apiSettings.testSuccess')
      : testResult === 'error'
        ? t('apiSettings.testFailed')
        : ''

  return (
    <>
      <div className="api-settings-field">
        <label className="api-settings-label">{t('apiSettings.apiKeyLabel')}</label>
        <div className="api-settings-input-wrap">
          <input type={showKey ? 'text' : 'password'} className="api-settings-input" value={apiKey}
            onChange={(e) => setApiKey(e.target.value)} placeholder={t('apiSettings.apiKeyPlaceholder')} autoComplete="off" />
          <button type="button" className="api-settings-eye-btn" onClick={() => setShowKey((v) => !v)} tabIndex={-1}>
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
          {t('apiSettings.apiKeySecurityWarning')}
        </div>
      </div>
      <div className="api-settings-field">
        <label className="api-settings-label">{t('apiSettings.baseUrlLabel')}</label>
        <input type="text" className="api-settings-input" value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)} placeholder={DEFAULT_API_BASE_URL} autoComplete="off" />
        {error && <div className="api-settings-error">{error}</div>}
      </div>
      <div className="api-settings-test-slot" aria-live="polite">
        <div className={`api-settings-test-result ${testResult}`}>
          {testResult === 'testing' && <Loader size={12} className="api-settings-spin" />}
          {testResult === 'success' && <CheckCircle size={12} />}
          {testResult === 'error' && <XCircle size={12} />}
          <span>{resultText}</span>
        </div>
      </div>
      <div className="api-settings-actions">
        <button className="cf-btn" onClick={onResetDefault}><RefreshCw size={12} /> {t('apiSettings.resetDefault')}</button>
        <button className="cf-btn api-settings-test-btn" onClick={onTest} disabled={testing} aria-busy={testing}>
          {testing ? <Loader size={12} className="api-settings-spin" /> : <Zap size={12} />}
          <span>{testing ? t('apiSettings.testing') : t('apiSettings.testConnection')}</span>
        </button>
      </div>
    </>
  )
}

// ── Error detail type ──────────────────────────────────────────────────

interface ErrorDetail {
  message: string
  status?: string | number
  statusText?: string
  contentType?: string
  textPreview?: string
}

type Translate = (key: string) => string

function formatMessage(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(values[key] ?? ''))
}

const AUTODL_STATUS_LABEL_KEYS: Record<string, string> = {
  running: 'autodl.status.running',
  stopped: 'autodl.status.stopped',
  shutdown: 'autodl.status.stopped',
  starting: 'autodl.status.starting',
  stopping: 'autodl.status.stopping',
  rebuilding: 'autodl.status.rebuilding',
  no_machine: 'autodl.status.noMachine',
  unknown: 'autodl.status.unknown',
}

function getLocalizedStatusLabel(status: string | undefined, t: Translate) {
  const value = status || 'unknown'
  const key = AUTODL_STATUS_LABEL_KEYS[value]
  return key ? t(key) : value
}

// ── Remote Service Tab ─────────────────────────────────────────────────

function RemoteServiceTab() {
  const { t } = useI18n()
  const zealmanBaseUrl = useRemoteServiceStore((s) => s.zealmanBaseUrl)
  const setZealmanBaseUrl = useRemoteServiceStore((s) => s.setZealmanBaseUrl)
  const autodlHost = useRemoteServiceStore((s) => s.autodlHost)
  const autodlToken = useRemoteServiceStore((s) => s.autodlToken)
  const autodlUuid = useRemoteServiceStore((s) => s.autodlInstanceUuid)
  const autodlStartCmd = useRemoteServiceStore((s) => s.autodlStartCommand)
  const saveAutodl = useRemoteServiceStore((s) => s.saveAutodlSettings)

  const [host, setHost] = useState(autodlHost)
  const [token, setToken] = useState(autodlToken)
  const [uuid, setUuid] = useState(autodlUuid)
  const [startCmd, setStartCmd] = useState(autodlStartCmd)
  const [zealmanUrl, setZealmanUrl] = useState(zealmanBaseUrl)
  const [showToken, setShowToken] = useState(false)

  // Independent loading states per action
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingPowerOn, setLoadingPowerOn] = useState(false)
  const [loadingPowerOff, setLoadingPowerOff] = useState(false)
  const [loadingSnapshot, setLoadingSnapshot] = useState(false)
  const [loadingTestPanel, setLoadingTestPanel] = useState(false)
  const [polling, setPolling] = useState(false)

  // Status and error display
  const [instanceStatus, setInstanceStatus] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [statusType, setStatusType] = useState<'success' | 'error' | 'warning' | ''>('')
  const [errorDetail, setErrorDetail] = useState<ErrorDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Instance list
  const [instances, setInstances] = useState<AutodlInstanceItem[]>([])
  const [showInstanceList, setShowInstanceList] = useState(false)

  // Snapshot URL
  const [snapshotUrl, setSnapshotUrl] = useState('')
  const [panelTestResult, setPanelTestResult] = useState<'idle' | 'ok' | 'fail'>('idle')

  const pollAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => { pollAbortRef.current?.abort() }
  }, [])

  const showError = useCallback((msg: string, err?: unknown) => {
    setStatusMsg(msg)
    setStatusType('error')
    const detail = getErrorDetail(err)
    setErrorDetail(detail ? {
      message: detail.message as string || '',
      status: detail.status as string || '',
      statusText: detail.statusText as string || '',
      contentType: detail.contentType as string || '',
      textPreview: detail.textPreview as string || '',
    } : null)
    setDetailOpen(false)
  }, [])

  const showSuccess = useCallback((msg: string) => {
    setStatusMsg(msg)
    setStatusType('success')
    setErrorDetail(null)
    setDetailOpen(false)
  }, [])

  const showWarning = useCallback((msg: string) => {
    setStatusMsg(msg)
    setStatusType('warning')
    setErrorDetail(null)
    setDetailOpen(false)
  }, [])

  const clearStatus = useCallback(() => {
    setStatusMsg('')
    setStatusType('')
    setErrorDetail(null)
    setDetailOpen(false)
  }, [])

  const handleSave = useCallback(() => {
    const normalizedZealman = zealmanUrl.trim().replace(/\/+$/, '')
    if (normalizedZealman && !/^https?:\/\//i.test(normalizedZealman)) {
      showError(t('autodl.error.invalidZealmanUrl'))
      return
    }
    saveAutodl({ host: host.trim(), token: token.trim(), instanceUuid: uuid.trim(), startCommand: startCmd.trim() })
    setZealmanBaseUrl(normalizedZealman)
    showSuccess(t('autodl.saved'))
  }, [host, token, uuid, startCmd, zealmanUrl, saveAutodl, setZealmanBaseUrl, showSuccess, showError, t])

  // ── Query Status (list-first) ─────────────────────────────────────────
  const handleStatus = useCallback(async () => {
    if (!token.trim()) { showError(t('autodl.error.tokenRequired')); return }
    if (!uuid.trim()) { showError(t('autodl.error.uuidRequired')); return }
    setLoadingStatus(true)
    clearStatus()
    try {
      const res = await getInstanceStatus(host.trim(), token.trim(), uuid.trim())
      const label = getLocalizedStatusLabel(res.status, t)
      setInstanceStatus(res.status)
      showSuccess(`${t('autodl.instanceStatus')}: ${label}`)
    } catch (err) {
      setInstanceStatus('')
      showError(normalizeApiError(err), err)
    } finally {
      setLoadingStatus(false)
    }
  }, [host, token, uuid, showError, clearStatus, t])

  // ── List Instances (also refreshes current instance status) ────────────
  const handleListInstances = useCallback(async () => {
    if (!token.trim()) { showError(t('autodl.error.tokenRequired')); return }
    setLoadingList(true)
    clearStatus()
    try {
      const list = await listInstances(host.trim(), token.trim())
      setInstances(list)

      // If we have a current uuid, refresh its status from the list
      const currentUuid = uuid.trim()
      if (currentUuid) {
        const current = list.find((item) => item.uuid === currentUuid)
        if (current && current.status) {
          setInstanceStatus(current.status)
          const label = getLocalizedStatusLabel(current.status, t)
          showSuccess(`${t('autodl.instanceStatus')}: ${label}`)
        } else if (list.length > 0) {
          showWarning(t('autodl.error.instanceNotFound'))
        } else {
          showWarning(t('autodl.noInstances'))
        }
      } else if (list.length === 0) {
        showWarning(t('autodl.noInstances'))
      }

      setShowInstanceList(true)
    } catch (err) {
      showError(normalizeApiError(err), err)
    } finally {
      setLoadingList(false)
    }
  }, [host, token, uuid, showError, clearStatus, showWarning, showSuccess, t])

  // ── Select Instance ───────────────────────────────────────────────────
  const handleSelectInstance = useCallback((item: AutodlInstanceItem) => {
    setUuid(item.uuid)
    saveAutodl({ instanceUuid: item.uuid })

    // Update status from list data
    if (item.status) {
      setInstanceStatus(item.status)
    }

    // Auto-fill zealman URL if 6008 domain is available
    if (item.service_6008_domain) {
      let url = item.service_6008_domain
      if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`
      }
      setZealmanUrl(url)
    }

    setShowInstanceList(false)
    showSuccess(formatMessage(t('autodl.instanceSelected'), {
      name: item.name || item.application_name || item.uuid,
      status: getLocalizedStatusLabel(item.status, t),
    }))
  }, [saveAutodl, showSuccess, t])

  // ── Power On ──────────────────────────────────────────────────────────
  const handlePowerOn = useCallback(async () => {
    if (!token.trim()) { showError(t('autodl.error.tokenRequired')); return }
    if (!uuid.trim()) { showError(t('autodl.error.uuidRequired')); return }
    setLoadingPowerOn(true)
    clearStatus()
    try {
      await powerOnInstance(host.trim(), token.trim(), uuid.trim(), startCmd.trim())
      setInstanceStatus('starting')
      showSuccess(t('autodl.error.powerOnSent'))

      // Start polling (list-first, so it's reliable)
      setPolling(true)
      pollAbortRef.current?.abort()
      const controller = new AbortController()
      pollAbortRef.current = controller

      try {
        const finalStatus = await pollUntilRunning(
          host.trim(), token.trim(), uuid.trim(),
          { intervalMs: 5000, timeoutMs: 300000 },
          controller.signal,
        )
        setInstanceStatus(finalStatus.status)
        showSuccess(`${t('autodl.instanceStatus')}: ${getLocalizedStatusLabel(finalStatus.status, t)}`)

        // Auto-fetch snapshot after running
        try {
          const snap = await getInstanceSnapshot(host.trim(), token.trim(), uuid.trim())
          if (snap.zealmanUrl) {
            setSnapshotUrl(snap.zealmanUrl)
            setStatusMsg((prev) => prev + `\n${t('autodl.detectedUrl')}: ${snap.zealmanUrl}`)
            if (!zealmanUrl.trim()) {
              setZealmanUrl(snap.zealmanUrl)
              setZealmanBaseUrl(snap.zealmanUrl)
            }
          }
        } catch { /* non-critical */ }
      } catch (pollErr) {
        showWarning(normalizeApiError(pollErr))
      } finally {
        setPolling(false)
      }
    } catch (err) {
      showError(normalizeApiError(err), err)
    } finally {
      setLoadingPowerOn(false)
    }
  }, [host, token, uuid, startCmd, zealmanUrl, showError, clearStatus, showSuccess, showWarning, setZealmanBaseUrl, t])

  // ── Power Off ─────────────────────────────────────────────────────────
  const handlePowerOff = useCallback(async () => {
    if (!token.trim()) { showError(t('autodl.error.tokenRequired')); return }
    if (!uuid.trim()) { showError(t('autodl.error.uuidRequired')); return }
    if (!window.confirm(t('autodl.confirmPowerOff'))) return
    setLoadingPowerOff(true)
    clearStatus()
    try {
      await powerOffInstance(host.trim(), token.trim(), uuid.trim())
      setInstanceStatus('stopped')
      showSuccess(t('autodl.error.powerOffSent'))
    } catch (err) {
      showError(normalizeApiError(err), err)
    } finally {
      setLoadingPowerOff(false)
    }
  }, [host, token, uuid, showError, clearStatus, showSuccess, t])

  // ── Get Snapshot + health check ───────────────────────────────────────
  const handleSnapshot = useCallback(async () => {
    if (!token.trim()) { showError(t('autodl.error.tokenRequired')); return }
    if (!uuid.trim()) { showError(t('autodl.error.uuidRequired')); return }
    setLoadingSnapshot(true)
    clearStatus()
    try {
      const snap = await getInstanceSnapshot(host.trim(), token.trim(), uuid.trim())
      if (snap.zealmanUrl) {
        setSnapshotUrl(snap.zealmanUrl)
        // Verify the URL works by checking health
        try {
          const health = await checkPanelHealth(snap.zealmanUrl)
          if (health.ok) {
            showSuccess(`${t('autodl.detectedUrl')}: ${snap.zealmanUrl}\n${t('autodl.panelOk')}`)
          } else {
            showWarning(`${t('autodl.detectedUrl')}: ${snap.zealmanUrl}\n${t('autodl.panelUnreachable')}: ${health.detail || t('autodl.httpError')}`)
          }
        } catch {
          showWarning(`${t('autodl.detectedUrl')}: ${snap.zealmanUrl}\n${t('autodl.panelUnreachable')}: ${t('autodl.fetchFailed')}`)
        }
      } else {
        showWarning(t('autodl.error.no6008'))
      }
    } catch (err) {
      showError(normalizeApiError(err), err)
    } finally {
      setLoadingSnapshot(false)
    }
  }, [host, token, uuid, showError, clearStatus, showSuccess, showWarning, t])

  // ── Test Zealman Panel URL ────────────────────────────────────────────
  const handleTestPanel = useCallback(async () => {
    const url = zealmanUrl.trim().replace(/\/+$/, '')
    if (!url) {
      showError(t('autodl.error.zealmanUnavailable'))
      return
    }
    if (!/^https?:\/\//i.test(url)) {
      showError(t('autodl.error.invalidZealmanUrl'))
      return
    }
    setLoadingTestPanel(true)
    setPanelTestResult('idle')
    try {
      const health = await checkPanelHealth(url)
      if (health.ok) {
        setPanelTestResult('ok')
      } else {
        setPanelTestResult('fail')
      }
    } catch {
      setPanelTestResult('fail')
    } finally {
      setLoadingTestPanel(false)
    }
  }, [zealmanUrl, showError, t])

  // ── Apply snapshot URL to Zealman ─────────────────────────────────────
  const handleApplyUrl = useCallback(() => {
    if (!snapshotUrl) return
    if (!window.confirm(t('autodl.confirmApplyUrl'))) return
    setZealmanUrl(snapshotUrl)
    setZealmanBaseUrl(snapshotUrl)
    setPanelTestResult('idle')
    showSuccess(t('autodl.appliedToZealman'))
  }, [snapshotUrl, setZealmanBaseUrl, showSuccess, t])

  const isLoading = loadingStatus || loadingList || loadingPowerOn || loadingPowerOff || loadingSnapshot || loadingTestPanel || polling

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Zealman Base URL + test */}
      <div className="api-settings-field">
        <label className="api-settings-label">{t('autodl.zealmanBaseUrl')}</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="text" className="api-settings-input" value={zealmanUrl}
            onChange={(e) => { setZealmanUrl(e.target.value); setPanelTestResult('idle') }}
            placeholder="https://your-zealman-panel-domain:port" autoComplete="off"
            style={{ flex: 1 }} />
          <button className="cf-btn" onClick={handleTestPanel} disabled={isLoading || loadingTestPanel}
            style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            {loadingTestPanel ? <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Activity size={11} />}
            {' '}{loadingTestPanel ? t('autodl.testingPanel') : t('autodl.testPanel')}
          </button>
        </div>
        {panelTestResult === 'ok' && (
          <div style={{ fontSize: 10, color: 'var(--accent-green)', marginTop: 2 }}>
            <CheckCircle size={10} style={{ verticalAlign: 'middle' }} /> {t('autodl.panelOk')}
          </div>
        )}
        {panelTestResult === 'fail' && (
          <div style={{ fontSize: 10, color: 'var(--accent-red)', marginTop: 2 }}>
            <XCircle size={10} style={{ verticalAlign: 'middle' }} /> {t('autodl.panelUnreachable')}
          </div>
        )}
      </div>

      {/* AutoDL section header */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', paddingTop: 8, borderTop: '1px solid var(--border-primary)' }}>
        {t('autodl.instanceManagement')}
      </div>

      <div className="api-settings-field">
        <label className="api-settings-label">{t('autodl.apiHost')}</label>
        <input type="text" className="api-settings-input" value={host}
          onChange={(e) => setHost(e.target.value)} placeholder="https://www.autodl.art" autoComplete="off" />
      </div>

      {/* Token field - password by default */}
      <div className="api-settings-field">
        <label className="api-settings-label">{t('autodl.token')}</label>
        <div className="api-settings-input-wrap">
          <input
            type={showToken ? 'text' : 'password'}
            className="api-settings-input"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t('autodl.tokenPlaceholder')}
            autoComplete="off"
          />
          <button type="button" className="api-settings-eye-btn" onClick={() => setShowToken((v) => !v)} tabIndex={-1}>
            {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {!showToken && token && (
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
            {maskToken(token)}
          </div>
        )}
      </div>

      {/* Instance UUID */}
      <div className="api-settings-field">
        <label className="api-settings-label">{t('autodl.instanceUuid')}</label>
        <input type="text" className="api-settings-input" value={uuid}
          onChange={(e) => setUuid(e.target.value)}
          placeholder={t('autodl.uuidPlaceholder')} autoComplete="off" />
        {instanceStatus && (
          <div style={{ fontSize: 10, marginTop: 2, color: instanceStatus === 'running' ? 'var(--accent-green)' : 'var(--text-muted)' }}>
            {t('autodl.instanceStatus')}: {getLocalizedStatusLabel(instanceStatus, t)}
          </div>
        )}
      </div>

      <div className="api-settings-field">
        <label className="api-settings-label">{t('autodl.startCommand')}</label>
        <input type="text" className="api-settings-input" value={startCmd}
          onChange={(e) => setStartCmd(e.target.value)}
          placeholder="bash /path/to/your-startup-script.sh"
          autoComplete="off" style={{ fontSize: 10 }} />
      </div>

      {/* Action buttons - independent loading states */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <ActionButton onClick={handleStatus} disabled={isLoading} loading={loadingStatus}
          icon={<Search size={11} />} label={t('autodl.queryStatus')} loadingLabel={t('autodl.querying')} />
        <ActionButton onClick={handleListInstances} disabled={isLoading} loading={loadingList}
          icon={<List size={11} />} label={t('autodl.listInstances')} loadingLabel={t('autodl.listingInstances')} />
        <ActionButton onClick={handlePowerOn} disabled={isLoading} loading={loadingPowerOn || polling}
          icon={<Power size={11} />} label={t('autodl.powerOn')} loadingLabel={polling ? t('autodl.pollingStatus') : t('autodl.poweringOnFull')} />
        <ActionButton onClick={handlePowerOff} disabled={isLoading} loading={loadingPowerOff}
          icon={<PowerOff size={11} />} label={t('autodl.powerOff')} loadingLabel={t('autodl.poweringOffFull')} />
        <ActionButton onClick={handleSnapshot} disabled={isLoading} loading={loadingSnapshot}
          icon={<RefreshCw size={11} />} label={t('autodl.getSnapshot')} loadingLabel={t('autodl.gettingSnapshot')} />
      </div>

      {/* Status message */}
      {statusMsg && (
        <StatusMessage type={statusType} instanceStatus={instanceStatus ? getLocalizedStatusLabel(instanceStatus, t) : ''} message={statusMsg} />
      )}

      {/* Expandable error detail */}
      {errorDetail && (
        <div style={{ fontSize: 10 }}>
          <div
            onClick={() => setDetailOpen(!detailOpen)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            {detailOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {t('autodl.error.detail')}
          </div>
          {detailOpen && (
            <pre style={{
              margin: '4px 0 0', padding: '6px 8px', borderRadius: 6,
              background: 'var(--field-bg)', border: '1px solid var(--border-primary)',
              fontSize: 9, fontFamily: 'monospace', maxHeight: 200, overflow: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-secondary)',
            }}>
{JSON.stringify(errorDetail, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Instance list modal/dropdown */}
      {showInstanceList && (
        <div style={{
          border: '1px solid var(--border-primary)', borderRadius: 8,
          background: 'var(--field-bg)', maxHeight: 260, overflowY: 'auto',
        }}>
          <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{t('autodl.selectInstance')}</span>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowInstanceList(false)}>
              <X size={12} />
            </button>
          </div>
          {instances.length === 0 ? (
            <div style={{ padding: 12, fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
              {t('autodl.noInstances')}
            </div>
          ) : (
            instances.map((item) => (
              <div
                key={item.uuid}
                onClick={() => handleSelectInstance(item)}
                style={{
                  padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border-primary)',
                  fontSize: 10, display: 'flex', flexDirection: 'column', gap: 2,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>{item.name || item.application_name || item.uuid}</span>
                  <InstanceStatusBadge status={item.status} />
                </div>
                <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  UUID: {item.uuid}
                </div>
                {item.gpu_spec_uuid && <div style={{ color: 'var(--text-muted)' }}>GPU: {item.gpu_spec_uuid}</div>}
                {item.service_6008_domain && <div style={{ color: 'var(--accent-blue)' }}>6008: {item.service_6008_domain}</div>}
              </div>
            ))
          )}
        </div>
      )}

      {/* Apply Zealman URL from snapshot */}
      {snapshotUrl && (
        <div style={{
          padding: '6px 10px', borderRadius: 6, fontSize: 10,
          background: 'rgba(68,255,68,0.05)', border: '1px solid rgba(68,255,68,0.15)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ color: 'var(--text-muted)' }}>
            {t('autodl.detectedUrl')}: <code style={{ fontSize: 9, color: 'var(--accent-blue)' }}>{snapshotUrl}</code>
          </div>
          <button className="cf-btn" onClick={handleApplyUrl} style={{ fontSize: 10, padding: '2px 8px', alignSelf: 'flex-start' }}>
            {t('autodl.applyToZealman')}
          </button>
        </div>
      )}

      {/* Save button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border-primary)' }}>
        <button className="cf-btn cf-btn-primary" onClick={handleSave}>{t('apiSettings.save')}</button>
      </div>
    </div>
  )
}

// ── Instance Status Badge ──────────────────────────────────────────────

function InstanceStatusBadge({ status }: { status?: string }) {
  const { t } = useI18n()
  const s = status || 'unknown'
  const isRunning = s === 'running'
  const isStarting = s === 'starting'
  const isStopped = s === 'stopped' || s === 'shutdown'
  const bg = isRunning ? 'rgba(68,255,68,0.1)' : isStarting ? 'rgba(255,170,0,0.1)' : isStopped ? 'rgba(255,68,68,0.1)' : 'rgba(255,255,255,0.05)'
  const color = isRunning ? 'var(--accent-green)' : isStarting ? 'var(--accent-orange)' : isStopped ? 'var(--accent-red)' : 'var(--text-muted)'
  return (
    <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: bg, color }}>
      {getLocalizedStatusLabel(s, t)}
    </span>
  )
}

// ── Action Button with independent loading ─────────────────────────────

function ActionButton({ onClick, disabled, loading, icon, label, loadingLabel }: {
  onClick: () => void; disabled: boolean; loading: boolean
  icon: React.ReactNode; label: string; loadingLabel: string
}) {
  return (
    <button className="cf-btn" onClick={onClick} disabled={disabled} style={{ opacity: disabled && !loading ? 0.5 : 1 }}>
      {loading ? <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> : icon}
      {' '}{loading ? loadingLabel : label}
    </button>
  )
}

// ── Status Message ─────────────────────────────────────────────────────

function StatusMessage({ type, instanceStatus, message }: {
  type: 'success' | 'error' | 'warning' | ''
  instanceStatus: string
  message: string
}) {
  const bg = type === 'error' ? 'rgba(255,68,68,0.1)'
    : type === 'success' ? 'rgba(68,255,68,0.1)'
    : type === 'warning' ? 'rgba(255,170,0,0.1)'
    : 'var(--field-bg)'
  const color = type === 'error' ? 'var(--accent-red)'
    : type === 'success' ? 'var(--accent-green)'
    : type === 'warning' ? 'var(--accent-orange)'
    : 'var(--text-secondary)'
  const Icon = type === 'error' ? XCircle : type === 'success' ? CheckCircle : type === 'warning' ? AlertTriangle : null

  return (
    <div style={{
      fontSize: 11, padding: '6px 10px', borderRadius: 6, background: bg, color,
      fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    }}>
      {instanceStatus && <span style={{ fontWeight: 600 }}>[{instanceStatus}] </span>}
      {Icon && <Icon size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
      {message}
    </div>
  )
}
