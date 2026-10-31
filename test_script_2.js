
    (function() {
      'use strict';
      const STORAGE_KEY = 'nostalgicverse_support_prompt_state';
      const ACTIVE_TIME_KEY = 'nostalgicverse_active_time_ms';
      const TARGET_ACTIVE_MS = 120000;
      const INACTIVITY_TIMEOUT_MS = 30000;

      function safeGet(k) {
        try { return localStorage.getItem(k); } catch (e) { return null; }
      }
      function safeSet(k, v) {
        try { localStorage.setItem(k, v); } catch (e) {}
      }

      const currentState = safeGet(STORAGE_KEY);
      if (currentState === 'shown' || currentState === 'accepted' || currentState === 'declined' || currentState === 'later') {
        return;
      }

      const modal = document.getElementById('support-modal');
      const backdrop = document.getElementById('support-modal-backdrop');
      const btnYes = document.getElementById('support-btn-yes');
      const btnNo = document.getElementById('support-btn-no');
      const btnLater = document.getElementById('support-btn-later');
      const btnClose = document.getElementById('support-modal-close-btn');

      if (!modal || !backdrop) return;

      let lastActive = Date.now();
      let accumulatedMs = parseInt(safeGet(ACTIVE_TIME_KEY) || '0', 10);
      if (isNaN(accumulatedMs) || accumulatedMs < 0) accumulatedMs = 0;

      let previousFocusedElement = null;
      let isModalOpen = false;

      function onActivity() {
        lastActive = Date.now();
      }
      ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'].forEach(function(evt) {
        window.addEventListener(evt, onActivity, { passive: true });
      });

      window.addEventListener('storage', function(e) {
        if (e.key === STORAGE_KEY) {
          if (e.newValue === 'shown' || e.newValue === 'accepted' || e.newValue === 'declined' || e.newValue === 'later') {
            closeModal(false);
          }
        }
      });

      function openModal() {
        if (isModalOpen) return;
        const state = safeGet(STORAGE_KEY);
        if (state === 'shown' || state === 'accepted' || state === 'declined' || state === 'later') return;

        safeSet(STORAGE_KEY, 'shown');
        isModalOpen = true;
        previousFocusedElement = document.activeElement;

        backdrop.style.display = 'block';
        modal.style.display = 'flex';
        document.body.classList.add('support-modal-open');

        if (btnYes) btnYes.focus();
      }

      function closeModal(recordState, stateValue) {
        if (recordState && stateValue) {
          safeSet(STORAGE_KEY, stateValue);
        }
        isModalOpen = false;
        if (backdrop) backdrop.style.display = 'none';
        if (modal) modal.style.display = 'none';
        document.body.classList.remove('support-modal-open');

        if (previousFocusedElement && typeof previousFocusedElement.focus === 'function') {
          try { previousFocusedElement.focus(); } catch (e) {}
        }
      }

      if (btnYes) {
        btnYes.addEventListener('click', function() {
          closeModal(true, 'accepted');
          window.location.href = '/support/';
        });
      }
      if (btnNo) {
        btnNo.addEventListener('click', function() {
          closeModal(true, 'declined');
        });
      }
      if (btnLater) {
        btnLater.addEventListener('click', function() {
          closeModal(true, 'later');
        });
      }
      if (btnClose) {
        btnClose.addEventListener('click', function() {
          closeModal(true, 'later');
        });
      }

      document.addEventListener('keydown', function(e) {
        if (!isModalOpen) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          closeModal(true, 'later');
          return;
        }
        if (e.key === 'Tab') {
          const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          if (!focusables.length) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      });

      const interval = setInterval(function() {
        const state = safeGet(STORAGE_KEY);
        if (state === 'shown' || state === 'accepted' || state === 'declined' || state === 'later') {
          clearInterval(interval);
          return;
        }

        const now = Date.now();
        const idleTime = now - lastActive;
        const isDocumentVisible = document.visibilityState === 'visible';

        if (isDocumentVisible && idleTime < INACTIVITY_TIMEOUT_MS) {
          accumulatedMs += 1000;
          safeSet(ACTIVE_TIME_KEY, accumulatedMs.toString());
          if (accumulatedMs >= TARGET_ACTIVE_MS) {
            clearInterval(interval);
            openModal();
          }
        }
      }, 1000);
    })();
  