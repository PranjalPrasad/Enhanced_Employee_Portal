// ═══════════════════════════════════════════════════════════════════════
//  POLICY.JS — Employee Portal | Company Policies
//  Backend: Spring Boot /api/v1/policies
// ═══════════════════════════════════════════════════════════════════════

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:8086/api/v1/policies';

// ─── STATE (same variable names as original) ────────────────────────────────
let currentTab       = null;   // will be set after categories load
let currentView      = "list";
let selectedPolicy   = null;
let allCategories    = [];     // PolicyCategoryResponseDTO[]
let allPolicies      = [];     // PolicyResponseDTO[] for current tab
let acknowledgedPolicies = JSON.parse(localStorage.getItem("acknowledgedPolicies") || "{}");

// Employee profile — read from localStorage (set at login)
const EMPLOYEE_DEPARTMENT = localStorage.getItem('hrms_department') || '';
const EMPLOYEE_TYPE       = localStorage.getItem('hrms_emp_type')   || '';

// ─── HELPER: Auth headers ───────────────────────────────────────────────────
function getAuthHeaders() {
    const token = localStorage.getItem('hrms_token');
    return token
        ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        : { 'Content-Type': 'application/json' };
}

// ─── HELPER: Toast (same as original) ───────────────────────────────────────
function showToast(msg, type) {
    Toastify({
        text: type === 'success' ? `✓ ${msg}` : `✕ ${msg}`,
        duration: 3000,
        gravity: "bottom",
        position: "right",
        backgroundColor: type === 'success' ? "#6faf2e" : "#e56c6c",
        stopOnFocus: true,
        style: { borderRadius: "10px", padding: "12px 16px", fontSize: "14px" }
    }).showToast();
}

// ═══════════════════════════════════════════════════════════════════════
//  API CALLS
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/policies/categories
 * Loads all categories → used to build tab buttons
 */
async function fetchCategories() {
    const res = await fetch(`${BASE_URL}/categories`, {
        headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load categories');
    return await res.json(); // PolicyCategoryResponseDTO[]
}

/**
 * GET /api/v1/policies/employee-preview
 * Returns only Active policies visible to this employee
 * Filtered by: department, employeeType, categoryName
 */
async function fetchPoliciesByCategory(categoryName) {
    const params = new URLSearchParams();
    if (EMPLOYEE_DEPARTMENT) params.append('department',   EMPLOYEE_DEPARTMENT);
    if (EMPLOYEE_TYPE)        params.append('employeeType', EMPLOYEE_TYPE);
    if (categoryName)         params.append('categoryName', categoryName);

    const res = await fetch(`${BASE_URL}/employee-preview?${params}`, {
        headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load policies');
    return await res.json(); // PolicyResponseDTO[]
}

/**
 * GET /api/v1/policies/{id}
 * Loads single policy detail
 */
async function fetchPolicyById(id) {
    const res = await fetch(`${BASE_URL}/${id}`, {
        headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load policy details');
    return await res.json(); // PolicyResponseDTO
}

/**
 * GET /api/v1/policies/{id}/document
 * Returns base64 fileData or fileUrl for download
 */
async function fetchPolicyDocument(id) {
    const res = await fetch(`${BASE_URL}/${id}/document`, {
        headers: getAuthHeaders()
    });
    if (res.status === 404) return null;  // no document attached
    if (!res.ok) throw new Error('Failed to fetch document');
    return await res.json(); // PolicyDocumentResponseDTO
}

// ═══════════════════════════════════════════════════════════════════════
//  RENDER TABS  (same structure as original renderTabs())
// ═══════════════════════════════════════════════════════════════════════
function renderTabs() {
    const tabsContainer = document.getElementById('tabsContainer');
    if (!tabsContainer) return;

    // Build tab HTML — same pattern as original
    tabsContainer.innerHTML = allCategories.map(cat =>
        `<button class="tab-btn ${currentTab === cat.name ? 'active' : ''}"
            data-tab="${cat.name}"
            data-id="${cat.id}">
            ${cat.name}
        </button>`
    ).join('');

    // Attach click listeners — same as original
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            currentTab     = btn.dataset.tab;
            currentView    = "list";
            selectedPolicy = null;
            renderTabs();
            await loadPoliciesForTab(currentTab);
            renderContent();
        });
    });
}

// ═══════════════════════════════════════════════════════════════════════
//  LOAD POLICIES FOR A TAB
// ═══════════════════════════════════════════════════════════════════════
async function loadPoliciesForTab(categoryName) {
    showLoadingInContent();
    try {
        allPolicies = await fetchPoliciesByCategory(categoryName);
    } catch (err) {
        allPolicies = [];
        showToast('Failed to load policies', 'error');
        console.error(err);
    }
}

// ═══════════════════════════════════════════════════════════════════════
//  RENDER CONTENT  (same structure as original renderContent())
// ═══════════════════════════════════════════════════════════════════════
function renderContent() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;

    const searchTerm = document.getElementById('searchInput')?.value?.toLowerCase() || '';

    // ── LIST VIEW (same as original) ──────────────────────────────────────
    if (currentView === "list") {

        // Client-side search filter on already-loaded policies
        const filtered = searchTerm
            ? allPolicies.filter(p =>
                (p.title       || '').toLowerCase().includes(searchTerm) ||
                (p.description || '').toLowerCase().includes(searchTerm)
              )
            : allPolicies;

        if (filtered.length === 0) {
            contentArea.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-alt"></i>
                    <p>No policies found matching your search.</p>
                </div>`;
            return;
        }

        // Card HTML — same structure as original
        // DTO field mapping:
        //   p.title        → policy title
        //   p.description  → policy description
        //   p.updatedAt    → last updated (was p.lastUpdated in dummy data)
        //   p.id           → data-id on card
        contentArea.innerHTML = `
            <div class="policy-grid">
                ${filtered.map(p => `
                    <div class="policy-card" data-id="${p.id}">
                        <div class="policy-card-header">
                            <h3>${escHtml(p.title)}</h3>
                            ${acknowledgedPolicies[p.id]
                                ? '<span class="ack-badge"><i class="fas fa-check-circle"></i> Acknowledged</span>'
                                : '<span class="policy-badge">Pending</span>'
                            }
                        </div>
                        <div class="policy-desc">${escHtml(p.description || 'No description provided.')}</div>
                        <div class="policy-meta">
                            <span><i class="far fa-calendar-alt"></i> Updated: ${formatDate(p.updatedAt)}</span>
                            <span style="color: var(--primary);">Click to view →</span>
                        </div>
                    </div>`
                ).join('')}
            </div>`;

        // Card click → detail view (same as original)
        document.querySelectorAll('.policy-card').forEach(card => {
            card.addEventListener('click', async () => {
                const id = card.dataset.id;
                showLoadingInContent();
                try {
                    selectedPolicy = await fetchPolicyById(id);
                    currentView    = "detail";
                    renderContent();
                } catch (err) {
                    showToast('Failed to load policy details', 'error');
                    console.error(err);
                }
            });
        });

    // ── DETAIL VIEW (same as original) ───────────────────────────────────
    } else if (currentView === "detail" && selectedPolicy) {

        const p              = selectedPolicy;
        const isAcknowledged = !!acknowledgedPolicies[p.id];

        contentArea.innerHTML = `
            <button class="btn-back" id="backToListBtn">
                <i class="fas fa-arrow-left"></i> Back to Policies
            </button>
            <div class="policy-detail-view">
                <div class="detail-header">
                    <div class="detail-title">
                        <h2>${escHtml(p.title)}</h2>
                        <span class="policy-badge" style="margin-top: 8px; display: inline-block;">
                            ${escHtml(p.categoryName || currentTab)}
                        </span>
                    </div>
                    <div class="detail-actions">
                        <button class="btn-download" id="downloadPolicyBtn"
                            ${!p.hasDocument ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                            <i class="fas fa-download"></i>
                            ${p.hasDocument ? 'Download (PDF)' : 'No Document'}
                        </button>
                        <button class="btn-acknowledge" id="acknowledgeBtn" ${isAcknowledged ? 'disabled' : ''}>
                            ${isAcknowledged
                                ? '<i class="fas fa-check-circle"></i> Acknowledged'
                                : '<i class="fas fa-check"></i> Acknowledge & Agree'
                            }
                        </button>
                    </div>
                </div>

                <div class="detail-content">
                    ${p.description
                        ? `<p>${escHtml(p.description)}</p>`
                        : `<p style="color:var(--text-muted);font-style:italic;">No detailed content available for this policy.</p>`
                    }
                </div>

                <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #20879bcb; font-size: 0.8rem; color: var(--text-muted);">
                    <i class="far fa-calendar-alt"></i> Last updated: ${formatDate(p.updatedAt)}
                </div>
            </div>`;

        // ── Back button (same as original) ───────────────────────────────
        document.getElementById('backToListBtn')?.addEventListener('click', () => {
            currentView    = "list";
            selectedPolicy = null;
            renderContent();
        });

        // ── Download button → calls backend /document endpoint ────────────
        document.getElementById('downloadPolicyBtn')?.addEventListener('click', async () => {
            if (!p.hasDocument) return;
            showToast('Preparing download...', 'success');
            try {
                const doc = await fetchPolicyDocument(p.id);

                if (!doc) {
                    showToast('No document attached to this policy.', 'error');
                    return;
                }

                if (doc.fileData) {
                    // base64 → browser download (same <a>.click() trigger as original)
                    const a    = document.createElement('a');
                    a.href     = doc.fileData;
                    a.download = doc.fileName || `${p.title.replace(/\s/g, '_')}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    showToast('Policy downloaded', 'success');
                } else if (doc.fileUrl) {
                    window.open(doc.fileUrl, '_blank');
                    showToast('Opening document...', 'success');
                } else {
                    showToast('No document available.', 'error');
                }
            } catch (err) {
                showToast('Download failed. Please try again.', 'error');
                console.error('Download error:', err);
            }
        });

        // ── Acknowledge button — same localStorage logic as original ──────
        document.getElementById('acknowledgeBtn')?.addEventListener('click', () => {
            if (!acknowledgedPolicies[p.id]) {
                acknowledgedPolicies[p.id] = {
                    policyId:       p.id,
                    title:          p.title,
                    acknowledgedAt: new Date().toISOString()
                };
                localStorage.setItem("acknowledgedPolicies", JSON.stringify(acknowledgedPolicies));
                showToast(`You have acknowledged "${p.title}"`, 'success');
                renderContent(); // re-render to disable button (same as original)
            }
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════
//  SEARCH HANDLER (same as original)
// ═══════════════════════════════════════════════════════════════════════
document.getElementById('searchInput')?.addEventListener('input', () => {
    if (currentView === "list") renderContent();
});

// ═══════════════════════════════════════════════════════════════════════
//  SIDEBAR & UI (same as original — completely untouched)
// ═══════════════════════════════════════════════════════════════════════
const sidebar = document.getElementById('sidebar');

document.getElementById('collapseSidebarBtn')?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    document.getElementById('mainContent').classList.toggle('sidebar-collapsed');
});

document.getElementById('mobileToggleBtn')?.addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
});

const profileBtn      = document.getElementById('profileDropdownBtn');
const profileDropdown = document.getElementById('profileDropdown');
if (profileBtn && profileDropdown) {
    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('active');
    });
    document.addEventListener('click', (e) => {
        if (!profileBtn.contains(e.target)) profileDropdown.classList.remove('active');
    });
}

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.clear();
    window.location.href = '../pages/login.html';
});

// ═══════════════════════════════════════════════════════════════════════
//  LOADING STATE IN CONTENT AREA
// ═══════════════════════════════════════════════════════════════════════
function showLoadingInContent() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    contentArea.innerHTML = `
        <div class="empty-state">
            <div style="width:48px;height:48px;border:4px solid #e6f4f6;
                border-top-color:#1f6f7f;border-radius:50%;
                animation:policySpinner 0.8s linear infinite;margin:0 auto 16px;">
            </div>
            <p style="color:var(--text-muted);">Loading policies...</p>
        </div>
        <style>
            @keyframes policySpinner { to { transform: rotate(360deg); } }
        </style>`;
}

// ═══════════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════════
function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
    );
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
    } catch (e) { return dateStr; }
}

// ═══════════════════════════════════════════════════════════════════════
//  INIT — replaces original renderTabs() + renderContent() at bottom
// ═══════════════════════════════════════════════════════════════════════
async function init() {
    showLoadingInContent();
    try {
        // 1. Load categories from backend
        allCategories = await fetchCategories();

        if (!allCategories.length) {
            document.getElementById('tabsContainer').innerHTML = '';
            document.getElementById('contentArea').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <p>No policy categories available.</p>
                </div>`;
            return;
        }

        // 2. Set first category as active tab
        //    (same as original: currentTab = "HR Policies" was hardcoded)
        currentTab = allCategories[0].name;

        // 3. Render tabs
        renderTabs();

        // 4. Load policies for first tab
        await loadPoliciesForTab(currentTab);

        // 5. Render content
        renderContent();

    } catch (err) {
        console.error('Init error:', err);
        document.getElementById('contentArea').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle" style="color:var(--danger);"></i>
                <p>Failed to load policies. Please refresh the page.</p>
                <button onclick="init()"
                    style="margin-top:12px;padding:8px 20px;background:var(--primary);
                    color:white;border:none;border-radius:8px;cursor:pointer;font-family:inherit;">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>`;
    }
}

// ── Entry point (replaces original: renderTabs(); renderContent();) ──────────
init();