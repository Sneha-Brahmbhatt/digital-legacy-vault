/**
 * ReleasePendingPage.jsx
 *
 * Owner-facing view. Shows when a trustee has an active pending release request.
 * Displays:
 *   - Who initiated the request
 *   - Real-time grace period countdown
 *   - Cancel button (owner veto)
 *   - Past release history
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, Clock, XCircle, CheckCircle, AlertTriangle, History } from 'lucide-react';
import apiClient from '../services/api.js';

function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const diff = new Date(expiresAt) - Date.now();
      if (diff <= 0) {
        setRemaining('Grace period expired');
        setExpired(true);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}h ${m}m ${s}s remaining`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return { remaining, expired };
}

export default function ReleasePendingPage() {
  const [activeRequest, setActiveRequest] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [error, setError] = useState('');

  const { remaining: countdown, expired } = useCountdown(activeRequest?.gracePeriodExpiresAt);

  const fetchStatus = useCallback(async () => {
    try {
      const [statusRes, histRes] = await Promise.all([
        apiClient.get('/release/active-status'),
        apiClient.get('/release/history'),
      ]);
      setActiveRequest(statusRes.data.data);
      setHistory(histRes.data.data || []);
    } catch {
      // silent — not critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleCancel = async () => {
    if (!activeRequest?._id) return;
    if (!window.confirm('Are you sure you want to cancel this release request? The trustee will need to restart the process.')) return;

    setCancelling(true); setError('');
    try {
      await apiClient.post('/release/cancel', { requestId: activeRequest._id });
      setCancelSuccess(true);
      setActiveRequest(null);
      fetchStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel release request.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" />
        <p className="text-muted mt-3">Checking release status…</p>
      </div>
    );
  }

  return (
    <div className="container py-5" style={{ maxWidth: '680px', margin: '0 auto' }}>
      {/* ── Active release alert ─────────────────────────────────────────── */}
      {activeRequest && activeRequest.status === 'pending' && (
        <div className="vault-card p-4 mb-4 border border-danger border-opacity-50">
          <div className="d-flex align-items-center gap-3 mb-3">
            <div className="p-2 rounded-circle bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25">
              <ShieldAlert size={28} />
            </div>
            <div>
              <h5 className="fw-bold text-danger mb-0">⚠️ Active Release Request</h5>
              <p className="text-muted small mb-0">Your vault may be released if you do not cancel</p>
            </div>
          </div>

          <div className="p-3 rounded mb-3" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="row g-2">
              <div className="col-sm-6">
                <p className="text-muted small mb-1">Initiated by trustee:</p>
                <p className="text-white fw-medium mb-0">
                  {activeRequest.trusteeId?.name || 'Unknown'} ({activeRequest.trusteeId?.email || 'N/A'})
                </p>
              </div>
              <div className="col-sm-6">
                <p className="text-muted small mb-1">Requested at:</p>
                <p className="text-white fw-medium mb-0">
                  {new Date(activeRequest.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="col-12 mt-2">
                <p className="text-muted small mb-1">Grace period expires:</p>
                <div className="d-flex align-items-center gap-2">
                  <Clock size={16} className={expired ? 'text-danger' : 'text-warning'} />
                  <span className={`fw-bold ${expired ? 'text-danger' : 'text-warning'}`}>{countdown}</span>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger py-2 d-flex align-items-center gap-2 mb-3">
              <AlertTriangle size={16} />{error}
            </div>
          )}

          {!expired ? (
            <button
              className="btn btn-danger w-100 fw-bold"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling
                ? <><span className="spinner-border spinner-border-sm me-2" />Cancelling…</>
                : <><XCircle size={16} className="me-2" />Cancel This Release Request</>
              }
            </button>
          ) : (
            <div className="alert alert-danger py-2 mb-0">
              <AlertTriangle size={16} className="me-2" />
              The grace period has expired. The release will be executed by the system shortly.
            </div>
          )}

          <p className="text-muted small mt-3 mb-0">
            If you did not expect this request, cancel it immediately and consider changing your vault password.
          </p>
        </div>
      )}

      {/* ── Cancel success banner ─────────────────────────────────────────── */}
      {cancelSuccess && (
        <div className="vault-card p-4 mb-4 border border-success border-opacity-50">
          <div className="d-flex align-items-center gap-3">
            <CheckCircle size={28} className="text-success" />
            <div>
              <h5 className="fw-bold text-success mb-1">Release Cancelled</h5>
              <p className="text-muted small mb-0">Your vault remains secure. A confirmation has been sent to your email.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── No active request ─────────────────────────────────────────────── */}
      {!activeRequest && !cancelSuccess && (
        <div className="vault-card p-4 mb-4 text-center">
          <CheckCircle size={40} className="text-success mb-3" />
          <h5 className="fw-bold text-white mb-2">No Active Release Request</h5>
          <p className="text-muted small">Your vault is secure. No trustee has initiated a release.</p>
        </div>
      )}

      {/* ── Release history ───────────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="vault-card p-4">
          <div className="d-flex align-items-center gap-2 mb-3">
            <History size={18} className="text-muted" />
            <h6 className="text-white mb-0">Release History</h6>
          </div>
          {history.map(req => (
            <div key={req._id} className="d-flex align-items-start justify-content-between py-2 border-bottom border-secondary border-opacity-25">
              <div>
                <p className="text-white small mb-0">{req.trusteeId?.name || req.trusteeId?.email || 'Trustee'}</p>
                <p className="text-muted" style={{ fontSize: '11px' }}>{new Date(req.createdAt).toLocaleString()}</p>
              </div>
              <span className={`badge rounded-pill ${
                req.status === 'cancelled' ? 'bg-secondary' :
                req.status === 'released' ? 'bg-success' : 'bg-danger'
              }`}>
                {req.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
