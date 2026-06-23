import { Handle, Position } from '@xyflow/react'

type Props = {
  type: 'source' | 'target'
  position?: Position
  id: string
  label?: string
  /** All ports are now minimal dots. 'main' ports are visible, others invisible. */
  mode?: 'main' | 'semantic' | 'legacy'
  emphasis?: boolean
}

export function PortLabel({ type, position, id, mode = 'semantic' }: Props) {
  const pos = position ?? (type === 'source' ? Position.Right : Position.Left)
  const isMain = mode === 'main'

  return (
    <Handle
      type={type}
      position={pos}
      id={id}
      isConnectable={true}
      className={`react-flow__handle port-dot${type === 'source' ? ' source' : ' target'}${isMain ? ' visible' : ' hidden'}`}
      style={isMain ? undefined : { opacity: 0, width: 1, height: 1 }}
    />
  )
}
