/**
 * React Hook — useRealtimeNotifications
 * 
 * Menghubungkan komponen React ke WebSocket SiagaBencana
 * untuk menerima notifikasi real-time (banjir, SOS, darurat).
 * 
 * Contoh penggunaan:
 *   const { notifications, isConnected, unreadCount, clearAll } = useRealtimeNotifications('alerts');
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import wsService from '../services/wsService';

export default function useRealtimeNotifications(channel = 'alerts', maxNotifications = 50) {
  const [notifications, setNotifications] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const unsubscribersRef = useRef([]);

  useEffect(() => {
    // Hubungkan ke WebSocket channel
    wsService.connect(channel);

    // Listen connection events
    const unsub1 = wsService.on('ws_connected', (data) => {
      if (data.channel === channel) setIsConnected(true);
    });

    const unsub2 = wsService.on('ws_disconnected', (data) => {
      if (data.channel === channel) setIsConnected(false);
    });

    // Listen notifikasi banjir
    const unsub3 = wsService.on('flood_alert', (data) => {
      addNotification({
        id: Date.now(),
        type: 'flood_alert',
        title: data.title,
        message: data.message,
        severity: data.risk_level,
        village: data.village_name,
        timestamp: data.timestamp || new Date().toISOString(),
        read: false,
      });
    });

    // Listen SOS events
    const sosEvents = ['sos_new', 'sos_updated', 'sos_verified', 'sos_dispatched', 'sos_arrived', 'sos_completed', 'sos_rejected'];
    const unsub4 = sosEvents.map(eventType =>
      wsService.on(eventType, (data) => {
        addNotification({
          id: Date.now(),
          type: eventType,
          title: data.title,
          message: data.message,
          ticketId: data.ticket_id,
          ticketNumber: data.ticket_number,
          village: data.village_name,
          timestamp: data.timestamp || new Date().toISOString(),
          read: false,
        });
      })
    );

    // Listen SOS terdekat (untuk warga)
    const unsub5 = wsService.on('sos_nearby', (data) => {
      addNotification({
        id: Date.now(),
        type: 'sos_nearby',
        title: 'SOS di Sekitar Anda',
        message: data.message,
        village: data.village_name,
        timestamp: data.timestamp || new Date().toISOString(),
        read: false,
      });
    });

    // Listen status darurat
    const unsub6 = wsService.on('emergency_status', (data) => {
      addNotification({
        id: Date.now(),
        type: 'emergency_status',
        title: data.is_emergency_active ? '🚨 MODE DARURAT AKTIF' : '✅ MODE DARURAT NONAKTIF',
        message: data.message,
        village: data.village_name,
        timestamp: data.timestamp || new Date().toISOString(),
        read: false,
      });
    });

    // Simpan semua unsubscribers
    unsubscribersRef.current = [unsub1, unsub2, unsub3, ...unsub4, unsub5, unsub6];

    // Cleanup on unmount
    return () => {
      unsubscribersRef.current.forEach(unsub => unsub?.());
      wsService.disconnect(channel);
    };
  }, [channel]);

  const addNotification = useCallback((notif) => {
    setNotifications(prev => {
      const updated = [notif, ...prev].slice(0, maxNotifications);
      setUnreadCount(updated.filter(n => !n.read).length);
      return updated;
    });
  }, [maxNotifications]);

  const markAsRead = useCallback((notifId) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === notifId ? { ...n, read: true } : n);
      setUnreadCount(updated.filter(n => !n.read).length);
      return updated;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      setUnreadCount(0);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const removeNotification = useCallback((notifId) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== notifId);
      setUnreadCount(updated.filter(n => !n.read).length);
      return updated;
    });
  }, []);

  return {
    notifications,
    isConnected,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    removeNotification,
  };
}
