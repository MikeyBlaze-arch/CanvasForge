import { useCallback } from 'react'
import type { Connection } from '@xyflow/react'
import { useNodeStore } from '../../store/nodeStore'
import { useEdgeStore } from '../../store/edgeStore'
import { isValidConnection, EDGE_ERROR_MSG } from '../edgeRules'

export function useEdgeValidation() {
  const nodes = useNodeStore((s) => s.nodes)
  const edges = useEdgeStore((s) => s.edges)

  const validate = useCallback(
    (connection: Connection): boolean => {
      return isValidConnection(connection, nodes, edges)
    },
    [nodes, edges]
  )

  const onConnectError = useCallback(() => {
    alert(EDGE_ERROR_MSG)
  }, [])

  return { validate, onConnectError }
}
