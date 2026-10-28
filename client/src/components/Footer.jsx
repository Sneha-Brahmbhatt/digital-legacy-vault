import React from 'react';
import { ShieldCheck, Lock, Terminal } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-auto py-4 border-top border-dark text-muted" style={{ borderColor: 'var(--vault-border)' }}>
      <div className="container-fluid px-4 d-flex flex-column flex-md-row align-items-center justify-content-between gap-3 text-secondary small">
        <div className="d-flex align-items-center gap-2">
          <ShieldCheck size={16} className="text-success" />
          <span>Zero-Knowledge Architecture: Client-Side AES-256-GCM + Asymmetric RSA-OAEP Key Wrapping</span>
        </div>
        
        <div className="d-flex align-items-center gap-4">
          <span className="d-flex align-items-center gap-1">
            <Lock size={14} className="text-primary" /> Server Plaintext Invariant: Verified
          </span>
          <span className="d-flex align-items-center gap-1 vault-mono text-muted">
            <Terminal size={14} /> BTCS502 — GSFC University
          </span>
          <span>© 2026 Sneha Brahmbhatt (24BT04011)</span>
        </div>
      </div>
    </footer>
  );
}
