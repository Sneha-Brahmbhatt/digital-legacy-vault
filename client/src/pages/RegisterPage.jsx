import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, User, Clock, ArrowRight, AlertCircle, KeyRound, Check } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext.jsx';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'owner',
    gracePeriodHours: 48
  });
  const [error, setError] = useState(null);
  const [generatingKeys, setGeneratingKeys] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setGeneratingKeys(true);

    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        gracePeriodHours: parseInt(formData.gracePeriodHours, 10) || 48
      });
      navigate('/vault');
    } catch (err) {
      setError(err.message || 'Registration failed. Please review your details.');
    } finally {
      setGeneratingKeys(false);
    }
  };

  return (
    <div className="container py-5 d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
      <div className="vault-card p-4 p-md-5 w-100 shadow-lg" style={{ maxWidth: '540px' }}>
        <div className="text-center mb-4">
          <div className="p-3 rounded-circle bg-primary bg-opacity-10 text-primary d-inline-flex mb-3 border border-primary border-opacity-25">
            <KeyRound size={32} />
          </div>
          <h3 className="fw-bold text-white mb-1">Create Secure Vault Account</h3>
          <p className="text-muted small">
            Your browser will generate an RSA-OAEP 2048-bit keypair for zero-knowledge encryption before submitting.
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
              <User size={14} /> Full Legal Name
            </label>
            <input 
              type="text" 
              name="name"
              className="form-control form-control-vault w-100" 
              placeholder="Sneha Brahmbhatt"
              value={formData.name}
              onChange={handleChange}
              required 
            />
          </div>

          <div className="mb-3">
            <label className="form-label text-muted small fw-medium d-flex align-items-center gap-1">
              <Mail size={14} /> Email Address
            </label>
            <input 
              type="email" 
              name="email"
              className="form-control form-control-vault w-100" 
              placeholder="name@example.com"
              value={formData.email}
              onChange={handleChange}
              required 
            />
          </div>

          <div className="mb-3">
            <label className="form-label text-muted small fw-medium d-flex align-items-center gap-1">
              <Lock size={14} /> Master Password (Min 8 characters)
            </label>
            <input 
              type="password" 
              name="password"
              className="form-control form-control-vault w-100" 
              placeholder="••••••••••••"
              value={formData.password}
              onChange={handleChange}
              minLength={8}
              required 
            />
          </div>

          <div className="row g-3 mb-4">
            <div className="col-sm-6">
              <label className="form-label text-muted small fw-medium d-flex align-items-center gap-1">
                Account Role
              </label>
              <select 
                name="role" 
                className="form-select form-control-vault"
                value={formData.role}
                onChange={handleChange}
              >
                <option value="owner">Vault Owner</option>
                <option value="trustee">Designated Trustee</option>
                <option value="both">Both (Owner & Trustee)</option>
              </select>
            </div>

            <div className="col-sm-6">
              <label className="form-label text-muted small fw-medium d-flex align-items-center gap-1">
                <Clock size={14} /> Grace Period
              </label>
              <select 
                name="gracePeriodHours" 
                className="form-select form-control-vault"
                value={formData.gracePeriodHours}
                onChange={handleChange}
              >
                <option value={24}>24 Hours (1 Day)</option>
                <option value={48}>48 Hours (2 Days — Canonical)</option>
                <option value={72}>72 Hours (3 Days)</option>
                <option value={168}>168 Hours (7 Days)</option>
              </select>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-vault-primary w-100 py-2 d-flex align-items-center justify-content-center gap-2 mb-3"
            disabled={generatingKeys}
          >
            {generatingKeys ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Generating Web Crypto Keys & Registering...
              </>
            ) : (
              <>
                Generate Keys & Create Vault <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-3 border-top border-secondary border-opacity-25 text-muted small">
          Already have an account?{' '}
          <Link to="/login" className="text-primary text-decoration-none fw-medium">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
