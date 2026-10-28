import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, KeyRound, UserCheck, AlertTriangle, CheckCircle2, ArrowRight, Activity, Database, Lock } from 'lucide-react';
import { checkHealth } from '../services/api';

export default function LandingPage() {
  const [healthStatus, setHealthStatus] = useState({ loading: true, healthy: false, data: null });

  useEffect(() => {
    checkHealth()
      .then(res => setHealthStatus({ loading: false, healthy: true, data: res }))
      .catch(err => setHealthStatus({ loading: false, healthy: false, error: err.message }));
  }, []);

  return (
    <div className="vault-glow-bg container py-5">
      {/* Backend Connectivity Status Pill */}
      <div className="d-flex justify-content-center mb-4">
        <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill vault-card border border-secondary border-opacity-25 shadow-sm">
          <Activity size={14} className={healthStatus.healthy ? 'text-success' : 'text-warning'} />
          <span className="small text-muted">Backend Service Status:</span>
          {healthStatus.loading ? (
            <span className="small text-secondary">Probing /api/health...</span>
          ) : healthStatus.healthy ? (
            <span className="small text-success fw-medium d-flex align-items-center gap-1">
              <CheckCircle2 size={13} /> Online ({healthStatus.data?.environment} mode)
            </span>
          ) : (
            <span className="small text-warning fw-medium">Standby Mode</span>
          )}
        </div>
      </div>

      {/* Hero Section */}
      <div className="text-center py-4 mb-5">
        <div className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-3 py-2 rounded-pill mb-3">
          Zero-Knowledge Digital Will & Asset Custody
        </div>
        <h1 className="display-4 fw-bold text-white mb-3 tracking-tight">
          Protect Your Digital Legacy.<br />
          <span className="text-transparent bg-clip-text bg-gradient text-primary">Released Only When You Decide.</span>
        </h1>
        <p className="lead text-muted mx-auto mb-4" style={{ maxWidth: '720px' }}>
          Secure passwords, estate documents, and private instructions using client-side AES-256 encryption. 
          Released to verified trustees through an auditable trustee-initiated workflow backed by an inviolable owner grace period.
        </p>
        <div className="d-flex justify-content-center gap-3">
          <Link to="/register" className="btn btn-vault-primary btn-lg px-4 d-flex align-items-center gap-2">
            Create Your Vault <ArrowRight size={18} />
          </Link>
          <Link to="/login" className="btn btn-vault-outline btn-lg px-4">
            Access Existing Vault
          </Link>
        </div>
      </div>

      {/* 4 Core Architectural Pillars */}
      <div className="row g-4 mb-5">
        <div className="col-md-6 col-lg-3">
          <div className="vault-card p-4 h-100">
            <div className="p-3 rounded bg-primary bg-opacity-10 text-primary d-inline-block mb-3 border border-primary border-opacity-25">
              <Lock size={24} />
            </div>
            <h5 className="fw-semibold text-white mb-2">Zero-Knowledge AES-256</h5>
            <p className="text-muted small mb-0">
              Vault entries are encrypted in your browser using AES-256-GCM before transmission. The server never sees plaintext keys or credentials.
            </p>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="vault-card p-4 h-100">
            <div className="p-3 rounded bg-info bg-opacity-10 text-info d-inline-block mb-3 border border-info border-opacity-25">
              <UserCheck size={24} />
            </div>
            <h5 className="fw-semibold text-white mb-2">Trustee Assignment</h5>
            <p className="text-muted small mb-0">
              Designate specific trustees and map item-level permissions. Keys are wrapped using asymmetric RSA-OAEP for end-to-end delegation.
            </p>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="vault-card p-4 h-100">
            <div className="p-3 rounded bg-warning bg-opacity-10 text-warning d-inline-block mb-3 border border-warning border-opacity-25">
              <AlertTriangle size={24} />
            </div>
            <h5 className="fw-semibold text-white mb-2">48h Inviolable Grace Period</h5>
            <p className="text-muted small mb-0">
              Trustee-initiated release triggers immediate alerts to the owner. The owner maintains full veto authority throughout the 48-hour window.
            </p>
          </div>
        </div>

        <div className="col-md-6 col-lg-3">
          <div className="vault-card p-4 h-100">
            <div className="p-3 rounded bg-success bg-opacity-10 text-success d-inline-block mb-3 border border-success border-opacity-25">
              <Database size={24} />
            </div>
            <h5 className="fw-semibold text-white mb-2">Immutable Audit Trail</h5>
            <p className="text-muted small mb-0">
              Every request, OTP verification, cancellation, and release attempt is logged with tamper-resistant audit stamps for complete dispute resolution.
            </p>
          </div>
        </div>
      </div>

      {/* Security Verification Table */}
      <div className="vault-card p-4 mb-4">
        <h5 className="fw-semibold text-white mb-3 d-flex align-items-center gap-2">
          <Shield size={20} className="text-primary" />
          Canonical Release Flow Verification (Practical 1 Specification)
        </h5>
        <div className="table-responsive">
          <table className="table table-dark table-hover mb-0 align-middle">
            <thead>
              <tr className="border-secondary text-muted small">
                <th>Stage</th>
                <th>Trigger Event</th>
                <th>Security Control</th>
                <th>Server State Invariant</th>
              </tr>
            </thead>
            <tbody className="small">
              <tr>
                <td className="fw-medium text-white">1. Initiation</td>
                <td>Designated Trustee initiates release request</td>
                <td>Trustee Identity Challenge + Email OTP</td>
                <td><span className="badge bg-secondary">awaiting_verification</span></td>
              </tr>
              <tr>
                <td className="fw-medium text-white">2. Grace Period</td>
                <td>OTP verification successful</td>
                <td>Immediate Owner Notification (Email)</td>
                <td><span className="badge bg-warning text-dark">pending (48h countdown)</span></td>
              </tr>
              <tr>
                <td className="fw-medium text-white">3. Owner Veto</td>
                <td>Owner cancels at any point in grace period</td>
                <td>Atomic cancellation update</td>
                <td><span className="badge bg-danger">cancelled (Terminal)</span></td>
              </tr>
              <tr>
                <td className="fw-medium text-white">4. Expiry & Release</td>
                <td>Grace period elapses without cancellation</td>
                <td>Persistent worker verification + wrapped key handover</td>
                <td><span className="badge bg-success">released (Decryption on Client)</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
