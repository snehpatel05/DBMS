// app.js - District Court Case Management System (RBAC Multi-Role Controller)
// Handles dual-sided access control: Administration (Clerk, Judge, Administrator) & User (Advocate, Litigant)

let allCases = [];
let currentPage = 1;
let pageSize = 25;
let currentDossierCnr = null;
let deleteTargetCnr = null;

// Active User Session (Stored in localStorage, default: Clerk #301)
let currentUser = {
    user_id: 301,
    name: 'Vivaan Dave',
    email: 'user301@courtmail.in',
    user_role: 'Clerk'
};

// ==============================================================
// 1. INITIALIZATION & RBAC SETUP
// ==============================================================
document.addEventListener('DOMContentLoaded', () => {
    // Restore session if present
    const saved = localStorage.getItem('court_active_user');
    if (saved) {
        try { currentUser = JSON.parse(saved); } catch (e) {}
    }

    applyUserRoleUI();
    initTabs();
    loadDashboardStats();
    loadCases();
    setupEventListeners();
});

function applyUserRoleUI() {
    // Update Header
    const avatar = document.getElementById('headerAvatar');
    const nameEl = document.getElementById('headerUserName');
    const roleEl = document.getElementById('headerUserRole');

    if (avatar) avatar.innerText = getInitials(currentUser.name);
    if (nameEl) nameEl.innerText = currentUser.name;
    if (roleEl) roleEl.innerText = currentUser.user_role;

    // RBAC: "+ File New Case" visibility (Clerks & Admins only)
    const canFile = ['Clerk', 'Court Administrator'].includes(currentUser.user_role);
    const headerBtn = document.getElementById('headerBtnFileCase');
    const toolbarBtn = document.getElementById('btnFileCaseToolbar');
    const enrollWitBtn = document.getElementById('btnEnrollWitness');

    if (headerBtn) headerBtn.style.display = canFile ? 'inline-flex' : 'none';
    if (toolbarBtn) toolbarBtn.style.display = canFile ? 'inline-flex' : 'none';
    if (enrollWitBtn) enrollWitBtn.style.display = canFile ? 'inline-flex' : 'none';

    // RBAC: Admin Tab visibility (Court Administrator only)
    const adminTab = document.getElementById('tabNavAdmin');
    if (adminTab) {
        adminTab.style.display = currentUser.user_role === 'Court Administrator' ? 'inline-flex' : 'none';
    }

    // RBAC: Scope Banner (for Litigant & Advocate)
    const banner = document.getElementById('roleScopeBanner');
    const bannerMsg = document.getElementById('roleScopeMessage');
    if (banner && bannerMsg) {
        if (currentUser.user_role === 'Litigant') {
            banner.style.display = 'flex';
            bannerMsg.innerText = `Litigant View (${currentUser.name}): Displaying exclusively legal disputes where you are a named party.`;
        } else if (currentUser.user_role === 'Advocate') {
            banner.style.display = 'flex';
            bannerMsg.innerText = `Counsel View (${currentUser.name}): Displaying active matters assigned to your legal practice.`;
        } else if (currentUser.user_role === 'Judge') {
            banner.style.display = 'flex';
            bannerMsg.innerText = `Bench Docket (${currentUser.name}): Presiding Judicial View. Authorized to pronounce and publish final orders.`;
        } else {
            banner.style.display = 'none';
        }
    }
}

function getInitials(name) {
    if (!name) return 'US';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

function initTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-tab');
            switchTab(targetId);
        });
    });
}

function switchTab(targetId) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

    const activeTab = document.querySelector(`.nav-tab[data-tab="${targetId}"]`);
    const activePane = document.getElementById(targetId);

    if (activeTab) activeTab.classList.add('active');
    if (activePane) activePane.classList.add('active');

    if (targetId === 'tab-cases') loadCases();
    else if (targetId === 'tab-hearings') loadHearings();
    else if (targetId === 'tab-orders') loadOrders();
    else if (targetId === 'tab-witnesses') loadWitnesses();
    else if (targetId === 'tab-admin') loadSystemUsers();
}

function setupEventListeners() {
    // Case Registry Filters
    document.getElementById('caseSearchInput').addEventListener('input', debounce(() => {
        currentPage = 1;
        loadCases();
    }, 250));
    document.getElementById('caseFilterUrgency').addEventListener('change', () => {
        currentPage = 1;
        loadCases();
    });
    document.getElementById('caseFilterStatus').addEventListener('change', () => {
        currentPage = 1;
        loadCases();
    });

    // Hearing Schedule Filters
    document.getElementById('hearingSearchInput').addEventListener('input', debounce(loadHearings, 250));
    document.getElementById('hearingFilterOutcome').addEventListener('change', loadHearings);

    // Order Filters
    document.getElementById('orderSearchInput').addEventListener('input', debounce(loadOrders, 250));
    document.getElementById('orderFilterType').addEventListener('change', loadOrders);
    document.getElementById('orderFilterPublish').addEventListener('change', loadOrders);

    // Witness Filter
    document.getElementById('witnessSearchInput').addEventListener('input', debounce(loadWitnesses, 250));

    // Form Submissions
    document.getElementById('createCaseForm').addEventListener('submit', handleCreateCase);
    document.getElementById('updateCaseForm').addEventListener('submit', handleUpdateCase);
    document.getElementById('btnConfirmDelete').addEventListener('click', handleConfirmDelete);
    document.getElementById('createWitnessForm').addEventListener('submit', handleCreateWitness);

    // Drawer edit button
    document.getElementById('btnDrawerEdit').addEventListener('click', () => {
        if (currentDossierCnr) {
            closeModal('dossierModal');
            openUpdateModal(currentDossierCnr);
        }
    });
}

// ==============================================================
// 2. RBAC LOGIN & ROLE SWITCHER
// ==============================================================
async function loginPresetUser(userId, expectedRole) {
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: userId })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        currentUser = json.user;
        localStorage.setItem('court_active_user', JSON.stringify(currentUser));
        applyUserRoleUI();
        closeModal('switchUserModal');
        showToast(`Active session switched to ${currentUser.name} (${currentUser.user_role})`, 'success');

        // Reset to cases tab & reload with new role filters
        currentPage = 1;
        switchTab('tab-cases');
        loadCases();
        loadDashboardStats();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

async function handleCustomLogin() {
    const val = document.getElementById('customUserIdentifier').value.trim();
    if (!val) {
        showToast('Please enter a User ID or Email.', 'warning');
        return;
    }
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: val })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        currentUser = json.user;
        localStorage.setItem('court_active_user', JSON.stringify(currentUser));
        applyUserRoleUI();
        closeModal('switchUserModal');
        showToast(`Session authenticated: ${currentUser.name} (${currentUser.user_role})`, 'success');

        currentPage = 1;
        switchTab('tab-cases');
        loadCases();
        loadDashboardStats();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

// Helper: Common request headers with active RBAC credentials
function getAuthHeaders() {
    return {
        'x-user-id': currentUser.user_id ? currentUser.user_id.toString() : '301',
        'x-user-role': currentUser.user_role || 'Clerk'
    };
}

// ==============================================================
// 3. DASHBOARD SUMMARY CARDS & BADGE COUNTS
// ==============================================================
async function loadDashboardStats() {
    try {
        const res = await fetch('/api/stats', { headers: getAuthHeaders() });
        const json = await res.json();
        if (json.success && json.stats) {
            const s = json.stats;
            document.getElementById('kpiTotalCases').innerText = Number(s.total_cases).toLocaleString();
            document.getElementById('kpiPendingCases').innerText = Number(s.pending_cases).toLocaleString();
            document.getElementById('kpiUrgentCases').innerText = Number(s.urgent_cases).toLocaleString();
            document.getElementById('kpiDisposedCases').innerText = Number(s.disposed_cases).toLocaleString();
            document.getElementById('kpiTotalHearings').innerText = Number(s.total_hearings).toLocaleString();
            document.getElementById('kpiPublishedOrders').innerText = Number(s.published_orders).toLocaleString();

            document.getElementById('badgeCases').innerText = s.total_cases;
            document.getElementById('badgeHearings').innerText = s.total_hearings;
            document.getElementById('badgeOrders').innerText = s.total_orders;
            document.getElementById('badgeWitnesses').innerText = s.total_witnesses;
        }
    } catch (err) {
        console.warn('Could not refresh summary cards:', err);
    }
}

function filterByCard(status, urgency) {
    switchTab('tab-cases');
    const statusSelect = document.getElementById('caseFilterStatus');
    const urgencySelect = document.getElementById('caseFilterUrgency');
    const searchInput = document.getElementById('caseSearchInput');

    statusSelect.value = status;
    urgencySelect.value = urgency;
    searchInput.value = '';

    currentPage = 1;
    loadCases();
}

function clearCaseFilters() {
    document.getElementById('caseSearchInput').value = '';
    document.getElementById('caseFilterUrgency').value = 'ALL';
    document.getElementById('caseFilterStatus').value = 'ALL';
    currentPage = 1;
    loadCases();
}

function clearHearingFilters() {
    document.getElementById('hearingSearchInput').value = '';
    document.getElementById('hearingFilterOutcome').value = 'ALL';
    loadHearings();
}

function clearOrderFilters() {
    document.getElementById('orderSearchInput').value = '';
    document.getElementById('orderFilterType').value = 'ALL';
    document.getElementById('orderFilterPublish').value = 'ALL';
    loadOrders();
}

function clearWitnessFilters() {
    document.getElementById('witnessSearchInput').value = '';
    loadWitnesses();
}

// ==============================================================
// 4. TAB 1: MASTER CASES (WITH ROLE ACCESS PERMISSIONS)
// ==============================================================
async function loadCases() {
    const tbody = document.getElementById('caseTableBody');
    const countLabel = document.getElementById('caseShowingText');
    const search = document.getElementById('caseSearchInput').value.trim();
    const urgency = document.getElementById('caseFilterUrgency').value;
    const status = document.getElementById('caseFilterStatus').value;

    countLabel.innerText = 'Loading cases...';

    try {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (urgency !== 'ALL') params.append('urgency', urgency);
        if (status !== 'ALL') params.append('status', status);
        params.append('limit', '100');

        const res = await fetch(`/api/cases?${params.toString()}`, { headers: getAuthHeaders() });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        allCases = json.data;
        renderPaginatedCases();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" class="table-loading text-danger">Error: ${escapeHtml(err.message)}</td></tr>`;
        countLabel.innerText = 'Unable to fetch cases';
        showToast(err.message, 'danger');
    }
}

function renderPaginatedCases() {
    const tbody = document.getElementById('caseTableBody');
    const countLabel = document.getElementById('caseShowingText');
    const pageRangeLabel = document.getElementById('pageRangeLabel');
    const pageNumbersContainer = document.getElementById('pageNumbersContainer');

    const totalRecords = allCases.length;
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalRecords);
    const displayedCases = allCases.slice(startIndex, endIndex);

    if (totalRecords === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="table-empty-box">
                        <p>No court cases match the active role filters.</p>
                        <button class="btn btn-secondary btn-sm" onclick="clearCaseFilters()">Clear filters</button>
                    </div>
                </td>
            </tr>
        `;
        countLabel.innerText = 'Showing 0 of 0 cases';
        pageRangeLabel.innerText = 'Page 1 of 1';
        pageNumbersContainer.innerHTML = '';
        document.getElementById('btnPrevPage').disabled = true;
        document.getElementById('btnNextPage').disabled = true;
        return;
    }

    countLabel.innerText = `Showing ${startIndex + 1}–${endIndex} of ${totalRecords} cases`;
    pageRangeLabel.innerText = `Page ${currentPage} of ${totalPages}`;

    // RBAC: Determine which action buttons to display
    const canEdit = ['Clerk', 'Court Administrator'].includes(currentUser.user_role);
    const canDelete = ['Clerk', 'Court Administrator'].includes(currentUser.user_role);

    tbody.innerHTML = '';
    displayedCases.forEach(c => {
        const tr = document.createElement('tr');

        let statusBadge = '';
        if (c.case_status === 'Pending') statusBadge = '<span class="status-badge badge-pending">Pending</span>';
        else if (c.case_status === 'Filed') statusBadge = '<span class="status-badge badge-filed">Filed</span>';
        else if (c.case_status === 'Disposed') statusBadge = '<span class="status-badge badge-disposed">Disposed</span>';
        else statusBadge = `<span class="status-badge badge-filed">${escapeHtml(c.case_status)}</span>`;

        let urgencyBadge = '';
        if (c.statutory_urgency === 'Normal') {
            urgencyBadge = '<span class="text-normal-urgency">Normal</span>';
        } else if (c.statutory_urgency === 'Urgent') {
            urgencyBadge = '<span class="status-badge badge-urgent">Urgent</span>';
        } else if (c.statutory_urgency === 'Statutory') {
            urgencyBadge = '<span class="status-badge badge-statutory">Statutory</span>';
        } else {
            urgencyBadge = escapeHtml(c.statutory_urgency);
        }

        // Actions cell respecting RBAC
        let actionButtons = `<button class="btn btn-sm btn-outline" onclick="viewDossier('${escapeHtml(c.cnr)}')">View</button>`;
        if (canEdit) {
            actionButtons += `<button class="btn btn-sm btn-outline" onclick="openUpdateModal('${escapeHtml(c.cnr)}')">Edit</button>`;
        }
        if (canDelete) {
            actionButtons += `<button class="btn btn-sm btn-danger-outline" onclick="openDeleteModal('${escapeHtml(c.cnr)}')">Delete</button>`;
        }

        tr.innerHTML = `
            <td>
                <a class="case-cnr-link font-mono" onclick="viewDossier('${escapeHtml(c.cnr)}')">
                    ${escapeHtml(c.cnr)}
                </a>
            </td>
            <td>${escapeHtml(c.standardized_filing_number)}</td>
            <td>${escapeHtml(c.case_number)}</td>
            <td>${c.fir_number ? escapeHtml(c.fir_number) : '<span class="text-muted">—</span>'}</td>
            <td>${urgencyBadge}</td>
            <td>${statusBadge}</td>
            <td>Clerk #${c.registered_by_clerk_id}</td>
            <td class="text-right">
                <div class="actions-cell">
                    ${actionButtons}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Pagination controls
    document.getElementById('btnPrevPage').disabled = currentPage === 1;
    document.getElementById('btnNextPage').disabled = currentPage === totalPages;

    pageNumbersContainer.innerHTML = '';
    const maxButtons = 5;
    let startBtn = Math.max(1, currentPage - 2);
    let endBtn = Math.min(totalPages, startBtn + maxButtons - 1);
    if (endBtn - startBtn < maxButtons - 1) {
        startBtn = Math.max(1, endBtn - maxButtons + 1);
    }

    for (let i = startBtn; i <= endBtn; i++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        btn.innerText = i;
        btn.onclick = () => {
            currentPage = i;
            renderPaginatedCases();
        };
        pageNumbersContainer.appendChild(btn);
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderPaginatedCases();
    }
}

function nextPage() {
    const totalPages = Math.ceil(allCases.length / pageSize);
    if (currentPage < totalPages) {
        currentPage++;
        renderPaginatedCases();
    }
}

function changePageSize(newSize) {
    pageSize = parseInt(newSize, 10);
    currentPage = 1;
    renderPaginatedCases();
}

// CREATE CASE (INSERT)
async function handleCreateCase(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitCreate');
    btn.disabled = true;
    btn.innerText = 'Saving Case...';

    const payload = {
        cnr: document.getElementById('cnr_in').value.trim(),
        filing_no: document.getElementById('sfn_in').value.trim(),
        case_no: document.getElementById('caseno_in').value.trim(),
        fir_no: document.getElementById('fir_in').value.trim(),
        urgency: document.getElementById('urgency_in').value,
        status: document.getElementById('status_in').value,
        clerk_id: document.getElementById('clerk_in').value
    };

    try {
        const res = await fetch('/api/cases', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        showToast(`Case ${payload.cnr} registered successfully.`, 'success');
        closeModal('createCaseModal');
        loadCases();
        loadDashboardStats();
    } catch (err) {
        showToast(err.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Save Case';
    }
}

// UPDATE CASE
function openUpdateModal(cnr) {
    const c = allCases.find(item => item.cnr === cnr);
    if (!c) return;

    document.getElementById('upd_cnr').value = c.cnr;
    document.getElementById('upd_fir').value = c.fir_number || '';
    document.getElementById('upd_urgency').value = c.statutory_urgency;
    document.getElementById('upd_status').value = c.case_status === 'Disposed' ? 'Pending' : c.case_status;

    openModal('updateCaseModal');
}

async function handleUpdateCase(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitUpdate');
    btn.disabled = true;
    btn.innerText = 'Saving Changes...';

    const cnr = document.getElementById('upd_cnr').value;
    const payload = {
        fir_no: document.getElementById('upd_fir').value.trim(),
        urgency: document.getElementById('upd_urgency').value,
        status: document.getElementById('upd_status').value
    };

    try {
        const res = await fetch(`/api/cases/${encodeURIComponent(cnr)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        showToast(`Case ${cnr} record updated.`, 'success');
        closeModal('updateCaseModal');
        loadCases();
        loadDashboardStats();
        if (currentDossierCnr === cnr) viewDossier(cnr);
    } catch (err) {
        showToast(err.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Save Case';
    }
}

// DELETE CASE
function openDeleteModal(cnr) {
    deleteTargetCnr = cnr;
    document.getElementById('del_target_cnr').innerText = cnr;
    openModal('deleteCaseModal');
}

async function handleConfirmDelete() {
    if (!deleteTargetCnr) return;
    const btn = document.getElementById('btnConfirmDelete');
    btn.disabled = true;
    btn.innerText = 'Deleting...';

    try {
        const res = await fetch(`/api/cases/${encodeURIComponent(deleteTargetCnr)}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        showToast(`Case ${deleteTargetCnr} permanently deleted.`, 'success');
        closeModal('deleteCaseModal');
        deleteTargetCnr = null;
        loadCases();
        loadDashboardStats();
    } catch (err) {
        showToast(err.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Delete Case';
    }
}

// ==============================================================
// 5. RIGHT-SIDE CASE DETAIL DRAWER
// ==============================================================
async function viewDossier(cnr) {
    currentDossierCnr = cnr;
    const title = document.getElementById('dossierTitle');
    const container = document.getElementById('dossierContent');
    const badgeContainer = document.getElementById('dossierBadges');
    const editBtn = document.getElementById('btnDrawerEdit');

    // Only Clerk or Admin can edit from drawer
    if (editBtn) {
        editBtn.style.display = ['Clerk', 'Court Administrator'].includes(currentUser.user_role) ? 'inline-flex' : 'none';
    }

    title.innerText = cnr;
    badgeContainer.innerHTML = '';
    container.innerHTML = '<div class="table-loading">Loading case details and timeline...</div>';
    openModal('dossierModal');

    try {
        const res = await fetch(`/api/cases/${encodeURIComponent(cnr)}/dossier`, { headers: getAuthHeaders() });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        const d = json.dossier;
        const c = d.case_details;

        const statusBadgeClass = c.case_status === 'Pending' ? 'badge-pending' :
                                c.case_status === 'Filed' ? 'badge-filed' : 'badge-disposed';
        const urgencyBadgeClass = c.statutory_urgency === 'Urgent' ? 'badge-urgent' :
                                 c.statutory_urgency === 'Statutory' ? 'badge-statutory' : '';

        badgeContainer.innerHTML = `
            <span class="status-badge ${statusBadgeClass}">${c.case_status}</span>
            ${c.statutory_urgency !== 'Normal' ? `<span class="status-badge ${urgencyBadgeClass}">${c.statutory_urgency}</span>` : ''}
        `;

        const isJudge = currentUser.user_role === 'Judge';
        const timelineEvents = [];

        (d.hearings || []).forEach(h => {
            // SRS REQ-03: Judge's private bench notes are visible to Judge, masked for public/litigant
            const benchText = isJudge
                ? (h.bench_note ? `Bench Note: "${h.bench_note}"` : 'No bench notes.')
                : (currentUser.user_role === 'Clerk' || currentUser.user_role === 'Court Administrator'
                    ? (h.bench_note ? `Note: "${h.bench_note}"` : '—')
                    : 'Procedural record filed.');

            timelineEvents.push({
                type: 'Hearing',
                date: h.hearing_date,
                title: `Hearing #${h.hearing_seq_no}: ${h.outcome || 'Pending Hearing'}`,
                desc: benchText,
                meta: h.judge_id ? `Judge #${h.judge_id}` : 'Unassigned',
                isOrder: false
            });
        });

        (d.orders || []).forEach(o => {
            timelineEvents.push({
                type: 'Order',
                date: o.published_date || o.draft_timestamp,
                title: `${o.order_type} (${o.publish_status})`,
                desc: o.published_date ? `Published on ${formatDate(o.published_date)}` : `Drafted on ${formatDate(o.draft_timestamp)} (Draft)`,
                meta: `Judge #${o.judge_id}`,
                isOrder: true
            });
        });

        timelineEvents.sort((a, b) => {
            const da = a.date ? new Date(a.date) : new Date(0);
            const db = b.date ? new Date(b.date) : new Date(0);
            return da - db;
        });

        let html = `
            <div class="drawer-section">
                <div class="drawer-section-title">Case Metadata</div>
                <div class="details-grid">
                    <div class="grid-item">
                        <span class="grid-k">Filing Number</span>
                        <span class="grid-v font-mono">${c.standardized_filing_number}</span>
                    </div>
                    <div class="grid-item">
                        <span class="grid-k">Case Number</span>
                        <span class="grid-v font-mono">${c.case_number}</span>
                    </div>
                    <div class="grid-item">
                        <span class="grid-k">FIR Reference</span>
                        <span class="grid-v">${c.fir_number || 'Civil Case (No FIR)'}</span>
                    </div>
                    <div class="grid-item">
                        <span class="grid-k">Registering Clerk</span>
                        <span class="grid-v">Clerk #${c.registered_by_clerk_id}</span>
                    </div>
                </div>
            </div>

            <div class="drawer-section">
                <div class="drawer-section-title">Involved Parties</div>
                ${(d.parties || []).length === 0 ? '<div class="text-muted" style="font-size:13px;">No parties assigned.</div>' :
                    d.parties.map(p => `
                        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--border-light); font-size:13px;">
                            <span><strong>${escapeHtml(p.party_role)}:</strong> ${escapeHtml(p.name)}</span>
                            <span class="text-muted font-mono">Litigant #${p.litigant_id}</span>
                        </div>
                    `).join('')
                }
            </div>

            <div class="drawer-section">
                <div class="drawer-section-title">Assigned Advocates</div>
                ${(d.advocates || []).length === 0 ? '<div class="text-muted" style="font-size:13px;">No advocates on record.</div>' :
                    d.advocates.map(a => `
                        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--border-light); font-size:13px;">
                            <span><strong>${escapeHtml(a.case_role)}:</strong> ${escapeHtml(a.name)}</span>
                            <span class="text-muted font-mono">${escapeHtml(a.bar_enrollment_no)}</span>
                        </div>
                    `).join('')
                }
            </div>

            <div class="drawer-section">
                <div class="drawer-section-title">Hearings & Decrees Timeline</div>
                <div class="timeline-track">
                    ${timelineEvents.length === 0 ? '<div class="text-muted" style="font-size:13px;">No scheduled hearings or orders yet.</div>' :
                        timelineEvents.map(evt => `
                            <div class="timeline-row">
                                <div class="timeline-bullet ${evt.isOrder ? 'bullet-order' : ''}"></div>
                                <div class="timeline-body">
                                    <div class="timeline-date">${evt.date ? formatDate(evt.date) : 'Unscheduled'} • ${evt.type}</div>
                                    <div class="timeline-header">${escapeHtml(evt.title)}</div>
                                    <div class="timeline-sub">${escapeHtml(evt.desc)}</div>
                                    <div style="font-size:11.5px; color:var(--text-muted); margin-top:3px;">${escapeHtml(evt.meta)}</div>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
            </div>

            <div class="drawer-section">
                <div class="drawer-section-title">Case Documents (R15)</div>
                ${(!d.documents || d.documents.length === 0) ? '<div class="text-muted" style="font-size:13px;">No digital documents uploaded.</div>' :
                    d.documents.map(doc => `
                        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--border-light); font-size:13px;">
                            <span><strong>#${doc.doc_seq_no} ${escapeHtml(doc.document_type)}</strong> (${formatDate(doc.upload_date)})</span>
                            <span class="text-muted">Advocate #${doc.advocate_id}</span>
                        </div>
                    `).join('')
                }
            </div>
        `;

        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<div class="table-loading text-danger">Failed to load case details: ${escapeHtml(err.message)}</div>`;
    }
}

// ==============================================================
// 6. TAB 2: HEARINGS SCHEDULE
// ==============================================================
async function loadHearings() {
    const tbody = document.getElementById('hearingTableBody');
    const countLabel = document.getElementById('hearingShowingText');
    const search = document.getElementById('hearingSearchInput').value.trim();
    const outcome = document.getElementById('hearingFilterOutcome').value;

    countLabel.innerText = 'Loading hearings...';

    try {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (outcome !== 'ALL') params.append('outcome', outcome);
        params.append('limit', '100');

        const res = await fetch(`/api/hearings?${params.toString()}`, { headers: getAuthHeaders() });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        renderHearingsTable(json.data);
        countLabel.innerText = `Showing ${json.rowCount} hearings`;
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="table-loading text-danger">Error: ${escapeHtml(err.message)}</td></tr>`;
        countLabel.innerText = 'Failed to load hearings';
    }
}

function renderHearingsTable(hearings) {
    const tbody = document.getElementById('hearingTableBody');
    tbody.innerHTML = '';

    if (!hearings || hearings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="table-loading">No hearings match the selected criteria.</td></tr>';
        return;
    }

    let lastDate = null;
    hearings.forEach(h => {
        const dateStr = h.hearing_date ? formatDate(h.hearing_date) : 'Unscheduled / Unlisted';
        
        if (dateStr !== lastDate) {
            const groupHeader = document.createElement('tr');
            groupHeader.style.backgroundColor = 'var(--header-bg)';
            groupHeader.innerHTML = `
                <td colspan="7" style="font-weight:700; color:var(--primary); padding:8px 16px; border-bottom:1px solid var(--border);">
                    Hearing Session Date: ${dateStr}
                </td>
            `;
            tbody.appendChild(groupHeader);
            lastDate = dateStr;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <a class="case-cnr-link font-mono" onclick="viewDossier('${escapeHtml(h.cnr)}')">
                    ${escapeHtml(h.cnr)}
                </a>
            </td>
            <td>Hearing #${h.hearing_seq_no}</td>
            <td>${dateStr}</td>
            <td><strong>${h.outcome ? escapeHtml(h.outcome) : '<span class="text-muted">Awaiting Outcome</span>'}</strong></td>
            <td style="color:var(--text-muted); max-width:280px;">${h.bench_note ? escapeHtml(h.bench_note) : '—'}</td>
            <td>Judge #${h.judge_id || 'N/A'}</td>
            <td>${h.causelist_id ? `List #${h.causelist_id}` : '—'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ==============================================================
// 7. TAB 3: ORDERS & JUDGMENTS (WITH JUDGE PUBLISH PRIVILEGE)
// ==============================================================
async function loadOrders() {
    const tbody = document.getElementById('orderTableBody');
    const countLabel = document.getElementById('orderShowingText');
    const search = document.getElementById('orderSearchInput').value.trim();
    const type = document.getElementById('orderFilterType').value;
    const pub = document.getElementById('orderFilterPublish').value;

    countLabel.innerText = 'Loading orders...';

    try {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (type !== 'ALL') params.append('type', type);
        if (pub !== 'ALL') params.append('publish_status', pub);
        params.append('limit', '100');

        const res = await fetch(`/api/orders?${params.toString()}`, { headers: getAuthHeaders() });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        renderOrdersTable(json.data);
        countLabel.innerText = `Showing ${json.rowCount} orders`;
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" class="table-loading text-danger">Error: ${escapeHtml(err.message)}</td></tr>`;
        countLabel.innerText = 'Failed to load orders';
    }
}

function renderOrdersTable(orders) {
    const tbody = document.getElementById('orderTableBody');
    tbody.innerHTML = '';

    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="table-loading">No orders match the selected criteria.</td></tr>';
        return;
    }

    // RBAC: Only Judge or Court Administrator can publish orders
    const canPublish = ['Judge', 'Court Administrator'].includes(currentUser.user_role);

    orders.forEach(o => {
        const tr = document.createElement('tr');
        const pubBadge = o.publish_status === 'Published'
            ? '<span class="status-badge badge-published">Published</span>'
            : '<span class="status-badge badge-draft">Draft</span>';

        let actionBtn = '';
        if (o.publish_status === 'Draft') {
            if (canPublish) {
                actionBtn = `<button class="btn btn-sm btn-outline" onclick="publishOrder('${escapeHtml(o.cnr)}', ${o.order_seq_no})">Sign & Publish</button>`;
            } else {
                actionBtn = '<span class="text-muted" style="font-size:12px;">Awaiting Bench Sign</span>';
            }
        } else {
            actionBtn = '<span class="text-muted" style="font-size:12px;">Archived</span>';
        }

        tr.innerHTML = `
            <td>
                <a class="case-cnr-link font-mono" onclick="viewDossier('${escapeHtml(o.cnr)}')">
                    ${escapeHtml(o.cnr)}
                </a>
            </td>
            <td>Order #${o.order_seq_no}</td>
            <td><strong>${escapeHtml(o.order_type)}</strong></td>
            <td>${formatDate(o.draft_timestamp)}</td>
            <td>${o.published_date ? formatDate(o.published_date) : '<span class="text-muted">—</span>'}</td>
            <td>${pubBadge}</td>
            <td>Judge #${o.judge_id}</td>
            <td class="text-right">${actionBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function publishOrder(cnr, seq) {
    try {
        const res = await fetch(`/api/orders/${encodeURIComponent(cnr)}/${seq}/publish`, {
            method: 'PUT',
            headers: getAuthHeaders()
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        showToast(`Order #${seq} for case ${cnr} published with judicial signature.`, 'success');
        loadOrders();
        loadDashboardStats();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

// ==============================================================
// 8. TAB 4: WITNESSES
// ==============================================================
async function loadWitnesses() {
    const tbody = document.getElementById('witnessTableBody');
    const countLabel = document.getElementById('witnessShowingText');
    const search = document.getElementById('witnessSearchInput').value.trim();

    countLabel.innerText = 'Loading witnesses...';

    try {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        params.append('limit', '100');

        const res = await fetch(`/api/witnesses?${params.toString()}`, { headers: getAuthHeaders() });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        renderWitnessTable(json.data);
        countLabel.innerText = `Showing ${json.rowCount} witnesses`;
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" class="table-loading text-danger">Error: ${escapeHtml(err.message)}</td></tr>`;
        countLabel.innerText = 'Failed to load witnesses';
    }
}

function renderWitnessTable(witnesses) {
    const tbody = document.getElementById('witnessTableBody');
    tbody.innerHTML = '';

    if (!witnesses || witnesses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="table-loading">No witnesses match search.</td></tr>';
        return;
    }

    witnesses.forEach(w => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>Witness #${w.witness_id}</td>
            <td><strong>${escapeHtml(w.name)}</strong></td>
            <td class="font-mono">${escapeHtml(w.contact_number)}</td>
            <td>${w.summons_count} Summons Served</td>
        `;
        tbody.appendChild(tr);
    });
}

async function handleCreateWitness(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitWitness');
    btn.disabled = true;
    btn.innerText = 'Saving...';

    const payload = {
        witness_id: document.getElementById('wit_id').value,
        name: document.getElementById('wit_name').value.trim(),
        contact_number: document.getElementById('wit_phone').value.trim()
    };

    try {
        const res = await fetch('/api/witnesses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        showToast(`Witness ${payload.name} enrolled.`, 'success');
        closeModal('createWitnessModal');
        loadWitnesses();
        loadDashboardStats();
    } catch (err) {
        showToast(err.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Save Witness';
    }
}

// ==============================================================
// 9. TAB 5: COURT ADMINISTRATOR (SYSTEM USERS & AUDIT)
// ==============================================================
async function loadSystemUsers() {
    const tbody = document.getElementById('adminUserTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Querying system_users and ISA subtypes...</td></tr>';

    try {
        const res = await fetch('/api/users', { headers: getAuthHeaders() });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        tbody.innerHTML = '';
        json.data.forEach(u => {
            const tr = document.createElement('tr');
            let roleBadgeClass = 'badge-clerk';
            if (u.user_role === 'Judge') roleBadgeClass = 'badge-judge';
            else if (u.user_role === 'Court Administrator') roleBadgeClass = 'badge-admin';
            else if (u.user_role === 'Advocate') roleBadgeClass = 'badge-advocate';
            else if (u.user_role === 'Litigant') roleBadgeClass = 'badge-litigant';

            let extraInfo = '—';
            if (u.bar_enrollment_no) extraInfo = `Bar No: ${escapeHtml(u.bar_enrollment_no)}`;
            else if (u.localization_setting) extraInfo = `Locale: ${escapeHtml(u.localization_setting)}`;

            tr.innerHTML = `
                <td class="font-mono">#${u.user_id}</td>
                <td><strong>${escapeHtml(u.name)}</strong></td>
                <td class="font-mono" style="color:var(--text-muted);">${escapeHtml(u.email)}</td>
                <td><span class="rbac-badge ${roleBadgeClass}">${escapeHtml(u.user_role)}</span></td>
                <td>${extraInfo}</td>
                <td class="text-muted font-mono">${u.created_by_admin_id ? `Admin #${u.created_by_admin_id}` : 'Root'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="table-loading text-danger">Error: ${escapeHtml(err.message)}</td></tr>`;
        showToast(err.message, 'danger');
    }
}

// ==============================================================
// 10. MODAL & TOAST HELPERS
// ==============================================================
function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active, .drawer-overlay.active').forEach(m => m.classList.remove('active'));
    }
});

document.querySelectorAll('.modal-overlay, .drawer-overlay').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.classList.remove('active');
    });
});

function showToast(message, type = 'info') {
    const shelf = document.getElementById('toastShelf');
    const item = document.createElement('div');
    item.className = `toast-item toast-${type}`;
    item.innerHTML = `<span style="flex:1;">${escapeHtml(message)}</span>`;

    shelf.appendChild(item);
    setTimeout(() => {
        item.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
        item.style.opacity = '0';
        item.style.transform = 'translateY(4px)';
        setTimeout(() => item.remove(), 150);
    }, 3800);
}

function formatDate(val) {
    if (!val) return '—';
    try {
        const d = new Date(val);
        return d.toISOString().split('T')[0];
    } catch {
        return val;
    }
}

function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// Automatic view trigger for headless documentation screenshots
window.addEventListener('load', () => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'newCase') {
        setTimeout(() => openModal('createCaseModal'), 300);
    } else if (view === 'drawer') {
        setTimeout(() => viewDossier('GJAH010000012024'), 400);
    } else if (view === 'delete') {
        setTimeout(() => openDeleteModal('GJAH010000012024', 'CC/1/2024'), 300);
    } else if (view === 'rbac') {
        setTimeout(() => openModal('switchUserModal'), 300);
    } else if (view === 'admin') {
        setTimeout(() => switchTab('admin'), 300);
    }
});
