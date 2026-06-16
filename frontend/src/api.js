import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Token refresh is handled by the login flow (tokens last 1 hour)
// On 401, redirect to login page
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const auth = {
  login: (email, password) => api.post('/auth/login/', { email, password }).then(r => r.data),
  register: (data) => api.post('/auth/register/', data).then(r => r.data),
  profile: () => api.get('/auth/me/').then(r => r.data),
  logout: (refresh) => api.post('/auth/logout/', { refresh }).then(r => r.data),
};

export const jobs = {
  list: (params) => api.get('/jobs/', { params }).then(r => r.data),
  create: (data) => api.post('/jobs/', data).then(r => r.data),
  detail: (id) => api.get(`/jobs/${id}/`).then(r => r.data),
  update: (id, data) => api.patch(`/jobs/${id}/`, data).then(r => r.data),
  delete: (id) => api.delete(`/jobs/${id}/`),
  stats: (id) => api.get(`/jobs/${id}/stats/`).then(r => r.data),
};

export const candidates = {
  list: (params) => api.get('/candidates/', { params }).then(r => r.data),
  detail: (id) => api.get(`/candidates/${id}/`).then(r => r.data),
  upload: (formData) => api.post('/candidates/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data),
  bulkUpload: (formData) => api.post('/candidates/bulk-upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data),
  quickBulkUpload: (formData) => api.post('/candidates/quick-bulk-upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data),
  delete: (id) => api.delete(`/candidates/${id}/`).then(r => r.data),
};

export const screening = {
  run: (jobId, candidateId) => api.post('/screening/run/', { job_id: jobId, candidate_id: candidateId }).then(r => r.data),
  bulk: (jobId, candidateIds) => api.post('/screening/bulk/', { job_id: jobId, candidate_ids: candidateIds }).then(r => r.data),
  updateStatus: (id, status) => api.patch(`/screening/${id}/status/`, { status }).then(r => r.data),
  bulkUpdateStatus: (resultIds, status) => api.post('/screening/bulk-status/', { result_ids: resultIds, status }).then(r => r.data),
  jobCandidates: (jobId, params) => api.get(`/jobs/${jobId}/candidates/`, { params }).then(r => r.data),
};

export default api;
