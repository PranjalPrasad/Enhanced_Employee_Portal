/**
 * auth.js — Shared Authentication Module
 * SIEC Employee Portal
 *
 * Link this script on EVERY protected page (dashboard, profile, attendance, etc.)
 * It handles:
 *   1. Session guard  — redirects to login if not authenticated
 *   2. Logout flow    — confirmation overlay + cookie clearing via API
 *   3. UI population  — fills userName, userRole, avatar initials wherever those
 *                       elements exist on the page
 *
 * Usage:
 *   <script src="../js/auth.js"></script>
 *   Place it just before </body> on every protected page.
 *   It runs automatically; no init call needed.
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
   * CONFIG
   * ───────────────────────────────────────────── */
  const BASE_URL       = 'http://localhost:8086';
  const LOGOUT_URL     = BASE_URL + '/api/employee/auth/logout';   // POST — clears HttpOnly cookies server-side
  const LOGIN_PAGE     = '/index.html';                            // Redirect target on session loss
  const SESSION_KEY    = 'hrms_authenticated';                     // Lightweight flag (no tokens stored here)

  /* ─────────────────────────────────────────────
   * SESSION GUARD
   * Runs immediately. If no session flag is found
   * the user is sent back to login right away.
   * ───────────────────────────────────────────── */
  function guardSession() {
    if (localStorage.getItem(SESSION_KEY) !== 'true') {
      redirectToLogin();
    }
  }

  function redirectToLogin() {
    // Clean up any leftover display data before leaving
    clearLocalSession();
    window.location.replace(LOGIN_PAGE);
  }

  /* ─────────────────────────────────────────────
   * LOCAL SESSION HELPERS
   * Only non-sensitive display fields are stored
   * in localStorage. Tokens live in HttpOnly cookies
   * managed exclusively by the browser/server.
   * ───────────────────────────────────────────── */
  const SESSION_DISPLAY_KEYS = [
    SESSION_KEY,
    'hrms_employee_id',
    'hrms_employee_prime_id',
    'hrms_first_name',
    'hrms_full_name',
    'hrms_designation',
    'hrms_department',
    'hrms_work_email',
    'hrms_login_ts',
  ];

  function clearLocalSession() {
    SESSION_DISPLAY_KEYS.forEach(k => localStorage.removeItem(k));
  }

  /* ─────────────────────────────────────────────
   * LOGOUT OVERLAY
   * Injects a modal into the current page and
   * waits for user confirmation before proceeding.
   * ───────────────────────────────────────────── */
  function injectOverlayStyles() {
    if (document.getElementById('auth-overlay-style')) return;
    const style = document.createElement('style');
    style.id = 'auth-overlay-style';
    style.textContent = `
      #auth-logout-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        background: rgba(10, 25, 35, 0.55);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.22s ease;
        pointer-events: none;
      }
      #auth-logout-overlay.visible {
        opacity: 1;
        pointer-events: all;
      }
      #auth-logout-box {
        background: #ffffff;
        border-radius: 18px;
        padding: 2rem 2.2rem 1.6rem;
        width: min(360px, 90vw);
        box-shadow: 0 20px 60px rgba(10, 25, 35, 0.22);
        text-align: center;
        transform: translateY(16px) scale(0.97);
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        border: 1px solid rgba(31,111,127,0.12);
      }
      #auth-logout-overlay.visible #auth-logout-box {
        transform: translateY(0) scale(1);
      }
      #auth-logout-box .auth-icon {
        width: 54px;
        height: 54px;
        border-radius: 50%;
        background: linear-gradient(135deg, #fff3f3 0%, #ffe0e0 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1rem;
        font-size: 1.4rem;
        color: #d9534f;
      }
      #auth-logout-box h3 {
        font-family: 'Poppins', sans-serif;
        font-size: 1.1rem;
        font-weight: 600;
        color: #1a2e38;
        margin: 0 0 0.35rem;
      }
      #auth-logout-box p {
        font-size: 0.82rem;
        color: #64748B;
        margin: 0 0 1.5rem;
        line-height: 1.5;
      }
      .auth-overlay-actions {
        display: flex;
        gap: 10px;
      }
      .auth-btn-cancel,
      .auth-btn-confirm {
        flex: 1;
        padding: 0.72rem 0;
        border-radius: 10px;
        font-family: 'Poppins', sans-serif;
        font-size: 0.88rem;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: all 0.18s ease;
      }
      .auth-btn-cancel {
        background: #f1f5f9;
        color: #475569;
      }
      .auth-btn-cancel:hover { background: #e2e8f0; }
      .auth-btn-confirm {
        background: linear-gradient(105deg, #d9534f 0%, #e07b78 100%);
        color: #fff;
        box-shadow: 0 4px 12px rgba(217,83,79,0.28);
      }
      .auth-btn-confirm:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(217,83,79,0.38);
      }
      .auth-btn-confirm:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(style);
  }

  function buildOverlay() {
    if (document.getElementById('auth-logout-overlay')) return;
    injectOverlayStyles();

    const overlay = document.createElement('div');
    overlay.id = 'auth-logout-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'auth-logout-title');
    overlay.innerHTML = `
      <div id="auth-logout-box">
        <div class="auth-icon">
          <i class="fas fa-sign-out-alt"></i>
        </div>
        <h3 id="auth-logout-title">Sign out?</h3>
        <p>You will be returned to the login screen. Any unsaved changes will be lost.</p>
        <div class="auth-overlay-actions">
          <button class="auth-btn-cancel" id="auth-cancel-btn">Cancel</button>
          <button class="auth-btn-confirm" id="auth-confirm-btn">
            <span id="auth-confirm-text">Yes, sign out</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Cancel
    document.getElementById('auth-cancel-btn').addEventListener('click', closeOverlay);

    // Click outside box to dismiss
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeOverlay();
    });

    // Keyboard: Escape to cancel, Enter to confirm
    document.addEventListener('keydown', handleOverlayKeydown);
  }

  function handleOverlayKeydown(e) {
    const overlay = document.getElementById('auth-logout-overlay');
    if (!overlay || !overlay.classList.contains('visible')) return;
    if (e.key === 'Escape') { e.preventDefault(); closeOverlay(); }
    if (e.key === 'Enter')  { e.preventDefault(); performLogout(); }
  }

  function openOverlay() {
    buildOverlay();
    // Small tick so CSS transition fires
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const overlay = document.getElementById('auth-logout-overlay');
        if (overlay) overlay.classList.add('visible');

        // Wire confirm button fresh each open (avoids stale listener)
        const confirmBtn = document.getElementById('auth-confirm-btn');
        if (confirmBtn) {
          // Clone to strip old listeners
          const fresh = confirmBtn.cloneNode(true);
          confirmBtn.parentNode.replaceChild(fresh, confirmBtn);
          fresh.addEventListener('click', performLogout);
        }
      });
    });
  }

  function closeOverlay() {
    const overlay = document.getElementById('auth-logout-overlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
  }

  /* ─────────────────────────────────────────────
   * LOGOUT EXECUTION
   * Calls server to clear HttpOnly cookies, then
   * wipes local session data and redirects.
   * ───────────────────────────────────────────── */
  async function performLogout() {
    const confirmBtn = document.getElementById('auth-confirm-btn');
    const confirmText = document.getElementById('auth-confirm-text');

    // Show loading state
    if (confirmBtn) {
      confirmBtn.disabled = true;
      if (confirmText) confirmText.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Signing out…';
    }

    try {
      // Server-side: invalidate refresh token + clear HttpOnly cookies
      await fetch(LOGOUT_URL, {
        method: 'POST',
        credentials: 'include',   // sends employee_token cookie automatically
        headers: { 'Content-Type': 'application/json' },
      });
      // We proceed regardless of response — even if the server is unreachable
      // the user's local session is still cleared, which is the safe outcome.
    } catch (_) {
      // Network error — still log out locally. Server token will expire naturally.
    }

    clearLocalSession();
    window.location.replace(LOGIN_PAGE);
  }

  /* ─────────────────────────────────────────────
   * BIND LOGOUT TRIGGERS
   * Finds ALL elements with [data-logout] or the
   * well-known class/id names used in dashboard.
   * Call this after DOM is ready.
   * ───────────────────────────────────────────── */
  function bindLogoutTriggers() {
    const selectors = [
      '[data-logout]',          // recommended going forward — add data-logout to any button
      '#logoutBtn',             // sidebar logout button (dashboard layout)
      '.logout-item',           // dropdown logout item
      '.logout-btn',            // any standalone logout button
    ];

    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        // Remove any previously attached native confirm() handlers to avoid conflicts
        // Clone-replace to strip all old listeners cleanly
        const clone = el.cloneNode(true);
        el.parentNode.replaceChild(clone, el);
        clone.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          openOverlay();
        });
      });
    });
  }

  /* ─────────────────────────────────────────────
   * UI POPULATION
   * Reads display data from localStorage and fills
   * standard element IDs used across the portal.
   * ───────────────────────────────────────────── */
  function populateUserUI() {
     const firstName = localStorage.getItem('hrms_first_name') || '';
    const lastName  = localStorage.getItem('hrms_last_name')  || '';
    const fullName  = (firstName + ' ' + lastName).trim() || 'Employee';

    const designation = localStorage.getItem('hrms_designation')  || '';
    const department  = localStorage.getItem('hrms_department')   || '';
    const role        = designation || department || 'Employee';

    const initials = fullName
      ? fullName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
      : 'E';

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    set('userName',          fullName || firstName);
    set('userRole',          role);
    set('userAvatar',        initials);
    set('dashboardUserName', firstName);

    // Greeting
    const greetingEl = document.getElementById('greetingMessage');
    if (greetingEl) {
      const h = new Date().getHours();
      const g = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
      greetingEl.innerText = `${g}! Here's your dashboard overview.`;
    }
  }

  /* ─────────────────────────────────────────────
   * BOOT
   * ───────────────────────────────────────────── */
  function boot() {
    guardSession();           // Redirect immediately if no session
    populateUserUI();         // Fill in name/role/avatar
    bindLogoutTriggers();     // Hook all logout buttons to overlay
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot(); // DOM already ready
  }

})();
