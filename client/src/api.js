import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e.response?.data?.expired) window.dispatchEvent(new Event('session-expired'));
    return Promise.reject(e);
  }
);

export const errorText = (e) => {
  if (e.response?.data?.error) return e.response.data.error;
  if (!e.response) return 'Cannot reach the server. Make sure the backend is running (npm run dev) and see the terminal for errors.';
  return e.message || 'Something went wrong';
};
export default api;
