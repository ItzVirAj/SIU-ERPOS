// In Node.js environments (tests/API routes), dynamically delegate to net.isIP
// In Edge middleware, use the standards-compliant regex/octet validator to avoid webpack UnhandledSchemeError
let nodeNetIsIP: ((ip: string) => number) | null = null
try {
  if (typeof globalThis !== 'undefined' && (globalThis as any).process?.versions?.node) {
    const req = (globalThis as any).eval?.('require')
    if (typeof req === 'function') {
      const nodeNet = req('net')
      if (typeof nodeNet?.isIP === 'function') {
        nodeNetIsIP = nodeNet.isIP
      }
    }
  }
} catch {}

/**
 * Validates whether the given string is a valid IPv4 or IPv6 address.
 * Returns 4 for IPv4, 6 for IPv6, and 0 for invalid.
 */
export function isIP(input: string): number {
  if (nodeNetIsIP) {
    return nodeNetIsIP(input)
  }
  if (!input || typeof input !== 'string') return 0

  // IPv4 check: 4 octets 0..255 with no leading zeros
  const ipv4Parts = input.split('.')
  if (ipv4Parts.length === 4) {
    const isV4 = ipv4Parts.every((part) => {
      if (!/^\d+$/.test(part)) return false
      const num = Number(part)
      return num >= 0 && num <= 255 && (part === '0' || !part.startsWith('0'))
    })
    if (isV4) return 4
  }

  // IPv6 check
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/
  if (ipv6Regex.test(input)) return 6

  return 0
}

const DEFAULT_TRUSTED_PROXY_HOPS = 1

export function getTrustedProxyHops(): number {
  const envVal = process.env.TRUSTED_PROXY_HOPS
  if (!envVal) return DEFAULT_TRUSTED_PROXY_HOPS
  const parsed = parseInt(envVal, 10)
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 5) {
    return parsed
  }
  return DEFAULT_TRUSTED_PROXY_HOPS
}

/**
 * Computes the client IP from the X-Forwarded-For header by selecting the N-th
 * entry from the RIGHT. This trusts only the proxy hops added by our own trusted
 * edge infrastructure (e.g. Render, AWS ALB, Cloudflare), ignoring any spoofed
 * entries prepended by the caller.
 */
export function computeClientIpFromForwarded(
  xff: string | null | undefined,
  hops = getTrustedProxyHops()
): string {
  if (!xff || typeof xff !== 'string') return 'unknown'

  const parts = xff
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  if (parts.length === 0) return 'unknown'

  const targetIndex = parts.length - hops
  if (targetIndex < 0 || targetIndex >= parts.length) {
    return 'unknown'
  }

  const candidate = parts[targetIndex]
  if (isIP(candidate)) {
    return candidate
  }

  return 'unknown'
}

/**
 * Reads the canonical client IP from the x-siu-client-ip header ONLY,
 * which is strictly stamped by middleware after edge verification.
 */
export function getClientIp(
  headers: Headers | Record<string, string | string[] | undefined>
): string {
  let val: string | null | undefined

  if (typeof (headers as Headers)?.get === 'function') {
    val = (headers as Headers).get('x-siu-client-ip')
  } else {
    const raw = (headers as Record<string, string | string[] | undefined>)['x-siu-client-ip']
    val = Array.isArray(raw) ? raw[0] : raw
  }

  if (val && typeof val === 'string' && val.trim().length > 0 && isIP(val.trim())) {
    return val.trim()
  }

  return 'unknown'
}
