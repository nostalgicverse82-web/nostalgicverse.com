/**
 * NostalgicVerse — WebRTC 1-to-1 Voice & Video Call Manager
 * ========================================================
 * Implements real-time peer-to-peer voice and video calls with:
 * - Real browser permission request (getUserMedia) BEFORE call request is sent
 * - Strict consent lifecycle: caller must authorize device -> call requested -> recipient accepts -> recipient authorizes device -> WebRTC connects
 * - Comprehensive browser media error translations (NotAllowedError, NotFoundError, NotReadableError, SecurityError)
 * - Immediate cleanup of temporary test streams so camera/mic LEDs do not remain active during ringing
 * - Web Audio API synthesizer for retro dual-tone ringing and chimes
 * - Dynamic STUN/TURN ICE configuration
 * - Full mute, camera toggle, duration timer, and multi-tab synchronization
 */

(function() {
    'use strict';

    if (window.NVCallManager) return;

    class WebRTCCallManager {
        constructor() {
            this.tabId = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 7);
            this.currentCall = null; // { id, conversationId, callerId, recipientId, callType, status, partner, isCaller }
            this.peerConnection = null;
            this.localStream = null;
            this.remoteStream = null;
            this.iceServers = null;
            this.callTimerInterval = null;
            this.callSeconds = 0;
            this.audioCtx = null;
            this.ringInterval = null;
            this.isAudioMuted = false;
            this.isVideoDisabled = false;
            this.callerTimeout = null;

            this._initElements();
            this._bindRealtimeEvents();
            this._fetchIceConfig();
        }

        async _fetchIceConfig() {
            try {
                const res = await fetch('/api/calls/config/ice');
                const data = await res.json();
                if (data.success && data.iceServers) {
                    this.iceServers = data.iceServers;
                }
            } catch (e) {
                this.iceServers = [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ];
            }
        }

        _initElements() {
            let root = document.getElementById('nv-call-system-root');
            if (!root) {
                root = document.createElement('div');
                root.id = 'nv-call-system-root';
                document.body.appendChild(root);
            }
            this.root = root;
        }

        _getAudioContext() {
            if (!this.audioCtx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                    this.audioCtx = new AudioContext();
                }
            }
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().catch(() => {});
            }
            return this.audioCtx;
        }

        /**
         * Web Audio API retro chimes (no external asset dependencies)
         */
        _playChime(type) {
            const ctx = this._getAudioContext();
            if (!ctx) return;

            try {
                const now = ctx.currentTime;
                if (type === 'ringtone') {
                    // Dual tone 440Hz + 480Hz US ringback tone
                    const osc1 = ctx.createOscillator();
                    const osc2 = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc1.type = 'sine';
                    osc2.type = 'sine';
                    osc1.frequency.setValueAtTime(440, now);
                    osc2.frequency.setValueAtTime(480, now);

                    gain.gain.setValueAtTime(0.08, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

                    osc1.connect(gain);
                    osc2.connect(gain);
                    gain.connect(ctx.destination);

                    osc1.start(now);
                    osc2.start(now);
                    osc1.stop(now + 1.6);
                    osc2.stop(now + 1.6);
                } else if (type === 'end') {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(440, now);
                    osc.frequency.exponentialRampToValueAtTime(220, now + 0.35);

                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.35);
                } else if (type === 'connected') {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(330, now);
                    osc.frequency.setValueAtTime(440, now + 0.1);
                    osc.frequency.setValueAtTime(660, now + 0.2);

                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.4);
                }
            } catch (e) {}
        }

        _startRinging(type = 'ringtone') {
            this._stopRinging();
            this._playChime(type);
            this.ringInterval = setInterval(() => {
                this._playChime(type);
            }, 3000);
        }

        _stopRinging() {
            if (this.ringInterval) {
                clearInterval(this.ringInterval);
                this.ringInterval = null;
            }
        }

        // ==========================================
        // REAL BROWSER PERMISSION API (STEP 5 & 6)
        // ==========================================

        /**
         * Explicitly request real microphone permission using the Web Media API
         */
        async requestVoicePermission() {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                return {
                    granted: false,
                    error: new Error('Secure connection (HTTPS) required for device access'),
                    code: 'INSECURE_CONTEXT'
                };
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: false
                });
                return {
                    granted: true,
                    stream
                };
            } catch (error) {
                return {
                    granted: false,
                    error,
                    code: error.name || 'UnknownError'
                };
            }
        }

        /**
         * Explicitly request real camera and microphone permission using the Web Media API
         */
        async requestVideoPermission() {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                return {
                    granted: false,
                    error: new Error('Secure connection (HTTPS) required for device access'),
                    code: 'INSECURE_CONTEXT'
                };
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: true
                });
                return {
                    granted: true,
                    stream
                };
            } catch (error) {
                return {
                    granted: false,
                    error,
                    code: error.name || 'UnknownError'
                };
            }
        }

        /**
         * Check browser permission status where supported
         */
        async checkPermissionStatus(name) {
            if (navigator.permissions && navigator.permissions.query) {
                try {
                    const res = await navigator.permissions.query({ name });
                    return res.state; // 'granted', 'prompt', 'denied'
                } catch (e) {
                    return 'unknown';
                }
            }
            return 'unknown';
        }

        /**
         * Translate raw browser exceptions into clear, friendly guidance (Step 31)
         */
        _translateMediaError(code, callType) {
            const isVideo = callType === 'VIDEO';
            const deviceName = isVideo ? 'camera and microphone' : 'microphone';

            if (code === 'INSECURE_CONTEXT') {
                return {
                    title: 'Secure Connection Required',
                    message: 'Voice and video calls require a secure connection (HTTPS).',
                    canRetry: false
                };
            }

            if (code === 'NotAllowedError' || code === 'PermissionDeniedError') {
                return {
                    title: isVideo ? 'Camera & Microphone Access Denied' : 'Microphone Access Denied',
                    message: isVideo
                        ? 'Camera and microphone access was denied. Allow camera and microphone access in your browser settings to make video calls.'
                        : 'Microphone access was denied. Allow microphone access in your browser settings to make voice calls.',
                    canRetry: true,
                    isBlocked: true
                };
            }

            if (code === 'NotFoundError' || code === 'DevicesNotFoundError') {
                return {
                    title: 'Device Not Found',
                    message: `No ${deviceName} was found on this device. Please connect a working ${deviceName} and try again.`,
                    canRetry: true
                };
            }

            if (code === 'NotReadableError' || code === 'TrackStartError') {
                return {
                    title: 'Device Busy',
                    message: `Your ${deviceName} is currently being used by another application. Please close other applications and try again.`,
                    canRetry: true
                };
            }

            if (code === 'SecurityError') {
                return {
                    title: 'Security Policy Restriction',
                    message: 'A browser security setting is preventing device access on this page.',
                    canRetry: false
                };
            }

            return {
                title: 'Device Access Required',
                message: isVideo
                    ? 'Camera and microphone access are required for video calls.'
                    : 'Microphone access is required to make a voice call.',
                canRetry: true
            };
        }

        _showPermissionErrorModal(errInfo, onRetry, onCancel) {
            this._dismissModal();

            const helpTip = errInfo.isBlocked 
                ? '<p style="font-size:0.8rem; color:var(--nv-text-muted); margin-top:10px;">Tip: Click the lock or camera icon in your browser address bar to allow permissions, then click Try Again.</p>'
                : '';

            this.root.innerHTML = `
                <div class="nv-call-overlay" id="nv-perm-error-modal">
                    <div class="nv-call-modal-box">
                        <div style="font-size:2.4rem; margin-bottom:12px;">🚫</div>
                        <h3 class="nv-call-modal-name" style="margin-bottom:10px;">${escapeHtml(errInfo.title)}</h3>
                        <p style="color:var(--nv-text-muted); font-size:0.9rem; line-height:1.5; margin-bottom:20px;">
                            ${escapeHtml(errInfo.message)}
                        </p>
                        ${helpTip}
                        <div class="nv-call-action-btns" style="margin-top:20px; gap:12px;">
                            <button class="nv-btn-decline" id="nv-perm-cancel-btn" style="padding:10px 22px; font-size:0.88rem;">
                                Cancel
                            </button>
                            ${errInfo.canRetry ? `
                                <button class="nv-btn-accept" id="nv-perm-retry-btn" style="padding:10px 22px; font-size:0.88rem; background:var(--nv-cyan); color:#000;">
                                    Try Again
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('nv-perm-cancel-btn').onclick = () => {
                this._dismissModal();
                if (onCancel) onCancel();
            };

            const retryBtn = document.getElementById('nv-perm-retry-btn');
            if (retryBtn && onRetry) {
                retryBtn.onclick = () => {
                    this._dismissModal();
                    onRetry();
                };
            }
        }

        // ==========================================
        // REALTIME SIGNALING EVENTS
        // ==========================================

        _bindRealtimeEvents() {
            if (!window.NVRealtime) return;

            // Incoming call notification
            window.NVRealtime.on('call.incoming', (data) => {
                this._handleIncomingCall(data);
            });

            // Outgoing call accepted by recipient
            window.NVRealtime.on('call.accepted', (data) => {
                this._handleCallAcceptedByPeer(data);
            });

            // Multi-tab sync: call was accepted on another tab of recipient
            window.NVRealtime.on('call.accepted_sync', (data) => {
                if (data.recipientTabId !== this.tabId) {
                    this._dismissModal();
                    this._stopRinging();
                }
            });

            // Call was declined
            window.NVRealtime.on('call.declined', (data) => {
                this._handleCallDeclined(data);
            });

            // Multi-tab sync: call declined on another tab
            window.NVRealtime.on('call.declined_sync', () => {
                this._dismissModal();
                this._stopRinging();
            });

            // Call cancelled by caller
            window.NVRealtime.on('call.cancelled', () => {
                this._stopRinging();
                this._dismissModal();
                this._cleanupMedia();
                this._showToast('Call was cancelled.');
            });

            // Call connected
            window.NVRealtime.on('call.connected', () => {
                if (this.currentCall) {
                    this.currentCall.status = 'CONNECTED';
                    this._playChime('connected');
                    this._startTimer();
                }
            });

            // Call ended
            window.NVRealtime.on('call.ended', (data) => {
                this._handleCallEnded(data);
            });

            // Call failed (e.g. peer media permission failure)
            window.NVRealtime.on('call.failed', (data) => {
                this._handleCallFailed(data);
            });

            // WebRTC Signaling: Offer
            window.NVRealtime.on('call.offer', async (data) => {
                await this._handleSdpOffer(data);
            });

            // WebRTC Signaling: Answer
            window.NVRealtime.on('call.answer', async (data) => {
                await this._handleSdpAnswer(data);
            });

            // WebRTC Signaling: ICE Candidate
            window.NVRealtime.on('call.ice', async (data) => {
                await this._handleIceCandidate(data);
            });

            // Peer media state update
            window.NVRealtime.on('call.media_state', (data) => {
                this._handlePeerMediaState(data);
            });
        }

        // ==========================================
        // CALL INITIATION (CALLER FLOW)
        // ==========================================

        /**
         * GATED CALL INITIATION:
         * Step 1: User clicks call button
         * Step 2: Requests real browser device permission explicitly
         * Step 3: Only after permission is GRANTED, sends call request to server
         * Step 4: If denied, halts and explains error; does NOT send request
         */
        async startCall(conversationId, recipientId, callType, partnerInfo = {}) {
            if (this.currentCall) {
                alert('You are already in an active call.');
                return;
            }

            // --- STEP 1: REAL BROWSER DEVICE PERMISSION REQUEST ---
            let permResult;
            if (callType === 'VIDEO') {
                permResult = await this.requestVideoPermission();
            } else {
                permResult = await this.requestVoicePermission();
            }

            // --- STEP 2: HANDLE PERMISSION FAILURE ---
            if (!permResult.granted) {
                const errInfo = this._translateMediaError(permResult.code, callType);
                this._showPermissionErrorModal(
                    errInfo,
                    () => this.startCall(conversationId, recipientId, callType, partnerInfo), // Retry callback
                    null // Cancel callback
                );
                return; // DO NOT SEND CALL REQUEST
            }

            // --- STEP 3: STOP TEMPORARY VERIFICATION STREAM (Step 19) ---
            // Do NOT leave the camera LED / mic capture active while waiting for recipient
            if (permResult.stream) {
                permResult.stream.getTracks().forEach(track => track.stop());
            }

            // --- STEP 4: SEND CALL REQUEST TO SERVER ---
            try {
                const res = await fetch('/api/calls/request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conversationId,
                        recipientId,
                        callType,
                        tabId: this.tabId
                    })
                });
                const data = await res.json();

                if (!res.ok || !data.success) {
                    if (data.code === 'BUSY') {
                        alert('User is currently busy in another call.');
                    } else {
                        alert(data.error || 'Failed to start call.');
                    }
                    return;
                }

                this.currentCall = {
                    id: data.call.id,
                    conversationId,
                    callerId: data.call.callerId,
                    recipientId,
                    callType,
                    status: 'REQUESTED',
                    isCaller: true,
                    partner: partnerInfo
                };

                // Show outgoing ringing screen
                this._renderOutgoingCallingUI();
                this._startRinging('ringtone');

                // Caller-side timeout (30 seconds)
                this.callerTimeout = setTimeout(() => {
                    if (this.currentCall && this.currentCall.status === 'REQUESTED') {
                        this.cancelCall();
                        this._showToast('No answer. Call timed out.');
                    }
                }, 30000);

            } catch (err) {
                console.error('[CallManager] startCall request error:', err);
                alert('Network error while requesting call.');
            }
        }

        // ==========================================
        // INCOMING CALL HANDLING (RECIPIENT FLOW)
        // ==========================================

        _handleIncomingCall(data) {
            if (this.currentCall) return;

            const call = data.call;
            const caller = data.caller;

            this.currentCall = {
                id: call.id,
                conversationId: call.conversationId,
                callerId: call.callerId,
                recipientId: call.recipientId,
                callType: call.callType,
                status: 'REQUESTED',
                isCaller: false,
                partner: caller
            };

            // NOTE: Do NOT call getUserMedia here! (Step 26)
            this._startRinging('ringtone');
            this._renderIncomingCallModal(caller, call.callType);
        }

        _renderIncomingCallModal(caller, callType) {
            const avatarSrc = (caller && caller.avatarId) ? `/assets/images/branding/logo/logo.png` : '/assets/images/branding/logo/logo.png';
            const callerName = (caller && (caller.displayName || caller.username)) || 'NostalgicVerse User';
            const typeLabel = callType === 'VIDEO' ? 'Incoming Video Call...' : 'Incoming Voice Call...';
            const icon = callType === 'VIDEO' ? '📹' : '📞';

            this.root.innerHTML = `
                <div class="nv-call-overlay" id="nv-incoming-modal">
                    <div class="nv-call-modal-box">
                        <div class="nv-ringing-pulse">
                            <div class="nv-pulse-ring"></div>
                            <img src="${avatarSrc}" alt="${callerName}">
                        </div>
                        <h3 class="nv-call-modal-name">${escapeHtml(callerName)}</h3>
                        <div class="nv-call-modal-status">${icon} ${typeLabel}</div>
                        <div class="nv-call-action-btns">
                            <button class="nv-btn-decline" id="nv-btn-decline-call">
                                <span style="font-size:1.4rem;">✕</span>
                                <span>Decline</span>
                            </button>
                            <button class="nv-btn-accept" id="nv-btn-accept-call">
                                <span style="font-size:1.4rem;">✓</span>
                                <span>Accept</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('nv-btn-decline-call').onclick = () => this.declineCall();
            document.getElementById('nv-btn-accept-call').onclick = () => this.acceptCall();
        }

        // ==========================================
        // CALL ACTIONS (ACCEPT / DECLINE / CANCEL)
        // ==========================================

        /**
         * RECIPIENT ACCEPTS:
         * Step 1: User explicitly clicks "Accept"
         * Step 2: Requests recipient's own device permission NOW (Step 27)
         * Step 3: If permission granted -> sends /accept and connects
         * Step 4: If permission denied -> sends /fail and notifies caller
         */
        async acceptCall() {
            if (!this.currentCall) return;
            const callId = this.currentCall.id;
            const callType = this.currentCall.callType;

            this._stopRinging();
            this._dismissModal();

            // Request recipient's own device permission
            let permResult;
            if (callType === 'VIDEO') {
                permResult = await this.requestVideoPermission();
            } else {
                permResult = await this.requestVoicePermission();
            }

            // If recipient denies device permission
            if (!permResult.granted) {
                const errInfo = this._translateMediaError(permResult.code, callType);
                this._cleanupMedia();
                this.currentCall = null;

                // Notify server and caller that media permission failed
                try {
                    await fetch(`/api/calls/${callId}/fail`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reason: 'MEDIA_PERMISSION_FAILED' })
                    });
                } catch (e) {}

                this._showPermissionErrorModal(
                    errInfo,
                    null,
                    null
                );
                return;
            }

            // Recipient granted permission -> hold local stream
            this.localStream = permResult.stream;

            try {
                const res = await fetch(`/api/calls/${callId}/accept`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tabId: this.tabId })
                });
                const data = await res.json();

                if (!res.ok || !data.success) {
                    this._cleanupMedia();
                    this.currentCall = null;
                    alert(data.error || 'Failed to accept call.');
                    return;
                }

                this.currentCall.status = 'ACCEPTED';
                this._renderActiveCallUI();

            } catch (err) {
                console.error('[CallManager] acceptCall error:', err);
                this._cleanupMedia();
                this.currentCall = null;
            }
        }

        async declineCall() {
            if (!this.currentCall) return;
            const callId = this.currentCall.id;

            this._stopRinging();
            this._dismissModal();
            this._cleanupMedia();
            this.currentCall = null;

            try {
                await fetch(`/api/calls/${callId}/decline`, { method: 'POST' });
            } catch (e) {}
        }

        async cancelCall() {
            if (!this.currentCall) return;
            const callId = this.currentCall.id;

            if (this.callerTimeout) {
                clearTimeout(this.callerTimeout);
                this.callerTimeout = null;
            }

            this._stopRinging();
            this._dismissModal();
            this._cleanupMedia();
            this.currentCall = null;

            try {
                await fetch(`/api/calls/${callId}/cancel`, { method: 'POST' });
            } catch (e) {}
        }

        async endCall() {
            if (!this.currentCall) return;
            const callId = this.currentCall.id;

            this._stopTimer();
            this._stopRinging();
            this._playChime('end');
            this._cleanupMedia();
            this._dismissModal();

            const durationSec = this.callSeconds;
            this.currentCall = null;

            try {
                await fetch(`/api/calls/${callId}/end`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason: 'completed' })
                });
            } catch (e) {}

            this._showToast(`Call ended (${this._formatDuration(durationSec)})`);
        }

        // ==========================================
        // WEBRTC PEER CONNECTION & SIGNALING
        // ==========================================

        _createPeerConnection() {
            if (this.peerConnection) return this.peerConnection;

            const config = {
                iceServers: this.iceServers || [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            };

            const pc = new RTCPeerConnection(config);

            // Add local tracks
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    pc.addTrack(track, this.localStream);
                });
            }

            // Remote track reception
            pc.ontrack = (event) => {
                if (event.streams && event.streams[0]) {
                    this.remoteStream = event.streams[0];
                    this._attachRemoteStream(this.remoteStream);
                }
            };

            // ICE Candidate dispatch
            pc.onicecandidate = (event) => {
                if (event.candidate && this.currentCall && window.NVRealtime) {
                    window.NVRealtime.send({
                        type: 'CALL_ICE_CANDIDATE',
                        callId: this.currentCall.id,
                        candidate: event.candidate
                    });
                }
            };

            // Connection state change
            pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'connected') {
                    this._stopRinging();
                    this._playChime('connected');
                    if (this.currentCall && this.currentCall.status !== 'CONNECTED') {
                        this.currentCall.status = 'CONNECTED';
                        this._startTimer();
                        fetch(`/api/calls/${this.currentCall.id}/connected`, { method: 'POST' }).catch(() => {});
                    }
                    const statusEl = document.getElementById('nv-call-status-indicator');
                    if (statusEl) statusEl.textContent = 'Connected';
                } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                    const statusEl = document.getElementById('nv-call-status-indicator');
                    if (statusEl) statusEl.textContent = 'Reconnecting...';
                }
            };

            this.peerConnection = pc;
            return pc;
        }

        /**
         * Caller reacquires live stream upon recipient acceptance (permission was already granted)
         */
        async _handleCallAcceptedByPeer(data) {
            if (!this.currentCall || !this.currentCall.isCaller) return;
            if (this.callerTimeout) clearTimeout(this.callerTimeout);

            this._stopRinging();
            this.currentCall.status = 'NEGOTIATING';

            // Caller reacquires stream for the active call
            const constraints = {
                audio: true,
                video: this.currentCall.callType === 'VIDEO' ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                } : false
            };

            try {
                this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
                console.error('[CallManager] Stream acquisition error after peer acceptance:', err);
                this.endCall();
                return;
            }

            this._renderActiveCallUI();
            const pc = this._createPeerConnection();

            // Create and send SDP Offer
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                if (window.NVRealtime) {
                    window.NVRealtime.send({
                        type: 'CALL_OFFER',
                        callId: this.currentCall.id,
                        sdp: pc.localDescription
                    });
                }
            } catch (err) {
                console.error('[CallManager] createOffer error:', err);
                this.endCall();
            }
        }

        async _handleSdpOffer(data) {
            if (!this.currentCall || this.currentCall.id !== data.callId) return;

            const pc = this._createPeerConnection();
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                if (window.NVRealtime) {
                    window.NVRealtime.send({
                        type: 'CALL_ANSWER',
                        callId: this.currentCall.id,
                        sdp: pc.localDescription
                    });
                }
            } catch (err) {
                console.error('[CallManager] handleSdpOffer error:', err);
            }
        }

        async _handleSdpAnswer(data) {
            if (!this.currentCall || this.currentCall.id !== data.callId) return;
            if (this.peerConnection) {
                try {
                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
                } catch (err) {
                    console.error('[CallManager] handleSdpAnswer error:', err);
                }
            }
        }

        async _handleIceCandidate(data) {
            if (!this.currentCall || this.currentCall.id !== data.callId) return;
            if (this.peerConnection && data.candidate) {
                try {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (err) {
                    console.warn('[CallManager] addIceCandidate error:', err);
                }
            }
        }

        _handleCallDeclined() {
            this._stopRinging();
            this._dismissModal();
            this._cleanupMedia();
            this.currentCall = null;
            this._showToast('Call was declined.');
        }

        _handleCallFailed(data) {
            this._stopTimer();
            this._stopRinging();
            this._cleanupMedia();
            this._dismissModal();
            this.currentCall = null;

            if (data.reason === 'MEDIA_PERMISSION_FAILED') {
                this._showToast('The other person could not enable their microphone/camera.');
            } else {
                this._showToast('Call could not be connected.');
            }
        }

        _handleCallEnded(data) {
            this._stopTimer();
            this._stopRinging();
            this._playChime('end');
            this._cleanupMedia();
            this._dismissModal();
            this.currentCall = null;

            const durationStr = data.duration ? ` (${this._formatDuration(data.duration)})` : '';
            this._showToast(`Call ended${durationStr}`);
        }

        _handlePeerMediaState(data) {
            const peerNote = document.getElementById('nv-peer-media-note');
            if (!peerNote) return;

            if (data.audioEnabled === false) {
                peerNote.textContent = 'Peer microphone muted';
                peerNote.style.display = 'block';
            } else if (data.videoEnabled === false) {
                peerNote.textContent = 'Peer camera turned off';
                peerNote.style.display = 'block';
            } else {
                peerNote.style.display = 'none';
            }
        }

        // ==========================================
        // CONTROLS & MEDIA TOGGLES
        // ==========================================

        toggleMute() {
            if (!this.localStream) return;
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.isAudioMuted = !audioTrack.enabled;

                const muteBtn = document.getElementById('nv-btn-mute');
                if (muteBtn) {
                    muteBtn.classList.toggle('off', this.isAudioMuted);
                    muteBtn.innerHTML = this.isAudioMuted ? '🔇' : '🎙️';
                }

                this._broadcastMediaState();
            }
        }

        toggleVideo() {
            if (!this.localStream) return;
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                this.isVideoDisabled = !videoTrack.enabled;

                const camBtn = document.getElementById('nv-btn-cam');
                if (camBtn) {
                    camBtn.classList.toggle('off', this.isVideoDisabled);
                    camBtn.innerHTML = this.isVideoDisabled ? '🚫' : '📹';
                }

                this._broadcastMediaState();
            }
        }

        _broadcastMediaState() {
            if (this.currentCall && window.NVRealtime) {
                window.NVRealtime.send({
                    type: 'CALL_MEDIA_STATE',
                    callId: this.currentCall.id,
                    audioEnabled: !this.isAudioMuted,
                    videoEnabled: !this.isVideoDisabled
                });
            }
        }

        // ==========================================
        // UI RENDERING
        // ==========================================

        _renderOutgoingCallingUI() {
            const partner = this.currentCall.partner || {};
            const partnerName = partner.displayName || partner.username || 'User';
            const typeLabel = this.currentCall.callType === 'VIDEO' ? 'Video Call' : 'Voice Call';

            this.root.innerHTML = `
                <div class="nv-call-overlay" id="nv-outgoing-modal">
                    <div class="nv-call-modal-box">
                        <div class="nv-ringing-pulse">
                            <div class="nv-pulse-ring"></div>
                            <img src="/assets/images/branding/logo/logo.png" alt="${partnerName}">
                        </div>
                        <h3 class="nv-call-modal-name">${escapeHtml(partnerName)}</h3>
                        <div class="nv-call-modal-status">Calling ${typeLabel}...</div>
                        <div class="nv-call-action-btns">
                            <button class="nv-btn-decline" id="nv-btn-cancel-call">
                                <span style="font-size:1.4rem;">✕</span>
                                <span>Cancel</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('nv-btn-cancel-call').onclick = () => this.cancelCall();
        }

        _renderActiveCallUI() {
            const call = this.currentCall;
            const isVideo = call && call.callType === 'VIDEO';
            const partnerName = (call.partner && (call.partner.displayName || call.partner.username)) || 'User';

            this.root.innerHTML = `
                <div class="nv-active-call-pane" id="nv-active-call-pane">
                    <div class="nv-call-header-bar">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <img src="/assets/images/branding/logo/logo.png" style="width:32px; height:32px; border-radius:50%;">
                            <div>
                                <strong style="font-size:1rem;">${escapeHtml(partnerName)}</strong>
                                <div id="nv-call-status-indicator" style="font-size:0.75rem; color:var(--nv-cyan, #00f0ff);">Connecting...</div>
                            </div>
                        </div>
                        <div class="nv-call-timer" id="nv-call-timer">00:00</div>
                    </div>

                    <div class="nv-call-stage">
                        ${isVideo ? `
                            <video class="nv-remote-video" id="nv-remote-video" autoplay playsinline></video>
                            <video class="nv-local-video-pip" id="nv-local-video" autoplay playsinline muted></video>
                        ` : `
                            <div style="display:flex; flex-direction:column; align-items:center; gap:16px;">
                                <img src="/assets/images/branding/logo/logo.png" class="nv-voice-stage-avatar">
                                <h3 style="color:#fff; margin:0;">${escapeHtml(partnerName)}</h3>
                                <div id="nv-peer-media-note" style="display:none; color:var(--nv-crimson, #ff0055); font-size:0.85rem;"></div>
                            </div>
                            <audio id="nv-remote-audio" autoplay></audio>
                        `}
                    </div>

                    <div class="nv-call-control-bar">
                        <button class="nv-ctrl-btn" id="nv-btn-mute" title="Mute/Unmute Mic">🎙️</button>
                        ${isVideo ? `<button class="nv-ctrl-btn" id="nv-btn-cam" title="Toggle Camera">📹</button>` : ''}
                        <button class="nv-ctrl-btn hangup" id="nv-btn-hangup" title="End Call">✕</button>
                    </div>
                </div>
            `;

            // Attach local video if present
            if (isVideo && this.localStream) {
                const localVideo = document.getElementById('nv-local-video');
                if (localVideo) localVideo.srcObject = this.localStream;
            }

            // Attach remote stream if already acquired
            if (this.remoteStream) {
                this._attachRemoteStream(this.remoteStream);
            }

            document.getElementById('nv-btn-mute').onclick = () => this.toggleMute();
            if (isVideo) {
                document.getElementById('nv-btn-cam').onclick = () => this.toggleVideo();
            }
            document.getElementById('nv-btn-hangup').onclick = () => this.endCall();
        }

        _attachRemoteStream(stream) {
            const remoteVideo = document.getElementById('nv-remote-video');
            if (remoteVideo) {
                remoteVideo.srcObject = stream;
            }
            const remoteAudio = document.getElementById('nv-remote-audio');
            if (remoteAudio) {
                remoteAudio.srcObject = stream;
            }
        }

        _startTimer() {
            this._stopTimer();
            this.callSeconds = 0;
            this.callTimerInterval = setInterval(() => {
                this.callSeconds++;
                const timerEl = document.getElementById('nv-call-timer');
                if (timerEl) {
                    timerEl.textContent = this._formatDuration(this.callSeconds);
                }
            }, 1000);
        }

        _stopTimer() {
            if (this.callTimerInterval) {
                clearInterval(this.callTimerInterval);
                this.callTimerInterval = null;
            }
        }

        _formatDuration(totalSec) {
            const mins = Math.floor(totalSec / 60);
            const secs = totalSec % 60;
            return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }

        _dismissModal() {
            if (this.root) this.root.innerHTML = '';
        }

        _cleanupMedia() {
            if (this.localStream) {
                this.localStream.getTracks().forEach(t => t.stop());
                this.localStream = null;
            }
            if (this.remoteStream) {
                this.remoteStream.getTracks().forEach(t => t.stop());
                this.remoteStream = null;
            }
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }
            this.isAudioMuted = false;
            this.isVideoDisabled = false;
        }

        _showToast(msg) {
            const toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(17, 17, 24, 0.95);
                border: 1px solid var(--nv-cyan, #00f0ff);
                color: #fff;
                padding: 10px 20px;
                border-radius: 20px;
                font-size: 0.9rem;
                z-index: 10005;
                box-shadow: 0 4px 16px rgba(0,0,0,0.5);
                animation: fadeIn 0.2s ease;
            `;
            toast.textContent = msg;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    window.NVCallManager = new WebRTCCallManager();
})();
