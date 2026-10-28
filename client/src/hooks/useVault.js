import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api.js';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { 
  generateAesKey, 
  encryptData, 
  decryptData, 
  importPublicKey, 
  wrapKeyForTrustee, 
  unwrapKeyByTrustee 
} from '../utils/crypto.js';

export function useVault(selectedCategory = '') {
  const { user, privateKey } = useAuth();
  const [rawItems, setRawItems] = useState([]);
  const [decryptedItems, setDecryptedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState(null);

  // Fetch encrypted vault items from backend
  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = selectedCategory ? `?category=${selectedCategory}` : '';
      const res = await apiClient(`/vault${query}`);
      setRawItems(res.data);
    } catch (err) {
      setError(err.message || 'Failed to fetch vault items');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Decrypt items in browser whenever rawItems or privateKey changes
  useEffect(() => {
    async function decryptAll() {
      if (!privateKey || rawItems.length === 0) {
        setDecryptedItems(rawItems.map(item => ({ ...item, isDecrypted: false })));
        return;
      }

      setDecrypting(true);
      const decryptedList = await Promise.all(
        rawItems.map(async (item) => {
          try {
            // 1. Unwrap the AES DEK using owner's RSA private key
            const aesKey = await unwrapKeyByTrustee(item.encryptedKeyForOwner, privateKey);

            // 2. Decrypt the title and payload
            const title = await decryptData(item.encryptedTitle, item.titleIv, aesKey);
            const payloadJson = await decryptData(item.encryptedData, item.dataIv, aesKey);
            const payload = JSON.parse(payloadJson);

            return {
              ...item,
              title,
              payload,
              aesKey, // held in client state for re-encryption or editing
              isDecrypted: true
            };
          } catch (decErr) {
            console.error(`[Crypto] Failed to decrypt item ${item._id}:`, decErr);
            return {
              ...item,
              title: '[Decryption Error — Key Mismatch]',
              payload: { notes: 'Unable to decrypt with current private key.' },
              isDecrypted: false
            };
          }
        })
      );

      setDecryptedItems(decryptedList);
      setDecrypting(false);
    }

    decryptAll();
  }, [rawItems, privateKey]);

  // Create a new encrypted vault entry
  const createEntry = async ({ category, title, payload, tags = [] }) => {
    if (!user?.publicKey) {
      throw new Error('Public key not found for current user session.');
    }

    // 1. Generate unique AES-256-GCM DEK
    const aesKey = await generateAesKey();

    // 2. Encrypt title and payload
    const { ciphertext: encryptedTitle, iv: titleIv } = await encryptData(title, aesKey);
    const { ciphertext: encryptedData, iv: dataIv } = await encryptData(JSON.stringify(payload), aesKey);

    // 3. Wrap DEK with owner's public key
    const ownerPublicKey = await importPublicKey(user.publicKey);
    const encryptedKeyForOwner = await wrapKeyForTrustee(aesKey, ownerPublicKey);

    // 4. Send ciphertext to backend
    const res = await apiClient('/vault', {
      method: 'POST',
      body: JSON.stringify({
        category,
        encryptedTitle,
        titleIv,
        encryptedData,
        dataIv,
        encryptedKeyForOwner,
        tags
      })
    });

    await fetchItems();
    return res.data;
  };

  // Delete an entry
  const deleteEntry = async (itemId) => {
    await apiClient(`/vault/${itemId}`, { method: 'DELETE' });
    await fetchItems();
  };

  return {
    items: decryptedItems,
    loading,
    decrypting,
    error,
    refresh: fetchItems,
    createEntry,
    deleteEntry
  };
}
