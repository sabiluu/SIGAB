import { useState, useEffect } from 'react';
import wsService from '../services/wsService';
import { apiFetch } from '../services/api';

export default function useDashboardRealtime() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const fetchInitialData = async () => {
      try {
        const payload = await apiFetch('/dashboard/realtime');
        if (mounted) {
          setData(payload);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Gagal memuat data dashboard');
          setLoading(false);
        }
      }
    };

    fetchInitialData();

    // Connect to dashboard websocket channel
    wsService.connect('dashboard');

    // Subscribe to dashboard updates
    const unsubscribe = wsService.on('dashboard_update', (newData) => {
      if (mounted) {
        setData(newData);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
      wsService.disconnect('dashboard');
    };
  }, []);

  return { data, loading, error };
}
