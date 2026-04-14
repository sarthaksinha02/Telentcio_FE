import axios from 'axios';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Limitation: Prevent redundant parallel requests to the same sensitive endpoint
const pendingRequests = new Map();

const getRequestKey = (config) => `${config.method}:${config.url}`;

// Add a request interceptor to attach the token
api.interceptors.request.use(
  (config) => {
    // Client-side rate limiting: Block identical pending POST/PUT/DELETE requests
    const requestKey = getRequestKey(config);
    if (['post', 'put', 'delete'].includes(config.method.toLowerCase())) {
      if (pendingRequests.has(requestKey)) {
        // Cancel the request if it's already in flight
        const controller = new AbortController();
        config.signal = controller.signal;
        controller.abort('Duplicate request throttled');
        return config;
      }
      pendingRequests.set(requestKey, true);
    }

    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Automatically remove Content-Type for FormData so Axios can infer the correct boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
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
    } else if (hostname.endsWith('vercel.app')) {
      // Extract the project prefix (e.g., telentcio-demo)
      detectedSubdomain = hostname.replace('.vercel.app', '');
    } else if (parts.length > 2) {
      // Ignore subdomains of cloud providers
      const cloudProviders = ['render.com', 'onrender.com', 'vercel.app', 'herokuapp.com'];
      if (!cloudProviders.some(p => hostname.endsWith(p))) {
        detectedSubdomain = parts[0];
      }
    }

    // Determine target tenant: URL param > Subdomain
    let targetTenant = currentTenant || detectedSubdomain;

    // Ignore main project domains as tenants
    if (targetTenant && ['telentcio-demo', 'talentcio'].includes(targetTenant.toLowerCase())) {
      targetTenant = '';
    }

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

// Add a response interceptor to handle errors and clean up tracking
api.interceptors.response.use(
  (response) => {
    const requestKey = getRequestKey(response.config);
    pendingRequests.delete(requestKey);
    return response;
  },
  (error) => {
    if (error.config) {
      const requestKey = getRequestKey(error.config);
      pendingRequests.delete(requestKey);
    }

    // Handle 429 (Too Many Requests) specifically
    if (error.response && error.response.status === 429) {
      // You could import toast here, but since this is a utility, 
      // we mainly want to ensure the error is passed through with a clear message.
      console.warn('API Rate Limit Hit:', error.response.data.message);
    }

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
