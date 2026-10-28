import React, { useState, useEffect } from 'react';
import { Users, Plus, Mail, Shield, Trash2, Key, Lock, CheckSquare, Square, AlertCircle, RefreshCw, UserCheck, UserX, Eye } from 'lucide-react';
import { useTrustees } from '../hooks/useTrustees.js';
import { useVault } from '../hooks/useVault.js';
import { useAuth } from '../features/auth/AuthContext.jsx';

export default function TrusteePage() {
  const { user } = useAuth();
  const { trustees, loading, error, refresh, lookupTrustee, addTrustee, updatePermissions, revokeTrustee } = useTrustees();
  const { items: vaultItems } = useVault();

  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);
  const [lookupResult, setLookupResult] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);

  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [selectedTrustee, setSelectedTrustee] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permError, setPermError] = useState(null);

  const handleLookup = async () => {
    if (!email.trim()) return;
    setLookingUp(true);
    setLookupResult(null);
    try {
      const res = await lookupTrustee(email.trim());
      setLookupResult(res);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setLookingUp(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddError(null);
    setAdding(true);
    try {
      await addTrustee(email.trim());
      setEmail('');
      setLookupResult(null);
    } catch (err) {
      setAddError(err.message || 'Failed to add trustee.');
    } finally {
      setAdding(false);
    }
  };

  const openPermissions = (trustee) => {
    setSelectedTrustee(trustee);
    const currentItems = trustee.assignedItems?.map(a =>
      a.itemId?._id || a.itemId
    ) || [];
    setSelectedItems(currentItems.map(id => id.toString()));
    setPermError(null);
    setPermissionModalOpen(true);
  };

  const toggleItem = (itemId) => {
    setSelectedItems(prev =>
      prev.includes(itemId.toString())
        ? prev.filter(i => i !== itemId.toString())
        : [...prev, itemId.toString()]
    );
  };

  const savePermissions = async () => {
    setSavingPermissions(true);
    setPermError(null);
    try {
      await updatePermissions(selectedTrustee._id, selectedItems, vaultItems);
      setPermissionModalOpen(false);
    } catch (err) {
      setPermError(err.message || 'Failed to update permissions. Ensure trustee has a registered account and public key.');
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleRevoke = async (trusteeId, trusteeName) => {
    if (!window.confirm(`Permanently revoke access for "${trusteeName}"? All wrapped decryption keys will be purged from the server.`)) return;
    try {
      await revokeTrustee(trusteeId);
    } catch (err) {
      alert(err.message || 'Failed to revoke trustee.');
    }
  };

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h2 className="fw-bold text-white mb-0">Trustee Management</h2>
            <span className="vault-badge vault-badge-trustee">FR-5</span>
          </div>
          <p className="text-muted small mb-0">
            Designate trustees and assign item-level RSA-OAEP wrapped keys. The server never receives raw decryption keys.
          </p>
        </div>
        <button className="btn btn-vault-outline d-flex align-items-center gap-1" onClick={refresh} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Add Trustee Card */}
      <div className="vault-card p-4 mb-4">
        <h5 className="fw-semibold text-white mb-3 d-flex align-items-center gap-2">
          <Plus size={18} className="text-primary" /> Designate a New Trustee
        </h5>

        {addError && (
          <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small mb-3">
            <AlertCircle size={15} /> {addError}
          </div>
        )}

        <form onSubmit={handleAdd}>
          <div className="row g-3 align-items-end">
            <div className="col-md-7">
              <label className="form-label text-muted small fw-medium d-flex align-items-center gap-1">
                <Mail size={14} /> Trustee Email Address
              </label>
              <input
                type="email"
                className="form-control form-control-vault w-100"
                placeholder="trustee@example.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setLookupResult(null); setAddError(null); }}
                required
              />
            </div>
            <div className="col-md-auto d-flex gap-2">
              <button
                type="button"
                className="btn btn-vault-outline"
                onClick={handleLookup}
                disabled={!email.trim() || lookingUp}
              >
                {lookingUp ? <span className="spinner-border spinner-border-sm" /> : <Eye size={16} />}
                {' '}Lookup
              </button>
              <button
                type="submit"
                className="btn btn-vault-primary d-flex align-items-center gap-1"
                disabled={adding}
              >
                {adding ? <span className="spinner-border spinner-border-sm" /> : <Plus size={15} />}
                Add Trustee
              </button>
            </div>
          </div>
        </form>

        {lookupResult && (
          <div className={`mt-3 p-3 rounded border small ${lookupResult.exists && lookupResult.hasPublicKey ? 'border-success text-success' : 'border-warning text-warning'}`}
            style={{ background: 'rgba(0,0,0,0.2)' }}>
            {lookupResult.exists && lookupResult.hasPublicKey ? (
              <span className="d-flex align-items-center gap-2">
                <UserCheck size={16} /> <strong>{lookupResult.data?.name}</strong> ({lookupResult.data?.email}) — Registered with RSA public key. ✓ Key wrapping supported.
              </span>
            ) : lookupResult.exists ? (
              <span className="d-flex align-items-center gap-2">
                <AlertCircle size={16} /> User found but has no public key yet. They must log in first to generate their cryptographic keypair.
              </span>
            ) : (
              <span className="d-flex align-items-center gap-2">
                <UserX size={16} /> No registered account found. Trustee must create an account before keys can be delegated.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Trustee List */}
      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" /><div className="text-muted small mt-2">Loading trustees...</div></div>
      ) : error ? (
        <div className="alert alert-danger small">{error}</div>
      ) : trustees.length === 0 ? (
        <div className="vault-card p-5 text-center">
          <Users size={36} className="text-muted mb-3" />
          <h5 className="fw-semibold text-white mb-2">No Trustees Designated</h5>
          <p className="text-muted small">Add a trustee to begin assigning item-level encrypted access permissions.</p>
        </div>
      ) : (
        <div className="row g-3">
          {trustees.map(trustee => (
            <div className="col-12" key={trustee._id}>
              <div className="vault-card p-4">
                <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
                  <div className="d-flex align-items-center gap-3">
                    <div className={`p-2 rounded border ${trustee.status === 'active' ? 'border-info bg-info' : 'border-danger bg-danger'} bg-opacity-10 border-opacity-25`}>
                      <Users size={20} className={trustee.status === 'active' ? 'text-info' : 'text-danger'} />
                    </div>
                    <div>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="fw-semibold text-white">{trustee.trusteeId?.name || trustee.trusteeEmail}</span>
                        <span className={`vault-badge ${trustee.status === 'active' ? 'vault-badge-trustee' : 'vault-badge-alert'}`}>
                          {trustee.status}
                        </span>
                        {trustee.trusteeId?.publicKey && (
                          <span className="vault-badge vault-badge-secure py-0 px-2" title="Has RSA-OAEP public key">
                            <Key size={12} /> Key Ready
                          </span>
                        )}
                      </div>
                      <div className="text-muted small">{trustee.trusteeEmail}</div>
                      <div className="text-muted small mt-1">
                        {trustee.assignedItems?.length || 0} vault items assigned
                      </div>
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    {trustee.status === 'active' && (
                      <button
                        className="btn btn-sm btn-vault-outline d-flex align-items-center gap-1"
                        onClick={() => openPermissions(trustee)}
                      >
                        <Lock size={14} /> Manage Items
                      </button>
                    )}
                    <button
                      className="btn btn-sm btn-vault-danger"
                      onClick={() => handleRevoke(trustee._id, trustee.trusteeId?.name || trustee.trusteeEmail)}
                      title="Revoke access"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {trustee.assignedItems?.length > 0 && (
                  <div className="mt-3 pt-3 border-top border-secondary border-opacity-25">
                    <div className="text-muted small mb-2">Assigned vault items (RSA-OAEP wrapped keys):</div>
                    <div className="d-flex flex-wrap gap-2">
                      {trustee.assignedItems.map((ai, idx) => (
                        <span key={idx} className="vault-badge vault-badge-secure small">
                          <Shield size={12} />
                          {ai.itemId?.category || 'item'} — DEK Wrapped
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Permission Assignment Modal */}
      {permissionModalOpen && selectedTrustee && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content vault-card text-white border-secondary">
              <div className="modal-header border-secondary border-opacity-25">
                <h5 className="modal-title d-flex align-items-center gap-2 fw-semibold">
                  <Lock size={18} className="text-primary" />
                  Assign Vault Items — {selectedTrustee.trusteeId?.name || selectedTrustee.trusteeEmail}
                </h5>
                <button className="btn-close btn-close-white" onClick={() => setPermissionModalOpen(false)} disabled={savingPermissions} />
              </div>

              <div className="modal-body py-4">
                <p className="text-muted small mb-3">
                  Select vault items to delegate. Each item's AES-256-GCM Data Encryption Key will be wrapped client-side using this trustee's RSA-OAEP public key before being stored.
                </p>

                {permError && (
                  <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small mb-3">
                    <AlertCircle size={15} /> {permError}
                  </div>
                )}

                {vaultItems.length === 0 ? (
                  <div className="text-center text-muted py-4">No decrypted vault items available. Ensure items are loaded and decrypted first.</div>
                ) : (
                  <div className="list-group list-group-flush">
                    {vaultItems.map(item => {
                      const isSelected = selectedItems.includes(item._id?.toString());
                      return (
                        <div
                          key={item._id}
                          className={`list-group-item list-group-item-action border-secondary border-opacity-25 mb-2 rounded p-3 cursor-pointer ${isSelected ? 'border-primary bg-primary bg-opacity-10' : 'bg-dark'}`}
                          onClick={() => toggleItem(item._id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="d-flex align-items-center gap-3">
                            {isSelected ? <CheckSquare size={18} className="text-primary flex-shrink-0" /> : <Square size={18} className="text-muted flex-shrink-0" />}
                            <div>
                              <div className="fw-medium text-white">{item.title || '[Encrypted Title]'}</div>
                              <div className="text-muted small text-capitalize">{item.category}</div>
                            </div>
                            {isSelected && <span className="ms-auto vault-badge vault-badge-secure small">DEK will be wrapped</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="modal-footer border-secondary border-opacity-25">
                <button className="btn btn-vault-outline" onClick={() => setPermissionModalOpen(false)} disabled={savingPermissions}>Cancel</button>
                <button className="btn btn-vault-primary d-flex align-items-center gap-2" onClick={savePermissions} disabled={savingPermissions}>
                  {savingPermissions ? (
                    <><span className="spinner-border spinner-border-sm" /> Wrapping Keys & Saving...</>
                  ) : (
                    <><Key size={15} /> Wrap Keys & Save Permissions</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
