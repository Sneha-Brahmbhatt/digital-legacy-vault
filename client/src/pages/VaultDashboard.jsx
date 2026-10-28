import React, { useState } from 'react';
import { Shield, Plus, Lock, FileText, MessageSquare, Search, RefreshCw, Key, Filter, CheckCircle2 } from 'lucide-react';
import { useVault } from '../hooks/useVault.js';
import { useAuth } from '../features/auth/AuthContext.jsx';
import VaultCard from '../features/vault/VaultCard.jsx';
import AddEntryModal from '../features/vault/AddEntryModal.jsx';

export default function VaultDashboard() {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { items, loading, decrypting, error, refresh, createEntry, downloadAndDecryptFile, deleteEntry } = useVault(selectedCategory);

  const filteredItems = items.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const titleMatch = item.title?.toLowerCase().includes(term);
    const tagMatch = item.tags?.some(tag => tag.toLowerCase().includes(term));
    return titleMatch || tagMatch;
  });

  const credentialCount = items.filter(i => i.category === 'credential').length;
  const documentCount = items.filter(i => i.category === 'document').length;
  const messageCount = items.filter(i => i.category === 'message').length;

  return (
    <div className="container py-4">
      {/* Top Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h2 className="fw-bold text-white mb-0">Personal Vault</h2>
            <span className="vault-badge vault-badge-secure">Zero-Knowledge</span>
          </div>
          <p className="text-muted small mb-0">
            Encrypted client-side with AES-256-GCM. Unsealed locally in your browser session.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-vault-outline d-flex align-items-center gap-1"
            onClick={refresh}
            disabled={loading}
            title="Refresh vault"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span className="d-none d-sm-inline">Sync</span>
          </button>
          <button
            type="button"
            className="btn btn-vault-primary d-flex align-items-center gap-2"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus size={18} /> Add Vault Item
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-3">
          <div className="vault-card p-3 d-flex align-items-center gap-3">
            <div className="p-2 rounded bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25">
              <Shield size={20} />
            </div>
            <div>
              <div className="fs-5 fw-bold text-white">{items.length}</div>
              <div className="text-muted small">Total Vault Entries</div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="vault-card p-3 d-flex align-items-center gap-3">
            <div className="p-2 rounded bg-info bg-opacity-10 text-info border border-info border-opacity-25">
              <Lock size={20} />
            </div>
            <div>
              <div className="fs-5 fw-bold text-white">{credentialCount}</div>
              <div className="text-muted small">Credentials & Passwords</div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="vault-card p-3 d-flex align-items-center gap-3">
            <div className="p-2 rounded bg-success bg-opacity-10 text-success border border-success border-opacity-25">
              <FileText size={20} />
            </div>
            <div>
              <div className="fs-5 fw-bold text-white">{documentCount}</div>
              <div className="text-muted small">Encrypted Documents</div>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="vault-card p-3 d-flex align-items-center gap-3">
            <div className="p-2 rounded bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25">
              <MessageSquare size={20} />
            </div>
            <div>
              <div className="fs-5 fw-bold text-white">{messageCount}</div>
              <div className="text-muted small">Confidential Messages</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="vault-card p-3 mb-4">
        <div className="row g-3 align-items-center">
          <div className="col-md-5 col-lg-6">
            <div className="input-group">
              <span className="input-group-text bg-dark border-secondary border-opacity-25 text-muted">
                <Search size={16} />
              </span>
              <input
                type="text"
                className="form-control form-control-vault"
                placeholder="Search encrypted items by title or tag..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="col-md-7 col-lg-6 d-flex align-items-center justify-content-md-end gap-2 overflow-auto">
            <button
              type="button"
              className={`btn btn-sm ${selectedCategory === '' ? 'btn-vault-primary' : 'btn-vault-outline'}`}
              onClick={() => setSelectedCategory('')}
            >
              All Categories
            </button>
            <button
              type="button"
              className={`btn btn-sm ${selectedCategory === 'credential' ? 'btn-vault-primary' : 'btn-vault-outline'}`}
              onClick={() => setSelectedCategory('credential')}
            >
              Credentials
            </button>
            <button
              type="button"
              className={`btn btn-sm ${selectedCategory === 'document' ? 'btn-vault-primary' : 'btn-vault-outline'}`}
              onClick={() => setSelectedCategory('document')}
            >
              Documents
            </button>
            <button
              type="button"
              className={`btn btn-sm ${selectedCategory === 'message' ? 'btn-vault-primary' : 'btn-vault-outline'}`}
              onClick={() => setSelectedCategory('message')}
            >
              Messages
            </button>
          </div>
        </div>
      </div>

      {/* Decrypting Status Pill */}
      {decrypting && (
        <div className="alert alert-info py-2 small d-flex align-items-center gap-2 mb-3">
          <div className="spinner-border spinner-border-sm" role="status"></div>
          <span>Unwrapping RSA-OAEP keys & decrypting AES-256-GCM ciphertexts in memory...</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="alert alert-danger py-2 small mb-3">
          {error}
        </div>
      )}

      {/* Item List */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading vault...</span>
          </div>
          <div className="text-muted small mt-2">Retrieving encrypted vault items...</div>
        </div>
      ) : filteredItems.length > 0 ? (
        <div>
          {filteredItems.map(item => (
            <VaultCard key={item._id} item={item} onDelete={deleteEntry} onDownloadFile={downloadAndDecryptFile} />
          ))}
        </div>
      ) : (
        <div className="vault-card p-5 text-center my-4">
          <div className="p-3 rounded-circle bg-dark border border-secondary border-opacity-25 d-inline-flex mb-3 text-muted">
            <Lock size={32} />
          </div>
          <h4 className="fw-semibold text-white mb-2">No Vault Entries Found</h4>
          <p className="text-muted small mx-auto mb-4" style={{ maxWidth: '440px' }}>
            {searchTerm || selectedCategory
              ? 'No items match your active search or category filters.'
              : 'Your vault is currently empty. Store your first password, property deed reference, or private legacy message.'}
          </p>
          <button
            type="button"
            className="btn btn-vault-primary d-inline-flex align-items-center gap-2"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus size={16} /> Add First Vault Entry
          </button>
        </div>
      )}

      {/* Add Entry Modal */}
      <AddEntryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={createEntry}
      />
    </div>
  );
}
