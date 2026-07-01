/**
 * dashboard.js  — API integration
 *
 * Endpoint: GET /api/employees/dashboard/{employeePrimeId}
 *
 * Assumes hrms_employee_prime_id is stored in localStorage after login.
 */

const BASE_EMP_URL = 'http://localhost:8086';

const sidebar      = document.getElementById('sidebar');
  const mainContent  = document.getElementById('mainContent');
  const collapseBtn  = document.getElementById('collapseSidebarBtn');
  const mobileToggle = document.getElementById('mobileToggleBtn');
  const profileBtn   = document.getElementById('profileDropdownBtn');
  const profileDropdown = document.getElementById('profileDropdown');

  let isProgrammaticResize = false;

  /* ─────────────────────────────────────────────
   * SIDEBAR COLLAPSE
   * ───────────────────────────────────────────── */
  function setSidebarCollapsed(isCollapsed, skipStorage = false) {
    sidebar.classList.toggle('collapsed', isCollapsed);
    mainContent.classList.toggle('sidebar-collapsed', isCollapsed);

    const icon = collapseBtn?.querySelector('i');
    if (icon) icon.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';

    if (!skipStorage) {
      localStorage.setItem('hrms_sidebar_collapsed', isCollapsed ? 'true' : 'false');
    }
  }

  function toggleCollapse() {
    setSidebarCollapsed(!sidebar.classList.contains('collapsed'));
  }

  if (collapseBtn) collapseBtn.addEventListener('click', toggleCollapse);

  /* ─────────────────────────────────────────────
   * MOBILE SIDEBAR
   * ───────────────────────────────────────────── */
  if (mobileToggle) {
    mobileToggle.addEventListener('click', e => {
      e.stopPropagation();
      sidebar.classList.toggle('mobile-open');
    });
  }

  document.addEventListener('click', e => {
    // Close mobile sidebar on outside click
    if (
      window.innerWidth <= 768 &&
      sidebar &&
      mobileToggle &&
      !sidebar.contains(e.target) &&
      !mobileToggle.contains(e.target)
    ) {
      sidebar.classList.remove('mobile-open');
    }

    // Close profile dropdown on outside click
    if (profileDropdown && profileBtn && !profileBtn.contains(e.target)) {
      profileDropdown.classList.remove('active');
    }
  });

  /* ─────────────────────────────────────────────
   * PROFILE DROPDOWN
   * ───────────────────────────────────────────── */
  if (profileBtn) {
    profileBtn.addEventListener('click', e => {
      e.stopPropagation();
      profileDropdown.classList.toggle('active');
    });
  }

  // ── LOGOUT BUTTONS ────────────────────────────
  // auth.js rebinds ALL logout triggers after DOMContentLoaded.
  // Nothing to do here — do not add confirm() or handleLogout().

  /* ─────────────────────────────────────────────
   * DATE / TIME
   * ───────────────────────────────────────────── */
  function updateDateTime() {
    const el = document.getElementById('currentDateTime');
    if (!el) return;
    el.innerText = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year:    'numeric',
      month:   'long',
      day:     'numeric',
    });
  }

  updateDateTime();
  setInterval(updateDateTime, 60000);


async function initDashboardCharts() {
  const employeePrimeId = localStorage.getItem('hrms_employee_prime_id');

  let data = null;

  if (employeePrimeId) {
    try {
      const res = await fetch(`${BASE_EMP_URL}/api/employees/dashboard/${employeePrimeId}`);
      if (res.ok) {
        data = await res.json();
      } else {
        console.warn('Dashboard API returned', res.status);
      }
    } catch (err) {
      console.warn('Dashboard API unreachable', err);
    }
  }

  if (!data) return; // nothing to render if API failed and no fallback needed

  // ── Stat cards ────────────────────────────────────────────────────────────

  const todayStatusEl = document.querySelector('.stat-card.blue .stat-value');
  if (todayStatusEl) todayStatusEl.textContent = data.todayStatus ?? 'Not Marked';

  const workingHoursEl = document.querySelector('.stat-card.green .stat-value');
  if (workingHoursEl) workingHoursEl.textContent = `${data.todayHours ?? 0} hrs`;

  // leaveRemaining  → the big number shown as "X Days"
  // leaveUsed       → the "Used: X" subtext
  // leaveAllotted   → total (optional tooltip/title if you want to show it)
  const leaveBalanceEl = document.querySelector('.stat-card.orange .stat-value');
  if (leaveBalanceEl) leaveBalanceEl.textContent = `${data.leaveRemaining ?? 0} Days`;

  const leaveUsedEl = document.querySelector('.stat-card.orange .stat-text');
  if (leaveUsedEl) leaveUsedEl.textContent = `Used: ${data.leaveUsed ?? 0}`;

  // ── Weekly line chart ─────────────────────────────────────────────────────
  const attendanceCtxEl = document.getElementById('attendanceChart');
  if (attendanceCtxEl) {
    new Chart(attendanceCtxEl.getContext('2d'), {
      type: 'line',
      data: {
        labels: data.weeklyLabels,
        datasets: [{
          label: 'Hours Worked',
          data: data.weeklyHours,
          borderColor: '#1F6F7F',
          backgroundColor: 'rgba(31,111,127,0.08)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: 10,
            ticks: { stepSize: 2 },
          },
        },
      },
    });
  }

  // ── Monthly bar chart ─────────────────────────────────────────────────────
  const taskCtxEl = document.getElementById('taskChart');
  if (taskCtxEl) {
    new Chart(taskCtxEl.getContext('2d'), {
      type: 'bar',
      data: {
        labels: data.monthlyLabels,
        datasets: [{
          label: 'Hours Worked',
          data: data.monthlyHours,
          backgroundColor: '#6FAF2E',
          borderRadius: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax: 10,
            ticks: { stepSize: 2 },
          },
        },
      },
    });
  }
}

document.addEventListener('DOMContentLoaded', initDashboardCharts);


 /* ─────────────────────────────────────────────
   * SIDEBAR RESTORE on load
   * ───────────────────────────────────────────── */
  if (window.innerWidth > 768) {
    const saved = localStorage.getItem('hrms_sidebar_collapsed') === 'true';
    setSidebarCollapsed(saved, true);
  }

  /* ─────────────────────────────────────────────
   * RESIZE HANDLER
   * ───────────────────────────────────────────── */
  window.addEventListener('resize', () => {
    if (isProgrammaticResize) return;
    isProgrammaticResize = true;

    if (window.innerWidth <= 768) {
      sidebar.classList.remove('collapsed', 'mobile-open');
      mainContent.classList.remove('sidebar-collapsed');
    } else {
      const stored = localStorage.getItem('hrms_sidebar_collapsed') === 'true';
      setSidebarCollapsed(stored, true);
    }

    setTimeout(() => { isProgrammaticResize = false; }, 100);
  });
