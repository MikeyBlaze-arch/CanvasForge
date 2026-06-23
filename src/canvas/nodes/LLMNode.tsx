import React, { useCallback, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { NodeShell } from '../../components/NodeShell'
import { PortLabel } from '../../components/PortLabel'
import { CompactSelect } from '../../components/Select'
import { useNodeStore } from '../../store/nodeStore'
import { useEdgeStore } from '../../store/edgeStore'
import type { LLMNodeData, TextNodeData } from '../nodeTypes'
import { LLM_MODEL_REGISTRY } from '../../generation/llmModelRegistry'
import { callLLM } from '../../generation/llmApi'
import { getLLMInputs } from '../nodeHelpers'
import { useI18n } from '../../i18n/useI18n'

export const LLMNodeComponent = React.memo(function LLMNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as LLMNodeData
  const updateNodeData = useNodeStore((s) => s.updateNodeData)
  const nodes = useNodeStore((s) => s.nodes)
  const edges = useEdgeStore((s) => s.edges)
  const [inputValue, setInputValue] = useState(d.userInput)
  const { t } = useI18n()

  const setField = useCallback(
    (patch: Partial<LLMNodeData>) => {
      updateNodeData(id, { ...patch, updatedAt: Date.now() } as Partial<LLMNodeData>)
    },
    [id, updateNodeData]
  )

  /**
   * Write LLM output to connected TextNodes only.
   */
  const writeOutputToTextNodes = useCallback(
    (outputText: string) => {
      const inputs = getLLMInputs(id, nodes, edges, '')

      if (inputs.connectedTextOutputNodes.length > 0) {
        for (const { nodeId } of inputs.connectedTextOutputNodes) {
          updateNodeData(nodeId, {
            content: outputText,
            sourceNodeId: id,
            sourceType: 'llm',
            metadata: {
              llmModel: d.llmModelId,
              llmMode: d.mode,
              inputImages: inputs.imageInputs,
              createdAt: Date.now(),
            },
            updatedAt: Date.now(),
          } as Partial<TextNodeData>)
        }
      }
    },
    [id, d.llmModelId, d.mode, nodes, edges, updateNodeData]
  )

  const handleRun = useCallback(async () => {
    // Gather inputs from connected nodes
    const statusInputs = getLLMInputs(id, nodes, edges, '')
    const hasConnectedTextInput = statusInputs.connectedTextNodeCount > 0
    const inputs = getLLMInputs(id, nodes, edges, hasConnectedTextInput ? '' : inputValue)

    if (!inputs.inputText.trim() && inputs.imageInputs.length === 0) return

    // Store image inputs on node data
    setField({ imageInputs: inputs.imageInputs })

    const userMsg = { role: 'user' as const, content: inputs.inputText, createdAt: Date.now() }
    setField({ conversation: [userMsg], userInput: hasConnectedTextInput ? d.userInput : inputValue, status: 'running', error: undefined })
    setInputValue('')

    try {
      const result = await callLLM({
        modelId: d.llmModelId,
        messages: [{ role: 'user', content: inputs.inputText }],
        systemPrompt: d.systemPrompt,
        imageUrls: inputs.imageInputs,
      })

      const assistantMsg = { role: 'assistant' as const, content: result, createdAt: Date.now() }
      setField({
        conversation: [userMsg, assistantMsg],
        outputText: result,
        status: 'success',
      })

      // Write output to connected TextNodes (or auto-create one)
      writeOutputToTextNodes(result)
    } catch (err: unknown) {
      const msg = err instanceof Error && err.message === 'MISSING_API_KEY'
        ? t('llm.error.missingApiKey')
        : err instanceof Error && err.message === 'MISSING_API_BASE_URL'
          ? t('llm.error.missingApiBaseUrl')
          : t('llm.failed')
      setField({ status: 'failed', error: msg })
    }
  }, [id, d, inputValue, nodes, edges, setField, t, writeOutputToTextNodes])

  const currentModelLabel = LLM_MODEL_REGISTRY.find((m) => m.id === d.llmModelId)?.label ?? d.llmModelId

  // Check text connection status
  const llmInputs = getLLMInputs(id, nodes, edges, '')
  const textConnected = llmInputs.connectedTextNodeCount > 0

  return (
    <NodeShell
      nodeType="llm"
      title={currentModelLabel}
      selected={!!selected}
      status={d.status}
      width={280}
      actions={
        <>
          <button className="node-btn primary" onClick={handleRun} disabled={d.status === 'running'}>
            {t('llm.run')}
          </button>
        </>
      }
    >
      {/* Model select */}
      <div className="node-field">
        <CompactSelect
          value={d.llmModelId}
          onChange={(value) => setField({ llmModelId: value })}
          options={LLM_MODEL_REGISTRY.map((model) => ({ value: model.id, label: model.label }))}
        />
      </div>

      {/* Input */}
      {!textConnected && (
        <textarea
          rows={2}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleRun()
          }}
          placeholder={t('llm.inputPlaceholder')}
          className="cf-textarea llm-node-textarea nodrag nopan"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        />
      )}

      {d.error && <div style={{ color: 'var(--accent-red)', fontSize: 11, padding: '2px 0' }}>{d.error}</div>}

      {/* Handles - main handles visible, semantic handles invisible */}
      <div className="node-ports">
        <div className="node-port-group">
          <PortLabel type="target" id="main_input" mode="main" />
          <PortLabel type="target" id="text_input" mode="semantic" />
          <PortLabel type="target" id="image_input" mode="semantic" />
        </div>
        <div className="node-port-group">
          <PortLabel type="source" id="main_output" mode="main" />
          <PortLabel type="source" id="llm_output" mode="semantic" />
          <PortLabel type="source" id="text" mode="semantic" />
        </div>
      </div>
    </NodeShell>
  )
})
