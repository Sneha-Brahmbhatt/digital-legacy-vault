import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api.js';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { importPublicKey, wrapKeyForTrustee, unwrapKeyByTrustee } from '../utils/crypto.js';

export function useTrustees() {
  const { user, privateKey } = useAuth();
  const [trustees, setTrustees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTrustees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient('/trustees');
      setTrustees(res.data);
    } catch (err) {
      setError(err.message || 'Failed to fetch trustees.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrustees();
  }, [fetchTrustees]);

  // Lookup if a trustee email is registered and has a public key
  const lookupTrustee = async (email) => {
    return apiClient(`/trustees/lookup?email=${encodeURIComponent(email)}`);
  };

  // Designate a trustee
  const addTrustee = async (email) => {
    const res = await apiClient('/trustees', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    await fetchTrustees();
    return res.data;
  };

  // Update item permissions for a trustee with client-side key wrapping
  const updatePermissions = async (trusteeAssignmentId, selectedItems, allDecryptedVaultItems) => {
    const assignment = trustees.find(t => t._id === trusteeAssignmentId);
    if (!assignment) throw new Error('Trustee assignment not found.');

    const trusteePublicKeyBase64 = assignment.trusteeId?.publicKey;
    if (!trusteePublicKeyBase64) {
      throw new Error('Trustee has not registered or generated an RSA public key yet. They must log in to register their key before items can be delegated.');
    }

    const trusteeRsaPublicKey = await importPublicKey(trusteePublicKeyBase64);

    // For every selected vault item, wrap its AES DEK using the trustee's public RSA key
    const assignedItemsPayload = await Promise.all(
      selectedItems.map(async (itemId) => {
        const vaultItem = allDecryptedVaultItems.find(v => v._id === itemId);
        if (!vaultItem) throw new Error(`Vault item ${itemId} not found in client memory.`);

        let aesKey = vaultItem.aesKey;
        if (!aesKey) {
          // Re-unwrap from owner's wrapped key if needed
          aesKey = await unwrapKeyByTrustee(vaultItem.encryptedKeyForOwner, privateKey);
        }

        const encryptedKeyForTrustee = await wrapKeyForTrustee(aesKey, trusteeRsaPublicKey);

        return {
          itemId,
          encryptedKeyForTrustee
        };
      })
    );

    const res = await apiClient(`/trustees/${trusteeAssignmentId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ assignedItems: assignedItemsPayload })
    });

    await fetchTrustees();
    return res.data;
  };

  // Revoke trustee access
  const revokeTrustee = async (trusteeAssignmentId) => {
    await apiClient(`/trustees/${trusteeAssignmentId}`, { method: 'DELETE' });
    await fetchTrustees();
  };

  return {
    trustees,
    loading,
    error,
    refresh: fetchTrustees,
    lookupTrustee,
    addTrustee,
    updatePermissions,
    revokeTrustee
  };
}
