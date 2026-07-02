// ============================================================
//  HRMS — attendance.js  |  Frontend-Only (Sample Data)
// ============================================================
//  NOTE: All backend connectivity has been removed. This page
//  now runs entirely on dummy in-memory data generated on load.
//  Manual Check-In / Check-Out and the pre-check-in status
//  selector are gone — attendance is "biometric-sourced" (i.e.
//  pre-populated sample data here). Correction requests are
//  simulated locally (stored in memory + toast confirmation).
//  Swap generateSampleData()/apiRaiseCorrectionRequest() for real
//  API calls whenever the backend is ready again.
// ============================================================

/* ── State ──────────────────────────────────────────────── */
let allRecords          = [];   // sample attendance records, newest first
let currentEditRecord   = null; // record being flagged in the correction modal
let correctionRequests  = [];   // locally stored correction requests (frontend-only)

/* ── Utilities ──────────────────────────────────────────── */
function getTodayStr() {
  const now = new Date();
  // IST = UTC + 5:30 → add 330 minutes to UTC
  const istOffset = 330 - (-now.getTimezoneOffset()); // handles any local tz
  const ist = new Date(now.getTime() + istOffset * 60000);
  return ist.toISOString().split('T')[0];
}

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

function fmt12(timeStr) {
  // "09:15:00" → "09:15 AM"
  if (!timeStr || timeStr === '--:--') return '--:--';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = ((h % 12) || 12).toString().padStart(2, '0');
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function hoursLabel(h) {
  if (h == null || isNaN(h)) return '0.0 hrs';
  return `${Math.abs(h).toFixed(1)} hrs`;
}

function statusColor(status) {
  const m = {
    Present:              '#6faf2e',
    Absent:                '#e56c6c',
    Late:                  '#f59e0b',
    'Half Day':            '#8b5cf6',
    WFH:                   '#1B738C',
    OD:                    '#0ea5e9',
    'C-off':                '#f97316',
    'Weekly-Off Present':  '#14b8a6'
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

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

/* ── Sample data generator ───────────────────────────────── */
// Builds ~75 calendar days of dummy attendance history ending today.
// Weekends default to "Weekly-Off Present"/off, weekdays get a
// realistic mix of statuses. A handful of weekdays are left out of
// the array entirely so they show up as "Absent" (same as the old
// monthly-summary logic assumed).
function generateSampleData() {
  const records  = [];
  const today    = new Date();
  const totalDays = 75;

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = toDateStr(d);
    const dow = d.getDay(); // 0 = Sun, 6 = Sat

    let status, checkInTime = null, checkOutTime = null, totalHours = 0, notes = '';

    if (dow === 0) {
      // Sunday — normally off, occasionally worked
      if (Math.random() < 0.12) {
        status = 'Weekly-Off Present';
        checkInTime  = '10:0' + randInt(0, 9) + ':00';
        checkOutTime = '15:' + randInt(10, 40) + ':00';
        totalHours   = 5 + Math.random() * 2;
      } else {
        continue; // no record → renders as a gap (weekly off, not counted as absent in table)
      }
    } else if (dow === 6) {
      // Saturday — half day is common at many Indian offices
      const r = Math.random();
      if (r < 0.5) {
        status = 'Half Day';
        checkInTime  = '09:' + randInt(45, 59) + ':00';
        checkOutTime = '14:' + randInt(0, 30) + ':00';
        totalHours   = 4 + Math.random();
      } else if (r < 0.65) {
        status = 'C-off';
        continue; // compensatory off — no punch, skip record
      } else {
        continue;
      }
    } else {
      // Weekday
      const r = Math.random();
      if (r < 0.68) {
        status = 'Present';
        checkInTime  = '09:' + randInt(0, 20) + ':00';
        checkOutTime = '18:' + randInt(0, 30) + ':00';
        totalHours   = 8 + Math.random();
      } else if (r < 0.78) {
        status = 'Late';
        checkInTime  = '10:' + randInt(15, 45) + ':00';
        checkOutTime = '18:' + randInt(30, 59) + ':00';
        totalHours   = 7.5 + Math.random();
      } else if (r < 0.86) {
        status = 'WFH';
        checkInTime  = '09:' + randInt(0, 30) + ':00';
        checkOutTime = '18:' + randInt(0, 20) + ':00';
        totalHours   = 8 + Math.random() * 0.5;
        notes = 'Worked from home';
      } else if (r < 0.92) {
        status = 'OD';
        checkInTime  = '09:' + randInt(30, 45) + ':00';
        checkOutTime = '17:' + randInt(30, 59) + ':00';
        totalHours   = 7 + Math.random();
        notes = 'On duty — client site visit';
      } else if (r < 0.96) {
        status = 'Half Day';
        checkInTime  = '09:' + randInt(0, 15) + ':00';
        checkOutTime = '13:' + randInt(30, 59) + ':00';
        totalHours   = 4 + Math.random();
      } else {
        // Leave it out entirely → renders as Absent in monthly view
        continue;
      }
    }

    records.push({
      attendanceId:  totalDays - i, // stable-ish fake id
      attendanceDate: dateStr,
      checkInTime,
      checkOutTime,
      totalHours: Math.round(totalHours * 10) / 10,
      status,
      notes
    });
  }

  // Newest first
  records.sort((a, b) => new Date(b.attendanceDate) - new Date(a.attendanceDate));
  return records;
}

function loadAllRecords() {
  allRecords = generateSampleData();
}

/* ── Local "correction request" (frontend-only) ──────────── */
function submitCorrectionRequestLocal(record, message) {
  const entry = {
    id:              correctionRequests.length + 1,
    attendanceId:    record.attendanceId,
    attendanceDate:  record.attendanceDate,
    reportedStatus:  record.status,
    checkInTime:     record.checkInTime,
    checkOutTime:    record.checkOutTime,
    reason:          message,
    submittedAt:     new Date().toISOString(),
    status:          'Pending'
  };
  correctionRequests.push(entry);
  console.log('[Attendance] Correction request (local only):', entry);
  return entry;
}

/* ── Today's record from allRecords ─────────────────────── */
function getTodayRecord() {
  return allRecords.find(r => r.attendanceDate === getTodayStr()) || null;
}

/* ── UI — Stat cards (read-only, from sample data) ─────────── */
function refreshStatCards() {
  const todayRec = getTodayRecord();

  const sessionLabel = todayRec ? (todayRec.status || 'Marked') : 'Not Marked';
  const badgeClass    = todayRec ? 'badge-success' : 'badge-secondary';

  document.getElementById('sessionBadge').textContent = sessionLabel;
  document.getElementById('sessionBadge').className   = `badge ${badgeClass}`;
  document.getElementById('todayStatusText').textContent = sessionLabel;

  document.getElementById('checkInTimeDisplay').textContent  = todayRec ? fmt12(todayRec.checkInTime)  : '--:--';
  document.getElementById('checkOutTimeDisplay').textContent = todayRec ? fmt12(todayRec.checkOutTime) : '--:--';

  const hrs = todayRec ? Math.abs(todayRec.totalHours || 0) : 0;
  document.getElementById('todayHoursDisplay').textContent = hoursLabel(hrs);

  document.getElementById('lastActionSub').textContent = todayRec
    ? 'Synced from biometric device'
    : 'No record yet';
}

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
          <button class="btn-action-correction" data-id="${rec.attendanceId}" title="Raise correction request">
            <i class="fas fa-flag"></i>
          </button>
        </td>
      </tr>`;
  }).join('');

  // Bind correction-request buttons
  document.querySelectorAll('.btn-action-correction').forEach(btn => {
    btn.addEventListener('click', () => {
      const id  = parseInt(btn.dataset.id);
      const rec = allRecords.find(r => r.attendanceId === id);
      if (rec) openCorrectionModal(rec);
    });
  });
}

/* ── Correction Request Modal ───────────────────────────── */
function openCorrectionModal(rec) {
  currentEditRecord = rec;
  document.getElementById('editModalDate').textContent     = rec.attendanceDate;
  document.getElementById('editModalStatus').textContent   = rec.status;
  document.getElementById('editModalCheckin').textContent  = fmt12(rec.checkInTime);
  document.getElementById('editModalCheckout').textContent = fmt12(rec.checkOutTime);
  document.getElementById('editNotesInput').value          = '';
  document.getElementById('editCharCount').textContent     = '0';
  document.getElementById('editModal').classList.add('active');
  document.getElementById('editNotesInput').focus();
}

function closeCorrectionModal() {
  document.getElementById('editModal').classList.remove('active');
  currentEditRecord = null;
}

document.getElementById('editModalClose').addEventListener('click', closeCorrectionModal);
document.getElementById('editModalCancel').addEventListener('click', closeCorrectionModal);
document.getElementById('editModal').addEventListener('click', e => {
  if (e.target === document.getElementById('editModal')) closeCorrectionModal();
});

document.getElementById('editModalSave').addEventListener('click', () => {
  if (!currentEditRecord) return;
  const reason = document.getElementById('editNotesInput').value.trim();
  if (!reason) {
    showToast('Please describe the issue before submitting', 'error');
    return;
  }
  const btn = document.getElementById('editModalSave');
  btn.disabled  = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Submitting…';

  // Simulated network delay so the UX still feels like a real submit
  setTimeout(() => {
    submitCorrectionRequestLocal(currentEditRecord, reason);
    closeCorrectionModal();
    showToast('Correction request submitted for review');
    btn.disabled  = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Request';
  }, 500);
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
function init() {
  populateYearSelect();
  loadAllRecords();
  refreshStatCards();
  renderTable();
}

init();