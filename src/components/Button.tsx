import React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
}

const variantClass: Record<string, string> = {
  default: 'cf-btn',
  primary: 'cf-btn cf-btn-primary',
  danger: 'cf-btn cf-btn-danger',
  ghost: 'cf-btn cf-btn-ghost',
}

export function Button({ variant = 'default', size = 'md', className = '', children, ...rest }: Props) {
  return (
    <button
      className={`${variantClass[variant]} ${size === 'sm' ? 'cf-btn-sm' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
