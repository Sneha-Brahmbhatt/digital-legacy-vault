/**
 * Zero-Knowledge Cryptographic Engine
 * Web Crypto API (SubtleCrypto) Implementation
 * Standards: AES-256-GCM (Authenticated Encryption), RSA-OAEP (Asymmetric Key Wrapping), PBKDF2 (Key Derivation)
 */

// Helper: Convert ArrayBuffer to Base64
export function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper: Convert Base64 to ArrayBuffer
export function base64ToBuffer(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate a 2048-bit RSA-OAEP Keypair for a User / Trustee
 * Used for asymmetric envelope encryption & key handover
 */
export async function generateRsaKeyPair() {
  return window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt']
  );
}

/**
 * Export RSA Public Key as Base64 SPKI
 */
export async function exportPublicKey(key) {
  const spki = await window.crypto.subtle.exportKey('spki', key);
  return bufferToBase64(spki);
}

/**
 * Import RSA Public Key from Base64 SPKI
 */
export async function importPublicKey(spkiBase64) {
  const buffer = base64ToBuffer(spkiBase64);
  return window.crypto.subtle.importKey(
    'spki',
    buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['wrapKey', 'encrypt']
  );
}

/**
 * Derive AES Key from user password + salt using PBKDF2 (100,000 iterations)
 * Used to securely seal/unseal the user's private key client-side
 */
async function derivePassphraseKey(password, saltBuffer) {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt private key with user's password before sending to server
 */
export async function sealPrivateKey(privateKey, password) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const derivedKey = await derivePassphraseKey(password, salt);

  const pkcs8 = await window.crypto.subtle.exportKey('pkcs8', privateKey);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    pkcs8
  );

  return {
    encryptedPrivateKey: bufferToBase64(encrypted),
    privateKeyIv: bufferToBase64(iv.buffer),
    privateKeySalt: bufferToBase64(salt.buffer)
  };
}

/**
 * Decrypt private key locally using user's password
 */
export async function unsealPrivateKey(encryptedBase64, ivBase64, saltBase64, password) {
  const saltBuffer = base64ToBuffer(saltBase64);
  const ivBuffer = base64ToBuffer(ivBase64);
  const encryptedBuffer = base64ToBuffer(encryptedBase64);

  const derivedKey = await derivePassphraseKey(password, saltBuffer);

  const decryptedPkcs8 = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
    derivedKey,
    encryptedBuffer
  );

  return window.crypto.subtle.importKey(
    'pkcs8',
    decryptedPkcs8,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['unwrapKey', 'decrypt']
  );
}

/**
 * Generate a random 256-bit AES-GCM Data Encryption Key (DEK)
 * Unique per vault entry
 */
export async function generateAesKey() {
  return window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt arbitrary string or JSON data using AES-256-GCM
 * Enforces unique 96-bit IV per encryption operation
 */
export async function encryptData(plaintextString, aesKey) {
  const enc = new TextEncoder();
  const data = enc.encode(plaintextString);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const ciphertextWithTag = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    data
  );

  return {
    ciphertext: bufferToBase64(ciphertextWithTag),
    iv: bufferToBase64(iv.buffer)
  };
}

/**
 * Decrypt AES-256-GCM ciphertext
 */
export async function decryptData(ciphertextBase64, ivBase64, aesKey) {
  const ciphertextBuffer = base64ToBuffer(ciphertextBase64);
  const ivBuffer = base64ToBuffer(ivBase64);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
    aesKey,
    ciphertextBuffer
  );

  const dec = new TextDecoder();
  return dec.decode(decrypted);
}

/**
 * Encrypt binary document ArrayBuffer using AES-256-GCM
 */
export async function encryptBinaryData(arrayBuffer, aesKey) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    arrayBuffer
  );

  return {
    ciphertextBase64: bufferToBase64(encryptedBuffer),
    ivBase64: bufferToBase64(iv.buffer)
  };
}

/**
 * Decrypt binary document ArrayBuffer using AES-256-GCM
 */
export async function decryptBinaryData(ciphertextBase64, ivBase64, aesKey) {
  const ciphertextBuffer = base64ToBuffer(ciphertextBase64);
  const ivBuffer = base64ToBuffer(ivBase64);

  return window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
    aesKey,
    ciphertextBuffer
  );
}

/**
 * Wrap (encrypt) an AES-256 DEK using a recipient's RSA-OAEP Public Key
 * Core mechanism for Zero-Knowledge Key Handover to Trustees
 */
export async function wrapKeyForTrustee(aesKey, trusteeRsaPublicKey) {
  const wrapped = await window.crypto.subtle.wrapKey(
    'raw',
    aesKey,
    trusteeRsaPublicKey,
    { name: 'RSA-OAEP', hash: 'SHA-256' }
  );
  return bufferToBase64(wrapped);
}

/**
 * Unwrap (decrypt) an AES-256 DEK using Trustee's RSA-OAEP Private Key
 */
export async function unwrapKeyByTrustee(wrappedKeyBase64, trusteeRsaPrivateKey) {
  const wrappedBuffer = base64ToBuffer(wrappedKeyBase64);
  return window.crypto.subtle.unwrapKey(
    'raw',
    wrappedBuffer,
    trusteeRsaPrivateKey,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    { name: 'AES-GCM', length: 256 },
    true,
    ['decrypt']
  );
}
