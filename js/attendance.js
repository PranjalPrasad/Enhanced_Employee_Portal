// ============================================================
//  HRMS — attendance.js  |  Full API Integration
// ============================================================

/* ── Config ─────────────────────────────────────────────── */
const BASE_URL     = 'http://localhost:8086';
const EMP_PRIME_ID = () => parseInt(localStorage.getItem('hrms_employee_prime_id'));
const PAGE_SIZE    = 10;

/* ── State ──────────────────────────────────────────────── */
let allRecords          = [];   // flat array from all pages
let currentPage         = 0;
let totalPages          = 1;
let timerInterval       = null;
let sessionCheckIn      = null; // ISO string, set when live check-in happens
let currentEditRecord   = null; // record object being edited in modal
let selectedCheckInStatus = null; // tracks chosen status pill

/* ── Utilities ──────────────────────────────────────────── */

//Before
// function getTodayStr() { return new Date().toISOString().split('T')[0]; }

// AFTER
function getTodayStr() {
  const now = new Date();
  // IST = UTC + 5:30 → add 330 minutes to UTC
  const istOffset = 330 - (-now.getTimezoneOffset()); // handles any local tz
  const ist = new Date(now.getTime() + istOffset * 60000);
  return ist.toISOString().split('T')[0];
}

function fmt12(timeStr) {
  // "09:15:00" → "09:15 AM"
  if (!timeStr || timeStr === '--:--') return '--:--';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = ((h % 12) || 12).toString().padStart(2, '0');
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function hmsNow() {
  const n = new Date();
  return [n.getHours(), n.getMinutes(), n.getSeconds()]
    .map(v => String(v).padStart(2, '0')).join(':');
}

function dateNow() { return getTodayStr(); }

function hoursLabel(h) {
  if (h == null || isNaN(h)) return '0.0 hrs';
  return `${Math.abs(h).toFixed(1)} hrs`;
}

function statusColor(status) {
  const m = {
    Present:   '#6faf2e',
    Absent:    '#e56c6c',
    Late:      '#f59e0b',
    'Half Day':'#8b5cf6',
    WFH:       '#1B738C'
  };
  return m[status] || '#64748b';
}

function showToast(msg, type = 'success') {
  Toastify({
    text: type === 'success' ? `✓ ${msg}` : `✕ ${msg}`,
    duration: 3500,
    gravity: 'bottom', position: 'right',
    backgroundColor: type === 'success' ? '#6faf2e' : '#e56c6c',
    stopOnFocus: true,
    style: { borderRadius: '10px', padding: '12px 16px', fontSize: '13.5px', fontWeight: '500' }
  }).showToast();
}

/* ── Session persistence (localStorage) ─────────────────── */
const SESSION_KEY = 'hrms_live_session';

function saveSession(checkInTime) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ date: getTodayStr(), checkInTime }));
}
function clearSession() { localStorage.removeItem(SESSION_KEY); }
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s.date === getTodayStr() ? s : null;
  } catch { return null; }
}

/* ── API calls ───────────────────────────────────────────── */
async function apiCheckIn() {
  const now = hmsNow();
  const payload = {
    employeePrimeId: EMP_PRIME_ID(),
    attendanceDate:  dateNow(),
    checkInTime:     now,
    checkOutTime:    null,
    status:          selectedCheckInStatus || 'Present',  // use selected pill status
    notes:           'Regular working day'
  };
  const res = await fetch(`${BASE_URL}/api/attendance/check-in`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Check-in failed (${res.status})`);
  return now;
}

async function apiCheckOut() {
  const res = await fetch(`${BASE_URL}/api/attendance/check-out/${EMP_PRIME_ID()}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`Check-out failed (${res.status})`);
  return hmsNow();
}

async function apiUpdateNote(notes) {
  const res = await fetch(`${BASE_URL}/api/attendance/update/${EMP_PRIME_ID()}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ notes })
  });
  if (!res.ok) throw new Error(`Update failed (${res.status})`);
}

async function apiFetchPage(page = 0) {
  const url = `${BASE_URL}/api/attendance/all-attendance-employee/${EMP_PRIME_ID()}` +
              `?page=${page}&size=${PAGE_SIZE}&sortBy=attendanceDate&sortDir=desc`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  return res.json();
}

async function fetchAllRecords() {
  try {
    allRecords = [];
    let page = 0;
    while (true) {
      const data = await apiFetchPage(page);
      allRecords = allRecords.concat(data.content || []);
      if (data.isLast || page >= (data.totalPages - 1)) break;
      page++;
    }
    allRecords.sort((a, b) => new Date(b.attendanceDate) - new Date(a.attendanceDate));
  } catch (err) {
    console.error('[Attendance] fetchAllRecords:', err);
  }
}

/* ── Today's record from allRecords ─────────────────────── */
function getTodayRecord() {
  return allRecords.find(r => r.attendanceDate === getTodayStr()) || null;
}

/* ── Check-In Status Pills ───────────────────────────────── */
function initStatusPills() {
  document.querySelectorAll('.status-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Deselect all, then select clicked
      document.querySelectorAll('.status-option-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedCheckInStatus = btn.dataset.value;

      // Enable Check In only if user hasn't already checked in / out today
      const sess       = loadSession();
      const todayRec   = getTodayRecord();
      const alreadyDone = sess || (todayRec && todayRec.checkOutTime);
      document.getElementById('checkInBtn').disabled = !!alreadyDone;
    });
  });
}

/* ── Reset status pills (called after successful check-in) ─ */
function resetStatusPills() {
  selectedCheckInStatus = null;
  document.querySelectorAll('.status-option-btn').forEach(b => b.classList.remove('selected'));
  const wrap = document.getElementById('checkInStatusWrap');
  if (wrap) wrap.classList.add('hidden');
  document.getElementById('checkInBtn').disabled = true;
}

/* ── UI — Stat cards ─────────────────────────────────────── */
function refreshStatCards() {
  const sess     = loadSession();
  const todayRec = getTodayRecord();

  // Session badge + status text
  let sessionLabel = 'Not Checked In';
  let badgeClass   = 'badge-secondary';
  if (sess)                               { sessionLabel = 'Checked In';  badgeClass = 'badge-warning'; }
  else if (todayRec && todayRec.checkOutTime) { sessionLabel = 'Checked Out'; badgeClass = 'badge-success'; }

  document.getElementById('sessionBadge').textContent = sessionLabel;
  document.getElementById('sessionBadge').className   = `badge ${badgeClass}`;
  document.getElementById('todayStatusText').textContent = sessionLabel;

  // Check-in / check-out times
  const ciTime = sess
    ? fmt12(sess.checkInTime)
    : (todayRec ? fmt12(todayRec.checkInTime) : '--:--');
  const coTime = (!sess && todayRec && todayRec.checkOutTime)
    ? fmt12(todayRec.checkOutTime) : '--:--';

  document.getElementById('checkInTimeDisplay').textContent  = ciTime;
  document.getElementById('checkOutTimeDisplay').textContent = coTime;

  // Today hours
  const hrs = todayRec ? Math.abs(todayRec.totalHours || 0) : 0;
  document.getElementById('todayHoursDisplay').textContent = hoursLabel(hrs);

  // Sub line
  const sub = document.getElementById('runningTimerSub');
  sub.innerHTML = sess
    ? '<i class="fas fa-hourglass-half"></i> Live tracking…'
    : 'Total recorded today';

  // Button states
  const alreadyDone = sess || (todayRec && todayRec.checkOutTime);
  // Check In: enabled only if a status pill is selected AND not already done
  document.getElementById('checkInBtn').disabled  = alreadyDone || !selectedCheckInStatus;
  document.getElementById('checkOutBtn').disabled = !sess;

  // Live timer visibility
  document.getElementById('liveTimer').style.display = sess ? 'inline-flex' : 'none';

  // Status pill wrapper: hide once user has checked in or fully done for today
  const wrap = document.getElementById('checkInStatusWrap');
  if (wrap) {
    if (alreadyDone) {
      wrap.classList.add('hidden');
      // Reset pill selection silently
      selectedCheckInStatus = null;
      document.querySelectorAll('.status-option-btn').forEach(b => b.classList.remove('selected'));
      document.getElementById('checkInBtn').disabled = true;
    } else {
      wrap.classList.remove('hidden');
    }
  }
}

/* ── Live timer tick ─────────────────────────────────────── */
function tickTimer() {
  const sess = loadSession();
  if (!sess) { document.getElementById('liveTimer').style.display = 'none'; return; }
  const [h, m, s] = sess.checkInTime.split(':').map(Number);
  const start = new Date();
  start.setHours(h, m, s, 0);
  const diff = Math.max(0, Math.floor((new Date() - start) / 1000));
  const hh   = Math.floor(diff / 3600);
  const mm   = Math.floor((diff % 3600) / 60);
  const ss   = diff % 60;
  document.getElementById('liveTimer').textContent =
    `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

/* ── Check-in action ─────────────────────────────────────── */
document.getElementById('checkInBtn').addEventListener('click', async () => {
  if (!selectedCheckInStatus) {
    showToast('Please select a status before checking in', 'error');
    return;
  }
  const sess = loadSession();
  if (sess) { showToast('Already checked in!', 'error'); return; }
  const todayRec = getTodayRecord();
  if (todayRec && todayRec.checkOutTime) { showToast('Already checked out today.', 'error'); return; }

  document.getElementById('checkInBtn').disabled = true;
  try {
    const checkInTime = await apiCheckIn();
    saveSession(checkInTime);
    await fetchAllRecords();

    // Hide pills and reset after successful check-in
    resetStatusPills();

    refreshStatCards();
    renderTable();
    showToast(`Checked in at ${fmt12(checkInTime)} · ${selectedCheckInStatus || 'Present'}`);

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tickTimer, 1000);
  } catch (err) {
    console.error('[Attendance] checkIn:', err);
    showToast(err.message || 'Check-in failed', 'error');
    // Re-enable only if a status is still selected
    document.getElementById('checkInBtn').disabled = !selectedCheckInStatus;
  }
});

/* ── Check-out action ────────────────────────────────────── */
document.getElementById('checkOutBtn').addEventListener('click', async () => {
  if (!loadSession()) { showToast('No active session.', 'error'); return; }
  document.getElementById('checkOutBtn').disabled = true;
  try {
    const checkOutTime = await apiCheckOut();
    clearSession();
    if (timerInterval) clearInterval(timerInterval);
    await fetchAllRecords();
    refreshStatCards();
    renderTable();
    showToast(`Checked out at ${fmt12(checkOutTime)}`);
  } catch (err) {
    console.error('[Attendance] checkOut:', err);
    showToast(err.message || 'Check-out failed', 'error');
    document.getElementById('checkOutBtn').disabled = false;
  }
});

/* ── Table rendering ─────────────────────────────────────── */
function renderTable() {
  const fromDate     = document.getElementById('filterDateFrom').value;
  const toDate       = document.getElementById('filterDateTo').value;
  const statusFilter = document.getElementById('filterStatus').value;

  let filtered = [...allRecords];
  if (fromDate)               filtered = filtered.filter(r => r.attendanceDate >= fromDate);
  if (toDate)                 filtered = filtered.filter(r => r.attendanceDate <= toDate);
  if (statusFilter !== 'all') filtered = filtered.filter(r => r.status === statusFilter);

  const tbody = document.getElementById('attendanceTableBody');

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">
        <i class="fas fa-calendar-times" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>
        No attendance records found
      </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(rec => {
    const color = statusColor(rec.status);
    const hrs   = Math.abs(rec.totalHours || 0);
    return `
      <tr>
        <td><span class="date-cell">${rec.attendanceDate}</span></td>
        <td><strong>${fmt12(rec.checkInTime)}</strong></td>
        <td>${fmt12(rec.checkOutTime)}</td>
        <td>${hoursLabel(hrs)}</td>
        <td>
          <span class="status-badge-table"
                style="background:${color}18;color:${color};border:1px solid ${color}33">
            ${rec.status}
          </span>
        </td>
        <td>
          <button class="btn-action-edit" data-id="${rec.attendanceId}" title="Edit notes">
            <i class="fas fa-pen"></i>
          </button>
        </td>
      </tr>`;
  }).join('');

  // Bind edit buttons
  document.querySelectorAll('.btn-action-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id  = parseInt(btn.dataset.id);
      const rec = allRecords.find(r => r.attendanceId === id);
      if (rec) openEditModal(rec);
    });
  });
}

/* ── Edit Modal ──────────────────────────────────────────── */
function openEditModal(rec) {
  currentEditRecord = rec;
  document.getElementById('editModalDate').textContent     = rec.attendanceDate;
  document.getElementById('editModalStatus').textContent   = rec.status;
  document.getElementById('editModalCheckin').textContent  = fmt12(rec.checkInTime);
  document.getElementById('editModalCheckout').textContent = fmt12(rec.checkOutTime);
  document.getElementById('editNotesInput').value          = rec.notes || '';
  document.getElementById('editCharCount').textContent     = (rec.notes || '').length;
  document.getElementById('editModal').classList.add('active');
  document.getElementById('editNotesInput').focus();
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('active');
  currentEditRecord = null;
}

document.getElementById('editModalClose').addEventListener('click', closeEditModal);
document.getElementById('editModalCancel').addEventListener('click', closeEditModal);
document.getElementById('editModal').addEventListener('click', e => {
  if (e.target === document.getElementById('editModal')) closeEditModal();
});

document.getElementById('editModalSave').addEventListener('click', async () => {
  if (!currentEditRecord) return;
  const notes = document.getElementById('editNotesInput').value.trim();
  const btn   = document.getElementById('editModalSave');
  btn.disabled  = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving…';
  try {
    await apiUpdateNote(notes);
    const idx = allRecords.findIndex(r => r.attendanceId === currentEditRecord.attendanceId);
    if (idx !== -1) allRecords[idx].notes = notes;
    closeEditModal();
    renderTable();
    showToast('Notes updated successfully');
  } catch (err) {
    console.error('[Attendance] updateNote:', err);
    showToast(err.message || 'Update failed', 'error');
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
  }
});

/* ── Monthly Summary Modal ───────────────────────────────── */
function populateYearSelect() {
  const sel = document.getElementById('yearSelect');
  sel.innerHTML = '';
  const cur = new Date().getFullYear();
  for (let y = cur - 2; y <= cur + 1; y++) {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y;
    if (y === cur) opt.selected = true;
    sel.appendChild(opt);
  }
}

function loadMonthlySummary(year, month) {
  const paddedMonth = String(month + 1).padStart(2, '0');
  const monthRecords = allRecords.filter(r => {
    const [y, m] = r.attendanceDate.split('-');
    return parseInt(y) === year && parseInt(m) === (month + 1);
  });

  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const presentCount = monthRecords.filter(r => r.status === 'Present').length;
  const absentCount  = Math.max(0, daysInMonth - monthRecords.length);
  const lateCount    = monthRecords.filter(r => r.status === 'Late').length;
  const totalHrs     = monthRecords.reduce((s, r) => s + Math.abs(r.totalHours || 0), 0);
  const avgHrs       = monthRecords.length > 0 ? totalHrs / monthRecords.length : 0;

  document.getElementById('totalDays').textContent       = daysInMonth;
  document.getElementById('presentDays').textContent     = presentCount;
  document.getElementById('absentDays').textContent      = absentCount;
  document.getElementById('lateDays').textContent        = lateCount;
  document.getElementById('totalHoursMonth').textContent = hoursLabel(totalHrs);
  document.getElementById('avgHours').textContent        = hoursLabel(avgHrs);

  const rows = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${paddedMonth}-${String(d).padStart(2, '0')}`;
    const rec     = monthRecords.find(r => r.attendanceDate === dateStr);
    const dayName = new Date(year, month, d).toLocaleDateString('en-US', { weekday: 'short' });
    const status  = rec?.status || 'Absent';
    const color   = statusColor(status);
    const hrs     = rec ? Math.abs(rec.totalHours || 0) : 0;
    rows.push(`
      <tr>
        <td>${dateStr}</td>
        <td>${dayName}</td>
        <td>${rec ? fmt12(rec.checkInTime)  : '--:--'}</td>
        <td>${rec ? fmt12(rec.checkOutTime) : '--:--'}</td>
        <td>${hoursLabel(hrs)}</td>
        <td>
          <span class="status-indicator"
                style="background:${color}18;color:${color};border:1px solid ${color}33">
            ${status}
          </span>
        </td>
      </tr>`);
  }
  document.getElementById('monthlyTableBody').innerHTML = rows.join('');
  document.getElementById('monthlyModal').style.display = 'flex';
}

function showMonthlySummary() {
  const now = new Date();
  document.getElementById('monthSelect').value = now.getMonth();
  document.getElementById('yearSelect').value  = now.getFullYear();
  loadMonthlySummary(now.getFullYear(), now.getMonth());
}

document.getElementById('viewMonthBtn').addEventListener('click', showMonthlySummary);
document.getElementById('closeModalBtn').addEventListener('click', () => {
  document.getElementById('monthlyModal').style.display = 'none';
});
document.getElementById('monthlyModal').addEventListener('click', e => {
  if (e.target === document.getElementById('monthlyModal'))
    document.getElementById('monthlyModal').style.display = 'none';
});
document.getElementById('monthSelect').addEventListener('change', () => {
  loadMonthlySummary(
    parseInt(document.getElementById('yearSelect').value),
    parseInt(document.getElementById('monthSelect').value)
  );
});
document.getElementById('yearSelect').addEventListener('change', () => {
  loadMonthlySummary(
    parseInt(document.getElementById('yearSelect').value),
    parseInt(document.getElementById('monthSelect').value)
  );
});

/* ── Filters ─────────────────────────────────────────────── */
document.getElementById('filterDateFrom').addEventListener('change', renderTable);
document.getElementById('filterDateTo').addEventListener('change', renderTable);
document.getElementById('filterStatus').addEventListener('change', renderTable);
document.getElementById('resetFiltersBtn').addEventListener('click', () => {
  document.getElementById('filterDateFrom').value = '';
  document.getElementById('filterDateTo').value   = '';
  document.getElementById('filterStatus').value   = 'all';
  renderTable();
});

/* ── Sidebar ─────────────────────────────────────────────── */
document.getElementById('collapseSidebarBtn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
  document.getElementById('mainContent').classList.toggle('sidebar-collapsed');
});
document.getElementById('mobileToggleBtn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('mobile-open');
});

/* ── Profile dropdown ────────────────────────────────────── */
const profileBtn      = document.getElementById('profileDropdownBtn');
const profileDropdown = document.getElementById('profileDropdown');
if (profileBtn && profileDropdown) {
  profileBtn.addEventListener('click', e => {
    e.stopPropagation();
    profileDropdown.classList.toggle('active');
  });
  document.addEventListener('click', e => {
    if (!profileBtn.contains(e.target)) profileDropdown.classList.remove('active');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') profileDropdown.classList.remove('active');
  });
}

/* ── Logout ──────────────────────────────────────────────── */
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  if (confirm('Are you sure you want to logout?')) window.location.href = '../index.html';
});

/* ── Init ────────────────────────────────────────────────── */
async function init() {
  populateYearSelect();
  initStatusPills();

  // Restore live session if exists
  const sess = loadSession();
  if (sess) {
    timerInterval = setInterval(tickTimer, 1000);
  }

  // Loading state
  document.getElementById('attendanceTableBody').innerHTML =
    '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">' +
    '<i class="fas fa-circle-notch fa-spin" style="margin-right:8px;"></i>Loading records…</td></tr>';

  await fetchAllRecords();
  refreshStatCards();
  renderTable();
}

init();
window.addEventListener('beforeunload', () => { if (timerInterval) clearInterval(timerInterval); });













// // ============================================================
// //  HRMS — attendance.js  |  Full API Integration
// // ============================================================

// /* ── Config ─────────────────────────────────────────────── */
// const BASE_URL        = 'http://localhost:8086';
// const EMP_PRIME_ID    = () => parseInt(localStorage.getItem('employeePrimeId') || '1', 10);
// const PAGE_SIZE       = 10;
// let selectedCheckInStatus = null;


// /* ── State ──────────────────────────────────────────────── */
// let allRecords        = [];   // flat array from all pages
// let currentPage       = 0;
// let totalPages        = 1;
// let timerInterval     = null;
// let sessionCheckIn    = null; // ISO string, set when live check-in happens
// let currentEditRecord = null; // record object being edited in modal

// /* ── Utilities ──────────────────────────────────────────── */
// function getTodayStr() { return new Date().toISOString().split('T')[0]; }

// function fmt12(timeStr) {
//   // "09:15:00" → "09:15 AM"
//   if (!timeStr || timeStr === '--:--') return '--:--';
//   const [h, m] = timeStr.split(':').map(Number);
//   const ampm = h >= 12 ? 'PM' : 'AM';
//   const h12 = ((h % 12) || 12).toString().padStart(2, '0');
//   return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
// }

// function hmsNow() {
//   // returns "HH:MM:SS" in local time
//   const n = new Date();
//   return [n.getHours(), n.getMinutes(), n.getSeconds()]
//     .map(v => String(v).padStart(2, '0')).join(':');
// }

// function dateNow() { return getTodayStr(); }

// function hoursLabel(h) {
//   if (h == null || isNaN(h)) return '0.0 hrs';
//   const abs = Math.abs(h);
//   return `${abs.toFixed(1)} hrs`;
// }

// function statusColor(status) {
//   const m = { Present: '#6faf2e', Absent: '#e56c6c', Late: '#f59e0b', 'Half Day': '#8b5cf6' };
//   return m[status] || '#64748b';
// }

// function showToast(msg, type = 'success') {
//   Toastify({
//     text: type === 'success' ? `✓ ${msg}` : `✕ ${msg}`,
//     duration: 3500,
//     gravity: 'bottom', position: 'right',
//     backgroundColor: type === 'success' ? '#6faf2e' : '#e56c6c',
//     stopOnFocus: true,
//     style: { borderRadius: '10px', padding: '12px 16px', fontSize: '13.5px', fontWeight: '500' }
//   }).showToast();
// }

// /* ── Session persistence (localStorage) ─────────────────── */
// const SESSION_KEY = 'hrms_live_session';

// function saveSession(checkInTime) {
//   localStorage.setItem(SESSION_KEY, JSON.stringify({ date: getTodayStr(), checkInTime }));
// }
// function clearSession() { localStorage.removeItem(SESSION_KEY); }
// function loadSession() {
//   try {
//     const raw = localStorage.getItem(SESSION_KEY);
//     if (!raw) return null;
//     const s = JSON.parse(raw);
//     return s.date === getTodayStr() ? s : null;
//   } catch { return null; }
// }

// /* ── API calls ───────────────────────────────────────────── */
// async function apiCheckIn() {
//   const now = hmsNow();
//   const payload = {
//     employeePrimeId: EMP_PRIME_ID(),
//     attendanceDate:  dateNow(),
//     checkInTime:     now,
//     checkOutTime:    null,
//     status:          'Present',
//     notes:           'Regular working day'
//   };
//   const res = await fetch(`${BASE_URL}/api/attendance/check-in`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(payload)
//   });
//   if (!res.ok) throw new Error(`Check-in failed (${res.status})`);
//   return now;
// }

// async function apiCheckOut() {
//   const res = await fetch(`${BASE_URL}/api/attendance/check-out/${EMP_PRIME_ID()}`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' }
//   });
//   if (!res.ok) throw new Error(`Check-out failed (${res.status})`);
//   return hmsNow();
// }

// async function apiUpdateNote(notes) {
//   const res = await fetch(`${BASE_URL}/api/attendance/update/${EMP_PRIME_ID()}`, {
//     method: 'PUT',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ notes })
//   });
//   if (!res.ok) throw new Error(`Update failed (${res.status})`);
// }

// async function apiFetchPage(page = 0) {
//   const url = `${BASE_URL}/api/attendance/all-attendance-employee/${EMP_PRIME_ID()}` +
//               `?page=${page}&size=${PAGE_SIZE}&sortBy=attendanceDate&sortDir=desc`;
//   const res = await fetch(url);
//   if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
//   return res.json();
// }

// async function fetchAllRecords() {
//   try {
//     allRecords = [];
//     let page = 0;
//     while (true) {
//       const data = await apiFetchPage(page);
//       allRecords = allRecords.concat(data.content || []);
//       if (data.isLast || page >= (data.totalPages - 1)) break;
//       page++;
//     }
//     // Sort newest first
//     allRecords.sort((a, b) => new Date(b.attendanceDate) - new Date(a.attendanceDate));
//   } catch (err) {
//     console.error('[Attendance] fetchAllRecords:', err);
//   }
// }

// /* ── Today's record from allRecords ─────────────────────── */
// function getTodayRecord() {
//   return allRecords.find(r => r.attendanceDate === getTodayStr()) || null;
// }

// /* ── UI — Stat cards ─────────────────────────────────────── */
// function refreshStatCards() {
//   const sess = loadSession();
//   const todayRec = getTodayRecord();

//   // Session badge + status
//   let sessionLabel = 'Not Checked In';
//   let badgeClass   = 'badge-secondary';
//   if (sess) { sessionLabel = 'Checked In'; badgeClass = 'badge-warning'; }
//   else if (todayRec && todayRec.checkOutTime) { sessionLabel = 'Checked Out'; badgeClass = 'badge-success'; }

//   document.getElementById('sessionBadge').textContent = sessionLabel;
//   document.getElementById('sessionBadge').className   = `badge ${badgeClass}`;
//   document.getElementById('todayStatusText').textContent = sessionLabel;

//   // Check-in / check-out times
//   const ciTime = sess ? fmt12(sess.checkInTime)
//                : (todayRec ? fmt12(todayRec.checkInTime) : '--:--');
//   const coTime = (!sess && todayRec && todayRec.checkOutTime)
//                ? fmt12(todayRec.checkOutTime) : '--:--';

//   document.getElementById('checkInTimeDisplay').textContent  = ciTime;
//   document.getElementById('checkOutTimeDisplay').textContent = coTime;

//   // Today hours
//   const hrs = todayRec ? Math.abs(todayRec.totalHours || 0) : 0;
//   document.getElementById('todayHoursDisplay').textContent = hoursLabel(hrs);

//   // Sub line
//   const sub = document.getElementById('runningTimerSub');
//   sub.innerHTML = sess ? '<i class="fas fa-hourglass-half"></i> Live tracking…' : 'Total recorded today';

//   // Buttons
//   const canIn  = !sess && !(todayRec && todayRec.checkOutTime);
//   const canOut = !!sess;
//   document.getElementById('checkInBtn').disabled  = !canIn;
//   document.getElementById('checkOutBtn').disabled = !canOut;

//   // Live timer
//   if (sess) {
//     document.getElementById('liveTimer').style.display = 'inline-flex';
//   } else {
//     document.getElementById('liveTimer').style.display = 'none';
//   }
// }

// /* ── Live timer tick ─────────────────────────────────────── */
// function tickTimer() {
//   const sess = loadSession();
//   if (!sess) { document.getElementById('liveTimer').style.display = 'none'; return; }
//   const [h, m, s] = sess.checkInTime.split(':').map(Number);
//   const start = new Date();
//   start.setHours(h, m, s, 0);
//   const diff = Math.max(0, Math.floor((new Date() - start) / 1000));
//   const hh = Math.floor(diff / 3600);
//   const mm = Math.floor((diff % 3600) / 60);
//   const ss = diff % 60;
//   document.getElementById('liveTimer').textContent =
//     `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
// }

// /* ── Check-in action ─────────────────────────────────────── */
// document.getElementById('checkInBtn').addEventListener('click', async () => {
//   const sess = loadSession();
//   if (sess) { showToast('Already checked in!', 'error'); return; }
//   const todayRec = getTodayRecord();
//   if (todayRec && todayRec.checkOutTime) { showToast('Already checked out today.', 'error'); return; }

//   document.getElementById('checkInBtn').disabled = true;
//   try {
//     const checkInTime = await apiCheckIn();
//     saveSession(checkInTime);
//     await fetchAllRecords();
//     refreshStatCards();
//     renderTable();
//     showToast(`Checked in at ${fmt12(checkInTime)}`);
//     if (timerInterval) clearInterval(timerInterval);
//     timerInterval = setInterval(tickTimer, 1000);
//   } catch (err) {
//     console.error('[Attendance] checkIn:', err);
//     showToast(err.message || 'Check-in failed', 'error');
//     document.getElementById('checkInBtn').disabled = false;
//   }
// });

// /* ── Check-out action ────────────────────────────────────── */
// document.getElementById('checkOutBtn').addEventListener('click', async () => {
//   if (!loadSession()) { showToast('No active session.', 'error'); return; }
//   document.getElementById('checkOutBtn').disabled = true;
//   try {
//     const checkOutTime = await apiCheckOut();
//     clearSession();
//     if (timerInterval) clearInterval(timerInterval);
//     await fetchAllRecords();
//     refreshStatCards();
//     renderTable();
//     showToast(`Checked out at ${fmt12(checkOutTime)}`);
//   } catch (err) {
//     console.error('[Attendance] checkOut:', err);
//     showToast(err.message || 'Check-out failed', 'error');
//     document.getElementById('checkOutBtn').disabled = false;
//   }
// });

// /* ── Table rendering ─────────────────────────────────────── */
// function renderTable() {
//   const fromDate    = document.getElementById('filterDateFrom').value;
//   const toDate      = document.getElementById('filterDateTo').value;
//   const statusFilter= document.getElementById('filterStatus').value;

//   let filtered = [...allRecords];
//   if (fromDate)              filtered = filtered.filter(r => r.attendanceDate >= fromDate);
//   if (toDate)                filtered = filtered.filter(r => r.attendanceDate <= toDate);
//   if (statusFilter !== 'all')filtered = filtered.filter(r => r.status === statusFilter);

//   const tbody = document.getElementById('attendanceTableBody');

//   if (filtered.length === 0) {
//     tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">
//       <i class="fas fa-calendar-times" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>
//       No attendance records found</td></tr>`;
//     return;
//   }

//   tbody.innerHTML = filtered.map(rec => {
//     const color = statusColor(rec.status);
//     const hrs   = Math.abs(rec.totalHours || 0);
//     return `
//     <tr>
//       <td><span class="date-cell">${rec.attendanceDate}</span></td>
//       <td><strong>${fmt12(rec.checkInTime)}</strong></td>
//       <td>${fmt12(rec.checkOutTime)}</td>
//       <td>${hoursLabel(hrs)}</td>
//       <td><span class="status-badge-table" style="background:${color}18;color:${color};border:1px solid ${color}33">${rec.status}</span></td>
//       <td>
//         <button class="btn-action-edit" data-id="${rec.attendanceId}" title="Edit notes">
//           <i class="fas fa-pen"></i>
//         </button>
//       </td>
//     </tr>`;
//   }).join('');

//   // Bind edit buttons
//   document.querySelectorAll('.btn-action-edit').forEach(btn => {
//     btn.addEventListener('click', () => {
//       const id  = parseInt(btn.dataset.id);
//       const rec = allRecords.find(r => r.attendanceId === id);
//       if (rec) openEditModal(rec);
//     });
//   });
// }

// /* ── Edit Modal ──────────────────────────────────────────── */
// function openEditModal(rec) {
//   currentEditRecord = rec;
//   document.getElementById('editModalDate').textContent    = rec.attendanceDate;
//   document.getElementById('editModalStatus').textContent  = rec.status;
//   document.getElementById('editModalCheckin').textContent = fmt12(rec.checkInTime);
//   document.getElementById('editModalCheckout').textContent= fmt12(rec.checkOutTime);
//   document.getElementById('editNotesInput').value         = rec.notes || '';
//   document.getElementById('editModal').classList.add('active');
//   document.getElementById('editNotesInput').focus();
// }

// function closeEditModal() {
//   document.getElementById('editModal').classList.remove('active');
//   currentEditRecord = null;
// }

// document.getElementById('editModalClose').addEventListener('click', closeEditModal);
// document.getElementById('editModalCancel').addEventListener('click', closeEditModal);
// document.getElementById('editModal').addEventListener('click', e => {
//   if (e.target === document.getElementById('editModal')) closeEditModal();
// });

// document.getElementById('editModalSave').addEventListener('click', async () => {
//   if (!currentEditRecord) return;
//   const notes = document.getElementById('editNotesInput').value.trim();
//   const btn = document.getElementById('editModalSave');
//   btn.disabled = true;
//   btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving…';
//   try {
//     await apiUpdateNote(notes);
//     // Update local record
//     const idx = allRecords.findIndex(r => r.attendanceId === currentEditRecord.attendanceId);
//     if (idx !== -1) allRecords[idx].notes = notes;
//     closeEditModal();
//     renderTable();
//     showToast('Notes updated successfully');
//   } catch (err) {
//     console.error('[Attendance] updateNote:', err);
//     showToast(err.message || 'Update failed', 'error');
//   } finally {
//     btn.disabled = false;
//     btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
//   }
// });

// /* ── Monthly Summary Modal ───────────────────────────────── */
// function populateYearSelect() {
//   const sel = document.getElementById('yearSelect');
//   sel.innerHTML = '';
//   const cur = new Date().getFullYear();
//   for (let y = cur - 2; y <= cur + 1; y++) {
//     const opt = document.createElement('option');
//     opt.value = y; opt.textContent = y;
//     if (y === cur) opt.selected = true;
//     sel.appendChild(opt);
//   }
// }

// function loadMonthlySummary(year, month) {
//   // month is 0-indexed
//   const paddedMonth = String(month + 1).padStart(2, '0');
//   const monthRecords = allRecords.filter(r => {
//     const [y, m] = r.attendanceDate.split('-');
//     return parseInt(y) === year && parseInt(m) === (month + 1);
//   });

//   const daysInMonth   = new Date(year, month + 1, 0).getDate();
//   const presentCount  = monthRecords.filter(r => r.status === 'Present').length;
//   const absentCount   = Math.max(0, daysInMonth - monthRecords.length);
//   const lateCount     = monthRecords.filter(r => r.status === 'Late').length;
//   const totalHrs      = monthRecords.reduce((s, r) => s + Math.abs(r.totalHours || 0), 0);
//   const avgHrs        = monthRecords.length > 0 ? totalHrs / monthRecords.length : 0;

//   document.getElementById('totalDays').textContent      = daysInMonth;
//   document.getElementById('presentDays').textContent    = presentCount;
//   document.getElementById('absentDays').textContent     = absentCount;
//   document.getElementById('lateDays').textContent       = lateCount;
//   document.getElementById('totalHoursMonth').textContent= hoursLabel(totalHrs);
//   document.getElementById('avgHours').textContent       = hoursLabel(avgHrs);

//   // Build day rows
//   const rows = [];
//   for (let d = 1; d <= daysInMonth; d++) {
//     const dateStr = `${year}-${paddedMonth}-${String(d).padStart(2, '0')}`;
//     const rec     = monthRecords.find(r => r.attendanceDate === dateStr);
//     const dayName = new Date(year, month, d).toLocaleDateString('en-US', { weekday: 'short' });
//     const status  = rec?.status || 'Absent';
//     const color   = statusColor(status);
//     const hrs     = rec ? Math.abs(rec.totalHours || 0) : 0;
//     rows.push(`
//       <tr>
//         <td>${dateStr}</td>
//         <td>${dayName}</td>
//         <td>${rec ? fmt12(rec.checkInTime) : '--:--'}</td>
//         <td>${rec ? fmt12(rec.checkOutTime) : '--:--'}</td>
//         <td>${hoursLabel(hrs)}</td>
//         <td><span class="status-indicator" style="background:${color}18;color:${color};border:1px solid ${color}33">${status}</span></td>
//       </tr>`);
//   }
//   document.getElementById('monthlyTableBody').innerHTML = rows.join('');
//   document.getElementById('monthlyModal').style.display = 'flex';
// }

// function showMonthlySummary() {
//   const now = new Date();
//   document.getElementById('monthSelect').value = now.getMonth();
//   document.getElementById('yearSelect').value  = now.getFullYear();
//   loadMonthlySummary(now.getFullYear(), now.getMonth());
// }

// document.getElementById('viewMonthBtn').addEventListener('click', showMonthlySummary);
// document.getElementById('closeModalBtn').addEventListener('click', () => {
//   document.getElementById('monthlyModal').style.display = 'none';
// });
// document.getElementById('monthlyModal').addEventListener('click', e => {
//   if (e.target === document.getElementById('monthlyModal'))
//     document.getElementById('monthlyModal').style.display = 'none';
// });
// document.getElementById('monthSelect').addEventListener('change', () => {
//   loadMonthlySummary(
//     parseInt(document.getElementById('yearSelect').value),
//     parseInt(document.getElementById('monthSelect').value)
//   );
// });
// document.getElementById('yearSelect').addEventListener('change', () => {
//   loadMonthlySummary(
//     parseInt(document.getElementById('yearSelect').value),
//     parseInt(document.getElementById('monthSelect').value)
//   );
// });

// /* ── Filters ─────────────────────────────────────────────── */
// document.getElementById('filterDateFrom').addEventListener('change', renderTable);
// document.getElementById('filterDateTo').addEventListener('change', renderTable);
// document.getElementById('filterStatus').addEventListener('change', renderTable);
// document.getElementById('resetFiltersBtn').addEventListener('click', () => {
//   document.getElementById('filterDateFrom').value = '';
//   document.getElementById('filterDateTo').value   = '';
//   document.getElementById('filterStatus').value   = 'all';
//   renderTable();
// });

// /* ── Sidebar ─────────────────────────────────────────────── */
// document.getElementById('collapseSidebarBtn').addEventListener('click', () => {
//   document.getElementById('sidebar').classList.toggle('collapsed');
//   document.getElementById('mainContent').classList.toggle('sidebar-collapsed');
// });
// document.getElementById('mobileToggleBtn').addEventListener('click', () => {
//   document.getElementById('sidebar').classList.toggle('mobile-open');
// });

// /* ── Profile dropdown ────────────────────────────────────── */
// const profileBtn      = document.getElementById('profileDropdownBtn');
// const profileDropdown = document.getElementById('profileDropdown');
// if (profileBtn && profileDropdown) {
//   profileBtn.addEventListener('click', e => {
//     e.stopPropagation();
//     profileDropdown.classList.toggle('active');
//   });
//   document.addEventListener('click', e => {
//     if (!profileBtn.contains(e.target)) profileDropdown.classList.remove('active');
//   });
//   document.addEventListener('keydown', e => {
//     if (e.key === 'Escape') profileDropdown.classList.remove('active');
//   });
// }

// /* ── Logout ──────────────────────────────────────────────── */
// document.getElementById('logoutBtn')?.addEventListener('click', () => {
//   if (confirm('Are you sure you want to logout?')) window.location.href = '../index.html';
// });

// /* ── Init ────────────────────────────────────────────────── */
// async function init() {
//   populateYearSelect();

//   // Restore live session
//   const sess = loadSession();
//   if (sess) {
//     timerInterval = setInterval(tickTimer, 1000);
//   }

//   // Show loading state
//   document.getElementById('attendanceTableBody').innerHTML =
//     '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">' +
//     '<i class="fas fa-circle-notch fa-spin" style="margin-right:8px;"></i>Loading records…</td></tr>';

//   await fetchAllRecords();
//   refreshStatCards();
//   renderTable();
// }

// init();
// window.addEventListener('beforeunload', () => { if (timerInterval) clearInterval(timerInterval); });