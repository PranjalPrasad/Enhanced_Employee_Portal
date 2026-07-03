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

/* ── Cross-Shift / Shift Overlap Attendance Module — State ─ */
const MOCK_SHIFTS   = ['1st Shift', '2nd Shift', '3rd Shift'];
let myShift          = 'General (9AM-6PM)'; // employee's currently assigned shift
let shiftChangeRequests = [];               // locally stored shift-change requests (frontend-only)

/* ── Overnight Duty OT-Split Module — State ─────────────── */
const STANDARD_SHIFT_HOURS = 8; // hours beyond this on an overnight-cross day are split out as Overtime

/* ── Designation-based OT vs C-off Module — State ───────── */
// Ladder used purely to decide which side of the cutoff a designation falls on.
// Everyone strictly below "Assistant Manager" gets paid Overtime; "Assistant
// Manager" and every designation above it instead accrues a Compensatory Off (C-off).
const DESIGNATION_LADDER = [
  'Trainee', 'Associate', 'Senior Associate', 'Executive', 'Senior Executive',
  'Team Lead', 'Assistant Manager', 'Deputy Manager', 'Manager',
  'Senior Manager', 'AVP', 'VP', 'Director'
];
const OT_COFF_CUTOFF = 'Assistant Manager';
let odRequests = []; // locally stored OD apply requests (frontend-only)

/* ── Designation-based OT vs C-off Module — Helpers ─────── */
function getMyDesignation() {
  return localStorage.getItem('hrms_designation') || 'Associate';
}

function isCoffEligible(designation) {
  const idx       = DESIGNATION_LADDER.findIndex(d => d.toLowerCase() === (designation || '').toLowerCase());
  const cutoffIdx = DESIGNATION_LADDER.indexOf(OT_COFF_CUTOFF);
  if (idx === -1) return false; // unrecognized designation → default to OT-eligible (safer for junior-style roles)
  return idx >= cutoffIdx;
}

function otEntitlementLabel() {
  return isCoffEligible(getMyDesignation()) ? 'C-off' : 'Overtime';
}

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

/* ── Cross-Shift / Shift Overlap Attendance Module — Helpers ── */
function shiftBadgeHtml(shift) {
  if (!shift) return `<span class="shift-badge shift-none">—</span>`;
  const cls = shift.startsWith('1st') ? 'shift-1st'
            : shift.startsWith('2nd') ? 'shift-2nd'
            : shift.startsWith('3rd') ? 'shift-3rd'
            : 'shift-none';
  return `<span class="shift-badge ${cls}">${shift}</span>`;
}

function overnightTagHtml(rec) {
  if (!rec.overnightCross) return '';
  return `<span class="tag-overnight" title="Check-out crossed midnight; this shift-date is still recognized as Present"><i class="fas fa-moon"></i> Overnight</span>`;
}

/* ── Overnight Duty OT-Split Module — Helpers ───────────── */
// Splits an overnight-cross record's totalHours into regular vs overtime,
// then tags the overtime with the correct entitlement (OT pay or C-off)
// based on the employee's designation.
function computeOtSplit(rec) {
  if (!rec.overnightCross || !rec.totalHours) {
    return { regularHours: rec.totalHours || 0, otHours: 0, entitlement: null };
  }
  const otHours      = Math.max(0, parseFloat((rec.totalHours - STANDARD_SHIFT_HOURS).toFixed(1)));
  const regularHours = parseFloat((rec.totalHours - otHours).toFixed(1));
  const entitlement  = otHours > 0 ? (isCoffEligible(getMyDesignation()) ? 'C-off' : 'Overtime') : null;
  return { regularHours, otHours, entitlement };
}

function otSplitBadgeHtml(rec) {
  const { otHours, entitlement } = computeOtSplit(rec);
  if (!otHours || otHours <= 0) return '';
  const cls = entitlement === 'C-off' ? 'tag-coff' : 'tag-ot';
  const icon = entitlement === 'C-off' ? 'fa-calendar-check' : 'fa-bolt';
  return `<span class="${cls}" title="${otHours.toFixed(1)} hrs beyond the ${STANDARD_SHIFT_HOURS}-hr shift, split as ${entitlement}"><i class="fas ${icon}"></i> ${otHours.toFixed(1)}h ${entitlement}</span>`;
}

function shiftChangeNoteHtml(rec) {
  if (!rec.shiftChangeApproved) return '';
  return `<span class="shift-change-note"><i class="fas fa-check-circle"></i>HOD-approved shift change — both overlapping days marked Present</span>`;
}

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

  // Cross-Shift / Shift Overlap Attendance Module — assign this employee's
  // current shift for the period. When it's "3rd Shift" (night), check-out
  // naturally crosses midnight into the next calendar date; that day must
  // still be recognized as "Present" for the shift-date (the date checked
  // IN on), not flagged as an anomaly.
  myShift = pick(MOCK_SHIFTS);

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = toDateStr(d);
    const dow = d.getDay(); // 0 = Sun, 6 = Sat

    let status, checkInTime = null, checkOutTime = null, totalHours = 0, notes = '',
        overnightCross = false;

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
        if (myShift === '3rd Shift') {
          // ── Cross-Shift / Shift Overlap: night shift punch crosses midnight.
          // Check-in stays in the evening; check-out lands on the next
          // calendar date. The shift-date (this record's date) is still
          // "Present" — the biometric pair is reconciled against the
          // 3rd Shift window (22:00 → 06:00 next day), same as the
          // requirement doc's cross-shift example.
          const inHour  = randInt(21, 22);
          const inMin   = randInt(0, 59);
          // Overnight Duty OT-Split Module: ~35% of night-shift days the employee
          // is held back past the normal 3rd Shift window (extra hours = Overtime).
          const heldLate = Math.random() < 0.35;
          const outHour  = heldLate ? randInt(7, 9) : randInt(5, 6);
          checkInTime  = `${String(inHour).padStart(2,'0')}:${String(inMin).padStart(2,'0')}:00`;
          checkOutTime = `${String(outHour).padStart(2,'0')}:${String(inMin).padStart(2,'0')}:00`;
          const hoursBeforeMidnight = 24 - inHour - inMin / 60;
          const hoursAfterMidnight  = outHour + inMin / 60;
          totalHours     = parseFloat((hoursBeforeMidnight + hoursAfterMidnight).toFixed(1));
          overnightCross = true;
          notes = heldLate
            ? 'Night shift — held back past shift end, extra hours split as Overtime/C-off'
            : 'Night shift — check-out after midnight, reconciled against 3rd Shift window';
        } else {
          checkInTime  = '09:' + randInt(0, 20) + ':00';
          checkOutTime = '18:' + randInt(0, 30) + ':00';
          totalHours   = 8 + Math.random();
        }
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

    const rec = {
      attendanceId:  totalDays - i, // stable-ish fake id
      attendanceDate: dateStr,
      shift: checkInTime ? myShift : null,
      checkInTime,
      checkOutTime,
      totalHours: Math.round(totalHours * 10) / 10,
      status,
      notes,
      overnightCross,
      shiftChangeApproved: false
    };
    // Overnight Duty OT-Split Module: pre-compute the split so reports/
    // stat cards don't have to re-derive it from scratch every render.
    const split = computeOtSplit(rec);
    rec.regularHours = split.regularHours;
    rec.otHours       = split.otHours;
    rec.otEntitlement = split.entitlement;
    records.push(rec);
  }

  // ── Cross-Shift / Shift Overlap: seed one real "approved shift change"
  // scenario, mirroring the requirement doc exactly — employee punches
  // 3rd Shift IN at ~22:00 on Day 1, continues into 1st Shift the next
  // morning (approved by HOD via a Shift Change Request), and clocks
  // out later on Day 2. BOTH calendar days must show as "Present".
  const transitionDay1 = new Date(today);
  transitionDay1.setDate(transitionDay1.getDate() - 18);
  const transitionDay2 = new Date(transitionDay1);
  transitionDay2.setDate(transitionDay2.getDate() + 1);
  const day1Str = toDateStr(transitionDay1);
  const day2Str = toDateStr(transitionDay2);

  const day1 = records.find(r => r.attendanceDate === day1Str);
  const day2 = records.find(r => r.attendanceDate === day2Str);

  if (day1) {
    day1.shift               = '3rd Shift';
    day1.status               = 'Present';
    day1.checkInTime          = '22:00:00';
    day1.checkOutTime         = '06:00:00';
    day1.totalHours           = 8.0;
    day1.overnightCross       = true;
    day1.shiftChangeApproved  = true;
    day1.notes = 'Approved shift change (HOD) — continued from 3rd Shift into 1st Shift';
  }
  if (day2) {
    day2.shift               = '1st Shift';
    day2.status               = 'Present';
    day2.checkInTime          = '06:00:00';
    day2.checkOutTime         = '14:00:00';
    day2.totalHours           = 8.0;
    day2.overnightCross       = false;
    day2.shiftChangeApproved  = true;
    day2.notes = 'Approved shift change (HOD) — continuation of prior day\'s duty, both days marked Present';
  }
  [day1, day2].forEach(d => {
    if (!d) return;
    const s = computeOtSplit(d);
    d.regularHours = s.regularHours;
    d.otHours       = s.otHours;
    d.otEntitlement = s.entitlement;
  });

  // Overnight Duty OT-Split Module: seed one unambiguous example — night
  // shift punch-in at 22:00, held back to 09:00 next day (11 total hrs).
  // 8 hrs are recognized as the regular 3rd Shift window; the remaining
  // 3 hrs are split out as Overtime (or C-off, per designation cutoff).
  const otExampleDay = new Date(today);
  otExampleDay.setDate(otExampleDay.getDate() - 9);
  const otExampleStr = toDateStr(otExampleDay);
  let otExampleRec = records.find(r => r.attendanceDate === otExampleStr);
  if (!otExampleRec) {
    otExampleRec = { attendanceId: -101, attendanceDate: otExampleStr, shiftChangeApproved: false };
    records.push(otExampleRec);
  }
  otExampleRec.shift          = '3rd Shift';
  otExampleRec.status          = 'Present';
  otExampleRec.checkInTime     = '22:00:00';
  otExampleRec.checkOutTime    = '09:00:00';
  otExampleRec.totalHours      = 11.0;
  otExampleRec.overnightCross  = true;
  otExampleRec.notes = 'Night shift — held back past shift end, extra hours split as Overtime/C-off';
  const otSplit = computeOtSplit(otExampleRec);
  otExampleRec.regularHours = otSplit.regularHours;
  otExampleRec.otHours       = otSplit.otHours;
  otExampleRec.otEntitlement = otSplit.entitlement;

  // Seed the matching "My Shift Change Requests" entry so the panel shows
  // a real, already-approved example alongside anything the employee submits.
  shiftChangeRequests = [{
    id: 1,
    fromDate:        day1Str,
    toDate:          day2Str,
    currentShift:    '3rd Shift',
    requestedShift:  '1st Shift',
    reason:          'Covering the next shift as the incoming employee was on emergency leave.',
    submittedAt:     new Date(transitionDay1.getTime() - 2 * 86400000).toISOString(),
    status:          'Approved'
  }];

  // Newest first
  records.sort((a, b) => new Date(b.attendanceDate) - new Date(a.attendanceDate));
  return records;
}

function loadAllRecords() {
  allRecords = generateSampleData();
}

/* ── Cross-Shift / Shift Overlap — submit a new request (local) ─── */
function submitShiftChangeRequestLocal(fromDate, requestedShift, reason) {
  const entry = {
    id:              shiftChangeRequests.length + 1,
    fromDate,
    toDate:          fromDate,
    currentShift:    myShift,
    requestedShift,
    reason,
    submittedAt:     new Date().toISOString(),
    status:          'Pending' // awaiting HOD approval — same pattern as correction requests
  };
  shiftChangeRequests.unshift(entry);
  console.log('[Shift Change] Request submitted (local only, pending HOD approval):', entry);
  return entry;
}

function renderShiftRequestsPanel() {
  const wrap = document.getElementById('shiftRequestsPanelBody');
  if (!wrap) return;

  if (shiftChangeRequests.length === 0) {
    wrap.innerHTML = `<div class="shift-requests-empty">No shift change requests yet.</div>`;
    return;
  }

  const pillClass = s => s === 'Approved' ? 'approved' : s === 'Rejected' ? 'rejected' : 'pending';
  const pillIcon  = s => s === 'Approved' ? 'fa-check' : s === 'Rejected' ? 'fa-times' : 'fa-hourglass-half';

  const rows = shiftChangeRequests.map(req => `
    <tr>
      <td>${req.fromDate}${req.toDate !== req.fromDate ? ' → ' + req.toDate : ''}</td>
      <td>${shiftBadgeHtml(req.currentShift)}</td>
      <td>${shiftBadgeHtml(req.requestedShift)}</td>
      <td>${req.reason}</td>
      <td><span class="req-status-pill ${pillClass(req.status)}"><i class="fas ${pillIcon(req.status)}"></i>${req.status}</span></td>
    </tr>`).join('');

  wrap.innerHTML = `
    <table class="shift-requests-table">
      <thead><tr><th>Date</th><th>Current</th><th>Requested</th><th>Reason</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* ── OD (On-Duty) Apply/Approve Workflow Module ──────────── */
function seedOdRequests() {
  const today = new Date();

  const approvedDay = new Date(today); approvedDay.setDate(approvedDay.getDate() - 14);
  const pendingDay   = new Date(today); pendingDay.setDate(pendingDay.getDate() - 2);

  odRequests = [
    {
      id: 1,
      date:          toDateStr(approvedDay),
      location:      'Client Site — Whitefield, Bengaluru',
      reason:        'On-site client demo and requirement walkthrough for the Q3 rollout.',
      submittedAt:   new Date(approvedDay.getTime() - 3 * 86400000).toISOString(),
      status:        'Approved',
      approver:      'Reporting Manager',
      approvedAt:    new Date(approvedDay.getTime() - 1 * 86400000).toISOString()
    },
    {
      id: 2,
      date:          toDateStr(pendingDay),
      location:      'Regional Office — Pune',
      reason:        'Vendor coordination meeting for the new payroll integration.',
      submittedAt:   new Date(pendingDay.getTime() - 1 * 86400000).toISOString(),
      status:        'Pending',
      approver:      null,
      approvedAt:    null
    }
  ];

  // Reflect the already-approved OD onto the matching attendance record,
  // same pattern used for approved shift-change days.
  const approvedRec = allRecords.find(r => r.attendanceDate === toDateStr(approvedDay));
  if (approvedRec) {
    approvedRec.status = 'OD';
    approvedRec.notes  = 'Approved On-Duty — Client Site, Whitefield, Bengaluru';
  }
}

function submitOdRequestLocal(date, location, reason) {
  const entry = {
    id:            (odRequests.length ? Math.max(...odRequests.map(r => r.id)) : 0) + 1,
    date,
    location,
    reason,
    submittedAt:   new Date().toISOString(),
    status:        'Pending',
    approver:      null,
    approvedAt:    null
  };
  odRequests.unshift(entry);
  console.log('[OD] Apply request submitted (local only, pending manager approval):', entry);
  return entry;
}

function odStatusPillHtml(status) {
  const cls  = status === 'Approved' ? 'approved' : status === 'Rejected' ? 'rejected' : 'pending';
  const icon = status === 'Approved' ? 'fa-check' : status === 'Rejected' ? 'fa-times' : 'fa-hourglass-half';
  return `<span class="req-status-pill ${cls}"><i class="fas ${icon}"></i>${status}</span>`;
}

function renderOdRequestsPanel() {
  const wrap = document.getElementById('odRequestsPanelBody');
  if (!wrap) return;

  if (odRequests.length === 0) {
    wrap.innerHTML = `<div class="shift-requests-empty">No OD (On-Duty) requests yet.</div>`;
    return;
  }

  const rows = odRequests.map(req => `
    <tr>
      <td>${req.date}</td>
      <td>${req.location}</td>
      <td>${req.reason}</td>
      <td>${odStatusPillHtml(req.status)}</td>
    </tr>`).join('');

  wrap.innerHTML = `
    <table class="shift-requests-table">
      <thead><tr><th>Date</th><th>Location / Client</th><th>Reason</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* ── OD Apply Modal ──────────────────────────────────────── */
function openOdModal() {
  document.getElementById('odDate').value      = getTodayStr();
  document.getElementById('odDate').min        = toDateStr(new Date(Date.now() - 30 * 86400000));
  document.getElementById('odLocation').value  = '';
  document.getElementById('odReason').value    = '';
  document.getElementById('odCharCount').textContent = '0';
  document.getElementById('odModal').classList.add('active');
}

function closeOdModal() {
  document.getElementById('odModal').classList.remove('active');
}

document.getElementById('openOdBtn').addEventListener('click', openOdModal);
document.getElementById('odModalClose').addEventListener('click', closeOdModal);
document.getElementById('odModalCancel').addEventListener('click', closeOdModal);
document.getElementById('odModal').addEventListener('click', e => {
  if (e.target === document.getElementById('odModal')) closeOdModal();
});
document.getElementById('odReason').addEventListener('input', function () {
  document.getElementById('odCharCount').textContent = this.value.length;
});

document.getElementById('odModalSave').addEventListener('click', () => {
  const date     = document.getElementById('odDate').value;
  const location = document.getElementById('odLocation').value.trim();
  const reason   = document.getElementById('odReason').value.trim();

  if (!date)      { showToast('Please select the OD date', 'error'); return; }
  if (!location)  { showToast('Please enter the location / client name', 'error'); return; }
  if (!reason)    { showToast('Please describe the purpose of this On-Duty visit', 'error'); return; }

  const btn = document.getElementById('odModalSave');
  btn.disabled  = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Submitting…';

  setTimeout(() => {
    submitOdRequestLocal(date, location, reason);
    renderOdRequestsPanel();
    closeOdModal();
    showToast('OD request submitted — pending manager approval');
    btn.disabled  = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Request';
  }, 500);
});

/* ── OD Report Modal ─────────────────────────────────────── */
function loadOdReport() {
  const odRecords = allRecords.filter(r => r.status === 'OD');
  const approvedCount = odRequests.filter(r => r.status === 'Approved').length;
  const pendingCount  = odRequests.filter(r => r.status === 'Pending').length;

  document.getElementById('odReportTotalDays').textContent = odRecords.length;
  document.getElementById('odReportApproved').textContent  = approvedCount;
  document.getElementById('odReportPending').textContent   = pendingCount;

  const rows = odRequests.map(req => `
    <tr>
      <td>${req.date}</td>
      <td>${req.location}</td>
      <td>${req.reason}</td>
      <td>${req.approver || '—'}</td>
      <td>${odStatusPillHtml(req.status)}</td>
    </tr>`).join('') || `<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:var(--text-muted);">No OD requests on record</td></tr>`;

  document.getElementById('odReportTableBody').innerHTML = rows;
  document.getElementById('odReportModal').style.display = 'flex';
}

function downloadOdReportCsv() {
  const header = ['Date', 'Location/Client', 'Reason', 'Approver', 'Status'];
  const lines  = [header.join(',')];
  odRequests.forEach(req => {
    const row = [req.date, req.location, req.reason, req.approver || '', req.status]
      .map(v => `"${String(v).replace(/"/g, '""')}"`);
    lines.push(row.join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `OD_Report_${getTodayStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('OD report downloaded');
}

document.getElementById('viewOdReportBtn').addEventListener('click', loadOdReport);
document.getElementById('closeOdReportBtn').addEventListener('click', () => {
  document.getElementById('odReportModal').style.display = 'none';
});
document.getElementById('odReportModal').addEventListener('click', e => {
  if (e.target === document.getElementById('odReportModal'))
    document.getElementById('odReportModal').style.display = 'none';
});
document.getElementById('downloadOdReportBtn').addEventListener('click', downloadOdReportCsv);

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

  refreshOtCoffCard();
}

/* ── Overnight Duty OT-Split + Designation-based OT vs C-off — Stat Card ── */
function refreshOtCoffCard() {
  const card = document.getElementById('otCoffCard');
  if (!card) return;

  const designation = getMyDesignation();
  const coffMode     = isCoffEligible(designation);
  const now          = new Date();

  const monthRecords = allRecords.filter(r => {
    const [y, m] = r.attendanceDate.split('-');
    return parseInt(y) === now.getFullYear() && parseInt(m) === (now.getMonth() + 1);
  });
  const totalOtHours = monthRecords.reduce((s, r) => s + (r.otHours || 0), 0);

  document.getElementById('otCoffIcon').className   = `stat-icon ${coffMode ? 'purple' : 'accent'}`;
  document.getElementById('otCoffTitle').textContent = coffMode ? "C-off Balance (This Month)" : "Overtime Hours (This Month)";

  if (coffMode) {
    const coffDays = Math.floor(totalOtHours / STANDARD_SHIFT_HOURS);
    const remHours = parseFloat((totalOtHours % STANDARD_SHIFT_HOURS).toFixed(1));
    document.getElementById('otCoffValue').textContent = `${coffDays} day${coffDays === 1 ? '' : 's'}`;
    document.getElementById('otCoffSub').textContent    = remHours > 0
      ? `+ ${remHours} hrs carried forward · ${designation}`
      : `Compensatory off · ${designation}`;
  } else {
    document.getElementById('otCoffValue').textContent = hoursLabel(totalOtHours);
    document.getElementById('otCoffSub').textContent    = `Eligible for OT pay · ${designation}`;
  }
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
      <tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">
        <i class="fas fa-calendar-times" style="font-size:1.5rem;margin-bottom:8px;display:block;"></i>
        No attendance records found
      </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(rec => {
    const color = statusColor(rec.status);
    const hrs   = Math.abs(rec.totalHours || 0);
    const otHours = rec.otHours || 0;
    const hoursCell = otHours > 0
      ? `${hoursLabel(hrs)}<div class="hours-sub">${hoursLabel(rec.regularHours)} reg + ${otSplitBadgeHtml(rec)}</div>`
      : hoursLabel(hrs);
    return `
      <tr>
        <td><span class="date-cell">${rec.attendanceDate}</span>${shiftChangeNoteHtml(rec)}</td>
        <td>${shiftBadgeHtml(rec.shift)}</td>
        <td><strong>${fmt12(rec.checkInTime)}</strong></td>
        <td>${fmt12(rec.checkOutTime)}${overnightTagHtml(rec)}</td>
        <td>${hoursCell}</td>
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

/* ── Cross-Shift / Shift Overlap — Request Shift Change Modal ──── */
function openShiftChangeModal() {
  document.getElementById('shiftChangeDate').value      = getTodayStr();
  document.getElementById('shiftChangeDate').min        = getTodayStr();
  document.getElementById('shiftChangeCurrent').value   = myShift;
  document.getElementById('shiftChangeRequested').value = MOCK_SHIFTS.find(s => s !== myShift) || MOCK_SHIFTS[0];
  document.getElementById('shiftChangeReason').value    = '';
  document.getElementById('shiftChangeCharCount').textContent = '0';
  document.getElementById('shiftChangeModal').classList.add('active');
}

function closeShiftChangeModal() {
  document.getElementById('shiftChangeModal').classList.remove('active');
}

document.getElementById('openShiftChangeBtn').addEventListener('click', openShiftChangeModal);
document.getElementById('shiftChangeModalClose').addEventListener('click', closeShiftChangeModal);
document.getElementById('shiftChangeModalCancel').addEventListener('click', closeShiftChangeModal);
document.getElementById('shiftChangeModal').addEventListener('click', e => {
  if (e.target === document.getElementById('shiftChangeModal')) closeShiftChangeModal();
});

document.getElementById('shiftChangeModalSave').addEventListener('click', () => {
  const fromDate       = document.getElementById('shiftChangeDate').value;
  const requestedShift = document.getElementById('shiftChangeRequested').value;
  const reason          = document.getElementById('shiftChangeReason').value.trim();

  if (!fromDate) {
    showToast('Please select an effective date', 'error');
    return;
  }
  if (!reason) {
    showToast('Please describe why you need this shift change', 'error');
    return;
  }
  if (requestedShift === myShift) {
    showToast('Requested shift must be different from your current shift', 'error');
    return;
  }

  const btn = document.getElementById('shiftChangeModalSave');
  btn.disabled  = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Submitting…';

  setTimeout(() => {
    submitShiftChangeRequestLocal(fromDate, requestedShift, reason);
    renderShiftRequestsPanel();
    closeShiftChangeModal();
    showToast('Shift change request submitted — pending HOD approval');
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
    const hoursCell = (rec && rec.otHours > 0)
      ? `${hoursLabel(hrs)}<div class="hours-sub">${hoursLabel(rec.regularHours)} reg + ${otSplitBadgeHtml(rec)}</div>`
      : hoursLabel(hrs);
    rows.push(`
      <tr>
        <td>${dateStr}</td>
        <td>${dayName}</td>
        <td>${rec ? shiftBadgeHtml(rec.shift) : shiftBadgeHtml(null)}</td>
        <td>${rec ? fmt12(rec.checkInTime)  : '--:--'}</td>
        <td>${rec ? fmt12(rec.checkOutTime) : '--:--'}${rec ? overnightTagHtml(rec) : ''}</td>
        <td>${hoursCell}</td>
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
  seedOdRequests();
  refreshStatCards();
  renderTable();
  renderShiftRequestsPanel();
  renderOdRequestsPanel();
}

init();