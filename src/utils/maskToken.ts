export function maskToken(token: string): string {
  if (!token) return ''
  if (token.length <= 16) return '******'
  return `${token.slice(0, 8)}...${token.slice(-6)}`
}
