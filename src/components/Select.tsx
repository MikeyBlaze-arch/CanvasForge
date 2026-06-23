import React from 'react'

export type SelectOption = { value: string; label: string; disabled?: boolean }

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  options: SelectOption[]
}

export function Select({ label, options, className = '', ...rest }: Props) {
  return (
    <div
      className="cf-select-wrap nodrag nopan nowheel"
      onWheelCapture={(e) => { e.stopPropagation(); e.preventDefault() }}
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {label && <label className="cf-select-label">{label}</label>}
      <select
        className={`cf-select nodrag nopan nowheel ${className}`}
        onWheelCapture={(e) => { e.stopPropagation(); e.preventDefault() }}
        onWheel={(e) => e.stopPropagation()}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

type SelectGroup = { label: string; options: SelectOption[] }

type CompactSelectProps = {
  value: string
  options?: SelectOption[]
  /** Grouped options — takes precedence over `options` when provided. */
  groups?: SelectGroup[]
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
  title?: string
}

export function CompactSelect({
  value,
  options,
  groups,
  onChange,
  className = '',
  disabled,
  title,
}: CompactSelectProps) {
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)

  // Flatten all options for finding the selected label
  const flatOptions: SelectOption[] = groups
    ? groups.flatMap((g) => g.options)
    : options ?? []
  const selected = flatOptions.find((option) => option.value === value)

  React.useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  const renderOptions = (opts: SelectOption[]) =>
    opts.map((option) => (
      <button
        key={option.value}
        type="button"
        role="option"
        aria-selected={option.value === value}
        className={`cf-compact-select-option nodrag nopan nowheel ${option.value === value ? 'selected' : ''}`}
        disabled={option.disabled}
        onClick={(e) => {
          e.stopPropagation()
          if (option.disabled) return
          onChange(option.value)
          setOpen(false)
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {option.label}
      </button>
    ))

  return (
    <div
      className={`cf-compact-select nodrag nopan nowheel ${open ? 'open' : ''} ${className}`}
      ref={rootRef}
      onWheelCapture={(e) => { e.stopPropagation(); e.preventDefault() }}
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={`cf-compact-select-trigger nodrag nopan nowheel ${open ? 'open' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((current) => !current)
        }}
        onMouseDown={(e) => e.stopPropagation()}
        disabled={disabled}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected?.label ?? value}</span>
        <span className="cf-compact-select-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div
          className="cf-compact-select-menu nodrag nopan nowheel"
          role="listbox"
          style={{ maxHeight: 220, overflowY: 'auto' }}
          onWheelCapture={(e) => { e.stopPropagation(); e.preventDefault() }}
          onWheel={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {groups
            ? groups.map((g) => (
                <React.Fragment key={g.label}>
                  <div className="cf-compact-select-group-label">{g.label}</div>
                  {renderOptions(g.options)}
                </React.Fragment>
              ))
            : renderOptions(flatOptions)}
        </div>
      )}
    </div>
  )
}
