import { useState, useCallback } from 'react';
import api from '../services/api';

/**
 * Thin wrapper around the configured axios instance.
 * Returns { data, loading, error, request } where `request` is a callable
 * that accepts (method, url, payload) and returns the response data.
 */
const useApi = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (method, url, payload = null) => {
    setLoading(true);
    setError(null);
    try {
      const config = { method, url };
      if (payload) config.data = payload;
      const response = await api(config);
      setData(response.data);
      return response.data;
    } catch (err) {
      const message = err.response?.data?.error ?? err.message ?? 'Request failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, request };
};

export default useApi;
