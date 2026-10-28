import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, AlertCircle, Key } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext.jsx';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      navigate('/vault');
    } catch (err) {
      setError(err.message || 'Failed to authenticate. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-5 d-flex justify-content-center align-items-center" style={{ minHeight: '75vh' }}>
      <div className="vault-card p-4 p-md-5 w-100 shadow-lg" style={{ maxWidth: '480px' }}>
        <div className="text-center mb-4">
          <div className="p-3 rounded-circle bg-primary bg-opacity-10 text-primary d-inline-flex mb-3 border border-primary border-opacity-25">
            <Shield size={32} />
          </div>
          <h3 className="fw-bold text-white mb-1">Access Your Vault</h3>
          <p className="text-muted small">
            Zero-knowledge authentication. Your password unseals your cryptographic keys directly in your browser.
          </p>
        </div>

        {error && (
          <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small mb-4" role="alert">
            <AlertCircle size={16} className="flex-shrink-0" />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label text-muted small fw-medium d-flex align-items-center gap-1">
              <Mail size={14} /> Email Address
            </label>
            <input 
              type="email" 
              className="form-control form-control-vault w-100" 
              placeholder="owner@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
              autoFocus
            />
          </div>

          <div className="mb-4">
            <label className="form-label text-muted small fw-medium d-flex align-items-center gap-1">
              <Lock size={14} /> Password / Master Passphrase
            </label>
            <input 
              type="password" 
              className="form-control form-control-vault w-100" 
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-vault-primary w-100 py-2 d-flex align-items-center justify-content-center gap-2 mb-3"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Unsealing Keys & Authenticating...
              </>
            ) : (
              <>
                Unlock Vault <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-3 border-top border-secondary border-opacity-25 text-muted small">
          Don't have a secure vault yet?{' '}
          <Link to="/register" className="text-primary text-decoration-none fw-medium">
            Register Account
          </Link>
        </div>
      </div>
    </div>
  );
}
