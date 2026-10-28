/**
 * ReleasePortal.jsx
 *
 * Trustee-facing page. Two-step flow:
 *   Step 1 — Trustee selects the vault owner and clicks "Initiate Release"
 *   Step 2 — Trustee enters the OTP received by email
 *
 * After OTP verified → shows confirmation with grace-period countdown.
 * After release is in `released` state → shows download button for the released vault.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Clock, CheckCircle, AlertTriangle, Mail, Key } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext.jsx';
import apiClient from '../services/api.js';

// Countdown display helper
function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const diff = new Date(expiresAt) - Date.now();
      if (diff <= 0) { setRemaining('Expired'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}h ${m}m ${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return remaining;
}

export default function ReleasePortal() {
  const { user } = useAuth();

  // Active request from server
  const [activeRequest, setActiveRequest] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Step 1 — Initiation
  const [ownerId, setOwnerId] = useState('');
  const [designations, setDesignations] = useState([]);
  const [initiating, setInitiating] = useState(false);
  const [requestId, setRequestId] = useState(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState(null);

  // Step 2 — OTP
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [gracePeriodExpiresAt, setGracePeriodExpiresAt] = useState(null);

  // Released vault
  const [releasedItems, setReleasedItems] = useState(null);
  const [loadingVault, setLoadingVault] = useState(false);

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const gracePeriodCountdown = useCountdown(gracePeriodExpiresAt);

  // Load designations (vaults this trustee is assigned to)
  useEffect(() => {
    apiClient.get('/trustees/designated')
      .then(r => setDesignations(r.data.data || []))
      .catch(() => {});
  }, []);

  // Check for any active request on mount
  const fetchActiveStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const r = await apiClient.get('/release/active-status');
      setActiveRequest(r.data.data);
      if (r.data.data?.status === 'pending') {
        setVerified(true);
        setGracePeriodExpiresAt(r.data.data.gracePeriodExpiresAt);
        setRequestId(r.data.data._id);
      }
      if (r.data.data?.status === 'awaiting_verification') {
        setRequestId(r.data.data._id);
        setOtpExpiresAt(r.data.data.otpExpiresAt);
      }
    } catch {
      setActiveRequest(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => { fetchActiveStatus(); }, [fetchActiveStatus]);

  // Step 1: Initiate release
  const handleInitiate = async (e) => {
    e.preventDefault();
    if (!ownerId) return;
    setError(''); setInfo('');
    setInitiating(true);
    try {
      const r = await apiClient.post('/release/initiate', { ownerId });
      setRequestId(r.data.data.requestId);
      setOtpExpiresAt(r.data.data.otpExpiresAt);
      setInfo('A 6-digit verification code has been sent to your email. Enter it below.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to initiate release.');
    } finally {
      setInitiating(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) { setError('Please enter the 6-digit code.'); return; }
    setError(''); setInfo('');
    setVerifying(true);
    try {
      const r = await apiClient.post('/release/verify-otp', { requestId, otp });
      setVerified(true);
      setGracePeriodExpiresAt(r.data.data.gracePeriodExpiresAt);
      setInfo('');
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  // Fetch released vault items
  const handleFetchReleasedVault = async () => {
    setLoadingVault(true); setError('');
    try {
      const r = await apiClient.get(`/release/released-vault?requestId=${requestId}`);
      setReleasedItems(r.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not retrieve released vault.');
    } finally {
      setLoadingVault(false);
    }
  };

  if (loadingStatus) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" />
        <p className="text-muted mt-3">Loading release status…</p>
      </div>
    );
  }

  return (
    <div className="container py-5" style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div className="vault-card p-4">

        {/* Header */}
        <div className="d-flex align-items-center gap-3 mb-4">
          <div className="p-2 rounded-circle bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25">
            <Shield size={28} />
          </div>
          <div>
            <h4 className="fw-bold text-white mb-0">Release Portal</h4>
            <p className="text-muted small mb-0">Trustee-initiated legacy access</p>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger d-flex align-items-center gap-2 py-2">
            <AlertTriangle size={16} />{error}
          </div>
        )}
        {info && (
          <div className="alert alert-info d-flex align-items-center gap-2 py-2">
            <Mail size={16} />{info}
          </div>
        )}

        {/* ── RELEASED STATE ── */}
        {activeRequest?.status === 'released' && (
          <div>
            <div className="alert alert-success d-flex align-items-center gap-2">
              <CheckCircle size={18} />
              Release has been executed. You can now access the assigned vault items.
            </div>
            {!releasedItems && (
              <button className="btn btn-vault w-100" onClick={handleFetchReleasedVault} disabled={loadingVault}>
                {loadingVault ? <span className="spinner-border spinner-border-sm me-2" /> : <Key size={16} className="me-2" />}
                Load Released Items
              </button>
            )}
            {releasedItems && (
              <div className="mt-3">
                <h6 className="text-white mb-3">Released Items ({releasedItems.items?.length || 0})</h6>
                <div className="text-muted small">
                  <p>Items are encrypted with your RSA public key. Open each item in the vault to decrypt with your private key (unlocked at login).</p>
                </div>
                {(releasedItems.items || []).map((item, i) => (
                  <div key={i} className="vault-card p-3 mb-2">
                    <div className="d-flex justify-content-between">
                      <span className="badge bg-primary">{item.itemId?.category || 'item'}</span>
                      <span className="text-muted small">ID: {item.itemId?._id?.slice(-6)}</span>
                    </div>
                    <p className="text-muted small mt-2 mb-0">Encrypted content ready for client-side decryption.</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PENDING — OTP verified, grace period running ── */}
        {verified && !releasedItems && activeRequest?.status !== 'released' && (
          <div>
            <div className="alert alert-warning d-flex align-items-center gap-2">
              <Clock size={18} />
              Grace period is running. The vault owner has been notified and can cancel.
            </div>
            <div className="p-3 rounded" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <p className="text-muted small mb-1">Time remaining before auto-release:</p>
              <p className="fs-4 fw-bold text-warning mb-0">{gracePeriodCountdown || '…'}</p>
            </div>
            <p className="text-muted small mt-3">
              If the vault owner does not cancel this request, the release will happen automatically when the timer expires.
            </p>
          </div>
        )}

        {/* ── STEP 2 — OTP Entry ── */}
        {requestId && !verified && (
          <form onSubmit={handleVerifyOtp}>
            <h6 className="text-white mb-3">Step 2 — Enter Verification Code</h6>
            <p className="text-muted small mb-3">A 6-digit code was sent to your email address.</p>
            <div className="mb-3">
              <label className="form-label text-muted small">Verification Code</label>
              <input
                type="text"
                className="form-control vault-input text-center fs-4 fw-bold tracking-widest"
                maxLength={6}
                pattern="\d{6}"
                placeholder="000000"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                required
              />
              {otpExpiresAt && (
                <div className="form-text text-muted">Code expires: {new Date(otpExpiresAt).toLocaleTimeString()}</div>
              )}
            </div>
            <button className="btn btn-vault w-100" disabled={verifying}>
              {verifying ? <span className="spinner-border spinner-border-sm me-2" /> : <Shield size={16} className="me-2" />}
              Verify Identity
            </button>
          </form>
        )}

        {/* ── STEP 1 — Initiation form ── */}
        {!requestId && activeRequest?.status !== 'released' && (
          <form onSubmit={handleInitiate}>
            <h6 className="text-white mb-3">Step 1 — Initiate Release Request</h6>
            <p className="text-muted small mb-3">
              Select the vault owner whose legacy you are authorized to release. 
              A verification code will be sent to your registered email address.
            </p>
            <div className="mb-3">
              <label className="form-label text-muted small">Vault Owner</label>
              {designations.length === 0 ? (
                <div className="alert alert-secondary py-2">
                  You are not currently designated as a trustee for any vault.
                </div>
              ) : (
                <select
                  className="form-select vault-input"
                  value={ownerId}
                  onChange={e => setOwnerId(e.target.value)}
                  required
                >
                  <option value="">— Select vault owner —</option>
                  {designations.map(d => (
                    <option key={d.ownerId?._id} value={d.ownerId?._id}>
                      {d.ownerId?.name} ({d.ownerId?.email})
                    </option>
                  ))}
                </select>
              )}
            </div>
            {designations.length > 0 && (
              <button className="btn btn-vault w-100" disabled={initiating || !ownerId}>
                {initiating ? <span className="spinner-border spinner-border-sm me-2" /> : <Shield size={16} className="me-2" />}
                Send Verification Code
              </button>
            )}
            <div className="mt-3 p-3 rounded" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <p className="text-muted small mb-0">
                <strong className="text-white">What happens next:</strong> After verifying your identity with a one-time code, 
                a {'{'}grace period{'}'} begins during which the vault owner can cancel this request. 
                If not cancelled, the release executes automatically.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
