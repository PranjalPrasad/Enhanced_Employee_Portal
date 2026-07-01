// ═══════════════════════════════════════════════════════
//  CONSTANTS & CONFIG
// ═══════════════════════════════════════════════════════
const BASE_EMP_URL = 'http://localhost:8086';
const STEPS = [
  'Personal Information',
  'Job Details',
  'Contact & Address',
  'Education & Family',
  'Documents'
];

// ═══════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════
let currentStep = 1;
let empData = null;
let isEditMode = false;
let isLocked = false;
let currentModalType = null;
let currentEditIndex = null;
let ifscDebounceTimer = null;

// In-memory doc store keyed by doc label
// Each entry: { file: File, url: string, name: string, mimeType: string } | null
let docUploads = {
  'Aadhaar Card': null,
  'PAN Card': null,
  'Degree Certificate': null,
  'Experience Letter': null,
  'Offer Letter': null,
  'Profile Photo': null,
};

let educationList  = [];
let familyList     = [];
let experienceList = [];

const COMPLETION_SECTIONS = [
  {
    key: 'personal', label: 'Personal Info',
    fields: ['firstName','lastName','dateOfBirth','gender','panNumber','aadhaarNumber'],
  },
  {
    key: 'job', label: 'Job Details',
    fields: ['department','designation','joiningDate','employmentType'],
  },
  {
    key: 'contact', label: 'Contact',
    fields: ['personalEmail','mobileNumber','currentCity'],
  },
  {
    key: 'education', label: 'Education',
    checkFn: () => educationList.length > 0,
  },
  {
    key: 'documents', label: 'Documents',
    checkFn: () => {
      if (!empData) return false;
      return [
        ['aadhaarDocumentUrl','Aadhaar Card'],
        ['panDocumentUrl','PAN Card'],
        ['degreeDocumentUrl','Degree Certificate'],
        ['experienceDocumentUrl','Experience Letter'],
        ['offerLetterUrl','Offer Letter'],
      ].every(([sk, uk]) => empData[sk] || docUploads[uk]);
    },
  },
];

// DOC_CONFIGS defines per-doc accept rules
const DOC_CONFIGS = [
  {
    label: 'Profile Photo',      serverKey: 'profilePhotoUrl',
    icon: 'fa-user-circle',
    acceptAttr: '.jpg,.jpeg,.png',
    acceptTypes: ['image/jpeg','image/jpg','image/png'],
    note: 'Passport-size, plain white/light background. Front-facing, no sunglasses. JPG/PNG only.',
    mandatory: false,
  },
  {
    label: 'Aadhaar Card',       serverKey: 'aadhaarDocumentUrl',
    icon: 'fa-id-card',
    acceptAttr: '.jpg,.jpeg,.png',
    acceptTypes: ['image/jpeg','image/jpg','image/png'],
    note: 'Scan/photo of BOTH sides. Name, DOB & 12-digit number clearly visible. JPG/PNG only.',
    mandatory: true,
  },
  {
    label: 'PAN Card',           serverKey: 'panDocumentUrl',
    icon: 'fa-address-card',
    acceptAttr: '.jpg,.jpeg,.png',
    acceptTypes: ['image/jpeg','image/jpg','image/png'],
    note: 'Clear scan showing name, DOB & PAN number. No glare or blur. JPG/PNG only.',
    mandatory: true,
  },
  {
    label: 'Degree Certificate', serverKey: 'degreeDocumentUrl',
    icon: 'fa-graduation-cap',
    acceptAttr: '.jpg,.jpeg,.png,.pdf',
    acceptTypes: ['image/jpeg','image/jpg','image/png','application/pdf'],
    note: 'Original degree/provisional certificate. All text must be legible. PDF or JPG/PNG.',
    mandatory: true,
  },
  {
    label: 'Experience Letter',  serverKey: 'experienceDocumentUrl',
    icon: 'fa-briefcase',
    acceptAttr: '.jpg,.jpeg,.png,.pdf',
    acceptTypes: ['image/jpeg','image/jpg','image/png','application/pdf'],
    note: 'On company letterhead with seal/signature, dates & designation. PDF or JPG/PNG.',
    mandatory: true,
  },
  {
    label: 'Offer Letter',       serverKey: 'offerLetterUrl',
    icon: 'fa-file-signature',
    acceptAttr: '.jpg,.jpeg,.png,.pdf',
    acceptTypes: ['image/jpeg','image/jpg','image/png','application/pdf'],
    note: 'Current offer letter showing CTC, designation & joining date. PDF or JPG/PNG.',
    mandatory: true,
  },
];

// ═══════════════════════════════════════════════════════
//  TOAST  — closeable; errors stay until dismissed
// ═══════════════════════════════════════════════════════
function showToast(msg, type = 'success') {
  Toastify({
    text: `<span>${type === 'success' ? '✓' : '✕'} ${msg}</span>`
        + `<button onclick="this.closest('.toastify').remove()"
             style="background:none;border:none;color:inherit;cursor:pointer;
                    margin-left:12px;font-size:15px;line-height:1;opacity:0.8">✕</button>`,
    duration: type === 'error' ? -1 : 4000,
    gravity: 'bottom', position: 'right',
    escapeMarkup: false,
    backgroundColor: type === 'success' ? '#16a34a' : '#dc2626',
    stopOnFocus: true,
    style: {
      borderRadius:'10px', padding:'12px 16px',
      fontSize:'13.5px', fontWeight:'500',
      display:'flex', alignItems:'center',
      boxShadow: type === 'success'
        ? '0 8px 24px rgba(22,163,74,0.22)'
        : '0 8px 24px rgba(220,38,38,0.22)',
    },
  }).showToast();
}

// ═══════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════
function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0,2).map(w => w[0]).join('').toUpperCase();
}
function parseJsonSafe(str) {
  if (!str) return [];
  try { const p = typeof str==='string'?JSON.parse(str):str; return Array.isArray(p)?p:[]; }
  catch { return []; }
}
function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
  catch { return d; }
}
function buildDocUrl(path) {
  if (!path) return null;
  if (path.startsWith('blob:')||path.startsWith('http')) return path;
  return `${BASE_EMP_URL}${path}`;
}
function getEmployeeId()      { return localStorage.getItem('hrms_employee_id')       || ''; }
function getEmployeePrimeId() { return localStorage.getItem('hrms_employee_prime_id') || ''; }


// REPLACE maskSalary — hide completely if profile is COMPLETED / locked
function maskSalary(val) {
    // Check if salary exists and is not empty
    const hasSalary = (val !== null && val !== undefined && val !== '');
    
    if (hasSalary) {
        // Salary exists - show masked/confidential message
        return '<div class="field-value" style="font-style:italic;color:var(--text-muted);font-size:13px;">🔒 Confidential</div>';
    }
    
    // No salary data
    return '<div class="field-value empty">Not provided</div>';
}


function toggleSalaryReveal(val) {
  const el = document.getElementById('salaryMask'); if(!el) return;
  if (el.dataset.revealed==='1') { el.textContent='●●●●●●'; el.dataset.revealed='0'; }
  else { el.textContent=`₹${Number(val).toLocaleString('en-IN')}`; el.dataset.revealed='1'; }
}

// ── Validation helpers ───────────────────────────────────
function isValidAadhaar(v) { return /^\d{12}$/.test((v||'').replace(/\s/g,'')); }
function isValidPAN(v)      { return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test((v||'').toUpperCase()); }
function isValidMobile(v)   { return /^[6-9]\d{9}$/.test((v||'').replace(/\s/g,'')); }
function isValidIFSC(v)     { return /^[A-Z]{4}0[A-Z0-9]{6}$/.test((v||'').toUpperCase()); }

function setFieldError(id, msg) {
  const el = document.getElementById(id); if(!el) return;
  el.style.borderColor='#dc2626'; el.style.boxShadow='0 0 0 3px rgba(220,38,38,0.12)';
  let h = el.parentElement.querySelector('.field-err-hint');
  if (!h) { h=document.createElement('span'); h.className='field-err-hint';
    h.style.cssText='font-size:11px;color:#dc2626;margin-top:3px;display:block'; el.parentElement.appendChild(h); }
  h.textContent = msg;
}
function clearFieldError(id) {
  const el = document.getElementById(id); if(!el) return;
  el.style.borderColor=''; el.style.boxShadow='';
  el.parentElement.querySelector('.field-err-hint')?.remove();
}

// ── IFSC live verifier ───────────────────────────────────
function attachIfscVerifier() {
  const el = document.getElementById('ifsc'); if(!el) return;
  el.addEventListener('input', () => {
    clearTimeout(ifscDebounceTimer);
    clearFieldError('ifsc');
    const val = el.value.trim().toUpperCase(); el.value = val;
    if (!val) return;
    if (!isValidIFSC(val)) { setFieldError('ifsc','Invalid IFSC format (e.g. HDFC0001234)'); return; }
    let h = el.parentElement.querySelector('.field-err-hint');
    if (!h) { h=document.createElement('span'); h.className='field-err-hint';
      h.style.cssText='font-size:11px;margin-top:3px;display:block'; el.parentElement.appendChild(h); }
    h.style.color='#64748b'; h.textContent='⏳ Verifying IFSC…';
    ifscDebounceTimer = setTimeout(async () => {
      try {
        const res  = await fetch(`https://ifsc.razorpay.com/${val}`);
        if (!res.ok) throw new Error('not found');
        const data = await res.json();
        clearFieldError('ifsc');
        el.style.borderColor='#16a34a'; el.style.boxShadow='0 0 0 3px rgba(22,163,74,0.12)';
        h.style.color='#16a34a'; h.textContent=`✓ ${data.BANK} — ${data.BRANCH}, ${data.CITY}`;
        const bEl = document.getElementById('bankName');
        if (bEl && !bEl.value.trim()) bEl.value = data.BANK;
      } catch { setFieldError('ifsc','✕ IFSC not found. Please check the code.'); }
    }, 600);
  });
}

// ── Field validators (blur) ──────────────────────────────
function attachFieldValidators() {
  const rules = [
    { id:'aadhaar',         fn:isValidAadhaar, msg:'Aadhaar must be exactly 12 digits' },
    { id:'pan',             fn:isValidPAN,     msg:'PAN format: ABCDE1234F (5 letters, 4 digits, 1 letter)' },
    { id:'mobileNumber',    fn:isValidMobile,  msg:'Enter valid 10-digit mobile starting with 6–9' },
    { id:'alternateNumber', fn:v=>!v||isValidMobile(v), msg:'Enter valid 10-digit number' },
    { id:'emergencyPhone',  fn:isValidMobile,  msg:'Enter valid 10-digit mobile number' },
  ];
  rules.forEach(({id,fn,msg}) => {
    const el = document.getElementById(id); if(!el) return;
    el.addEventListener('blur',  () => { const v=el.value.trim(); if(v&&!fn(v)) setFieldError(id,msg); else clearFieldError(id); });
    el.addEventListener('input', () => clearFieldError(id));
  });
  const panEl = document.getElementById('pan');
  if (panEl) panEl.addEventListener('input', () => { panEl.value = panEl.value.toUpperCase(); });
}

// ═══════════════════════════════════════════════════════
//  COMPLETION TRACKER
// ═══════════════════════════════════════════════════════
function calcCompletion() {
  if (!empData) return { pct:0, results:[] };
  let done = 0;
  const results = COMPLETION_SECTIONS.map(sec => {
    const filled = sec.checkFn
      ? sec.checkFn()
      : sec.fields.every(f => { const v=empData[f]; return v!==null&&v!==undefined&&v!==''; });
    if (filled) done++;
    return { key:sec.key, label:sec.label, filled };
  });
  return { pct: Math.round((done/COMPLETION_SECTIONS.length)*100), results };
}

function renderCompletion() {
  const { pct, results } = calcCompletion();
  const pctEl    = document.getElementById('completionPct');
  const barEl    = document.getElementById('completionBarFill');
  const tagsEl   = document.getElementById('completionTags');
  const badge100 = document.getElementById('badge100');
  const finalBtn = document.getElementById('finalSubmitBtn');
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (barEl) { barEl.style.width=`${pct}%`; barEl.classList.toggle('full', pct===100); }
  if (badge100) badge100.classList.toggle('show', pct===100);
  if (tagsEl) tagsEl.innerHTML = results.map(r=>`
    <span class="ctag ${r.filled?'done':'pending'}">
      <i class="fas ${r.filled?'fa-check-circle':'fa-circle'}"></i>${r.label}
    </span>`).join('');
  if (finalBtn) finalBtn.classList.toggle('show', pct===100 && !isLocked && !isEditMode);
}

// ═══════════════════════════════════════════════════════
//  API CALLS
// ═══════════════════════════════════════════════════════
async function fetchEmployee(empId) {
  const res  = await fetch(`${BASE_EMP_URL}/api/employees/get-employee-by-employeeId/${encodeURIComponent(empId)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const json = await res.json();
  if (!json.success||!json.data) throw new Error('Invalid response from server');
  return json.data;
}

async function callUpdateEmployee(primeId, dto, files) {
  const form = new FormData();
  form.append('employee', JSON.stringify(dto));
  if (files.aadhaarDocument)    form.append('aadhaarDocument',    files.aadhaarDocument);
  if (files.panDocument)        form.append('panDocument',        files.panDocument);
  if (files.degreeDocument)     form.append('degreeDocument',     files.degreeDocument);
  if (files.experienceDocument) form.append('experienceDocument', files.experienceDocument);
  if (files.offerLetter)        form.append('offerLetter',        files.offerLetter);
  if (files.profilePhoto)       form.append('profilePhoto',       files.profilePhoto);
  const res  = await fetch(`${BASE_EMP_URL}/api/employees/update-employee/${primeId}`, { method:'PUT', body:form });
  const json = await res.json();
  if (!json.success) throw new Error(json.message||'Update failed');
  return json.data;
}

async function callUpdatePassword(employeeId, oldPassword, newPassword) {
  const params = new URLSearchParams({ employeeId, oldPassword, newPassword });
  const res    = await fetch(`${BASE_EMP_URL}/api/employees/employee-update-password?${params}`, { method:'PATCH' });
  const text   = await res.text();
  if (!res.ok) throw new Error(text||'Password update failed');
  return text;
}

// ═══════════════════════════════════════════════════════
//  LOAD EMPLOYEE
// ═══════════════════════════════════════════════════════
async function loadEmployee() {
  const empId = getEmployeeId();
  document.getElementById('stepContainer').innerHTML = `
    <div class="loading-state">
      <i class="fas fa-circle-notch"></i>
      <span>Fetching profile for <strong>${empId||'you'}</strong>…</span>
    </div>`;
  try {
    empData        = await fetchEmployee(empId);
    educationList  = parseJsonSafe(empData.education);
    familyList     = parseJsonSafe(empData.family);
    experienceList = parseJsonSafe(empData.workExperience);
    isLocked       = empData.profileStatus === 'COMPLETED';
    onEmployeeLoaded();
  } catch (err) {
    console.error('[HRMS] fetch error:', err);
    document.getElementById('stepContainer').innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Could not load profile</p>
        <small style="color:var(--text-muted)">${err.message}</small>
        <button class="retry-btn" onclick="loadEmployee()"><i class="fas fa-redo"></i> Retry</button>
      </div>`;
    showToast('Failed to load employee profile', 'error');
  }
}

function onEmployeeLoaded() {
  const d = empData;
  const initials = getInitials(`${d.firstName||''} ${d.lastName||''}`);
  const avatarEl = document.getElementById('userAvatar');
  if (avatarEl) avatarEl.textContent = initials;
  const nameEl = document.getElementById('userName');
  if (nameEl) nameEl.textContent = `${d.firstName||''} ${d.lastName||''}`.trim()||'Employee';
  const roleEl = document.getElementById('userRole');
  if (roleEl) roleEl.textContent = d.designation||'—';
  if (d.employeePrimeId) localStorage.setItem('hrms_employee_prime_id', d.employeePrimeId);
  updateLockUI(); renderCompletion(); renderStepper(); renderCurrentStep(); updateNavButtons();
}

// ═══════════════════════════════════════════════════════
//  LOCK UI
// ═══════════════════════════════════════════════════════
function updateLockUI() {
  const lb  = document.getElementById('lockedBanner');
  const eb  = document.getElementById('editBtn');
  const lkb = document.getElementById('lockedBtn');
  if (isLocked) {
    lb?.classList.add('show');
    if (eb) eb.style.display='none';
    lkb?.classList.add('show');
    document.getElementById('cancelBtn')?.classList.remove('show');
    document.getElementById('saveBtn')?.classList.remove('show');
    document.getElementById('finalSubmitBtn')?.classList.remove('show');
  } else {
    lb?.classList.remove('show');
    if (eb) eb.style.display='';
    lkb?.classList.remove('show');
  }
}

// ═══════════════════════════════════════════════════════
//  EDIT MODE
// ═══════════════════════════════════════════════════════
function enterEditMode() {
  if (isLocked) return;
  isEditMode = true;
  document.getElementById('editBtn').style.display='none';
  document.getElementById('cancelBtn').classList.add('show');
  document.getElementById('saveBtn').classList.add('show');
  document.getElementById('finalSubmitBtn').classList.remove('show');
  renderCurrentStep();
}

function cancelEditMode() {
  isEditMode     = false;
  educationList  = parseJsonSafe(empData.education);
  familyList     = parseJsonSafe(empData.family);
  experienceList = parseJsonSafe(empData.workExperience);
  document.getElementById('editBtn').style.display='';
  document.getElementById('cancelBtn').classList.remove('show');
  document.getElementById('saveBtn').classList.remove('show');
  renderCurrentStep(); renderCompletion();
}

async function saveCurrentStep() {
  if (isLocked) return;
  const primeId = getEmployeePrimeId();
  if (!primeId) { showToast('Employee prime ID missing','error'); return; }
  if (!validateCurrentStep()) return;
  collectFormDataFromStep(currentStep);
  const dto   = buildDTOFromEmpData();
  const files = buildFilesPayload();
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Saving…';
  saveBtn.disabled=true;
  try {
    const updated  = await callUpdateEmployee(primeId, dto, files);
    empData        = updated;
    educationList  = parseJsonSafe(updated.education);
    familyList     = parseJsonSafe(updated.family);
    experienceList = parseJsonSafe(updated.workExperience);
    isEditMode     = false;
    document.getElementById('editBtn').style.display='';
    document.getElementById('cancelBtn').classList.remove('show');
    document.getElementById('saveBtn').classList.remove('show');
    saveBtn.innerHTML='<i class="fas fa-save"></i> Save Changes';
    saveBtn.disabled=false;
    renderCurrentStep(); renderCompletion();
    showToast('Profile updated successfully!');
  } catch(err) {
    showToast(err.message||'Failed to save changes','error');
    saveBtn.innerHTML='<i class="fas fa-save"></i> Save Changes';
    saveBtn.disabled=false;
  }
}

function validateCurrentStep() {
  if (currentStep===1) {
    const a=document.getElementById('aadhaar')?.value.trim();
    const p=document.getElementById('pan')?.value.trim();
    if (a && !isValidAadhaar(a)) { setFieldError('aadhaar','Aadhaar must be exactly 12 digits'); showToast('Fix highlighted errors before saving','error'); return false; }
    if (p && !isValidPAN(p))     { setFieldError('pan','Invalid PAN format (e.g. ABCDE1234F)');  showToast('Fix highlighted errors before saving','error'); return false; }
  }
  if (currentStep===2) {
    const i=document.getElementById('ifsc')?.value.trim();
    if (i && !isValidIFSC(i)) { setFieldError('ifsc','Invalid IFSC format (e.g. HDFC0001234)'); showToast('Fix highlighted errors before saving','error'); return false; }
  }
  if (currentStep===3) {
    const m=document.getElementById('mobileNumber')?.value.trim();
    const e=document.getElementById('emergencyPhone')?.value.trim();
    if (m && !isValidMobile(m)) { setFieldError('mobileNumber','Enter valid 10-digit mobile number'); showToast('Fix highlighted errors before saving','error'); return false; }
    if (e && !isValidMobile(e)) { setFieldError('emergencyPhone','Enter valid 10-digit number');      showToast('Fix highlighted errors before saving','error'); return false; }
  }
  return true;
}

// ═══════════════════════════════════════════════════════
//  COLLECT + BUILD DTO
// ═══════════════════════════════════════════════════════
function collectFormDataFromStep(step) {
  if (!empData) return;
  const g  = id => document.getElementById(id)?.value ?? null;
  const gb = id => { const el=document.getElementById(id); return el?el.checked:null; };
  if (step===1) {
    empData.firstName          = g('firstName')    || empData.firstName;
    empData.middleName         = g('middleName');
    empData.lastName           = g('lastName')     || empData.lastName;
    empData.dateOfBirth        = g('dob');
    empData.gender             = g('gender');
    empData.maritalStatus      = g('maritalStatus');
    empData.bloodGroup         = g('bloodGroup');
    empData.nationality        = g('nationality');
    empData.religion           = g('religion');
    empData.panNumber          = (g('pan')||'').toUpperCase() || empData.panNumber;
    empData.aadhaarNumber      = g('aadhaar');
    empData.linkedinProfile    = g('linkedin');
    empData.fatherSpouseName   = g('fatherSpouse');
    empData.isPhysicallyChallenged = gb('pwdCheckbox');
    if (empData.isPhysicallyChallenged) {
      empData.disabilityType       = g('disabilityType');
      empData.disabilityPercentage = parseInt(g('disabilityPercent'))||null;
      empData.certificateNumber    = g('certificateNo');
    }
  }
  if (step===2) {
    empData.department         = g('department')        || empData.department;
    empData.subDepartment      = g('subDepartment');
    empData.designation        = g('designation')       || empData.designation;
    empData.employeeGrade      = g('employeeGrade');
    empData.employmentType     = g('employmentType');
    empData.workLocation       = g('workLocation');
    empData.shift              = g('shift');
    empData.costCentre         = g('costCentre');
    empData.joiningDate        = g('joiningDate');
    empData.probationEndDate   = g('probationEndDate');
    empData.reportingManager   = g('reportingManager');
    empData.hrBusinessPartner  = g('hrBusinessPartner');
    empData.workEmail          = g('workEmail');
    empData.bankName           = g('bankName');
    empData.accountNumber      = g('accountNumber');
    empData.ifscCode           = (g('ifsc')||'').toUpperCase();
    // basicSalary NOT collected — HR-managed only
  }
  if (step===3) {
    empData.personalEmail         = g('personalEmail');
    empData.mobileNumber          = g('mobileNumber');
    empData.alternateNumber       = g('alternateNumber');
    empData.currentStreet         = g('curStreet');
    empData.currentCity           = g('curCity');
    empData.currentState          = g('curState');
    empData.currentPincode        = g('curPin');
    empData.currentCountry        = g('curCountry');
    empData.permanentStreet       = g('perStreet');
    empData.permanentCity         = g('perCity');
    empData.permanentState        = g('perState');
    empData.permanentPincode      = g('perPin');
    empData.permanentCountry      = g('perCountry');
    empData.emergencyName         = g('emergencyName');
    empData.emergencyRelationship = g('emergencyRelation');
    empData.emergencyPhone        = g('emergencyPhone');
  }
  if (step===4) {
    empData.education      = JSON.stringify(educationList);
    empData.family         = JSON.stringify(familyList);
    empData.workExperience = JSON.stringify(experienceList);
  }
}

function buildDTOFromEmpData() {
  return {
    firstName:empData.firstName, middleName:empData.middleName, lastName:empData.lastName,
    dateOfBirth:empData.dateOfBirth, gender:empData.gender, maritalStatus:empData.maritalStatus,
    bloodGroup:empData.bloodGroup, panNumber:empData.panNumber, aadhaarNumber:empData.aadhaarNumber,
    nationality:empData.nationality, religion:empData.religion, linkedinProfile:empData.linkedinProfile,
    fatherSpouseName:empData.fatherSpouseName, isPhysicallyChallenged:empData.isPhysicallyChallenged,
    disabilityType:empData.disabilityType, disabilityPercentage:empData.disabilityPercentage,
    certificateNumber:empData.certificateNumber, department:empData.department,
    subDepartment:empData.subDepartment, designation:empData.designation,
    employeeGrade:empData.employeeGrade, employmentType:empData.employmentType,
    joiningDate:empData.joiningDate, probationEndDate:empData.probationEndDate,
    reportingManager:empData.reportingManager, hrBusinessPartner:empData.hrBusinessPartner,
    workLocation:empData.workLocation, basicSalary:empData.basicSalary,
    shift:empData.shift, costCentre:empData.costCentre, workEmail:empData.workEmail,
    personalEmail:empData.personalEmail, mobileNumber:empData.mobileNumber,
    alternateNumber:empData.alternateNumber, currentStreet:empData.currentStreet,
    currentCity:empData.currentCity, currentState:empData.currentState,
    currentPincode:empData.currentPincode, currentCountry:empData.currentCountry,
    permanentStreet:empData.permanentStreet, permanentCity:empData.permanentCity,
    permanentState:empData.permanentState, permanentPincode:empData.permanentPincode,
    permanentCountry:empData.permanentCountry, emergencyName:empData.emergencyName,
    emergencyRelationship:empData.emergencyRelationship, emergencyPhone:empData.emergencyPhone,
    bankName:empData.bankName, accountNumber:empData.accountNumber, ifscCode:empData.ifscCode,
    education:empData.education, family:empData.family, workExperience:empData.workExperience,
    profileStatus:empData.profileStatus,
  };
}

function buildFilesPayload() {
  return {
    aadhaarDocument:    docUploads['Aadhaar Card']?.file        || null,
    panDocument:        docUploads['PAN Card']?.file            || null,
    degreeDocument:     docUploads['Degree Certificate']?.file  || null,
    experienceDocument: docUploads['Experience Letter']?.file   || null,
    offerLetter:        docUploads['Offer Letter']?.file        || null,
    profilePhoto:       docUploads['Profile Photo']?.file       || null,
  };
}

// ═══════════════════════════════════════════════════════
//  STEPPER
// ═══════════════════════════════════════════════════════
function allDocsUploaded() {
  if (!empData) return false;
  return [
    ['aadhaarDocumentUrl','Aadhaar Card'],['panDocumentUrl','PAN Card'],
    ['degreeDocumentUrl','Degree Certificate'],['experienceDocumentUrl','Experience Letter'],
    ['offerLetterUrl','Offer Letter'],
  ].every(([sk,uk]) => empData[sk]||docUploads[uk]);
}

function renderStepper() {
  const container = document.getElementById('stepper');
  container.innerHTML = STEPS.map((label,idx) => `
    <div class="step" data-step="${idx+1}">
      <div class="step-circle">${idx+1}</div>
      <div class="step-label">${label}</div>
    </div>`).join('');
  updateStepperUI();
  document.querySelectorAll('.step').forEach(el => {
    el.addEventListener('click', () => {
      if (!empData) return;
      // if (parseInt(el.dataset.step)===5 && !allDocsUploaded()) {
      //   showToast('Upload all 5 required documents before accessing the Documents tab.','error'); return;
      // }
      if (isEditMode) collectFormDataFromStep(currentStep);
      currentStep = parseInt(el.dataset.step);
      renderCurrentStep(); updateStepperUI(); updateNavButtons();
    });
  });
}

function updateStepperUI() {
  document.querySelectorAll('.step').forEach((el,idx) => {
    const num=idx+1, circle=el.querySelector('.step-circle');
    el.classList.remove('active','completed');
    if (num<currentStep) { el.classList.add('completed'); circle.innerHTML='<i class="fas fa-check"></i>'; }
    else if (num===currentStep) { el.classList.add('active'); circle.textContent=num; }
    else {
      circle.textContent=num;
      if (num===5 && !allDocsUploaded()) { el.style.opacity='0.45'; el.title='Upload all 5 required documents first'; }
      else { el.style.opacity=''; el.title=''; }
    }
  });
  document.getElementById('stepTitle').textContent = STEPS[currentStep-1];
}

function updateNavButtons() {
  const prev=document.getElementById('prevBtn'), next=document.getElementById('nextBtn');
  prev.disabled = currentStep===1;
  if (currentStep===STEPS.length) { next.innerHTML='<i class="fas fa-check-circle"></i> Done'; next.disabled=true; }
  else { next.innerHTML='Next <i class="fas fa-chevron-right"></i>'; next.disabled=false; }
}

// ═══════════════════════════════════════════════════════
//  STEP RENDERERS
// ═══════════════════════════════════════════════════════
function renderCurrentStep() {
  if (!empData) return;
  const renderers={1:renderStep1,2:renderStep2,3:renderStep3,4:renderStep4,5:renderStep5};
  document.getElementById('stepContainer').innerHTML=(renderers[currentStep]||(() =>''))(empData);
  attachStepEvents(); updateStepperUI();
}

function viewField(label, value) {
  const display = (value===null||value===undefined||value==='')
    ? `<div class="field-value empty">Not provided</div>`
    : `<div class="field-value">${value}</div>`;
  return `<div class="form-group"><label>${label}</label>${display}</div>`;
}
function editField(label, id, value, type='text', placeholder='', extra='') {
  const val=value??'';
  return `<div class="form-group"><label>${label}</label>
    <input type="${type}" id="${id}" value="${String(val).replace(/"/g,'&quot;')}"
      placeholder="${placeholder}" ${extra}/></div>`;
}
function editSelect(label, id, value, options) {
  const opts=options.map(o=>{const v=typeof o==='object'?o.value:o,l=typeof o==='object'?o.label:o;
    return `<option value="${v}" ${value===v?'selected':''}>${l}</option>`;}).join('');
  return `<div class="form-group"><label>${label}</label><select id="${id}">${opts}</select></div>`;
}

// ── Step 1 ──────────────────────────────────────────────
function renderStep1(d) {
  const initials     = getInitials(`${d.firstName||''} ${d.lastName||''}`);
  const sessionPhoto = docUploads['Profile Photo'];
  const rawPhotoSrc  = d.profilePhotoUrl ? buildDocUrl(d.profilePhotoUrl) : null;
  const displayPhoto = sessionPhoto ? sessionPhoto.url : rawPhotoSrc;
  const photoHtml    = displayPhoto
    ? `<img src="${displayPhoto}" alt="Photo"
         onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/>
       <span class="profile-photo-initials" style="display:none">${initials}</span>`
    : `<span class="profile-photo-initials">${initials}</span>`;
  const statusClass  = d.profileStatus==='COMPLETED' ? 'badge-completed'
                      : d.profileStatus==='ACTIVE'    ? 'badge-active' : 'badge-incomplete';

  const personalSection = isEditMode ? `<div class="form-grid">
      ${editField('First Name *','firstName',d.firstName,'text','e.g. Rahul')}
      ${editField('Middle Name','middleName',d.middleName,'text','e.g. Kumar')}
      ${editField('Last Name *','lastName',d.lastName,'text','e.g. Sharma')}
      <div class="form-group"><label>Employee ID</label><input type="text" value="${d.employeeId||''}" readonly/></div>
      ${editField('Date of Birth','dob',d.dateOfBirth,'date','')}
      ${editSelect('Gender','gender',d.gender,['','Male','Female','Other','Prefer not to say'])}
      ${editSelect('Marital Status','maritalStatus',d.maritalStatus,['','Single','Married','Divorced','Widowed'])}
      ${editSelect('Blood Group','bloodGroup',d.bloodGroup,['','A+','A-','B+','B-','O+','O-','AB+','AB-'])}
      ${editField('Nationality','nationality',d.nationality,'text','e.g. Indian')}
      ${editField('Religion','religion',d.religion,'text','e.g. Hindu')}
      ${editField('PAN Number','pan',d.panNumber,'text','e.g. ABCDE1234F')}
      ${editField('Aadhaar Number','aadhaar',d.aadhaarNumber,'text','12-digit Aadhaar','maxlength="12" inputmode="numeric"')}
      ${editField('LinkedIn Profile','linkedin',d.linkedinProfile,'url','https://linkedin.com/in/yourprofile')}
      ${editField('Father / Spouse Name','fatherSpouse',d.fatherSpouseName,'text','Full name')}
    </div>` : `<div class="form-grid">
      ${viewField('Employee ID',d.employeeId)} ${viewField('First Name',d.firstName)}
      ${viewField('Middle Name',d.middleName)} ${viewField('Last Name',d.lastName)}
      ${viewField('Date of Birth',formatDate(d.dateOfBirth))} ${viewField('Gender',d.gender)}
      ${viewField('Blood Group',d.bloodGroup)} ${viewField('Nationality',d.nationality)}
      ${viewField('Religion',d.religion)} ${viewField('Marital Status',d.maritalStatus)}
      ${viewField('Father / Spouse Name',d.fatherSpouseName)} ${viewField('PAN Number',d.panNumber)}
      ${viewField('Aadhaar Number',d.aadhaarNumber)}
      ${viewField('LinkedIn Profile',d.linkedinProfile
        ?`<a href="${d.linkedinProfile}" target="_blank" rel="noopener" style="color:var(--primary)">${d.linkedinProfile}</a>`:'')}
    </div>`;

  const pwdSection = isEditMode ? `
    <div style="margin-top:16px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:500;color:var(--text-secondary)">
        <input type="checkbox" id="pwdCheckbox" ${d.isPhysicallyChallenged?'checked':''} style="width:16px;height:16px;accent-color:var(--primary)"/>
        Physically Challenged
      </label>
    </div>
    <div id="pwdFields" style="display:${d.isPhysicallyChallenged?'grid':'none'};margin-top:16px" class="form-grid">
      ${editField('Disability Type','disabilityType',d.disabilityType,'text','e.g. Visual, Locomotor')}
      ${editField('Disability %','disabilityPercent',d.disabilityPercentage,'number','0–100','min="0" max="100"')}
      ${editField('Certificate Number','certificateNo',d.certificateNumber,'text','Govt issued cert. no.')}
    </div>` : `<div class="form-grid">
      <div class="form-group"><label>Physically Challenged</label>
        <div class="field-value"><span class="badge ${d.isPhysicallyChallenged?'badge-challenged':'badge-no'}">${d.isPhysicallyChallenged?'Yes':'No'}</span></div>
      </div>
      ${d.isPhysicallyChallenged?viewField('Disability Type',d.disabilityType):''}
      ${d.isPhysicallyChallenged?viewField('Disability %',d.disabilityPercentage!=null?`${d.disabilityPercentage}%`:''):''}
      ${d.isPhysicallyChallenged?viewField('Certificate Number',d.certificateNumber):''}
    </div>`;

  return `<div style="padding:0">
    <div class="profile-hero">
      <div class="profile-photo-wrap" id="profilePhotoWrap">
        ${photoHtml}
        ${isEditMode?`<div class="photo-edit-btn visible" id="photoEditTrigger" title="Change photo"><i class="fas fa-camera"></i></div>`:''}
      </div>
      <div class="profile-hero-info">
        <h2>${`${d.firstName||''} ${d.lastName||''}`.trim()||'—'}</h2>
        <p>${d.designation||'—'} &bull; ${d.department||'—'}</p>
        <div class="profile-hero-badges">
          <span class="badge ${statusClass}">${d.profileStatus||'Incomplete'}</span>
          ${d.employmentType?`<span class="badge badge-fulltime">${d.employmentType.replace(/_/g,' ')}</span>`:''}
        </div>
      </div>
    </div>
    <div style="padding:24px">
      <div class="form-section">
        <div class="section-title"><i class="fas fa-user"></i> Personal Details</div>
        ${personalSection}
      </div>
      <div class="form-section">
        <div class="section-title"><i class="fas fa-wheelchair"></i> Disability Information</div>
        ${pwdSection}
      </div>
    </div>
  </div>`;
}

// ── Step 2 ──────────────────────────────────────────────
function renderStep2(d) {
  const jobSection = isEditMode ? `<div class="form-grid">
      ${editField('Department *','department',d.department,'text','e.g. Engineering')}
      ${editField('Sub Department','subDepartment',d.subDepartment,'text','e.g. Frontend')}
      ${editField('Designation *','designation',d.designation,'text','e.g. Software Engineer')}
      ${editField('Employee Grade','employeeGrade',d.employeeGrade,'text','e.g. L3 / Senior')}
      ${editSelect('Employment Type','employmentType',d.employmentType,[
        {value:'',label:'-- Select --'},{value:'FULL_TIME',label:'Full Time'},
        {value:'PART_TIME',label:'Part Time'},{value:'CONTRACT',label:'Contract'},{value:'INTERN',label:'Intern'},
      ])}
      ${editField('Work Location','workLocation',d.workLocation,'text','e.g. Bangalore / Remote')}
      ${editField('Shift','shift',d.shift,'text','e.g. General / Night')}
      ${editField('Cost Centre','costCentre',d.costCentre,'text','e.g. CC-001')}
      ${editField('Joining Date','joiningDate',d.joiningDate,'date','')}
      ${editField('Probation End Date','probationEndDate',d.probationEndDate,'date','')}
      ${editField('Reporting Manager','reportingManager',d.reportingManager,'text','Full name of manager')}
      ${editField('HR Business Partner','hrBusinessPartner',d.hrBusinessPartner,'text','HR contact name')}
      ${editField('Work Email','workEmail',d.workEmail,'email','yourname@company.com')}
    </div>` : `<div class="form-grid">
      ${viewField('Department',d.department)} ${viewField('Sub Department',d.subDepartment)}
      ${viewField('Designation',d.designation)} ${viewField('Employee Grade',d.employeeGrade)}
      ${viewField('Employment Type',d.employmentType?d.employmentType.replace(/_/g,' '):'')}
      ${viewField('Work Location',d.workLocation)} ${viewField('Shift',d.shift)}
      ${viewField('Cost Centre',d.costCentre)} ${viewField('Joining Date',formatDate(d.joiningDate))}
      ${viewField('Probation End Date',formatDate(d.probationEndDate))}
      ${viewField('Reporting Manager',d.reportingManager)} ${viewField('HR Business Partner',d.hrBusinessPartner)}
      ${viewField('Work Email',d.workEmail)} ${viewField('Profile Status',d.profileStatus)}
    </div>`;

  // Salary: NEVER shown in edit form — HR managed
  const bankSection = isEditMode ? `<div class="form-grid">
      ${editField('Bank Name','bankName',d.bankName,'text','e.g. HDFC Bank / SBI')}
      ${editField('Account Number','accountNumber',d.accountNumber,'text','Savings account number')}
      <div class="form-group"><label>IFSC Code</label>
        <input type="text" id="ifsc" value="${(d.ifscCode||'').toUpperCase()}"
          placeholder="e.g. HDFC0001234" maxlength="11" style="text-transform:uppercase"/>
        <span style="font-size:11px;color:var(--text-muted);margin-top:3px">Auto-verifies bank name on valid IFSC.</span>
      </div>
      <div class="form-group"><label>Basic Salary (₹)</label>
        <div class="field-value empty" style="font-style:italic">Managed by HR — not editable</div>
      </div>
    </div>` : `<div class="form-grid">
      ${viewField('Bank Name',d.bankName)}
      ${viewField('Account Number',d.accountNumber?'••••'+String(d.accountNumber).slice(-4):'')}
      ${viewField('IFSC Code',d.ifscCode)}
      <div class="form-group"><label>Basic Salary</label>${maskSalary(d.basicSalary)}</div>
    </div>`;

  return `<div class="form-section">
      <div class="section-title"><i class="fas fa-briefcase"></i> Job Details</div>${jobSection}
    </div>
    <div class="form-section">
      <div class="section-title"><i class="fas fa-university"></i> Bank Details</div>${bankSection}
    </div>`;
}

// ── Step 3 ──────────────────────────────────────────────
function renderStep3(d) {
  if (isEditMode) return `
    <div class="form-section">
      <div class="section-title"><i class="fas fa-phone"></i> Contact Information</div>
      <div class="form-grid">
        ${editField('Personal Email *','personalEmail',d.personalEmail,'email','your@personal.com')}
        ${editField('Work Email','workEmail',d.workEmail,'email','your@company.com')}
        <div class="form-group"><label>Mobile Number *</label>
          <input type="tel" id="mobileNumber" value="${d.mobileNumber||''}"
            placeholder="10-digit mobile (starts 6–9)" maxlength="10" inputmode="numeric"/></div>
        <div class="form-group"><label>Alternate Number</label>
          <input type="tel" id="alternateNumber" value="${d.alternateNumber||''}"
            placeholder="Optional 10-digit number" maxlength="10" inputmode="numeric"/></div>
      </div>
    </div>
    <div class="form-section">
      <div class="section-title"><i class="fas fa-home"></i> Current Address</div>
      <div class="form-grid">
        ${editField('Street','curStreet',d.currentStreet,'text','House no., Street name')}
        ${editField('City','curCity',d.currentCity,'text','e.g. Bangalore')}
        ${editField('State','curState',d.currentState,'text','e.g. Karnataka')}
        ${editField('PIN Code','curPin',d.currentPincode,'text','6-digit PIN','maxlength="6" inputmode="numeric"')}
        ${editField('Country','curCountry',d.currentCountry,'text','e.g. India')}
      </div>
    </div>
    <div class="form-section">
      <div class="section-title">
        <div class="title-left"><i class="fas fa-map-marker-alt"></i> Permanent Address</div>
        <button class="btn-add" id="copyAddressBtn"><i class="fas fa-copy"></i> Same as Current</button>
      </div>
      <div class="form-grid">
        ${editField('Street','perStreet',d.permanentStreet,'text','House no., Street name')}
        ${editField('City','perCity',d.permanentCity,'text','e.g. Mumbai')}
        ${editField('State','perState',d.permanentState,'text','e.g. Maharashtra')}
        ${editField('PIN Code','perPin',d.permanentPincode,'text','6-digit PIN','maxlength="6" inputmode="numeric"')}
        ${editField('Country','perCountry',d.permanentCountry,'text','e.g. India')}
      </div>
    </div>
    <div class="form-section">
      <div class="section-title"><i class="fas fa-ambulance"></i> Emergency Contact</div>
      <div class="form-grid">
        ${editField('Name *','emergencyName',d.emergencyName,'text','Full name')}
        ${editField('Relationship','emergencyRelation',d.emergencyRelationship,'text','e.g. Father / Spouse')}
        <div class="form-group"><label>Phone Number *</label>
          <input type="tel" id="emergencyPhone" value="${d.emergencyPhone||''}"
            placeholder="10-digit mobile number" maxlength="10" inputmode="numeric"/></div>
      </div>
    </div>`;

  return `
  <div class="form-section">
    <div class="section-title"><i class="fas fa-phone"></i> Contact Information</div>
    <div class="form-grid">
      ${viewField('Personal Email',d.personalEmail)} ${viewField('Work Email',d.workEmail)}
      ${viewField('Mobile Number',d.mobileNumber)}   ${viewField('Alternate Number',d.alternateNumber)}
    </div>
  </div>
  <div class="form-section">
    <div class="section-title"><i class="fas fa-home"></i> Current Address</div>
    <div class="form-grid">
      ${viewField('Street',d.currentStreet)} ${viewField('City',d.currentCity)}
      ${viewField('State',d.currentState)}   ${viewField('PIN Code',d.currentPincode)}
      ${viewField('Country',d.currentCountry)}
    </div>
  </div>
  <div class="form-section">
    <div class="section-title"><i class="fas fa-map-marker-alt"></i> Permanent Address</div>
    <div class="form-grid">
      ${viewField('Street',d.permanentStreet)} ${viewField('City',d.permanentCity)}
      ${viewField('State',d.permanentState)}   ${viewField('PIN Code',d.permanentPincode)}
      ${viewField('Country',d.permanentCountry)}
    </div>
  </div>
  <div class="form-section">
    <div class="section-title"><i class="fas fa-ambulance"></i> Emergency Contact</div>
    <div class="form-grid">
      ${viewField('Name',d.emergencyName)} ${viewField('Relationship',d.emergencyRelationship)}
      ${viewField('Phone Number',d.emergencyPhone)}
    </div>
  </div>`;
}

// ── Step 4 ──────────────────────────────────────────────
function renderStep4(d) {
  const mkList = (arr, type, mapFn) => arr.length
    ? arr.map((item,i)=>`<div class="dynamic-item">
        <div class="dynamic-item-left">${mapFn(item)}</div>
        ${isEditMode?`<div class="dynamic-item-actions">
          <button class="btn-icon-sm" data-action="edit"   data-type="${type}" data-index="${i}"><i class="fas fa-pencil-alt"></i></button>
          <button class="btn-icon-sm del" data-action="delete" data-type="${type}" data-index="${i}"><i class="fas fa-trash"></i></button>
        </div>`:''}
      </div>`).join('')
    : `<div class="empty-list">No ${type} records added</div>`;

  return `
  <div class="form-section">
    <div class="section-title">
      <div class="title-left"><i class="fas fa-graduation-cap"></i> Education</div>
      ${isEditMode?`<button class="btn-add" id="addEduBtn"><i class="fas fa-plus"></i> Add</button>`:''}
    </div>
    <div class="dynamic-list">${mkList(educationList,'education',e=>`
      <strong>${e.degree||'—'}</strong>
      <span>${e.institute||e.institution||'—'}${e.year?` • ${e.year}`:''}${e.percentage?` • ${e.percentage}`:''}</span>`)}</div>
  </div>
  <div class="form-section">
    <div class="section-title">
      <div class="title-left"><i class="fas fa-users"></i> Family</div>
      ${isEditMode?`<button class="btn-add" id="addFamilyBtn"><i class="fas fa-plus"></i> Add</button>`:''}
    </div>
    <div class="dynamic-list">${mkList(familyList,'family',f=>`
      <strong>${f.name||'—'}</strong>
      <span>${f.relationship||'—'}${f.occupation?` • ${f.occupation}`:''}${f.phone?` • ${f.phone}`:''}</span>`)}</div>
  </div>
  <div class="form-section">
    <div class="section-title">
      <div class="title-left"><i class="fas fa-briefcase"></i> Work Experience</div>
      ${isEditMode?`<button class="btn-add" id="addExpBtn"><i class="fas fa-plus"></i> Add</button>`:''}
    </div>
    <div class="dynamic-list">${mkList(experienceList,'experience',e=>`
      <strong>${e.company||'—'}</strong>
      <span>${e.designation||'—'}${e.years?` • ${e.years} yr(s)`:''}${e.location?` • ${e.location}`:''}</span>`)}</div>
  </div>`;
}

// ── Step 5 ──────────────────────────────────────────────
// ── Step 5 — REPLACE ENTIRE renderStep5 function ────────
function renderStep5(d) {
  // ── Helper: strict URL validity (string level only) ──
  function isValidUrlString(url) {
    return !!(url && url !== 'null' && url !== 'undefined' && url.trim().length > 5);
  }

  // ── Build card HTML after we know which server URLs actually exist ──
  function buildCards(verifiedServerUrls) {
    return DOC_CONFIGS.map(doc => {
      const sess        = docUploads[doc.label];
      const serverUrl   = verifiedServerUrls[doc.label]; // null if 404 or not uploaded
      const viewUrl     = sess ? sess.url : serverUrl;
      const hasValidUrl = sess ? true : isValidUrlString(serverUrl); // session upload always valid
      const mimeIsImg   = sess ? (sess.mimeType !== 'application/pdf') : true;
      const uploadedName = sess ? sess.name : (hasValidUrl ? 'Available' : '');

      // Icon section — fallback img when no doc
      const iconHtml = hasValidUrl
        ? `<i class="fas ${doc.icon}"></i>`
        : `<img src="Images/doc.png" alt="No document"
             style="width:40px;height:40px;object-fit:contain;opacity:0.40;border-radius:4px"
             onerror="this.style.display='none';
                      this.insertAdjacentHTML('afterend','<i class=\\'fas ${doc.icon} \\' style=\\'color:var(--text-muted);font-size:18px\\'></i>')"/>`;

      // Action buttons — strictly guarded
      const actionHtml = hasValidUrl
        ? `<button class="btn-view-doc"
             data-url="${viewUrl}" data-label="${doc.label}" data-isimg="${mimeIsImg}">
             <i class="fas fa-eye"></i> View
           </button>
           <button class="btn-download-doc"
             style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;
                    background:var(--primary-light);color:var(--primary);
                    border:1px solid #b3dde5;border-radius:8px;
                    font-size:12.5px;font-weight:500;cursor:pointer;"
             data-url="${viewUrl}"
             data-filename="${doc.label.replace(/\s/g, '_')}">
             <i class="fas fa-download"></i> Download
           </button>`
        : `<button class="btn-view-doc disabled" disabled>
             <i class="fas fa-ban"></i> Not Available
           </button>
           <button disabled
             style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;
                    background:#f1f5f9;color:#94a3b8;border:1px solid #e2e8f0;
                    border-radius:8px;font-size:12.5px;font-weight:500;
                    cursor:not-allowed;opacity:0.55;pointer-events:none;">
             <i class="fas fa-download"></i> Download
           </button>`;

      const uploadBtn = isEditMode
        ? `<button class="btn-upload-doc"
             data-doc="${doc.label}"
             data-accept="${doc.acceptAttr}"
             data-types='${JSON.stringify(doc.acceptTypes)}'>
             <i class="fas fa-upload"></i> ${hasValidUrl ? 'Replace' : 'Upload'}
           </button>`
        : '';

      return `
        <div class="doc-card">
          <div class="doc-card-top">
            <div class="doc-icon-wrap ${hasValidUrl ? '' : 'unavailable'}"
                 style="${!hasValidUrl ? 'background:#f8fafc;border:1px dashed #cbd5e1;' : ''}">
              ${iconHtml}
            </div>
            <div class="doc-card-info">
              <h4>${doc.label}</h4>
              <span class="doc-status-badge ${hasValidUrl ? 'available' : 'unavailable'}">
                ${hasValidUrl ? (sess ? `✓ ${uploadedName}` : 'Available') : 'Not Uploaded'}
              </span>
            </div>
          </div>
          <div style="font-size:11.5px;color:var(--text-muted);line-height:1.5;margin-bottom:4px">
            ${doc.note}
          </div>
          <div class="doc-actions-row">
            ${actionHtml}
            ${uploadBtn}
          </div>
        </div>`;
    }).join('');
  }

  // ── Verify server URLs with HEAD requests (non-blocking) ──
  // Show skeleton cards first, then replace once verification done
  const skeletonCards = DOC_CONFIGS.map(() => `
    <div class="doc-card" style="opacity:0.5;pointer-events:none">
      <div class="doc-card-top">
        <div class="doc-icon-wrap unavailable">
          <i class="fas fa-circle-notch fa-spin" style="color:var(--text-muted)"></i>
        </div>
        <div class="doc-card-info">
          <h4 style="background:#e2e8f0;border-radius:4px;height:14px;width:120px"> </h4>
          <span style="background:#f1f5f9;border-radius:4px;height:10px;width:70px;display:inline-block;margin-top:4px"> </span>
        </div>
      </div>
    </div>`).join('');

  const missingBanner = !allDocsUploaded() && !isEditMode ? `
    <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;
                padding:12px 16px;margin-bottom:16px;font-size:13px;color:#92400e;
                display:flex;align-items:center;gap:10px">
      <i class="fas fa-exclamation-triangle" style="color:#f59e0b;flex-shrink:0"></i>
      <span>Some required documents are missing. Click <strong>Edit Profile</strong> to upload them.
            All 5 documents must be uploaded before Final Submission.</span>
    </div>` : '';

  // Fire HEAD checks async — update DOM once all settled
  setTimeout(async () => {
    const verifiedServerUrls = {};

    // await Promise.allSettled(
    //   DOC_CONFIGS.map(async doc => {
    //     const sess = docUploads[doc.label];
    //     if (sess) {
    //       // Session upload — no HEAD needed, it's a blob URL
    //       verifiedServerUrls[doc.label] = sess.url;
    //       return;
    //     }
    //     const rawUrl = d[doc.serverKey];
    //     if (!isValidUrlString(rawUrl)) {
    //       verifiedServerUrls[doc.label] = null;
    //       return;
    //     }
    //     const fullUrl = buildDocUrl(rawUrl);
    //     try {
    //       const res = await fetch(fullUrl, { method: 'HEAD' });
    //       // 200 = exists, anything else (404, 500) = treat as missing
    //       verifiedServerUrls[doc.label] = res.ok ? fullUrl : null;
    //     } catch {
    //       verifiedServerUrls[doc.label] = null;
    //     }
    //   })
    // );

    // FINAL CORRECT REPLACE — simple GET, read status only, no body consumed
await Promise.allSettled(
  DOC_CONFIGS.map(async doc => {
    const sess = docUploads[doc.label];
    if (sess) {
      verifiedServerUrls[doc.label] = sess.url;
      return;
    }

    const rawUrl = d[doc.serverKey];
    if (!isValidUrlString(rawUrl)) {
      verifiedServerUrls[doc.label] = null;
      return;
    }

    const fullUrl = buildDocUrl(rawUrl);
    try {
      const res = await fetch(fullUrl);
      // Check status WITHOUT reading body (avoids downloading entire file)
      // res.ok = true means 200-299, file exists on server
      verifiedServerUrls[doc.label] = res.ok ? fullUrl : null;
      // Consume body in background to release connection — don't await
      res.blob().catch(() => {});
    } catch {
      verifiedServerUrls[doc.label] = null;
    }
  })
);

    // Find the documents-grid container and replace content
    const grid = document.querySelector('#stepContainer .documents-grid');
    if (!grid) return; // user navigated away

    grid.innerHTML = buildCards(verifiedServerUrls);

    // Bind events on the newly rendered cards
    grid.querySelectorAll('.btn-view-doc[data-url]').forEach(btn => {
      btn.addEventListener('click', () =>
        openDocModal(btn.dataset.url, btn.dataset.label, btn.dataset.isimg === 'true')
      );
    });

    grid.querySelectorAll('.btn-upload-doc').forEach(btn => {
      const types = JSON.parse(btn.dataset.types || '[]');
      btn.addEventListener('click', () =>
        openFileUploadModal(btn.dataset.doc, btn.dataset.accept, types)
      );
    });

    grid.querySelectorAll('.btn-download-doc').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url      = btn.dataset.url;
        const filename = btn.dataset.filename;
        if (!url) return;

        // Blob URL — direct anchor download
        if (url.startsWith('blob:')) {
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          return;
        }

        // Server URL — fetch blob, force download (prevents browser PDF inline open)
        const origHtml = btn.innerHTML;
        try {
          btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
          btn.style.pointerEvents = 'none';
          const res  = await fetch(url);
          if (!res.ok) throw new Error(`${res.status}`);
          const blob = await res.blob();
          const ext  = blob.type === 'application/pdf' ? '.pdf'
                     : blob.type === 'image/png'       ? '.png' : '.jpg';
          const burl = URL.createObjectURL(blob);
          const a    = document.createElement('a');
          a.href     = burl;
          a.download = filename + ext;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(burl), 5000);
        } catch (err) {
          showToast('Download failed — file may not exist on server', 'error');
        } finally {
          btn.innerHTML = origHtml;
          btn.style.pointerEvents = '';
        }
      });
    });

  }, 0);

  // Return immediately with skeleton + instructions
  // Grid gets filled async above
  return `
    <div class="form-section">
      <div class="doc-instructions">
        <div class="doc-instructions-title">
          <i class="fas fa-exclamation-circle"></i> Document Upload Guidelines
        </div>
        <div class="doc-instr-grid">
          <div class="doc-instr-item"><i class="fas fa-check-circle"></i>All documents must be clear, legible, and not blurry.</div>
          <div class="doc-instr-item"><i class="fas fa-check-circle"></i><strong>Aadhaar, PAN, Profile Photo:</strong> JPG/PNG only. <strong>Degree, Experience, Offer Letter:</strong> PDF or JPG/PNG.</div>
          <div class="doc-instr-item"><i class="fas fa-check-circle"></i>Max file size: <strong>5 MB per file</strong>.</div>
          <div class="doc-instr-item"><i class="fas fa-check-circle"></i>No photocopies of photocopies. Original documents only.</div>
          <div class="doc-instr-item"><i class="fas fa-check-circle"></i>All four corners visible. No cropped edges.</div>
          <div class="doc-instr-item"><i class="fas fa-check-circle"></i>Experience/Offer letters must be on company letterhead with seal.</div>
          <div class="doc-instr-item"><i class="fas fa-check-circle"></i>Profile Photo: Passport-size, white background, no sunglasses.</div>
          <div class="doc-instr-item"><i class="fas fa-check-circle"></i>Incorrect or illegible documents will be rejected by HR.</div>
        </div>
      </div>
      ${missingBanner}
      <div class="documents-grid">${skeletonCards}</div>
    </div>`;
}
// ═══════════════════════════════════════════════════════
//  STEP EVENTS
// ═══════════════════════════════════════════════════════
function attachStepEvents() {
  if (currentStep===1) {
    const cb=document.getElementById('pwdCheckbox'), pf=document.getElementById('pwdFields');
    if (cb&&pf) { if(cb.checked) pf.style.display='grid'; cb.addEventListener('change',e=>{pf.style.display=e.target.checked?'grid':'none';}); }
    document.getElementById('photoEditTrigger')?.addEventListener('click',()=>
      openFileUploadModal('Profile Photo','.jpg,.jpeg,.png',['image/jpeg','image/jpg','image/png']));
    if (isEditMode) attachFieldValidators();
  }
  if (currentStep===2 && isEditMode) { attachFieldValidators(); attachIfscVerifier(); }
  if (currentStep===3) {
    document.getElementById('copyAddressBtn')?.addEventListener('click',()=>{
      [['curStreet','perStreet'],['curCity','perCity'],['curState','perState'],['curPin','perPin'],['curCountry','perCountry']]
        .forEach(([s,d])=>{ const se=document.getElementById(s),de=document.getElementById(d); if(se&&de) de.value=se.value; });
      showToast('Current address copied to permanent address');
    });
    if (isEditMode) attachFieldValidators();
  }
  if (currentStep===4) {
    document.getElementById('addEduBtn')   ?.addEventListener('click',()=>openAddModal('education'));
    document.getElementById('addFamilyBtn')?.addEventListener('click',()=>openAddModal('family'));
    document.getElementById('addExpBtn')   ?.addEventListener('click',()=>openAddModal('experience'));
    document.querySelectorAll('[data-action="edit"]').forEach(btn=>btn.addEventListener('click',()=>openEditModalEntry(btn.dataset.type,parseInt(btn.dataset.index))));
    document.querySelectorAll('[data-action="delete"]').forEach(btn=>btn.addEventListener('click',()=>{
      if(!confirm('Delete this entry?')) return;
      const idx=parseInt(btn.dataset.index);
      if(btn.dataset.type==='education')  educationList.splice(idx,1);
      if(btn.dataset.type==='family')     familyList.splice(idx,1);
      if(btn.dataset.type==='experience') experienceList.splice(idx,1);
      renderCurrentStep(); showToast('Entry deleted');
    }));
  }
}

// ═══════════════════════════════════════════════════════
//  MODALS: Add / Edit dynamic lists
// ═══════════════════════════════════════════════════════
const MODAL_FIELDS = {
  education:[
    {id:'modalField1',label:'Degree / Qualification',key:'degree',     ph:'e.g. B.Tech CSE'},
    {id:'modalField2',label:'Institute / University', key:'institute',  ph:'e.g. NIT Trichy'},
    {id:'modalField3',label:'Year of Passing',        key:'year',       ph:'e.g. 2020'},
    {id:'modalField4',label:'Percentage / CGPA',      key:'percentage', ph:'e.g. 8.5 CGPA'},
  ],
  family:[
    {id:'modalField1',label:'Full Name',    key:'name',        ph:'e.g. Ramesh Kumar'},
    {id:'modalField2',label:'Relationship', key:'relationship',ph:'e.g. Father / Spouse'},
    {id:'modalField3',label:'Occupation',   key:'occupation',  ph:'e.g. Retired / Teacher'},
    {id:'modalField4',label:'Phone Number', key:'phone',       ph:'10-digit mobile'},
  ],
  experience:[
    {id:'modalField1',label:'Company Name',key:'company',    ph:'e.g. Infosys'},
    {id:'modalField2',label:'Designation', key:'designation',ph:'e.g. Software Engineer'},
    {id:'modalField3',label:'Years',       key:'years',      ph:'e.g. 2.5'},
    {id:'modalField4',label:'Location',    key:'location',   ph:'e.g. Pune'},
  ],
};

function openAddModal(type) {
  currentModalType=type; currentEditIndex=null;
  document.getElementById('modalTitle').textContent=`Add ${capitalize(type)}`;
  document.getElementById('modalBody').innerHTML=(MODAL_FIELDS[type]||[]).map(f=>`
    <div class="form-group"><label>${f.label}</label>
      <input type="text" id="${f.id}" placeholder="${f.ph}"/></div>`).join('');
  document.getElementById('modalOverlay').classList.add('active');
  document.getElementById('modalSaveBtn').style.display='';
}
function openEditModalEntry(type,idx) {
  currentModalType=type; currentEditIndex=idx;
  const listMap={education:educationList,family:familyList,experience:experienceList};
  const item=(listMap[type]||[])[idx]; if(!item) return;
  document.getElementById('modalTitle').textContent=`Edit ${capitalize(type)}`;
  document.getElementById('modalBody').innerHTML=(MODAL_FIELDS[type]||[]).map(f=>`
    <div class="form-group"><label>${f.label}</label>
      <input type="text" id="${f.id}" value="${(item[f.key]||'').replace(/"/g,'&quot;')}" placeholder="${f.ph}"/></div>`).join('');
  document.getElementById('modalOverlay').classList.add('active');
  document.getElementById('modalSaveBtn').style.display='';
}
function saveModal() {
  const listMap={education:educationList,family:familyList,experience:experienceList};
  const obj={};
  (MODAL_FIELDS[currentModalType]||[]).forEach(f=>{const el=document.getElementById(f.id); obj[f.key]=el?el.value.trim():'';});
  const list=listMap[currentModalType];
  if(currentEditIndex!==null) list[currentEditIndex]=obj; else list.push(obj);
  document.getElementById('modalOverlay').classList.remove('active');
  renderCurrentStep(); showToast(`${capitalize(currentModalType)} saved`);
}
function capitalize(s) { return s?s[0].toUpperCase()+s.slice(1):''; }

// ═══════════════════════════════════════════════════════
//  FILE UPLOAD MODAL
// ═══════════════════════════════════════════════════════
function openFileUploadModal(docName, acceptAttr, acceptTypes) {
  currentModalType='fileUpload';
  document.getElementById('modalTitle').textContent=`Upload: ${docName}`;
  const imageOnly=!acceptAttr.includes('.pdf');
  document.getElementById('modalBody').innerHTML=`
    <div class="dropzone" id="dropzone">
      <i class="fas fa-cloud-upload-alt"></i>
      <p>Drag &amp; drop or click to select</p>
      <small>${imageOnly?'JPG, PNG only':'PDF, JPG, PNG'} &bull; Max 5 MB</small>
      <input type="file" id="fileInput" accept="${acceptAttr}" style="display:none"/>
    </div>
    <div id="filePreview" style="margin-top:8px"></div>`;
  document.getElementById('modalOverlay').classList.add('active');
  document.getElementById('modalSaveBtn').style.display='none';
  const dz=document.getElementById('dropzone'), fi=document.getElementById('fileInput');
  dz.onclick=()=>fi.click();
  fi.onchange=e=>handleFileSelect(e.target.files[0],docName,acceptTypes);
  dz.ondragover=e=>{e.preventDefault();dz.classList.add('drag-over');};
  dz.ondragleave=()=>dz.classList.remove('drag-over');
  dz.ondrop=e=>{e.preventDefault();dz.classList.remove('drag-over');handleFileSelect(e.dataTransfer.files[0],docName,acceptTypes);};
}

function handleFileSelect(file, docName, acceptTypes) {
  if (!file) return;
  if (!acceptTypes.includes(file.type)) {
    showToast(`Invalid type for ${docName}. Allowed: ${acceptTypes.map(t=>t.split('/')[1]).join(', ')}`, 'error'); return;
  }
  if (file.size>5*1024*1024) { showToast('File must be under 5 MB','error'); return; }
  if (docUploads[docName]?.url?.startsWith('blob:')) URL.revokeObjectURL(docUploads[docName].url);
  const url=URL.createObjectURL(file);
  docUploads[docName]={ file, url, name:file.name, mimeType:file.type };
  const pv=document.getElementById('filePreview');
  if (pv) pv.innerHTML=`<div style="display:flex;align-items:center;gap:8px;padding:10px;
    background:var(--success-bg);border-radius:8px;font-size:13px;color:var(--success)">
    <i class="fas fa-check-circle"></i><strong>${file.name}</strong>
    <span style="color:var(--text-muted)">(${(file.size/1024).toFixed(1)} KB)</span></div>`;
  document.getElementById('modalOverlay').classList.remove('active');
  renderCurrentStep(); renderCompletion();
  showToast(`${docName} selected. Click "Save Changes" to upload.`);
}

// ═══════════════════════════════════════════════════════
//  DOC VIEW MODAL — handles base64 PDF, base64 image, blob URL, remote URL
// ═══════════════════════════════════════════════════════
function openDocModal(url, label, isImg) {
  const overlay=document.getElementById('imgModalOverlay');
  const content=document.getElementById('imgModalContent');
  document.getElementById('imgModalTitle').textContent=label;
  content.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--text-muted)"><i class="fas fa-circle-notch fa-spin" style="font-size:24px"></i></div>`;
  overlay.classList.add('active');

  // Detect raw base64 string from backend (LONGBLOB served as base64 text)
  const isBase64Raw = url && !url.startsWith('blob:') && !url.startsWith('http') && !url.startsWith('/') && url.length>100;

  if (isBase64Raw) {
    const isPdfB64 = url.startsWith('JVBERi0');  // PDF magic bytes in base64
    if (isPdfB64) {
      try {
        const bytes=atob(url), arr=new Uint8Array(bytes.length);
        for(let i=0;i<bytes.length;i++) arr[i]=bytes.charCodeAt(i);
        const blob=new Blob([arr],{type:'application/pdf'});
        const blobUrl=URL.createObjectURL(blob);
        content.innerHTML=`<object data="${blobUrl}" type="application/pdf" style="width:80vw;height:75vh;border-radius:8px">
          <iframe src="${blobUrl}" style="width:80vw;height:75vh;border:none;border-radius:8px">
            <p>Cannot display PDF. <a href="${blobUrl}" target="_blank">Open in new tab</a></p>
          </iframe></object>`;
      } catch { content.innerHTML=`<p style="color:#ef4444;padding:20px">Failed to render PDF.</p>`; }
    } else {
      // base64 image
      const mime=url.startsWith('/9j/')?'image/jpeg':'image/png';
      content.innerHTML=`<img src="data:${mime};base64,${url}" alt="${label}" style="max-width:100%;display:block;border-radius:8px"/>`;
    }
    return;
  }

  // Blob / remote URL
  const lc=url.toLowerCase();
  
  // const isPdf=lc.endsWith('.pdf')||lc.includes('/pdf/')||lc.includes('pdf-image')||(!isImg && !lc.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/));

  // REPLACE WITH — trust Content-Type from server, detect by URL pattern for offer/degree/experience
  const isPdf = lc.endsWith('.pdf')
    || lc.includes('/offer-image')
    || lc.includes('/degree-image')
    || lc.includes('/experience-image');

  if (isPdf) {
    content.innerHTML=`
      <object data="${url}" type="application/pdf" style="width:80vw;height:75vh;border-radius:8px">
        <iframe src="${url}" style="width:80vw;height:75vh;border:none;border-radius:8px">
          <p>PDF cannot be displayed. <a href="${url}" target="_blank" style="color:var(--primary)">Open in new tab</a></p>
        </iframe>
      </object>`;
  } else {
    const img=new Image();
    img.onload=()=>{ content.innerHTML=`<img src="${url}" alt="${label}" style="max-width:100%;display:block;border-radius:8px"/>`; };
    img.onerror=()=>{ content.innerHTML=`<iframe src="${url}" style="width:80vw;height:75vh;border:none;border-radius:8px"></iframe>`; };
    img.src=url;
  }
}

function closeDocModal() {
  document.getElementById('imgModalOverlay').classList.remove('active');
  document.getElementById('imgModalContent').innerHTML='';
}

// ═══════════════════════════════════════════════════════
//  FINAL SUBMIT
// ═══════════════════════════════════════════════════════
function openConfirmOverlay() {
  document.getElementById('confirmOverlay').classList.add('active');
  document.querySelectorAll('.confirm-chk').forEach(c=>c.checked=false);
  updateConfirmSubmitBtn();
}
function closeConfirmOverlay() { document.getElementById('confirmOverlay').classList.remove('active'); }
function updateConfirmSubmitBtn() {
  document.getElementById('confirmSubmitBtn').disabled=![...document.querySelectorAll('.confirm-chk')].every(c=>c.checked);
}

async function doFinalSubmit() {
  const primeId=getEmployeePrimeId();
  if(!primeId){ showToast('Employee prime ID missing','error'); return; }
  const btn=document.getElementById('confirmSubmitBtn');
  btn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Submitting…'; btn.disabled=true;
  try {
    const dto=buildDTOFromEmpData(); dto.profileStatus='COMPLETED';
    const updated=await callUpdateEmployee(primeId,dto,buildFilesPayload());
    empData=updated; empData.profileStatus='COMPLETED';
    isLocked=true; closeConfirmOverlay(); updateLockUI(); renderCompletion(); renderCurrentStep();
    showToast('Profile submitted and locked successfully! 🎉');
  } catch(err) {
    showToast(err.message||'Submission failed. Try again.','error');
    btn.innerHTML='<i class="fas fa-paper-plane"></i> Confirm & Submit'; btn.disabled=false;
  }
}

// ═══════════════════════════════════════════════════════
//  PASSWORD UPDATE
// ═══════════════════════════════════════════════════════
async function updatePassword() {
  const empId    = getEmployeeId();
  // Do NOT trim passwords — intentional
  const oldPwd     = document.getElementById('oldPassword').value;
  const newPwd     = document.getElementById('newPassword').value;
  const confirmPwd = document.getElementById('confirmPassword').value;
  if (!oldPwd||!newPwd||!confirmPwd) { showToast('Fill all password fields','error'); return; }
  if (newPwd.length<6)               { showToast('New password must be at least 6 characters','error'); return; }
  if (newPwd!==confirmPwd)           { showToast('New password & confirm password do not match','error'); return; }
  if (oldPwd===newPwd)               { showToast('New password must differ from current password','error'); return; }
  const btn=document.getElementById('updatePwdBtn');
  btn.innerHTML='<i class="fas fa-circle-notch fa-spin"></i> Updating…'; btn.disabled=true;
  try {
    await callUpdatePassword(empId,oldPwd,newPwd);
    showToast('Password updated successfully!');
    ['oldPassword','newPassword','confirmPassword'].forEach(id=>{ document.getElementById(id).value=''; });
  } catch(err) { showToast(err.message||'Failed to update password','error'); }
  finally { btn.innerHTML='<i class="fas fa-lock"></i> Update Password'; btn.disabled=false; }
}

// ═══════════════════════════════════════════════════════
//  HEADER INIT
// ═══════════════════════════════════════════════════════
(function initHeaderFromStorage() {
  const fn=localStorage.getItem('hrms_first_name')||'';
  const ln=localStorage.getItem('hrms_last_name') ||'';
  const desig=localStorage.getItem('hrms_designation')||'';
  const initials=[fn,ln].filter(Boolean).map(n=>n[0]).join('').toUpperCase()||'E';
  const av=document.getElementById('userAvatar'); if(av) av.textContent=initials;
  const rl=document.getElementById('userRole');   if(rl) rl.textContent=desig||'Employee';
})();

// ═══════════════════════════════════════════════════════
//  EVENT BINDINGS
// ═══════════════════════════════════════════════════════
document.getElementById('editBtn').addEventListener('click', enterEditMode);
document.getElementById('cancelBtn').addEventListener('click', cancelEditMode);
document.getElementById('saveBtn').addEventListener('click', saveCurrentStep);
document.getElementById('finalSubmitBtn').addEventListener('click', openConfirmOverlay);

document.getElementById('prevBtn').addEventListener('click', () => {
  if (currentStep>1) {
    if(isEditMode) collectFormDataFromStep(currentStep);
    currentStep--; renderCurrentStep(); updateNavButtons();
  }
});
document.getElementById('nextBtn').addEventListener('click', () => {
  if (currentStep<STEPS.length) {
    if (currentStep+1===5 && !allDocsUploaded()) {
      showToast('Upload all 5 required documents before proceeding to the Documents tab.','error'); return;
    }
    if(isEditMode) collectFormDataFromStep(currentStep);
    currentStep++; renderCurrentStep(); updateNavButtons();
  }
});

document.getElementById('confirmCancelBtn').addEventListener('click', closeConfirmOverlay);
document.getElementById('confirmSubmitBtn').addEventListener('click', doFinalSubmit);
document.getElementById('confirmOverlay').addEventListener('change',e=>{ if(e.target.classList.contains('confirm-chk')) updateConfirmSubmitBtn(); });
document.getElementById('confirmOverlay').addEventListener('click',e=>{ if(e.target===document.getElementById('confirmOverlay')) closeConfirmOverlay(); });

document.getElementById('modalCloseBtn').addEventListener('click',()=>{ document.getElementById('modalOverlay').classList.remove('active'); document.getElementById('modalSaveBtn').style.display=''; });
document.getElementById('modalCancelBtn').addEventListener('click',()=>{ document.getElementById('modalOverlay').classList.remove('active'); document.getElementById('modalSaveBtn').style.display=''; });
document.getElementById('modalSaveBtn').addEventListener('click',()=>{ if(currentModalType!=='fileUpload') saveModal(); });
document.getElementById('modalOverlay').addEventListener('click',e=>{ if(e.target===document.getElementById('modalOverlay')){ document.getElementById('modalOverlay').classList.remove('active'); document.getElementById('modalSaveBtn').style.display=''; }});

document.getElementById('imgModalClose').addEventListener('click', closeDocModal);
document.getElementById('imgModalOverlay').addEventListener('click',e=>{ if(e.target===document.getElementById('imgModalOverlay')) closeDocModal(); });

// Password toggle — must use 'mousedown' to prevent autocomplete conflict
document.querySelectorAll('.toggle-pwd').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const t=document.getElementById(btn.dataset.target); if(!t) return;
    const h=t.type==='password'; t.type=h?'text':'password';
    btn.querySelector('i').className=h?'fas fa-eye-slash':'fas fa-eye';
  });
});

document.getElementById('updatePwdBtn').addEventListener('click', updatePassword);

document.getElementById('collapseSidebarBtn').addEventListener('click',()=>{
  document.getElementById('sidebar').classList.toggle('collapsed');
  document.getElementById('mainContent').classList.toggle('sidebar-collapsed');
});
document.getElementById('mobileToggleBtn').addEventListener('click',()=>{
  document.getElementById('sidebar').classList.toggle('mobile-open');
});

const _pDropBtn=document.getElementById('profileDropdownBtn');
const _pDrop   =document.getElementById('profileDropdown');
_pDropBtn.addEventListener('click',e=>{e.stopPropagation();_pDrop.classList.toggle('active');});
document.addEventListener('click',()=>_pDrop.classList.remove('active'));
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){ _pDrop.classList.remove('active'); closeDocModal(); closeConfirmOverlay(); }
});

function doLogout() { if(confirm('Are you sure you want to logout?')) window.location.href='../index.html'; }
document.getElementById('logoutBtn').addEventListener('click', doLogout);
document.getElementById('dropdownLogoutBtn').addEventListener('click', doLogout);

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
renderStepper();
loadEmployee();










// ======================  old version =======================//
// let educationList = [
//   {
//     degree: "B.Tech CSE",
//     institute: "NIT Trichy",
//     year: "2018",
//     percentage: "8.9 CGPA",
//   },
// ];
// let familyList = [
//   {
//     name: "Sarah Mercer",
//     relationship: "Spouse",
//     occupation: "Architect",
//     phone: "9876543211",
//   },
// ];
// let experienceList = [
//   {
//     company: "TechCorp",
//     designation: "Software Engineer",
//     years: "3",
//     location: "Bangalore",
//   },
// ];
// let documents = {
//   "Aadhaar Card": { uploaded: false, name: "", size: 0, url: null },
//   "PAN Card": { uploaded: false, name: "", size: 0, url: null },
//   "Degree Certificate": { uploaded: false, name: "", size: 0, url: null },
//   "Experience Letter": { uploaded: false, name: "", size: 0, url: null },
// };
// let currentStep = 1,
//   isEditMode = false,
//   currentModalType = null,
//   currentEditIndex = null;
// let formData = { personal: {}, job: {}, contact: {} };

// // Helper toast
// function showSuccessToast(msg) {
//   Toastify({
//     text: `✓ ${msg}`,
//     duration: 3000,
//     gravity: "bottom",
//     position: "right",
//     backgroundColor: "#6FAF2E",
//     className: "toast-success",
//     stopOnFocus: true,
//     style: {
//       borderRadius: "10px",
//       padding: "12px 16px",
//       fontSize: "14px",
//       fontWeight: "500",
//       boxShadow: "0 10px 20px rgba(111, 175, 46, 0.25)",
//       letterSpacing: "0.2px",
//     },
//   }).showToast();
// }
// function showErrorToast(msg) {
//   Toastify({
//     text: `✕ ${msg}`,
//     duration: 3000,
//     gravity: "bottom",
//     position: "right",
//     backgroundColor: "#E56C6C",
//     className: "toast-error",
//     stopOnFocus: true,
//     style: {
//       borderRadius: "10px",
//       padding: "12px 16px",
//       fontSize: "14px",
//       fontWeight: "500",
//       boxShadow: "0 10px 20px rgba(229, 108, 108, 0.25)",
//       letterSpacing: "0.2px",
//     },
//   }).showToast();
// }

// const steps = [
//   "Personal Information",
//   "Job Details",
//   "Contact & Address",
//   "Education & Family",
//   "Documents",
// ];
// function renderStepper() {
//   const container = document.getElementById("stepper");
//   container.innerHTML = steps
//     .map(
//       (l, idx) =>
//         `<div class="step" data-step="${idx + 1}"><div class="step-circle">${idx + 1}</div><div class="step-label">${l}</div></div>`,
//     )
//     .join("");
//   updateStepperUI();
//   document.querySelectorAll(".step").forEach((step) =>
//     step.addEventListener("click", () => {
//       let s = parseInt(step.dataset.step);
//       if (s <= currentStep + 1) {
//         currentStep = s;
//         renderCurrentStep();
//       }
//     }),
//   );
// }
// function updateStepperUI() {
//   document.querySelectorAll(".step").forEach((step, idx) => {
//     let num = idx + 1;
//     let circle = step.querySelector(".step-circle");
//     if (num < currentStep) {
//       step.classList.add("completed");
//       step.classList.remove("active");
//       circle.innerHTML = '<i class="fas fa-check"></i>';
//     } else if (num === currentStep) {
//       step.classList.add("active");
//       step.classList.remove("completed");
//       circle.innerHTML = num;
//     } else {
//       step.classList.remove("active", "completed");
//       circle.innerHTML = num;
//     }
//   });
//   document.getElementById("stepTitle").innerText = steps[currentStep - 1];
// }

// function validateStep(step) {
//   if (step === 1) {
//     let fname = document.getElementById("firstName")?.value;
//     if (!fname) {
//       showErrorToast("First Name is required");
//       return false;
//     }
//     let lname = document.getElementById("lastName")?.value;
//     if (!lname) {
//       showErrorToast("Last Name is required");
//       return false;
//     }
//     return true;
//   }
//   if (step === 2) {
//     let dept = document.getElementById("department")?.value;
//     if (!dept) {
//       showErrorToast("Department is required");
//       return false;
//     }
//     let desig = document.getElementById("designation")?.value;
//     if (!desig) {
//       showErrorToast("Designation is required");
//       return false;
//     }
//     let joinDate = document.getElementById("joiningDate")?.value;
//     if (!joinDate) {
//       showErrorToast("Joining Date is required");
//       return false;
//     }
//     let salary = document.getElementById("basicSalary")?.value;
//     if (!salary || salary <= 0) {
//       showErrorToast("Valid Basic Salary is required");
//       return false;
//     }
//     return true;
//   }
//   if (step === 3) {
//     let email = document.getElementById("personalEmail")?.value;
//     let emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!email || !emailRegex.test(email)) {
//       showErrorToast("Valid Personal Email required");
//       return false;
//     }
//     let mobile = document.getElementById("mobileNumber")?.value;
//     if (!mobile || !/^\d{10}$/.test(mobile)) {
//       showErrorToast("Valid 10-digit Mobile Number required");
//       return false;
//     }
//     let emerName = document.getElementById("emergencyName")?.value;
//     if (!emerName) {
//       showErrorToast("Emergency Contact Name required");
//       return false;
//     }
//     let emerPhone = document.getElementById("emergencyPhone")?.value;
//     if (!emerPhone || !/^\d{10}$/.test(emerPhone)) {
//       showErrorToast("Valid Emergency Phone required");
//       return false;
//     }
//     return true;
//   }
//   return true;
// }

// function renderCurrentStep() {
//   const container = document.getElementById("stepContainer");
//   if (currentStep === 1) container.innerHTML = getStep1HTML();
//   else if (currentStep === 2) container.innerHTML = getStep2HTML();
//   else if (currentStep === 3) container.innerHTML = getStep3HTML();
//   else if (currentStep === 4) container.innerHTML = getStep4HTML();
//   else if (currentStep === 5) container.innerHTML = getStep5HTML();
//   attachStepEvents();
//   if (!isEditMode) disableAllFields();
//   else enableAllFields();
// }

// function disableAllFields() {
//   document
//     .querySelectorAll(
//       "#stepContainer input, #stepContainer select, #stepContainer textarea",
//     )
//     .forEach((f) => (f.disabled = true));
// }
// function enableAllFields() {
//   document
//     .querySelectorAll(
//       "#stepContainer input, #stepContainer select, #stepContainer textarea",
//     )
//     .forEach((f) => (f.disabled = false));
//   document
//     .querySelectorAll(".dynamic-actions button, .btn-add")
//     .forEach((b) => (b.disabled = false));
// }
// function updateEditModeUI() {
//   if (isEditMode) {
//     enableAllFields();
//     document.getElementById("editModeBtn").style.display = "none";
//     document.getElementById("saveModeBtn").style.display = "inline-flex";
//     document.getElementById("cancelModeBtn").style.display = "inline-flex";
//   } else {
//     disableAllFields();
//     document.getElementById("editModeBtn").style.display = "inline-flex";
//     document.getElementById("saveModeBtn").style.display = "none";
//     document.getElementById("cancelModeBtn").style.display = "none";
//   }
// }

// function getStep1HTML() {
//   return `<div class="form-section"><div class="section-title"><i class="fas fa-user"></i> Personal Details</div><div class="form-grid"><div class="form-group"><label>First Name *</label><input type="text" id="firstName" value="Alex"></div><div class="form-group"><label>Middle Name</label><input type="text" id="middleName" value="James"></div><div class="form-group"><label>Last Name *</label><input type="text" id="lastName" value="Mercer"></div><div class="form-group"><label>Employee ID</label><input type="text" id="employeeId" value="EMP10234" readonly disabled></div><div class="form-group"><label>Date of Birth</label><input type="date" id="dob" value="1990-05-15"></div><div class="form-group"><label>Gender *</label><select id="gender"><option>Male</option><option>Female</option></select></div><div class="form-group"><label>PAN Number</label><input type="text" id="pan" value="ABCDE1234F"></div><div class="form-group"><label>Aadhaar Number</label><input type="text" id="aadhaar" value="123456789012"></div></div><div class="form-group" style="margin-top: 16px;"><label><input type="checkbox" id="pwdCheckbox"> Physically Challenged</label></div><div id="pwdFields" style="display: none; margin-top: 16px;" class="form-grid"><div class="form-group"><label>Type of Disability</label><input type="text" id="disabilityType"></div><div class="form-group"><label>Disability Percentage (0-100)</label><input type="number" id="disabilityPercent" min="0" max="100"></div><div class="form-group"><label>Certificate Number</label><input type="text" id="certificateNo"></div></div></div>`;
// }
// function getStep2HTML() {
//   return `<div class="form-section"><div class="section-title"><i class="fas fa-briefcase"></i> Job & Bank</div><div class="form-grid"><div class="form-group"><label>Department *</label><select id="department"><option>Engineering</option><option>HR</option><option>Sales</option></select></div><div class="form-group"><label>Designation *</label><select id="designation"><option>Senior Developer</option><option>Lead Engineer</option></select></div><div class="form-group"><label>Joining Date *</label><input type="date" id="joiningDate" value="2020-06-01"></div><div class="form-group"><label>Basic Salary *</label><input type="number" id="basicSalary" value="85000"></div><div class="form-group"><label>Bank Name</label><input type="text" id="bankName" value="HDFC Bank"></div><div class="form-group"><label>Account Number</label><input type="text" id="accountNumber" value="123456789012"></div><div class="form-group"><label>IFSC Code</label><input type="text" id="ifsc" value="HDFC0001234"></div></div></div>`;
// }
// function getStep3HTML() {
//   return `<div class="form-section"><div class="section-title"><i class="fas fa-address-card"></i> Contact & Address</div><div class="form-grid"><div class="form-group"><label>Personal Email *</label><input type="email" id="personalEmail" value="alex.mercer@example.com"></div><div class="form-group"><label>Mobile Number *</label><input type="text" id="mobileNumber" value="9876543210"></div></div><div class="section-title" style="margin-top: 20px;"><i class="fas fa-home"></i> Current Address</div><div class="form-grid"><div class="form-group"><label>Street</label><input id="curStreet" value="10th Main"></div><div class="form-group"><label>City</label><input id="curCity" value="Bangalore"></div><div class="form-group"><label>PIN Code</label><input id="curPin" value="560001"></div></div><div class="section-title" style="margin-top: 20px;"><i class="fas fa-permanent"></i> Permanent Address <button type="button" id="copyAddressBtn" class="btn-add" style="margin-left: auto;"><i class="fas fa-copy"></i> Copy from Current</button></div><div class="form-grid"><div class="form-group"><label>Street</label><input id="perStreet"></div><div class="form-group"><label>City</label><input id="perCity"></div><div class="form-group"><label>PIN Code</label><input id="perPin"></div></div><div class="section-title" style="margin-top: 20px;"><i class="fas fa-ambulance"></i> Emergency Contact</div><div class="form-grid"><div class="form-group"><label>Name *</label><input id="emergencyName" value="John Doe"></div><div class="form-group"><label>Relationship</label><input id="emergencyRelation" value="Brother"></div><div class="form-group"><label>Phone Number *</label><input id="emergencyPhone" value="9988776655"></div></div></div>`;
// }
// function getStep4HTML() {
//   return `
// <div class="form-section">

//     <div class="section-title">
//         <div class="title-left">
//             <i class="fas fa-graduation-cap"></i>Education
//         </div>
//         <button class="btn-add" id="addEduBtn">
//             <i class="fas fa-plus"></i>Add Education
//         </button>
//     </div>

//     <div id="eduListContainer" class="dynamic-list"></div>

//     <div class="section-title">
//         <div class="title-left">
//             <i class="fas fa-users"></i>Family
//         </div>
//         <button class="btn-add" id="addFamilyBtn">
//             <i class="fas fa-plus"></i>Add Member
//         </button>
//     </div>

//     <div id="familyListContainer" class="dynamic-list"></div>

//     <div class="section-title">
//         <div class="title-left">
//             <i class="fas fa-briefcase"></i>Work Experience
//         </div>
//         <button class="btn-add" id="addExpBtn">
//             <i class="fas fa-plus"></i>Add Experience
//         </button>
//     </div>

//     <div id="expListContainer" class="dynamic-list"></div>

// </div>`;
// }
// function getStep5HTML() {
//   return `<div class="form-section"><div class="section-title"><i class="fas fa-file-alt"></i> Official Documents</div><div id="documentsContainer" class="documents-container"></div></div>`;
// }

// function renderDynamicLists() {
//   let eduHtml =
//     educationList
//       .map(
//         (e, i) =>
//           `<div class="dynamic-item"><div><strong>${e.degree}</strong> - ${e.institute} (${e.year}) ${e.percentage ? `| ${e.percentage}` : ""}</div><div><button class="editItemBtn" data-type="education" data-index="${i}"><i class="fas fa-edit"></i></button> <button class="deleteItemBtn" data-type="education" data-index="${i}"><i class="fas fa-trash"></i></button></div></div>`,
//       )
//       .join("") || "<p>No records</p>";
//   let familyHtml = familyList
//     .map(
//       (f, i) =>
//         `<div class="dynamic-item"><div><strong>${f.name}</strong> (${f.relationship}) - ${f.occupation} | ${f.phone}</div><div><button class="editItemBtn" data-type="family" data-index="${i}"><i class="fas fa-edit"></i></button> <button class="deleteItemBtn" data-type="family" data-index="${i}"><i class="fas fa-trash"></i></button></div></div>`,
//     )
//     .join("");
//   let expHtml = experienceList
//     .map(
//       (e, i) =>
//         `<div class="dynamic-item"><div><strong>${e.company}</strong> - ${e.designation} (${e.years} yrs) | ${e.location}</div><div><button class="editItemBtn" data-type="experience" data-index="${i}"><i class="fas fa-edit"></i></button> <button class="deleteItemBtn" data-type="experience" data-index="${i}"><i class="fas fa-trash"></i></button></div></div>`,
//     )
//     .join("");
//   document.getElementById("eduListContainer") &&
//     (document.getElementById("eduListContainer").innerHTML = eduHtml);
//   document.getElementById("familyListContainer") &&
//     (document.getElementById("familyListContainer").innerHTML = familyHtml);
//   document.getElementById("expListContainer") &&
//     (document.getElementById("expListContainer").innerHTML = expHtml);
//   document.querySelectorAll(".editItemBtn").forEach((btn) =>
//     btn.addEventListener("click", (e) => {
//       let type = btn.dataset.type,
//         idx = btn.dataset.index;
//       openEditModal(type, parseInt(idx));
//     }),
//   );
//   document.querySelectorAll(".deleteItemBtn").forEach((btn) =>
//     btn.addEventListener("click", (e) => {
//       let type = btn.dataset.type,
//         idx = btn.dataset.index;
//       if (confirm("Delete?")) {
//         if (type === "education") educationList.splice(idx, 1);
//         if (type === "family") familyList.splice(idx, 1);
//         if (type === "experience") experienceList.splice(idx, 1);
//         renderDynamicLists();
//         showSuccessToast("Deleted");
//       }
//     }),
//   );
// }

// function openEditModal(type, idx) {
//   currentModalType = type;
//   currentEditIndex = idx;
//   let item = null;
//   if (type === "education") item = educationList[idx];
//   if (type === "family") item = familyList[idx];
//   if (type === "experience") item = experienceList[idx];
//   if (!item) return;
//   let fields = "";
//   if (type === "education")
//     fields = `<div class="form-group"><label>Degree</label><input id="modalField1" value="${item.degree}"></div><div class="form-group"><label>Institute</label><input id="modalField2" value="${item.institute}"></div><div class="form-group"><label>Year</label><input id="modalField3" value="${item.year}"></div><div class="form-group"><label>Percentage/CGPA</label><input id="modalField4" value="${item.percentage || ""}"></div>`;
//   if (type === "family")
//     fields = `<div class="form-group"><label>Name</label><input id="modalField1" value="${item.name}"></div><div class="form-group"><label>Relationship</label><input id="modalField2" value="${item.relationship}"></div><div class="form-group"><label>Occupation</label><input id="modalField3" value="${item.occupation}"></div><div class="form-group"><label>Contact Number</label><input id="modalField4" value="${item.phone}"></div>`;
//   if (type === "experience")
//     fields = `<div class="form-group"><label>Company</label><input id="modalField1" value="${item.company}"></div><div class="form-group"><label>Designation</label><input id="modalField2" value="${item.designation}"></div><div class="form-group"><label>Years</label><input id="modalField3" value="${item.years}"></div><div class="form-group"><label>Location</label><input id="modalField4" value="${item.location}"></div>`;
//   document.getElementById("modalTitle").innerText = `Edit ${type}`;
//   document.getElementById("modalBody").innerHTML = fields;
//   document.getElementById("modalOverlay").classList.add("active");
// }

// function renderDocumentsUI() {
//   let container = document.getElementById("documentsContainer");
//   if (!container) return;
//   let categories = [
//     {
//       name: "Identity",
//       icon: "fa-id-card",
//       docs: ["Aadhaar Card", "PAN Card"],
//     },
//     {
//       name: "Professional",
//       icon: "fa-graduation-cap",
//       docs: ["Degree Certificate", "Experience Letter"],
//     },
//   ];
//   let html = "";
//   categories.forEach((cat) => {
//     let uploadedCount = cat.docs.filter((d) => documents[d]?.uploaded).length;
//     html += `<div class="doc-category"><div class="doc-category-header"><h3><i class="fas ${cat.icon}"></i> ${cat.name}</h3><span class="doc-count-badge">${uploadedCount}/${cat.docs.length}</span></div>`;
//     cat.docs.forEach((doc) => {
//       let data = documents[doc];
//       let isUp = data?.uploaded;
//       html += `<div class="doc-item"><div class="doc-info"><div class="doc-icon"><i class="fas fa-file-pdf"></i></div><div><h4>${doc}</h4><span class="doc-profileStatus-badge ${isUp ? "uploaded" : "pending"}">${isUp ? "Uploaded" : "Pending"}</span>${isUp ? `<div class="doc-filename"><small>${data.name}</small></div>` : ""}</div></div><div class="doc-actions-buttons"><button class="doc-action-btn upload" data-doc="${doc}"><i class="fas fa-upload"></i> ${isUp ? "Replace" : "Upload"}</button>${isUp ? `<button class="doc-action-btn view" data-doc="${doc}"><i class="fas fa-eye"></i> View</button><button class="doc-action-btn delete" data-doc="${doc}"><i class="fas fa-trash"></i> Delete</button>` : ""}</div></div>`;
//     });
//     html += `</div>`;
//   });
//   container.innerHTML = html;
//   attachDocEvents();
// }

// function attachDocEvents() {
//   document
//     .querySelectorAll(".doc-action-btn.upload")
//     .forEach((btn) =>
//       btn.addEventListener("click", () => openFileUploadModal(btn.dataset.doc)),
//     );
//   document.querySelectorAll(".doc-action-btn.view").forEach((btn) =>
//     btn.addEventListener("click", () => {
//       let doc = btn.dataset.doc;
//       if (documents[doc]?.url) window.open(documents[doc].url, "_blank");
//       else showErrorToast("No file");
//     }),
//   );
//   document.querySelectorAll(".doc-action-btn.delete").forEach((btn) =>
//     btn.addEventListener("click", () => {
//       let doc = btn.dataset.doc;
//       if (confirm("Delete document?")) {
//         if (documents[doc]?.url) URL.revokeObjectURL(documents[doc].url);
//         documents[doc] = {
//           uploaded: false,
//           name: "",
//           size: 0,
//           url: null,
//         };
//         renderDocumentsUI();
//         showSuccessToast(`${doc} deleted`);
//       }
//     }),
//   );
// }

// function openFileUploadModal(docName) {
//   document.getElementById("modalTitle").innerHTML = `Upload ${docName}`;
//   document.getElementById("modalBody").innerHTML =
//     `<div class="dropzone" id="dropzone"><i class="fas fa-cloud-upload-alt fa-2x"></i><p>Drag & drop or click to select</p><input type="file" id="fileInput" accept=".pdf,.jpg,.jpeg,.png" style="display:none"></div><div id="fileInfo"></div>`;
//   document.getElementById("modalOverlay").classList.add("active");
//   let dropzone = document.getElementById("dropzone"),
//     fileInput = document.getElementById("fileInput");
//   dropzone.onclick = () => fileInput.click();
//   fileInput.onchange = (e) => handleDocUpload(e.target.files[0], docName);
//   dropzone.ondragover = (e) => e.preventDefault();
//   dropzone.ondrop = (e) => {
//     e.preventDefault();
//     let file = e.dataTransfer.files[0];
//     handleDocUpload(file, docName);
//   };
// }

// function handleDocUpload(file, docName) {
//   if (!file) return;
//   if (!file.type.match(/pdf|jpeg|jpg|png/i)) {
//     showErrorToast("Only PDF/JPG/PNG");
//     return;
//   }
//   if (file.size > 5 * 1024 * 1024) {
//     showErrorToast("Max 5MB");
//     return;
//   }
//   let url = URL.createObjectURL(file);
//   if (documents[docName]?.url) URL.revokeObjectURL(documents[docName].url);
//   documents[docName] = {
//     uploaded: true,
//     name: file.name,
//     size: file.size,
//     url: url,
//   };
//   renderDocumentsUI();
//   document.getElementById("modalOverlay").classList.remove("active");
//   showSuccessToast(`${docName} uploaded successfully!`);
// }

// function attachStepEvents() {
//   if (currentStep === 1) {
//     let cb = document.getElementById("pwdCheckbox");
//     let pwdDiv = document.getElementById("pwdFields");
//     if (cb)
//       cb.addEventListener(
//         "change",
//         (e) => (pwdDiv.style.display = e.target.checked ? "grid" : "none"),
//       );
//   }
//   if (currentStep === 3) {
//     let copyBtn = document.getElementById("copyAddressBtn");
//     if (copyBtn)
//       copyBtn.addEventListener("click", () => {
//         document.getElementById("perStreet").value =
//           document.getElementById("curStreet").value;
//         document.getElementById("perCity").value =
//           document.getElementById("curCity").value;
//         document.getElementById("perPin").value =
//           document.getElementById("curPin").value;
//         showSuccessToast("Address copied");
//       });
//   }
//   if (currentStep === 4) {
//     document
//       .getElementById("addEduBtn")
//       ?.addEventListener("click", () => openAddModal("education"));
//     document
//       .getElementById("addFamilyBtn")
//       ?.addEventListener("click", () => openAddModal("family"));
//     document
//       .getElementById("addExpBtn")
//       ?.addEventListener("click", () => openAddModal("experience"));
//     renderDynamicLists();
//   }
//   if (currentStep === 5) renderDocumentsUI();
// }

// function openAddModal(type) {
//   currentModalType = type;
//   currentEditIndex = null;
//   let fields = "";
//   if (type === "education")
//     fields = `<div class="form-group"><label>Degree</label><input id="modalField1"></div><div class="form-group"><label>Institute</label><input id="modalField2"></div><div class="form-group"><label>Year</label><input id="modalField3"></div><div class="form-group"><label>Percentage/CGPA</label><input id="modalField4"></div>`;
//   if (type === "family")
//     fields = `<div class="form-group"><label>Name</label><input id="modalField1"></div><div class="form-group"><label>Relationship</label><input id="modalField2"></div><div class="form-group"><label>Occupation</label><input id="modalField3"></div><div class="form-group"><label>Phone</label><input id="modalField4"></div>`;
//   if (type === "experience")
//     fields = `<div class="form-group"><label>Company</label><input id="modalField1"></div><div class="form-group"><label>Designation</label><input id="modalField2"></div><div class="form-group"><label>Years</label><input id="modalField3"></div><div class="form-group"><label>Location</label><input id="modalField4"></div>`;
//   document.getElementById("modalTitle").innerText = `Add ${type}`;
//   document.getElementById("modalBody").innerHTML = fields;
//   document.getElementById("modalOverlay").classList.add("active");
// }

// function saveModalEntry() {
//   if (currentModalType === "education") {
//     let obj = {
//       degree: document.getElementById("modalField1")?.value,
//       institute: document.getElementById("modalField2")?.value,
//       year: document.getElementById("modalField3")?.value,
//       percentage: document.getElementById("modalField4")?.value,
//     };
//     if (currentEditIndex !== null) educationList[currentEditIndex] = obj;
//     else educationList.push(obj);
//     renderDynamicLists();
//     showSuccessToast("Education saved");
//   }
//   if (currentModalType === "family") {
//     let obj = {
//       name: document.getElementById("modalField1")?.value,
//       relationship: document.getElementById("modalField2")?.value,
//       occupation: document.getElementById("modalField3")?.value,
//       phone: document.getElementById("modalField4")?.value,
//     };
//     if (currentEditIndex !== null) familyList[currentEditIndex] = obj;
//     else familyList.push(obj);
//     renderDynamicLists();
//     showSuccessToast("Family saved");
//   }
//   if (currentModalType === "experience") {
//     let obj = {
//       company: document.getElementById("modalField1")?.value,
//       designation: document.getElementById("modalField2")?.value,
//       years: document.getElementById("modalField3")?.value,
//       location: document.getElementById("modalField4")?.value,
//     };
//     if (currentEditIndex !== null) experienceList[currentEditIndex] = obj;
//     else experienceList.push(obj);
//     renderDynamicLists();
//     showSuccessToast("Experience saved");
//   }
//   document.getElementById("modalOverlay").classList.remove("active");
// }

// // Event listeners & UI init
// document.getElementById("nextBtn").onclick = () => {
//   if (!validateStep(currentStep)) return;

//   // STEP 1 to 4 → normal next
//   if (currentStep < 5) {
//     currentStep++;
//     renderCurrentStep();
//     updateStepperUI();
//     updateNextButtonUI();
//   }
//   // STEP 5 → SAVE ACTION
//   else {
//     saveFinalForm();
//   }
// };

// function saveFinalForm() {
//   // collect all final data here if needed
//   console.log("Final form data saved");

//   showSuccessToast("Profile saved successfully!");
// }

// //Button UI Switch Function
// function updateNextButtonUI() {
//   const nextBtn = document.getElementById("nextBtn");

//   if (currentStep === 5) {
//     nextBtn.innerHTML = `<i class="fas fa-save"></i> Save`;
//     nextBtn.classList.add("btn-save-style"); // optional
//   } else {
//     nextBtn.innerHTML = `Next <i class="fas fa-arrow-right"></i>`;
//     nextBtn.classList.remove("btn-save-style");
//   }
// }

// document.getElementById("prevBtn").onclick = () => {
//   if (currentStep > 1) {
//     currentStep--;
//     renderCurrentStep();
//     updateStepperUI();
//   }
// };
// document.getElementById("editModeBtn").onclick = () => {
//   isEditMode = true;
//   updateEditModeUI();
// };
// document.getElementById("saveModeBtn").onclick = () => {
//   isEditMode = false;
//   updateEditModeUI();
//   showSuccessToast("Profile changes saved");
// };
// document.getElementById("cancelModeBtn").onclick = () => {
//   isEditMode = false;
//   updateEditModeUI();
//   renderCurrentStep();
// };
// document.getElementById("cancelModalBtn").onclick = () =>
//   document.getElementById("modalOverlay").classList.remove("active");
// document.getElementById("saveModalBtn").onclick = saveModalEntry;
// // Sidebar logic
// document.getElementById("collapseSidebarBtn").onclick = () => {
//   document.getElementById("sidebar").classList.toggle("collapsed");
//   document.getElementById("mainContent").classList.toggle("sidebar-collapsed");
// };
// document.getElementById("mobileToggleBtn").onclick = () =>
//   document.getElementById("sidebar").classList.toggle("mobile-open");
// // ==================== PROFILE DROPDOWN FUNCTIONALITY ====================

// const profileDropdownBtn = document.getElementById("profileDropdownBtn");
// const profileDropdown = document.getElementById("profileDropdown");

// if (profileDropdownBtn && profileDropdown) {
//   profileDropdownBtn.addEventListener("click", function (e) {
//     e.stopPropagation();
//     profileDropdown.classList.toggle("active");
//   });
// }

// // Close when clicking outside
// document.addEventListener("click", function (e) {
//   if (profileDropdown && !profileDropdownBtn.contains(e.target)) {
//     profileDropdown.classList.remove("active");
//   }
// });

// // Close on ESC key
// document.addEventListener("keydown", function (e) {
//   if (e.key === "Escape" && profileDropdown) {
//     profileDropdown.classList.remove("active");
//   }
// });
// // Logout
// const logoutBtn = document.getElementById("logoutBtn");
// if (logoutBtn) {
//   logoutBtn.addEventListener("click", function () {
//     if (confirm("Are you sure you want to logout?")) {
//       // Replace with your actual logout logic
//       window.location.href = "../index.html";
//     }
//   });
// }
// // initial
// renderStepper();
// renderCurrentStep();
// updateNextButtonUI();
// disableAllFields();
// isEditMode = false;
// updateEditModeUI();
