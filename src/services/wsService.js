/**
 * WebSocket Service — koneksi real-time ke SiagaBencana backend.
 * 
 * Mendukung:
 *   - Auto-reconnect dengan exponential backoff
 *   - Ping/pong keep-alive
 *   - Event listener pattern
 *   - Channel switching (alerts / sos)
 */

const WS_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000')
  .replace(/^http/, 'ws');

const RECONNECT_BASE_DELAY = 2000;  // 2 detik
const RECONNECT_MAX_DELAY = 30000;  // 30 detik
const PING_INTERVAL = 25000;        // 25 detik

class WebSocketService {
  constructor() {
    this._connections = {};  // channel -> WebSocket
    this._listeners = {};    // eventType -> Set of callbacks
    this._reconnectAttempts = {};
    this._pingTimers = {};
    this._intentionallyClosed = {};
  }

  /**
   * Terhubung ke WebSocket channel.
   * @param {'alerts' | 'sos'} channel 
   */
  connect(channel = 'alerts') {
    if (this._connections[channel]?.readyState === WebSocket.OPEN) {
      console.log(`[WS] Already connected to '${channel}'`);
      return;
    }

    this._intentionallyClosed[channel] = false;
    const url = `${WS_BASE_URL}/ws/${channel}`;
    console.log(`[WS] Connecting to ${url}...`);

    const ws = new WebSocket(url);
    this._connections[channel] = ws;

    ws.onopen = () => {
      console.log(`[WS] Connected to '${channel}'`);
      this._reconnectAttempts[channel] = 0;
      this._startPing(channel);
      this._emit('ws_connected', { channel });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Abaikan pong
        if (data.type === 'pong') return;

        // Emit event berdasarkan tipe
        this._emit(data.type, data.data || data);
        
        // Juga emit event generik 'message' untuk semua pesan
        this._emit('message', { channel, ...data });

      } catch (err) {
        console.warn('[WS] Failed to parse message:', event.data);
      }
    };

    ws.onclose = (event) => {
      console.log(`[WS] Disconnected from '${channel}' (code: ${event.code})`);
      this._stopPing(channel);
      this._emit('ws_disconnected', { channel, code: event.code });

      // Auto-reconnect jika bukan sengaja ditutup
      if (!this._intentionallyClosed[channel]) {
        this._scheduleReconnect(channel);
      }
    };

    ws.onerror = (error) => {
      console.error(`[WS] Error on '${channel}':`, error);
      this._emit('ws_error', { channel, error });
    };
  }

  /**
   * Putuskan koneksi WebSocket secara sengaja.
   * @param {'alerts' | 'sos'} channel 
   */
  disconnect(channel = 'alerts') {
    this._intentionallyClosed[channel] = true;
    this._stopPing(channel);
    const ws = this._connections[channel];
    if (ws) {
      ws.close(1000, 'Client disconnect');
      delete this._connections[channel];
    }
  }

  /** Putuskan semua koneksi. */
  disconnectAll() {
    Object.keys(this._connections).forEach(ch => this.disconnect(ch));
  }

  /**
   * Daftarkan listener untuk event tertentu.
   * @param {string} eventType - Tipe event (e.g. 'flood_alert', 'sos_new', 'connected')
   * @param {Function} callback - Fungsi yang dipanggil dengan data event
   * @returns {Function} Unsubscribe function
   */
  on(eventType, callback) {
    if (!this._listeners[eventType]) {
      this._listeners[eventType] = new Set();
    }
    this._listeners[eventType].add(callback);

    // Return unsubscribe function
    return () => {
      this._listeners[eventType]?.delete(callback);
    };
  }

  /** Hapus listener tertentu. */
  off(eventType, callback) {
    this._listeners[eventType]?.delete(callback);
  }

  /** Cek apakah channel terkoneksi. */
  isConnected(channel = 'alerts') {
    return this._connections[channel]?.readyState === WebSocket.OPEN;
  }

  // --- Internal Methods ---

  _emit(eventType, data) {
    this._listeners[eventType]?.forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error(`[WS] Listener error for '${eventType}':`, err);
      }
    });
  }

  _startPing(channel) {
    this._stopPing(channel);
    this._pingTimers[channel] = setInterval(() => {
      const ws = this._connections[channel];
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, PING_INTERVAL);
  }

  _stopPing(channel) {
    if (this._pingTimers[channel]) {
      clearInterval(this._pingTimers[channel]);
      delete this._pingTimers[channel];
    }
  }

  _scheduleReconnect(channel) {
    const attempts = this._reconnectAttempts[channel] || 0;
    const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, attempts), RECONNECT_MAX_DELAY);
    
    console.log(`[WS] Reconnecting to '${channel}' in ${delay / 1000}s (attempt ${attempts + 1})...`);
    
    setTimeout(() => {
      if (!this._intentionallyClosed[channel]) {
        this._reconnectAttempts[channel] = attempts + 1;
        this.connect(channel);
      }
    }, delay);
  }
}

// Singleton instance
const wsService = new WebSocketService();
export default wsService;
