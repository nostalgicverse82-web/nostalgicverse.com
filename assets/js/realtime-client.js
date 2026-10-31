/**
 * NostalgicVerse Realtime Client Singleton
 * Manages a single authoritative WebSocket connection per browser tab.
 * Deduplicates events by event_id to prevent multi-delivery and UI ghosting.
 */
(function() {
    'use strict';

    if (window.NVRealtime) return;

    class RealtimeClient {
        constructor() {
            this.ws = null;
            this.handlers = new Map(); // eventType -> Set of callbacks
            this.processedEventIds = new Set();
            this.activeSubscriptions = new Set();
            this.reconnectAttempts = 0;
            this.reconnectTimer = null;
            this.isConnecting = false;
            this.heartbeatTimer = null;
            this._pendingReconnectOnVisible = false;

            if (typeof document !== 'undefined') {
                document.addEventListener('visibilitychange', () => {
                    if (!document.hidden) {
                        if (this._pendingReconnectOnVisible || (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
                            this._pendingReconnectOnVisible = false;
                            if (this.reconnectTimer) {
                                clearTimeout(this.reconnectTimer);
                                this.reconnectTimer = null;
                            }
                            this.connect();
                        }
                    }
                });
            }
        }

        connect() {
            if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
                return;
            }

            this.isConnecting = true;
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;

            try {
                this.ws = new WebSocket(wsUrl);
            } catch (err) {
                console.error('[RealtimeClient] Connection error:', err);
                this._scheduleReconnect();
                return;
            }

            this.ws.onopen = () => {
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this._notifyHandlers('connection.open', { status: 'connected' });

                // Re-subscribe to any active conversation rooms
                this.activeSubscriptions.forEach(convId => {
                    this.send({ type: 'JOIN_CONVERSATION', conversationId: convId });
                });
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    // Deduplicate by event_id if present
                    if (data.event_id) {
                        if (this.processedEventIds.has(data.event_id)) {
                            return; // Already handled
                        }
                        this.processedEventIds.add(data.event_id);
                        if (this.processedEventIds.size > 1000) {
                            // Trim oldest
                            const first = this.processedEventIds.values().next().value;
                            this.processedEventIds.delete(first);
                        }
                    }

                    // Dispatch to handlers
                    if (data.type) {
                        this._notifyHandlers(data.type, data);
                    }
                    if (data.legacyType && data.legacyType !== data.type) {
                        this._notifyHandlers(data.legacyType, data);
                    }
                    
                    // Also dispatch global window event for decoupled listeners
                    window.dispatchEvent(new CustomEvent('nv-realtime-event', { detail: data }));
                } catch (err) {
                    console.error('[RealtimeClient] Parse error:', err);
                }
            };

            this.ws.onclose = () => {
                this.isConnecting = false;
                this._notifyHandlers('connection.closed', { status: 'disconnected' });
                this._scheduleReconnect();
            };

            this.ws.onerror = (err) => {
                console.warn('[RealtimeClient] Socket warning:', err);
            };
        }

        _scheduleReconnect() {
            if (this.reconnectTimer) return;
            // When document is hidden, defer reconnect until user returns to tab
            if (typeof document !== 'undefined' && document.hidden) {
                this._pendingReconnectOnVisible = true;
                return;
            }
            const baseDelay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
            // Full randomized jitter between 75% and 125% of base delay to break lockstep stampedes
            const jitter = 0.75 + Math.random() * 0.5;
            const delay = Math.round(baseDelay * jitter);
            this.reconnectAttempts++;
            this.reconnectTimer = setTimeout(() => {
                this.reconnectTimer = null;
                this.connect();
            }, delay);
        }

        _notifyHandlers(type, data) {
            const set = this.handlers.get(type);
            if (set) {
                set.forEach(cb => {
                    try { cb(data); } catch (e) { console.error('[RealtimeClient] Handler error:', e); }
                });
            }
        }

        on(type, callback) {
            if (!this.handlers.has(type)) {
                this.handlers.set(type, new Set());
            }
            this.handlers.get(type).add(callback);
            
            // Auto connect if not connected
            if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
                this.connect();
            }

            return () => this.off(type, callback);
        }

        off(type, callback) {
            const set = this.handlers.get(type);
            if (set) {
                set.delete(callback);
                if (set.size === 0) this.handlers.delete(type);
            }
        }

        send(payload) {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(payload));
                return true;
            }
            return false;
        }

        joinConversation(conversationId) {
            this.activeSubscriptions.add(conversationId);
            this.send({ type: 'JOIN_CONVERSATION', conversationId });
        }

        leaveConversation(conversationId) {
            this.activeSubscriptions.delete(conversationId);
            this.send({ type: 'LEAVE_CONVERSATION', conversationId });
        }

        sendTyping(conversationId) {
            this.send({ type: 'TYPING', conversationId });
        }
    }

    window.NVRealtime = new RealtimeClient();
})();

