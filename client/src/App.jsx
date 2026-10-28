import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import VaultDashboard from './pages/VaultDashboard.jsx';
import { AuthProvider } from './features/auth/AuthContext.jsx';
import { Lock, Users, Clock, FileText } from 'lucide-react';

function PlaceholderPage({ title, description, icon: Icon, step }) {
  return (
    <div className="container py-5 text-center">
      <div className="vault-card p-5 mx-auto" style={{ maxWidth: '640px' }}>
        <div className="p-3 rounded-circle bg-primary bg-opacity-10 text-primary d-inline-flex mb-3 border border-primary border-opacity-25">
          <Icon size={36} />
        </div>
        <h3 className="fw-bold text-white mb-2">{title}</h3>
        <p className="text-muted mb-4">{description}</p>
        <div className="badge bg-secondary px-3 py-2 rounded-pill mb-4">
          Scheduled for implementation in {step}
        </div>
        <div>
          <Link to="/" className="btn btn-vault-outline btn-sm">
            ← Return to Overview
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <div className="d-flex flex-column min-vh-100">
        <Navbar />
        <main className="flex-grow-1">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/vault" element={<VaultDashboard />} />
            <Route 
              path="/trustees" 
              element={<PlaceholderPage title="Trustee Management" description="Designate trustees and encrypt item keys with trustee public keys." icon={Users} step="Step 5" />} 
            />
            <Route 
              path="/release" 
              element={<PlaceholderPage title="Release Workflow Engine" description="Trustee initiation, OTP challenge, and 48-hour owner grace period status." icon={Clock} step="Step 6" />} 
            />
            <Route 
              path="/audit" 
              element={<PlaceholderPage title="Audit Trail" description="Tamper-resistant audit log of all system and release actions." icon={FileText} step="Step 7" />} 
            />
          </Routes>
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
}
