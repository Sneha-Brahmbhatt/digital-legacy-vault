/**
 * AuditPage.jsx
 *
 * Displays a paginated, read-only audit trail of all security-relevant
 * events associated with the authenticated user's account.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, ChevronLeft, ChevronRight, ShieldCheck, ShieldAlert, Info } from 'lucide-react';
import apiClient from '../services/api.js';

// Human-readable labels for audit action codes
const ACTION_LABELS = {
  AUTH_REGISTER: 'Account registered',
  AUTH_LOGIN: 'Signed in',
  AUTH_LOGOUT: 'Signed out',
  VAULT_ITEM_CREATE: 'Vault item created',
  VAULT_ITEM_UPDATE: 'Vault item updated',
  VAULT_ITEM_DELETE: 'Vault item deleted',
  TRUSTEE_ASSIGNED: 'Trustee designated',
  TRUSTEE_PERMISSIONS_UPDATED: 'Trustee permissions updated',
  TRUSTEE_REVOKED: 'Trustee revoked',
  RELEASE_INITIATED: 'Release request initiated',
  RELEASE_OTP_VERIFIED: 'Release OTP verified — grace period started',
  RELEASE_CANCELLED_BY_OWNER: 'Release cancelled by owner',
  RELEASE_AUTO_EXECUTED: 'Vault released (automatic)',
  UNAUTHORIZED_ACCESS_ATTEMPT: 'Unauthorized access attempt blocked',
};

function statusIcon(status) {
  if (status === 'success') return <ShieldCheck size={14} className="text-success" />;
  if (status === 'failure') return <ShieldAlert size={14} className="text-danger" />;
  return <Info size={14} className="text-info" />;
}

function statusBadge(status) {
  const map = { success: 'success', failure: 'danger', info: 'secondary' };
  return <span className={`badge bg-${map[status] || 'secondary'} rounded-pill`}>{status}</span>;
}

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLogs = useCallback(async (p) => {
    setLoading(true); setError('');
    try {
      const r = await apiClient.get(`/audit?page=${p}&limit=20`);
      setLogs(r.data.logs || []);
      setPage(r.data.page);
      setPages(r.data.pages);
      setTotal(r.data.total);
    } catch {
      setError('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(1); }, [fetchLogs]);

  return (
    <div className="container py-5" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="vault-card p-4">
        {/* Header */}
        <div className="d-flex align-items-center gap-3 mb-4">
          <div className="p-2 rounded-circle bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25">
            <FileText size={24} />
          </div>
          <div>
            <h4 className="fw-bold text-white mb-0">Audit Trail</h4>
            <p className="text-muted small mb-0">
              {total} event{total !== 1 ? 's' : ''} recorded — tamper-resistant log
            </p>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}

        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <FileText size={40} className="mb-3 opacity-25" />
            <p>No audit events recorded yet.</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table-dark table-hover table-sm align-middle mb-0" style={{ fontSize: '13px' }}>
                <thead>
                  <tr className="text-muted border-secondary">
                    <th className="py-2">Time</th>
                    <th className="py-2">Event</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 d-none d-md-table-cell">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log._id} className="border-secondary border-opacity-25">
                      <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          {statusIcon(log.status)}
                          <span className="text-white">
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                        </div>
                      </td>
                      <td>{statusBadge(log.status)}</td>
                      <td className="text-muted d-none d-md-table-cell">{log.ipAddress || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="d-flex align-items-center justify-content-between mt-3">
                <button
                  className="btn btn-vault-outline btn-sm"
                  onClick={() => fetchLogs(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <span className="text-muted small">Page {page} of {pages}</span>
                <button
                  className="btn btn-vault-outline btn-sm"
                  onClick={() => fetchLogs(page + 1)}
                  disabled={page >= pages}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
