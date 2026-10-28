import React, { useState } from 'react';
import { Lock, FileText, MessageSquare, Shield, X, Eye, EyeOff, Plus, AlertCircle } from 'lucide-react';

export default function AddEntryModal({ isOpen, onClose, onSave }) {
  const [category, setCategory] = useState('credential');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Credential fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Document fields
  const [docContent, setDocContent] = useState('');

  // Message fields
  const [recipient, setRecipient] = useState('');
  const [messageBody, setMessageBody] = useState('');

  // General notes
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      let payload = { notes };

      if (category === 'credential') {
        payload = { ...payload, username, password, url };
      } else if (category === 'document') {
        payload = { ...payload, docContent };
      } else if (category === 'message') {
        payload = { ...payload, recipient, messageBody };
      }

      const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);

      await onSave({
        category,
        title,
        payload,
        tags: parsedTags
      });

      // Reset and close
      setTitle('');
      setUsername('');
      setPassword('');
      setUrl('');
      setDocContent('');
      setRecipient('');
      setMessageBody('');
      setNotes('');
      setTags('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to encrypt and store entry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content vault-card border-secondary text-white">
          <div className="modal-header border-secondary border-opacity-25 pb-3">
            <h5 className="modal-title d-flex align-items-center gap-2 fs-5 fw-semibold">
              <Shield size={20} className="text-primary" />
              Add Encrypted Vault Entry
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} disabled={submitting}></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body py-4">
              {error && (
                <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small mb-4">
                  <AlertCircle size={16} />
                  <div>{error}</div>
                </div>
              )}

              {/* Category Selection Tabs */}
              <div className="mb-4">
                <label className="form-label text-muted small fw-medium">Entry Category</label>
                <div className="row g-2">
                  <div className="col-4">
                    <button
                      type="button"
                      className={`btn w-100 py-2 d-flex flex-column align-items-center gap-1 ${category === 'credential' ? 'btn-vault-primary' : 'btn-vault-outline'}`}
                      onClick={() => setCategory('credential')}
                    >
                      <Lock size={18} />
                      <span className="small">Password / Credential</span>
                    </button>
                  </div>
                  <div className="col-4">
                    <button
                      type="button"
                      className={`btn w-100 py-2 d-flex flex-column align-items-center gap-1 ${category === 'document' ? 'btn-vault-primary' : 'btn-vault-outline'}`}
                      onClick={() => setCategory('document')}
                    >
                      <FileText size={18} />
                      <span className="small">Document / Legal</span>
                    </button>
                  </div>
                  <div className="col-4">
                    <button
                      type="button"
                      className={`btn w-100 py-2 d-flex flex-column align-items-center gap-1 ${category === 'message' ? 'btn-vault-primary' : 'btn-vault-outline'}`}
                      onClick={() => setCategory('message')}
                    >
                      <MessageSquare size={18} />
                      <span className="small">Private Message</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Title Input */}
              <div className="mb-3">
                <label className="form-label text-muted small fw-medium">Entry Title / Label</label>
                <input
                  type="text"
                  className="form-control form-control-vault w-100"
                  placeholder={category === 'credential' ? 'e.g. Primary Banking Vault, Google Account' : category === 'document' ? 'e.g. Property Deed Summary, Insurance Policy' : 'e.g. Letter to Children, Final Wishes'}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              {/* Credential specific inputs */}
              {category === 'credential' && (
                <>
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label text-muted small fw-medium">Username / Login ID</label>
                      <input
                        type="text"
                        className="form-control form-control-vault w-100"
                        placeholder="user@example.com"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-muted small fw-medium">Password / Secret Key</label>
                      <div className="input-group">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="form-control form-control-vault"
                          placeholder="Secret password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-vault-outline"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label text-muted small fw-medium">Service URL / Website</label>
                    <input
                      type="url"
                      className="form-control form-control-vault w-100"
                      placeholder="https://service.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* Document specific inputs */}
              {category === 'document' && (
                <div className="mb-3">
                  <label className="form-label text-muted small fw-medium">Encrypted Document Body / Legal Clauses</label>
                  <textarea
                    rows={5}
                    className="form-control form-control-vault w-100"
                    placeholder="Enter sensitive document details, recovery codes, or safe locker combinations..."
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Message specific inputs */}
              {category === 'message' && (
                <>
                  <div className="mb-3">
                    <label className="form-label text-muted small fw-medium">Intended Recipient / Instructions</label>
                    <input
                      type="text"
                      className="form-control form-control-vault w-100"
                      placeholder="e.g. My spouse, eldest child, attorney"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label text-muted small fw-medium">Confidential Message</label>
                    <textarea
                      rows={5}
                      className="form-control form-control-vault w-100"
                      placeholder="Write your private message here. This will only be decipherable by you and the designated trustee upon approved release..."
                      value={messageBody}
                      onChange={(e) => setMessageBody(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              {/* Notes & Tags */}
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label text-muted small fw-medium">Tags (comma-separated)</label>
                  <input
                    type="text"
                    className="form-control form-control-vault w-100"
                    placeholder="financial, urgent, personal"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label text-muted small fw-medium">Additional Notes (Optional)</label>
                  <input
                    type="text"
                    className="form-control form-control-vault w-100"
                    placeholder="Optional hints or instructions"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="p-3 rounded bg-dark border border-secondary border-opacity-25 small text-muted d-flex align-items-center gap-2">
                <Shield size={16} className="text-success flex-shrink-0" />
                <span>
                  <strong>Zero-Knowledge Assurance:</strong> Data will be encrypted in your browser using AES-256-GCM before transmission. The server receives only ciphertext.
                </span>
              </div>
            </div>

            <div className="modal-footer border-secondary border-opacity-25 pt-3">
              <button type="button" className="btn btn-vault-outline" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-vault-primary d-flex align-items-center gap-2" disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    Encrypting & Saving...
                  </>
                ) : (
                  <>
                    <Plus size={16} /> Encrypt & Save to Vault
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
