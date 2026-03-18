import axios from 'axios';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to attach the token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Tenant Identification (Strictly URL-based)
    const hostname = window.location.hostname;
    const urlParams = new URLSearchParams(window.location.search);
    let currentTenant = urlParams.get('tenant');
    
    // Detect subdomain
    let detectedSubdomain = '';
    const parts = hostname.split('.');
    
    if (hostname.endsWith('localhost')) {
      if (parts.length > 1 && parts[0] !== 'localhost') {
        detectedSubdomain = parts[0];
      }
    } else if (parts.length > 2) {
      // Ignore subdomains of cloud providers
      const cloudProviders = ['render.com', 'onrender.com', 'vercel.app', 'herokuapp.com'];
      if (!cloudProviders.some(p => hostname.endsWith(p))) {
        detectedSubdomain = parts[0];
      }
    }

    // Determine target tenant: URL param > Subdomain
    const targetTenant = currentTenant || detectedSubdomain;

    if (targetTenant) {
      // Ensure localStorage is in sync with current URL context
      localStorage.setItem('tenant', targetTenant.toLowerCase());
      config.headers['x-tenant-id'] = targetTenant.toLowerCase();
    } else {
      // Main domain / localhost - No tenant context
      localStorage.removeItem('tenant');
      delete config.headers['x-tenant-id'];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If we receive a 401, clear local storage.
    // However, if the request was to the login endpoint, DO NOT hard refresh.
    // Let the component catch the error and show the toast.
    if (error.response && (error.response.status === 401 || (error.response.status === 403 && error.response.data.code === 'TENANT_MISMATCH'))) {
      if (!error.config.url.includes('/auth/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('tenant');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
