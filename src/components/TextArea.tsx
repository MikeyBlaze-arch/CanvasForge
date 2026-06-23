import React from 'react'

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
}

export function TextArea({ label, className = '', ...rest }: Props) {
  return (
    <div className="cf-textarea-wrap">
      {label && <label className="cf-textarea-label">{label}</label>}
      <textarea className={`cf-textarea ${className}`} {...rest} />
    </div>
  )
}
