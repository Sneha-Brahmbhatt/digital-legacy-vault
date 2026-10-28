import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, Lock, Users, Clock, FileText, LogOut, User } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext.jsx';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="vault-navbar py-3 px-4 mb-4">
      <div className="container-fluid d-flex align-items-center justify-content-between">
        <Link to="/" className="text-decoration-none d-flex align-items-center gap-2">
          <div className="p-2 rounded bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25">
            <Shield size={22} className="text-primary" />
          </div>
          <div>
            <span className="fw-bold fs-5 text-white tracking-wide">Digital Legacy Vault</span>
            <span className="vault-badge vault-badge-secure ms-2 py-0 px-2">AES-256</span>
          </div>
        </Link>

        <div className="d-flex align-items-center gap-3">
          <Link 
            to="/" 
            className={`btn btn-sm ${location.pathname === '/' ? 'btn-vault-primary' : 'btn-vault-outline'}`}
          >
            Overview
          </Link>

          {isAuthenticated && (
            <>
              <Link 
                to="/vault" 
                className={`btn btn-sm ${location.pathname === '/vault' ? 'btn-vault-primary' : 'btn-vault-outline'} d-flex align-items-center gap-1`}
              >
                <Lock size={15} /> Vault
              </Link>
              <Link 
                to="/trustees" 
                className={`btn btn-sm ${location.pathname === '/trustees' ? 'btn-vault-primary' : 'btn-vault-outline'} d-flex align-items-center gap-1`}
              >
                <Users size={15} /> Trustees
              </Link>
            </>
          )}

          <Link 
            to="/release" 
            className={`btn btn-sm ${location.pathname === '/release' ? 'btn-vault-primary' : 'btn-vault-outline'} d-flex align-items-center gap-1`}
          >
            <Clock size={15} /> Release Engine
          </Link>

          {isAuthenticated && (
            <Link 
              to="/audit" 
              className={`btn btn-sm ${location.pathname === '/audit' ? 'btn-vault-primary' : 'btn-vault-outline'} d-flex align-items-center gap-1`}
            >
              <FileText size={15} /> Audit Log
            </Link>
          )}
          
          <div className="vr bg-secondary opacity-50 mx-1"></div>

          {isAuthenticated ? (
            <div className="d-flex align-items-center gap-2">
              <span className="vault-badge vault-badge-trustee d-none d-md-inline-flex">
                <User size={12} /> {user?.name} ({user?.role})
              </span>
              <button 
                onClick={handleLogout} 
                className="btn btn-sm btn-vault-outline text-danger d-flex align-items-center gap-1"
                title="Sign out of vault"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          ) : (
            <div className="d-flex align-items-center gap-2">
              <Link to="/login" className="btn btn-sm btn-vault-outline">
                Sign In
              </Link>
              <Link to="/register" className="btn btn-sm btn-vault-primary">
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
