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

    // Tenant Identification
    const hostname = window.location.hostname;
    const urlParams = new URLSearchParams(window.location.search);
    let tenantQuery = urlParams.get('tenant');
    
    // Automatically detect subdomain
    let detectedSubdomain = '';
    const parts = hostname.split('.');
    
    if (hostname.endsWith('localhost')) {
      if (parts.length > 1 && parts[0] !== 'localhost') {
        detectedSubdomain = parts[0];
      }
    } else if (parts.length > 2) {
      detectedSubdomain = parts[0];
    }

    if (tenantQuery) {
      localStorage.setItem('tenant', tenantQuery);
    } else if (detectedSubdomain) {
      localStorage.setItem('tenant', detectedSubdomain);
    }
    
    const savedTenant = localStorage.getItem('tenant');
    if (savedTenant) {
      config.headers['x-tenant-id'] = savedTenant;
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
    if (error.response && error.response.status === 401) {
      if (!error.config.url.includes('/auth/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
