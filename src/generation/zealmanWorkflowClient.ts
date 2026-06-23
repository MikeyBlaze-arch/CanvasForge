/**
 * Legacy shim — re-exports from the canonical service at src/services/zealmanClient.ts.
 * New code should import from '../../services/zealmanClient' directly.
 */

export {
  getZealmanBaseUrl,
  normalizeOutputUrl,
  generateWorkflow,
  getWorkflowResult,
  waitForWorkflowResult,
  extractVideoResult,
  uploadComfyFile,
  resolveInputValue,
  normalizeMotionTransferError,
  checkPanelHealth,
  checkGpuInfo,
  getComfyStatus,
  startComfy,
  waitForComfyReady,
  checkAllServices,
} from '../services/zealmanClient'

// Backward-compat alias
export { uploadComfyFile as uploadWorkflowFile } from '../services/zealmanClient'

// Type re-exports
export type { GenerateWorkflowPayload, WaitForOptions, ExtractedVideoResult, UploadResult } from '../services/zealmanClient'
