import axios from 'axios';

// Determine base URL for API calls
// In HA ingress, we need to use the ingress path prefix
// In standalone, we use absolute paths
const getApiBaseUrl = () => {
  // If VITE_API_URL is set, use it (for custom deployments)
  if (import.meta.env.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL}/api/v1`;
  }
  
  // For production builds, detect HA ingress or standalone
  if (import.meta.env.PROD) {
    const path = window.location.pathname;
    // Check if we're in HA ingress
    if (path.includes('/api/hassio_ingress/')) {
      // Extract the ingress path including the token
      const match = path.match(/^(\/api\/hassio_ingress\/[^/]+)/);
      const ingressBase = match ? match[1] : '';
      return `${ingressBase}/api/v1`;
    }
    // Standalone mode
    return '/api/v1';
  }
  
  // For dev, use absolute path (proxied by Vite)
  return '/api/v1';
};

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      // Detect HA ingress path for redirect
      const path = window.location.pathname;
      let base = '/';
      if (path.includes('/api/hassio_ingress/')) {
        const match = path.match(/^(\/api\/hassio_ingress\/[^/]+)/);
        base = match ? match[1] : '/';
      }
      window.location.href = `${base}/login`.replace(/\/\//g, '/');
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await apiClient.post('/auth/login', { username, password });
    return response.data;
  },
  getStatus: async () => {
    const response = await apiClient.get('/auth/status');
    return response.data;
  },
};

export const statusAPI = {
  getSystem: async () => {
    const response = await apiClient.get('/status/system');
    return response.data;
  },
};
