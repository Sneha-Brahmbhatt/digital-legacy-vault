import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../../services/api.js';
import { 
  generateRsaKeyPair, 
  exportPublicKey, 
  sealPrivateKey, 
  unsealPrivateKey 
} from '../../utils/crypto.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [privateKey, setPrivateKey] = useState(null); // Held strictly in memory
  const [token, setToken] = useState(localStorage.getItem('dlv_token'));
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('dlv_refresh_token'));
  const [loading, setLoading] = useState(true);

  // Load current user profile if token is present
  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const res = await apiClient('/auth/me');
          setUser(res.data.user);
        } catch (err) {
          console.warn('[Auth] Session check failed, attempting refresh...', err.message);
          await handleTokenRefresh();
        }
      }
      setLoading(false);
    }
    loadUser();
  }, [token]);

  // Handle token refresh
  const handleTokenRefresh = async () => {
    const storedRefresh = localStorage.getItem('dlv_refresh_token');
    if (!storedRefresh) {
      logout();
      return null;
    }

    try {
      const res = await apiClient('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: storedRefresh })
      });
      const newAccessToken = res.data.accessToken;
      localStorage.setItem('dlv_token', newAccessToken);
      setToken(newAccessToken);
      return newAccessToken;
    } catch (err) {
      console.error('[Auth] Refresh token failed:', err.message);
      logout();
      return null;
    }
  };

  // Register with client-side RSA keypair generation
  const register = async ({ name, email, password, role = 'owner', gracePeriodHours = 48 }) => {
    // 1. Generate RSA-OAEP keypair in browser
    const keyPair = await generateRsaKeyPair();
    const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);

    // 2. Seal private key using user password via PBKDF2 + AES-GCM
    const sealed = await sealPrivateKey(keyPair.privateKey, password);

    // 3. Transmit public key + sealed private key to backend
    const res = await apiClient('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        password,
        role,
        gracePeriodHours,
        publicKey: publicKeyBase64,
        encryptedPrivateKey: sealed.encryptedPrivateKey,
        privateKeyIv: sealed.privateKeyIv,
        privateKeySalt: sealed.privateKeySalt
      })
    });

    const { user: userData, accessToken, refreshToken: newRefresh } = res.data;
    
    // 4. Retain unsealed private key in memory
    setPrivateKey(keyPair.privateKey);
    setUser(userData);
    setToken(accessToken);
    setRefreshToken(newRefresh);
    localStorage.setItem('dlv_token', accessToken);
    localStorage.setItem('dlv_refresh_token', newRefresh);

    return userData;
  };

  // Login & restore unsealed private key locally
  const login = async (email, password) => {
    const res = await apiClient('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    const { user: userData, accessToken, refreshToken: newRefresh } = res.data;

    // Unseal user's private key in browser memory using their password
    if (userData.encryptedPrivateKey && userData.privateKeyIv && userData.privateKeySalt) {
      try {
        const unsealedKey = await unsealPrivateKey(
          userData.encryptedPrivateKey,
          userData.privateKeyIv,
          userData.privateKeySalt,
          password
        );
        setPrivateKey(unsealedKey);
      } catch (cryptoErr) {
        console.error('[Crypto] Failed to unseal local private key:', cryptoErr);
      }
    }

    setUser(userData);
    setToken(accessToken);
    setRefreshToken(newRefresh);
    localStorage.setItem('dlv_token', accessToken);
    localStorage.setItem('dlv_refresh_token', newRefresh);

    return userData;
  };

  // Logout & wipe in-memory keys
  const logout = async () => {
    const storedRefresh = localStorage.getItem('dlv_refresh_token');
    try {
      if (storedRefresh) {
        await apiClient('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: storedRefresh })
        });
      }
    } catch (e) {
      // ignore
    } finally {
      setUser(null);
      setPrivateKey(null);
      setToken(null);
      setRefreshToken(null);
      localStorage.removeItem('dlv_token');
      localStorage.removeItem('dlv_refresh_token');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      privateKey,
      token,
      isAuthenticated: !!user,
      loading,
      register,
      login,
      logout,
      handleTokenRefresh
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
