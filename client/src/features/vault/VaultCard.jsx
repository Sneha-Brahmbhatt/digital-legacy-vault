import React, { useState } from 'react';
import { Lock, FileText, MessageSquare, Eye, EyeOff, Copy, Check, Trash2, Key, Tag, Calendar, Download, FileCheck, Loader2 } from 'lucide-react';

export default function VaultCard({ item, onDelete, onDownloadFile }) {
  const [expanded, setExpanded] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const getCategoryIcon = () => {
    switch (item.category) {
      case 'credential': return <Lock size={16} className="text-primary" />;
      case 'document': return <FileText size={16} className="text-info" />;
      case 'message': return <MessageSquare size={16} className="text-warning" />;
      default: return <Key size={16} className="text-secondary" />;
    }
  };

  const getCategoryBadgeClass = () => {
    switch (item.category) {
      case 'credential': return 'vault-badge-secure';
      case 'document': return 'vault-badge-trustee';
      case 'message': return 'vault-badge-pending';
      default: return 'bg-secondary';
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to permanently delete "${item.title || 'this entry'}"?`)) {
      setDeleting(true);
      try {
        await onDelete(item._id);
      } catch (err) {
        alert(err.message || 'Failed to delete entry');
      } finally {
        setDeleting(false);
      }
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await onDownloadFile(item);
    } catch (err) {
      alert(err.message || 'Failed to download and decrypt document.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="vault-card mb-3 p-3 p-md-4">
      <div className="d-flex align-items-start justify-content-between gap-3">
        <div className="d-flex align-items-center gap-3">
          <div className="p-2 rounded bg-dark border border-secondary border-opacity-25">
            {getCategoryIcon()}
          </div>
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <h5 className="mb-0 fw-semibold text-white">
                {item.title || <span className="text-muted fst-italic">Untitled</span>}
              </h5>
              <span className={`vault-badge ${getCategoryBadgeClass()} text-capitalize`}>
                {item.category}
              </span>
              {item.isDecrypted && (
                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 small py-0">
                  Decrypted
                </span>
              )}
              {item.fileMetadata?.storageId && (
                <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 small py-0">
                  Encrypted File Attached
                </span>
              )}
            </div>
            <div className="text-muted small d-flex align-items-center gap-3">
              <span className="d-flex align-items-center gap-1">
                <Calendar size={13} /> {new Date(item.createdAt).toLocaleDateString()}
              </span>
              {item.tags?.length > 0 && (
                <span className="d-flex align-items-center gap-1">
                  <Tag size={13} /> {item.tags.join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-vault-outline"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Collapse' : 'Inspect'}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-vault-danger"
            onClick={handleDelete}
            disabled={deleting}
            title="Delete entry"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Expanded Decrypted Details */}
      {expanded && (
        <div className="mt-3 pt-3 border-top border-secondary border-opacity-25">
          {item.category === 'credential' && (
            <div className="row g-3">
              {item.payload?.username && (
                <div className="col-md-6">
                  <div className="text-muted small mb-1">Username / Identifier:</div>
                  <div className="d-flex align-items-center gap-2 p-2 rounded bg-dark border border-secondary border-opacity-25">
                    <span className="vault-mono text-white flex-grow-1">{item.payload.username}</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-vault-outline py-0 px-2"
                      onClick={() => copyToClipboard(item.payload.username)}
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
              )}

              {item.payload?.password && (
                <div className="col-md-6">
                  <div className="text-muted small mb-1">Decrypted Password:</div>
                  <div className="d-flex align-items-center gap-2 p-2 rounded bg-dark border border-secondary border-opacity-25">
                    <span className="vault-mono text-white flex-grow-1">
                      {showSecret ? item.payload.password : '••••••••••••••••'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-vault-outline py-0 px-2"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-vault-outline py-0 px-2"
                      onClick={() => copyToClipboard(item.payload.password)}
                    >
                      {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              )}

              {item.payload?.url && (
                <div className="col-12">
                  <div className="text-muted small mb-1">Service URL:</div>
                  <a href={item.payload.url} target="_blank" rel="noopener noreferrer" className="text-primary small text-decoration-none">
                    {item.payload.url}
                  </a>
                </div>
              )}
            </div>
          )}

          {item.category === 'document' && (
            <div>
              {item.payload?.docContent && (
                <div className="mb-3">
                  <div className="text-muted small mb-1">Document Text / Summary:</div>
                  <div className="p-3 rounded bg-dark border border-secondary border-opacity-25 vault-mono text-white small whitespace-pre-wrap">
                    {item.payload.docContent}
                  </div>
                </div>
              )}

              {/* Encrypted Document File Attachment */}
              {item.fileMetadata?.storageId && (
                <div className="p-3 rounded bg-dark border border-info border-opacity-25 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3 mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <FileCheck size={20} className="text-info" />
                    <div>
                      <div className="text-white small fw-medium">
                        {item.fileMetadata.fileName || 'Encrypted Confidential File'}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                        Size: {(item.fileMetadata.size / 1024).toFixed(1)} KB | Encrypted: AES-256-GCM
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-vault-primary d-flex align-items-center gap-2"
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    {downloading ? (
                      <>
                        <Loader2 size={14} className="spin" /> Decrypting in Browser...
                      </>
                    ) : (
                      <>
                        <Download size={14} /> Decrypt & Download
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {item.category === 'message' && (
            <div>
              {item.payload?.recipient && (
                <div className="mb-2">
                  <span className="text-muted small">Intended For: </span>
                  <span className="text-white small fw-medium">{item.payload.recipient}</span>
                </div>
              )}
              <div className="text-muted small mb-1">Confidential Message:</div>
              <div className="p-3 rounded bg-dark border border-secondary border-opacity-25 text-white small whitespace-pre-wrap">
                {item.payload?.messageBody || 'Empty message.'}
              </div>
            </div>
          )}

          {item.payload?.notes && (
            <div className="mt-2 text-muted small">
              <strong>Notes:</strong> {item.payload.notes}
            </div>
          )}

          {/* Cryptographic Proof Pill */}
          <div className="mt-3 pt-2 d-flex align-items-center justify-content-between text-muted small border-top border-secondary border-opacity-10">
            <span className="d-flex align-items-center gap-1 font-monospace" style={{ fontSize: '0.75rem' }}>
              IV: {item.dataIv?.slice(0, 16)}... | DEK: RSA-OAEP Wrapped
            </span>
            <span className="badge bg-secondary bg-opacity-25 text-muted font-monospace" style={{ fontSize: '0.75rem' }}>
              AES-GCM Authenticated
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
