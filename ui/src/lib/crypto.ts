/**
 * AuthForge - Client-Side Encryption Module
 * 
 * Implements AES-256-GCM encryption with PBKDF2 key derivation.
 * All encryption/decryption happens in the browser - server never sees plaintext.
 */

// Constants
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

// Session storage key for the derived encryption key
const VAULT_KEY_STORAGE = 'authforge_vault_key';
const VAULT_SALT_STORAGE = 'authforge_vault_salt';

/**
 * Generate a random salt for key derivation
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Generate a random IV for encryption
 */
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Convert ArrayBuffer to base64 string
 */
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 */
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derive an encryption key from a master password using PBKDF2
 */
export async function deriveKey(
  masterPassword: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Import the password as a key
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive the actual encryption key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    true, // extractable for storage
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a CryptoKey to base64 for session storage
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return bufferToBase64(exported);
}

/**
 * Import a base64 key from session storage
 */
export async function importKey(keyBase64: string): Promise<CryptoKey> {
  const keyBuffer = base64ToBuffer(keyBase64);
  return crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data using AES-256-GCM
 */
export async function encrypt(
  data: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const iv = generateIV();
  const encodedData = new TextEncoder().encode(data);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    encodedData
  );

  return {
    ciphertext: bufferToBase64(encrypted),
    iv: bufferToBase64(iv.buffer as ArrayBuffer)
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export async function decrypt(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const encryptedBuffer = base64ToBuffer(ciphertext);
  const ivBuffer = base64ToBuffer(iv);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    key,
    encryptedBuffer
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Store the vault key in session storage (cleared on browser close)
 */
export async function storeVaultKey(key: CryptoKey, salt: Uint8Array): Promise<void> {
  const exportedKey = await exportKey(key);
  sessionStorage.setItem(VAULT_KEY_STORAGE, exportedKey);
  sessionStorage.setItem(VAULT_SALT_STORAGE, bufferToBase64(salt.buffer as ArrayBuffer));
}

/**
 * Retrieve the vault key from session storage
 */
export async function getStoredVaultKey(): Promise<CryptoKey | null> {
  const keyBase64 = sessionStorage.getItem(VAULT_KEY_STORAGE);
  if (!keyBase64) return null;
  
  try {
    return await importKey(keyBase64);
  } catch {
    return null;
  }
}

/**
 * Get the stored salt
 */
export function getStoredSalt(): Uint8Array | null {
  const saltBase64 = sessionStorage.getItem(VAULT_SALT_STORAGE);
  if (!saltBase64) return null;
  return new Uint8Array(base64ToBuffer(saltBase64));
}

/**
 * Clear the vault key from session storage
 */
export function clearVaultKey(): void {
  sessionStorage.removeItem(VAULT_KEY_STORAGE);
  sessionStorage.removeItem(VAULT_SALT_STORAGE);
}

/**
 * Check if vault is unlocked (key is in session)
 */
export function isVaultUnlocked(): boolean {
  return sessionStorage.getItem(VAULT_KEY_STORAGE) !== null;
}

/**
 * Hash the master password for server-side verification
 * This allows the server to verify the user knows the master password
 * without ever seeing the actual password or encryption key
 */
export async function hashMasterPassword(
  masterPassword: string,
  salt: Uint8Array
): Promise<string> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  // Derive bits for verification hash (different from encryption key)
  const verificationBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new Uint8Array([...salt, 0x01]), // Different salt for hash
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    256
  );

  return bufferToBase64(verificationBits);
}

// Vault data types
export interface VaultItemData {
  // For login items
  username?: string;
  password?: string;
  url?: string;
  totp?: string;
  
  // For card items
  cardNumber?: string;
  expiry?: string;
  cvv?: string;
  cardholderName?: string;
  
  // For note items
  content?: string;
  
  // For identity items
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  
  // Error state
  error?: string;
}

/**
 * Encrypt vault item data
 */
export async function encryptVaultItem(
  data: VaultItemData,
  key: CryptoKey
): Promise<{ encryptedData: string; iv: string }> {
  const jsonData = JSON.stringify(data);
  const { ciphertext, iv } = await encrypt(jsonData, key);
  return { encryptedData: ciphertext, iv };
}

/**
 * Decrypt vault item data
 */
export async function decryptVaultItem(
  encryptedData: string,
  iv: string,
  key: CryptoKey
): Promise<VaultItemData> {
  const jsonData = await decrypt(encryptedData, iv, key);
  return JSON.parse(jsonData);
}
