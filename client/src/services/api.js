// Centralized API client with automatic token attachment and error extraction
const BASE_URL = '/api';

export const apiClient = async (endpoint, options = {}) => {
  const token = localStorage.getItem('dlv_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'omit' // tokens transmitted in Authorization header
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.errors = data.errors;
    error.response = { data, status: response.status };
    throw error;
  }

  return data;
};

// Convenience helpers matching axios-like signatures
apiClient.get = (url, options = {}) => apiClient(url, { ...options, method: 'GET' });
apiClient.post = (url, body, options = {}) => apiClient(url, { ...options, method: 'POST', body: JSON.stringify(body) });
apiClient.put = (url, body, options = {}) => apiClient(url, { ...options, method: 'PUT', body: JSON.stringify(body) });
apiClient.delete = (url, options = {}) => apiClient(url, { ...options, method: 'DELETE' });


export const checkHealth = async () => {
  return apiClient('/health');
};

export default apiClient;

