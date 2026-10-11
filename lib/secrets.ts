import crypto from 'node:crypto'

/**
 * Parses and validates a 32-byte base64 encryption key.
 */
function parseKey(envValue: string | undefined, varName: string): Buffer | null {
  if (!envValue || envValue.trim() === '') {
    return null
  }
  try {
    const buf = Buffer.from(envValue.trim(), 'base64')
    if (buf.length !== 32) {
      throw new Error(`${varName} must decode to exactly 32 bytes (got ${buf.length})`)
    }
    return buf
  } catch (err: any) {
    if (err.message.includes('must decode')) throw err
    throw new Error(`Failed to parse ${varName}: invalid base64`)
  }
}

function getActiveKey(): Buffer {
  const key = parseKey(process.env.APP_ENCRYPTION_KEY, 'APP_ENCRYPTION_KEY')
  if (!key) {
    throw new Error('APP_ENCRYPTION_KEY is required and must be 32 bytes base64 encoded')
  }
  return key
}

function getPreviousKey(): Buffer | null {
  return parseKey(process.env.APP_ENCRYPTION_KEY_PREVIOUS, 'APP_ENCRYPTION_KEY_PREVIOUS')
}

/**
 * Checks if a stored secret is encrypted with format v1:<iv>:<tag>:<ciphertext>
 */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('v1:')
}

/**
 * Encrypts a plaintext secret using AES-256-GCM.
 * Output format: "v1:<iv b64url>:<tag b64url>:<ciphertext b64url>"
 */
export function encryptSecret(plain: string): string {
  if (typeof plain !== 'string') {
    throw new Error('Secret to encrypt must be a string')
  }

  const key = getActiveKey()
  const iv = crypto.randomBytes(12) // 12-byte IV for AES-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`
}

function tryDecryptWithKey(
  key: Buffer,
  iv: Buffer,
  tag: Buffer,
  ciphertext: Buffer
): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8')
}

/**
 * Decrypts an encrypted secret.
 * If the value is legacy unencrypted text (does not start with "v1:"), returns it as-is with a one-line warning.
 * Throws an error if tampering is detected or if keys cannot decrypt.
 */
export function decryptSecret(value: string): string {
  if (typeof value !== 'string') {
    throw new Error('Secret to decrypt must be a string')
  }

  if (!isEncrypted(value)) {
    console.warn('[SECURITY WARNING] Stored secret is in plaintext legacy format. Encryption recommended.')
    return value
  }

  const parts = value.split(':')
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Invalid encrypted secret format')
  }

  const [, ivB64, tagB64, cipherB64] = parts
  const iv = Buffer.from(ivB64, 'base64url')
  const tag = Buffer.from(tagB64, 'base64url')
  const ciphertext = Buffer.from(cipherB64, 'base64url')

  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error('Invalid IV or auth tag length in encrypted secret')
  }

  const activeKey = getActiveKey()

  try {
    return tryDecryptWithKey(activeKey, iv, tag, ciphertext)
  } catch (err: any) {
    const previousKey = getPreviousKey()
    if (previousKey) {
      try {
        return tryDecryptWithKey(previousKey, iv, tag, ciphertext)
      } catch {
        // Fall through to error throw
      }
    }
    throw new Error('Decryption failed: invalid key or tampered ciphertext')
  }
}
