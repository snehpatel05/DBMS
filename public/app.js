// app.js - District Court Case Management System (RBAC Multi-Role Controller)
// Sessions Division • Comprehensive Relational Ledger with High-Assurance RBAC

let allCases = [];
let currentPage = 1;
let pageSize = 25;
let currentDossierCnr = null;
let deleteTargetCnr = null;

// Active User Session (Default: Registry Clerk Rajesh Sharma #301)
let currentUser = {
    user_id: 301,
    name: 'Rajesh Sharma',
    email: 'user301@courtmail.in',
    user_role: 'Clerk'
};

// ==============================================================
// 1. INITIALIZATION & RBAC SETUP
// ==============================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user explicitly switched roles in this browser session
    const saved = sessionStorage.getItem('court_active_user');
    const savedToken = sessionStorage.getItem('court_auth_token');
    if (saved && savedToken) {
        try { currentUser = JSON.parse(saved); } catch (e) {}
    } else {
        // Initial visit defaults to Clerk Rajesh Sharma with authenticated session token
        currentUser = {
            user_id: 301,
            name: 'Rajesh Sharma',
            email: 'user301@courtmail.in',
            user_role: 'Clerk'
        };
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: 301, password: 'Court@2026' })
            });
            const json = await res.json();
            if (json.success && json.token) {
                currentUser = json.user;
                sessionStorage.setItem('court_auth_token', json.token);
                sessionStorage.setItem('court_active_user', JSON.stringify(currentUser));
            }
        } catch (e) {
            console.warn('Initial session auth:', e.message);
        }
    }

    applyUserRoleUI();
    initTabs();
    loadDashboardStats();
    loadAlerts();
    
    // Always start on Cases Ledger tab
    switchTab('tab-cases');
    setupEventListeners();
});

function applyUserRoleUI() {
    // Update Header Profile Pill
    const avatar = document.getElementById('headerAvatar');
    const nameEl = document.getElementById('headerUserName');
    const roleEl = document.getElementById('headerUserRole');

    if (avatar) avatar.innerText = getInitials(currentUser.name);
    if (nameEl) nameEl.innerText = currentUser.name;
    if (roleEl) roleEl.innerText = currentUser.user_role;

    // Role Flags
    const isClerk = currentUser.user_role === 'Clerk';
    const isJudge = currentUser.user_role === 'Judge';
    const isAdvocate = currentUser.user_role === 'Advocate';
    const isLitigant = currentUser.user_role === 'Litigant';
    const isAdmin = currentUser.user_role === 'Court Administrator';

    // Filing & Registry Action Buttons
    const canFile = isClerk || isAdmin;
    const headerBtn = document.getElementById('headerBtnFileCase');
    const toolbarBtn = document.getElementById('btnFileCaseToolbar');
    const enrollWitBtn = document.getElementById('btnEnrollWitness');
    const uploadDocBtn = document.getElementById('btnUploadDocToolbar');

    if (headerBtn) headerBtn.style.display = canFile ? 'inline-flex' : 'none';
    if (toolbarBtn) toolbarBtn.style.display = canFile ? 'inline-flex' : 'none';
    if (enrollWitBtn) enrollWitBtn.style.display = canFile ? 'inline-flex' : 'none';
    if (uploadDocBtn) uploadDocBtn.style.display = (isAdvocate || isClerk || isAdmin) ? 'inline-flex' : 'none';

    // Auto-bind registering intake clerk to active authenticated session
    const clerkIn = document.getElementById('clerk_in');
    if (clerkIn) clerkIn.value = currentUser.user_id;

    // Toolbar Specific Role Actions (Cause List, Scheduling, Orders)
    const btnGenCL = document.getElementById('btnGenerateCauseListToolbar');
    const btnSchedH = document.getElementById('btnScheduleHearingToolbar');
    const btnDraftOrd = document.getElementById('btnDraftOrderToolbar');

    if (btnGenCL) btnGenCL.style.display = (isClerk || isAdmin) ? 'inline-flex' : 'none';
    if (btnSchedH) btnSchedH.style.display = (isClerk || isAdmin) ? 'inline-flex' : 'none';
    if (btnDraftOrd) btnDraftOrd.style.display = isJudge ? 'inline-flex' : 'none';

    // Bench Notes Column Header Privacy (SRS Section 4.1: Only visible to Judges)
    const thBenchNote = document.getElementById('thBenchNote');
    if (thBenchNote) {
        thBenchNote.style.display = isJudge ? '' : 'none';
    }

    // Tabs Visibility & Dynamic Labels
    const tabCases = document.getElementById('tabNavCases');
    const tabHearings = document.getElementById('tabNavHearings');
    const tabOrders = document.getElementById('tabNavOrders');
    const tabWitnesses = document.getElementById('tabNavWitnesses');
    const tabDocs = document.getElementById('tabNavDocuments');
    const tabVak = document.getElementById('tabNavVakalatnama');
    const tabAdmin = document.getElementById('tabNavAdmin');
    const tabAudit = document.getElementById('tabNavAudit');

    // Reset visibility
    [tabCases, tabHearings, tabOrders, tabWitnesses, tabDocs, tabVak, tabAdmin, tabAudit].forEach(t => {
        if (t) t.style.display = 'none';
    });

    if (isClerk) {
        if (tabCases) { tabCases.style.display = 'inline-flex'; tabCases.firstChild.textContent = 'Cases Registry '; }
        if (tabHearings) { tabHearings.style.display = 'inline-flex'; tabHearings.firstChild.textContent = 'Cause Lists & Hearings '; }
        if (tabOrders) { tabOrders.style.display = 'inline-flex'; tabOrders.firstChild.textContent = 'Orders Archive '; }
        if (tabWitnesses) { tabWitnesses.style.display = 'inline-flex'; tabWitnesses.firstChild.textContent = 'Witness Registry '; }
        if (tabDocs) { tabDocs.style.display = 'inline-flex'; tabDocs.firstChild.textContent = 'Pleadings & Exhibits '; }
        if (tabVak) { tabVak.style.display = 'inline-flex'; tabVak.firstChild.textContent = 'Vakalatnama Powers '; }
    } else if (isJudge) {
        if (tabHearings) { tabHearings.style.display = 'inline-flex'; tabHearings.firstChild.textContent = 'Judicial Bench & Hearings '; }
        if (tabOrders) { tabOrders.style.display = 'inline-flex'; tabOrders.firstChild.textContent = 'Orders & Decrees Desk '; }
        if (tabCases) { tabCases.style.display = 'inline-flex'; tabCases.firstChild.textContent = 'Court Matters (Reference) '; }
        if (tabDocs) { tabDocs.style.display = 'inline-flex'; tabDocs.firstChild.textContent = 'Case Pleadings '; }
    } else if (isAdvocate) {
        if (tabCases) { tabCases.style.display = 'inline-flex'; tabCases.firstChild.textContent = 'My Client Retainers '; }
        if (tabHearings) { tabHearings.style.display = 'inline-flex'; tabHearings.firstChild.textContent = 'Court Appearances '; }
        if (tabDocs) { tabDocs.style.display = 'inline-flex'; tabDocs.firstChild.textContent = 'Pleadings & Documents '; }
        if (tabVak) { tabVak.style.display = 'inline-flex'; tabVak.firstChild.textContent = 'Vakalatnama Authorizations '; }
    } else if (isLitigant) {
        if (tabCases) { tabCases.style.display = 'inline-flex'; tabCases.firstChild.textContent = 'My Court Matters '; }
        if (tabHearings) { tabHearings.style.display = 'inline-flex'; tabHearings.firstChild.textContent = 'Trial Hearing Dates '; }
        if (tabOrders) { tabOrders.style.display = 'inline-flex'; tabOrders.firstChild.textContent = 'Certified Decrees '; }
    } else if (isAdmin) {
        if (tabCases) { tabCases.style.display = 'inline-flex'; tabCases.firstChild.textContent = 'Master Cases Ledger '; }
        if (tabHearings) { tabHearings.style.display = 'inline-flex'; tabHearings.firstChild.textContent = 'Hearing Calendars '; }
        if (tabOrders) { tabOrders.style.display = 'inline-flex'; tabOrders.firstChild.textContent = 'Judicial Decrees '; }
        if (tabWitnesses) { tabWitnesses.style.display = 'inline-flex'; tabWitnesses.firstChild.textContent = 'Witnesses & Summons '; }
        if (tabDocs) { tabDocs.style.display = 'inline-flex'; tabDocs.firstChild.textContent = 'All Documents '; }
        if (tabVak) { tabVak.style.display = 'inline-flex'; tabVak.firstChild.textContent = 'All Vakalatnamas '; }
        if (tabAdmin) { tabAdmin.style.display = 'inline-flex'; tabAdmin.firstChild.textContent = 'User Accounts (Admin) '; }
        if (tabAudit) { tabAudit.style.display = 'inline-flex'; tabAudit.firstChild.textContent = 'Database & Relational Audit '; }
    }

    // Role Scope Explainer Banner
    const banner = document.getElementById('roleScopeBanner');
    const bannerMsg = document.getElementById('roleScopeMessage');
    if (banner && bannerMsg) {
        banner.style.display = 'flex';
        if (isClerk) {
            bannerMsg.innerHTML = `<strong>Registry Operations Mode (Clerk #${currentUser.user_id}):</strong> Authorized to file new case plaints, schedule daily cause lists, enroll witnesses, and update case progress metadata.`;
        } else if (isJudge) {
            bannerMsg.innerHTML = `<strong>Judicial Bench Authority (Hon'ble Judge #${currentUser.user_id}):</strong> Presiding over court trials. Exclusively authorized to draft judicial orders, record confidential Bench Notes, and Sign &amp; Publish judicial decrees.`;
        } else if (isAdvocate) {
            bannerMsg.innerHTML = `<strong>Counsel Retainer Workspace (Advocate #${currentUser.user_id}):</strong> Client privilege filter active. Displaying exclusively cases where you are on record as Lead or Associate Counsel.`;
        } else if (isLitigant) {
            bannerMsg.innerHTML = `<strong>Citizen Self-Service Portal (Litigant #${currentUser.user_id}):</strong> Transparency access. Viewing exclusively your personal dispute dockets, trial dates, and certified court decrees. (Read-Only)`;
        } else if (isAdmin) {
            bannerMsg.innerHTML = `<strong>Supreme System Supervision (Administrator #${currentUser.user_id}):</strong> Unrestricted audit access across all 18 BCNF tables, triggers, user accounts, and court operations.`;
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
    else if (targetId === 'tab-documents') loadDocuments();
    else if (targetId === 'tab-vakalatnama') loadVakalatnamas();
    else if (targetId === 'tab-admin') loadSystemUsers();
    else if (targetId === 'tab-audit') loadSystemHealth();
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

    // Document Filters
    const docSearch = document.getElementById('docSearchInput');
    if (docSearch) docSearch.addEventListener('input', debounce(loadDocuments, 250));
    const docFilter = document.getElementById('docFilterType');
    if (docFilter) docFilter.addEventListener('change', loadDocuments);

    // Form Submissions
    document.getElementById('createCaseForm').addEventListener('submit', handleCreateCase);
    document.getElementById('updateCaseForm').addEventListener('submit', handleUpdateCase);
    document.getElementById('btnConfirmDelete').addEventListener('click', handleConfirmDelete);
    document.getElementById('createWitnessForm').addEventListener('submit', handleCreateWitness);

    // Judge Bench Form & Document Upload Form
    const benchForm = document.getElementById('judgeBenchForm');
    if (benchForm) benchForm.addEventListener('submit', handleJudgeBenchSubmit);

    const docForm = document.getElementById('uploadDocForm');
    if (docForm) docForm.addEventListener('submit', handleUploadDocSubmit);

    // Case Party & Advocate Enrollment Forms (N11)
    const partyForm = document.getElementById('addPartyForm');
    if (partyForm) partyForm.addEventListener('submit', handleAddParty);

    const advForm = document.getElementById('addAdvocateForm');
    if (advForm) advForm.addEventListener('submit', handleAddAdvocate);

    // Cause List Generation Form
    const clForm = document.getElementById('generateCauseListForm');
    if (clForm) clForm.addEventListener('submit', handleGenerateCauseList);

    // Schedule Hearing Form
    const schedForm = document.getElementById('scheduleHearingForm');
    if (schedForm) schedForm.addEventListener('submit', handleScheduleHearing);

    // Draft Order Form
    const draftForm = document.getElementById('draftOrderForm');
    if (draftForm) draftForm.addEventListener('submit', handleDraftOrder);

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
            body: JSON.stringify({ identifier: userId, password: 'Court@2026' })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        currentUser = json.user;
        if (json.token) {
            sessionStorage.setItem('court_auth_token', json.token);
        }
        sessionStorage.setItem('court_active_user', JSON.stringify(currentUser));
        applyUserRoleUI();
        closeModal('switchUserModal');
        showToast(`Active session authenticated: ${currentUser.name} (${currentUser.user_role})`, 'success');

        currentPage = 1;
        if (currentUser.user_role === 'Judge') {
            switchTab('tab-hearings');
        } else {
            switchTab('tab-cases');
        }
        loadDashboardStats();
        loadAlerts();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

async function handleCustomLogin() {
    const val = document.getElementById('customUserIdentifier').value.trim();
    const pwd = (document.getElementById('customUserPassword')?.value || 'Court@2026').trim();
    if (!val) {
        showToast('Please enter a User ID or Email.', 'warning');
        return;
    }
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: val, password: pwd })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        currentUser = json.user;
        if (json.token) {
            sessionStorage.setItem('court_auth_token', json.token);
        }
        sessionStorage.setItem('court_active_user', JSON.stringify(currentUser));
        applyUserRoleUI();
        closeModal('switchUserModal');
        showToast(`Session authenticated: ${currentUser.name} (${currentUser.user_role})`, 'success');

        currentPage = 1;
        if (currentUser.user_role === 'Judge') {
            switchTab('tab-hearings');
        } else {
            switchTab('tab-cases');
        }
        loadDashboardStats();
        loadAlerts();
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

// Helper: Common request headers with active cryptographic token and RBAC credentials
function getAuthHeaders() {
    const headers = {
        'x-user-id': currentUser.user_id ? currentUser.user_id.toString() : '301',
        'x-user-role': currentUser.user_role || 'Clerk'
    };
    const token = sessionStorage.getItem('court_auth_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

// ==============================================================
// 3. DASHBOARD STATS (DYNAMIC PER ROLE)
// ==============================================================
async function loadDashboardStats() {
    try {
        const res = await fetch('/api/stats', { headers: getAuthHeaders() });
        const json = await res.json();
        if (!json.success) return;

        const row = document.getElementById('kpiCardsRow');
        if (row && json.cards) {
            row.innerHTML = json.cards.map((c, idx) => `
                <div class="card" style="border-top: 3px solid ${c.color || 'var(--primary)'};">
                    <span class="card-label">${escapeHtml(c.label)}</span>
                    <span class="card-num" style="color:${c.color || 'var(--primary)'};">${c.value !== undefined ? Number(c.value).toLocaleString() : '--'}</span>
                    <span class="card-caption">${escapeHtml(c.sub || '')}</span>
                </div>
            `).join('');
        }

        // Update tab badges if available
        if (json.stats) {
            const bc = document.getElementById('badgeCases');
            const bh = document.getElementById('badgeHearings');
            const bo = document.getElementById('badgeOrders');
            const bw = document.getElementById('badgeWitnesses');
            const bd = document.getElementById('badgeDocuments');
            const bv = document.getElementById('badgeVakalatnama');
            if (bc) bc.innerText = json.stats.total_cases || '--';
            if (bh) bh.innerText = json.stats.total_hearings || '--';
            if (bo) bo.innerText = json.stats.published_orders || '--';
            if (bw) bw.innerText = json.stats.active_summons || json.stats.total_witnesses || '--';
            if (bd) bd.innerText = json.stats.total_documents || '--';
            if (bv) bv.innerText = json.stats.total_vakalatnamas || '--';
        }
    } catch (err) {
        console.error('Failed to load dashboard KPIs:', err);
    }
}

// ==============================================================
// 4. AUTOMATED ALERTS & NOTIFICATIONS (REQ-04, P1)
// ==============================================================
async function loadAlerts() {
    const badge = document.getElementById('unreadAlertCount');
    const container = document.getElementById('alertsContainer');
    const summary = document.getElementById('alertsSummaryText');

    try {
        const res = await fetch('/api/alerts', { headers: getAuthHeaders() });
        const json = await res.json();
        if (!json.success) return;

        if (badge) {
            if (json.unreadCount > 0) {
                badge.innerText = json.unreadCount > 99 ? '99+' : json.unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }

        if (summary) {
            summary.innerText = `${json.rowCount} court notifications (${json.unreadCount} unread)`;
        }

        if (container) {
            if (!json.data || json.data.length === 0) {
                container.innerHTML = '<div class="table-empty-box"><p>No system notifications for your account.</p></div>';
                return;
            }

            container.innerHTML = json.data.map(a => {
                const isUnread = a.alert_status === 'Delivered';
                let tagClass = 'alert-tag-case';
                if (a.alert_type === 'Hearing Reminder') tagClass = 'alert-tag-hearing';
                else if (a.alert_type === 'Order Published') tagClass = 'alert-tag-order';
                else if (a.alert_type === 'Document Uploaded') tagClass = 'alert-tag-doc';

                return `
                    <div class="alert-item-card ${isUnread ? 'unread' : 'read'}">
                        <div style="flex:1;">
                            <div class="alert-item-title">
                                <span class="alert-tag ${tagClass}">${escapeHtml(a.alert_type)}</span>
                                <a class="case-cnr-link font-mono" onclick="closeModal('alertsModal'); viewDossier('${escapeHtml(a.cnr)}');">
                                    ${escapeHtml(a.cnr)}
                                </a>
                            </div>
                            <div class="alert-item-meta">
                                Case: ${escapeHtml(a.case_number || 'Docket')} • Status: ${escapeHtml(a.case_status || 'Active')}
                            </div>
                            <div style="font-size:11.5px; color:var(--text-muted); margin-top:3px;">
                                ${formatDate(a.alert_timestamp)} (${a.alert_status})
                            </div>
                        </div>
                        ${isUnread ? `<button class="btn btn-sm btn-outline" onclick="markAlertAsRead(${a.alert_id})">Mark Read</button>` : ''}
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        console.error('Failed to load notifications:', err);
    }
}

async function markAlertAsRead(alertId) {
    try {
        const res = await fetch(`/api/alerts/${alertId}/read`, {
            method: 'PUT',
            headers: getAuthHeaders()
        });
        const json = await res.json();
        if (json.success) {
            loadAlerts();
        }
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

async function markAllAlertsAsRead() {
    try {
        const res = await fetch('/api/alerts/read-all', {
            method: 'PUT',
            headers: getAuthHeaders()
        });
        const json = await res.json();
        if (json.success) {
            showToast('All delivered alerts marked as read.', 'success');
            loadAlerts();
        }
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

// ==============================================================
// 5. TAB 1: MASTER CASES (WITH MULTI-PARAM SEARCH & RBAC)
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
        params.append('limit', '500');

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

        // Actions cell respecting RBAC and Disposed closure
        const isDisposed = c.case_status === 'Disposed';
        let actionButtons = `<button class="btn btn-sm btn-outline" onclick="viewDossier('${escapeHtml(c.cnr)}')">View</button>`;
        if (canEdit && !isDisposed) {
            actionButtons += `<button class="btn btn-sm btn-outline" onclick="openUpdateModal('${escapeHtml(c.cnr)}')">Edit</button>`;
        }
        if (canDelete && !isDisposed && c.case_status === 'Filed') {
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
            <td>${c.clerk_name ? escapeHtml(c.clerk_name) : 'Clerk'} (#${c.registered_by_clerk_id})</td>
            <td class="text-right">
                <div class="actions-cell">
                    ${actionButtons}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderPaginationControls(totalPages);
}

function renderPaginationControls(totalPages) {
    const container = document.getElementById('pageNumbersContainer');
    container.innerHTML = '';

    document.getElementById('btnPrevPage').disabled = (currentPage === 1);
    document.getElementById('btnNextPage').disabled = (currentPage === totalPages);

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        btn.innerText = i;
        btn.onclick = () => { currentPage = i; renderPaginatedCases(); };
        container.appendChild(btn);
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderPaginatedCases();
    }
}

function nextPage() {
    const totalPages = Math.ceil(allCases.length / pageSize) || 1;
    if (currentPage < totalPages) {
        currentPage++;
        renderPaginatedCases();
    }
}

function changePageSize(val) {
    pageSize = parseInt(val, 10);
    currentPage = 1;
    renderPaginatedCases();
}

function clearCaseFilters() {
    document.getElementById('caseSearchInput').value = '';
    document.getElementById('caseFilterUrgency').value = 'ALL';
    document.getElementById('caseFilterStatus').value = 'ALL';
    currentPage = 1;
    loadCases();
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
        loadAlerts();
    } catch (err) {
        showToast(err.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Save Case';
    }
}

// UPDATE CASE (With Irreversible Disposal Guard)
function openUpdateModal(cnr) {
    const c = allCases.find(item => item.cnr === cnr);
    if (!c) return;

    document.getElementById('upd_cnr').value = c.cnr;
    document.getElementById('upd_fir').value = c.fir_number || '';
    document.getElementById('upd_urgency').value = c.statutory_urgency;
    document.getElementById('upd_status').value = c.case_status;

    const warningEl = document.getElementById('upd_disposed_warning');
    const submitBtn = document.getElementById('btnSubmitUpdate');
    const statusSelect = document.getElementById('upd_status');
    const urgencySelect = document.getElementById('upd_urgency');
    const firInput = document.getElementById('upd_fir');

    if (c.case_status === 'Disposed') {
        if (warningEl) warningEl.style.display = 'block';
        if (submitBtn) submitBtn.disabled = true;
        if (statusSelect) statusSelect.disabled = true;
        if (urgencySelect) urgencySelect.disabled = true;
        if (firInput) firInput.disabled = true;
    } else {
        if (warningEl) warningEl.style.display = 'none';
        if (submitBtn) submitBtn.disabled = false;
        if (statusSelect) statusSelect.disabled = false;
        if (urgencySelect) urgencySelect.disabled = false;
        if (firInput) firInput.disabled = false;
    }

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
        loadAlerts();
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

        showToast(`Case ${deleteTargetCnr} permanently removed from registry.`, 'success');
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
// 6. RIGHT-SIDE CASE DETAIL DOSSIER (With Bench Note Privacy)
// ==============================================================
async function viewDossier(cnr) {
    currentDossierCnr = cnr;
    const title = document.getElementById('dossierTitle');
    const container = document.getElementById('dossierContent');
    const badgeContainer = document.getElementById('dossierBadges');
    const editBtn = document.getElementById('btnDrawerEdit');

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

        badgeContainer.innerHTML = `
            <span class="status-badge ${c.case_status === 'Pending' ? 'badge-pending' : (c.case_status === 'Disposed' ? 'badge-disposed' : 'badge-filed')}">${escapeHtml(c.case_status)}</span>
            <span class="status-badge ${c.statutory_urgency === 'Urgent' ? 'badge-urgent' : 'badge-statutory'}">${escapeHtml(c.statutory_urgency)}</span>
        `;

        // #68: Case Classification & Matter Stage
        const caseType = c.fir_number ? 'Criminal Sessions Case' : 'Civil Original Suit';
        let caseStage = 'Filing & Registration';
        if (c.case_status === 'Disposed') {
            caseStage = 'Disposal (Concluded)';
        } else if (c.case_status === 'Pending') {
            caseStage = (d.hearings && d.hearings.length > 0) ? 'Court Proceedings / Trial' : 'Listing / Scrutiny';
        }

        // #68: Next Hearing Date
        let nextHearingText = 'None scheduled';
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const upcomingHearings = (d.hearings || [])
            .filter(h => h.hearing_date && new Date(h.hearing_date) >= now)
            .sort((a, b) => new Date(a.hearing_date) - new Date(b.hearing_date));
        if (upcomingHearings.length > 0) {
            nextHearingText = `${formatDate(upcomingHearings[0].hearing_date)} (Session #${upcomingHearings[0].hearing_seq_no})`;
        } else if ((d.hearings || []).length > 0) {
            const sortedH = [...d.hearings].sort((a, b) => new Date(b.hearing_date) - new Date(a.hearing_date));
            nextHearingText = `Concluded / Last: ${formatDate(sortedH[0].hearing_date)}`;
        }

        // #68: Operative Decree (Latest published order)
        let operativeOrderText = 'No decree published yet';
        const pubOrders = (d.orders || [])
            .filter(o => o.publish_status === 'Published' && o.published_date)
            .sort((a, b) => new Date(b.published_date) - new Date(a.published_date));
        if (pubOrders.length > 0) {
            operativeOrderText = `${pubOrders[0].order_type} #${pubOrders[0].order_seq_no} (Signed ${formatDate(pubOrders[0].published_date)})`;
        }

        // Action permissions
        const canManageCase = ['Clerk', 'Court Administrator'].includes(currentUser.user_role);
        const isCaseLeadAdvocate = currentUser.user_role === 'Advocate' && (d.advocates || []).some(a => a.advocate_id === currentUser.user_id && a.case_role === 'Lead');
        const canAssignCounsel = canManageCase || isCaseLeadAdvocate;

        const timelineEvents = [];
        (d.hearings || []).forEach(h => {
            timelineEvents.push({
                date: h.hearing_date,
                type: 'Hearing Session',
                title: `Hearing #${h.hearing_seq_no} • ${h.outcome || 'Pending Outcome'}`,
                desc: h.bench_note ? `Judicial Notes: ${h.bench_note}` : (currentUser.user_role === 'Judge' ? 'No bench notes recorded' : 'Private to Presiding Bench'),
                meta: `Judge #${h.judge_id || 'N/A'} • Cause List #${h.causelist_id || 'N/A'}`
            });
        });
        (d.orders || []).forEach(o => {
            timelineEvents.push({
                date: o.published_date || o.draft_timestamp,
                type: 'Judicial Order',
                title: `${o.order_type} #${o.order_seq_no} (${o.publish_status})`,
                desc: o.published_date ? `Signed and legally pronounced on ${formatDate(o.published_date)}` : 'Draft Reserved - Awaiting Bench Signature',
                meta: `Authoring Judge: #${o.judge_id} • Hearing Seq #${o.hearing_seq_no || 'N/A'}`,
                isOrder: true
            });
        });

        timelineEvents.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        const html = `
            <div class="drawer-section">
                <div class="drawer-section-title">Case Registry Details</div>
                <div class="drawer-kv-grid">
                    <div class="drawer-kv-label">Standardized Filing No:</div>
                    <div class="drawer-kv-value font-mono">${escapeHtml(c.standardized_filing_number)}</div>
                    <div class="drawer-kv-label">Case Number:</div>
                    <div class="drawer-kv-value">${escapeHtml(c.case_number)}</div>
                    <div class="drawer-kv-label">Matter Classification:</div>
                    <div class="drawer-kv-value"><strong>${escapeHtml(caseType)}</strong></div>
                    <div class="drawer-kv-label">Current Stage:</div>
                    <div class="drawer-kv-value"><span class="status-badge badge-filed" style="font-size:12px;">${escapeHtml(caseStage)}</span></div>
                    <div class="drawer-kv-label">Next Hearing Date:</div>
                    <div class="drawer-kv-value font-mono">${escapeHtml(nextHearingText)}</div>
                    <div class="drawer-kv-label">Operative Decree:</div>
                    <div class="drawer-kv-value">${escapeHtml(operativeOrderText)}</div>
                    <div class="drawer-kv-label">FIR Reference:</div>
                    <div class="drawer-kv-value">${c.fir_number ? escapeHtml(c.fir_number) : '<span class="text-muted">—</span>'}</div>
                    <div class="drawer-kv-label">Filing Intake Clerk:</div>
                    <div class="drawer-kv-value">${c.clerk_name ? escapeHtml(c.clerk_name) : 'Clerk'} (#${c.registered_by_clerk_id})</div>
                </div>
            </div>

            <div class="drawer-section">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div class="drawer-section-title" style="margin-bottom:0;">Enrolled Litigant Parties</div>
                    ${canManageCase ? `<button class="btn btn-secondary btn-sm" onclick="openAddPartyModal('${escapeHtml(cnr)}')">+ Add Party</button>` : ''}
                </div>
                ${(d.parties || []).length === 0 ? '<div class="text-muted" style="font-size:13px;">No litigant parties enrolled.</div>' :
                    d.parties.map(p => `
                        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--border-light); font-size:13px;">
                            <span><strong>${escapeHtml(p.party_role)}:</strong> ${escapeHtml(p.name)}</span>
                            <span class="text-muted font-mono">Litigant #${p.litigant_id}</span>
                        </div>
                    `).join('')
                }
            </div>

            <div class="drawer-section">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div class="drawer-section-title" style="margin-bottom:0;">Retained Legal Counsel</div>
                    ${canAssignCounsel ? `<button class="btn btn-secondary btn-sm" onclick="openAddAdvocateModal('${escapeHtml(cnr)}')">+ Assign Counsel</button>` : ''}
                </div>
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
                <div class="drawer-section-title">Pleadings, Briefs & Exhibits</div>
                ${(!d.documents || d.documents.length === 0) ? '<div class="text-muted" style="font-size:13px;">No digital pleadings filed.</div>' :
                    d.documents.map(doc => `
                        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--border-light); font-size:13px;">
                            <span><strong>#${doc.doc_seq_no} ${escapeHtml(doc.document_type)}</strong> (${formatDate(doc.upload_date)})</span>
                            <span class="text-muted">Counsel #${doc.advocate_id}</span>
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
// 6B. CASE PARTY & COUNSEL ASSIGNMENT CONTROLLERS (N11)
// ==============================================================
function openAddPartyModal(cnr) {
    const targetCnr = cnr || currentDossierCnr;
    if (!targetCnr) return;
    const input = document.getElementById('party_cnr');
    if (input) input.value = targetCnr;
    const idInput = document.getElementById('party_litigant_id');
    if (idInput) idInput.value = '';
    const roleSel = document.getElementById('party_role_select');
    if (roleSel) roleSel.value = 'Petitioner';
    openModal('addPartyModal');
}

function openAddAdvocateModal(cnr) {
    const targetCnr = cnr || currentDossierCnr;
    if (!targetCnr) return;
    const input = document.getElementById('adv_cnr');
    if (input) input.value = targetCnr;
    const idInput = document.getElementById('adv_id_in');
    if (idInput) idInput.value = '';
    const roleSel = document.getElementById('adv_role_select');
    if (roleSel) roleSel.value = 'Lead';
    toggleAssignerField();
    openModal('addAdvocateModal');
}

function toggleAssignerField() {
    const role = document.getElementById('adv_role_select')?.value;
    const group = document.getElementById('adv_assigner_group');
    const input = document.getElementById('adv_assigned_by');
    if (group) {
        if (role === 'Associate') {
            group.style.display = 'block';
            if (input && currentUser.user_role === 'Advocate') {
                input.value = currentUser.user_id;
            }
        } else {
            group.style.display = 'none';
            if (input) input.value = '';
        }
    }
}

async function handleAddParty(e) {
    e.preventDefault();
    const cnr = document.getElementById('party_cnr').value.trim();
    const litigant_id = parseInt(document.getElementById('party_litigant_id').value, 10);
    const party_role = document.getElementById('party_role_select').value;

    if (!cnr || isNaN(litigant_id)) {
        showToast('Please provide valid CNR and Litigant ID.', 'warning');
        return;
    }

    try {
        const res = await fetch('/api/case-parties', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ cnr, litigant_id, party_role })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        closeModal('addPartyModal');
        showToast(`Party enrolled successfully (${party_role})`, 'success');
        if (currentDossierCnr === cnr) {
            viewDossier(cnr);
        }
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

async function handleAddAdvocate(e) {
    e.preventDefault();
    const cnr = document.getElementById('adv_cnr').value.trim();
    const advocate_id = parseInt(document.getElementById('adv_id_in').value, 10);
    const case_role = document.getElementById('adv_role_select').value;
    let assigned_by = null;

    if (case_role === 'Associate') {
        const val = parseInt(document.getElementById('adv_assigned_by').value, 10);
        if (isNaN(val)) {
            showToast('Associate counsel requires an assigning Lead Advocate ID.', 'warning');
            return;
        }
        assigned_by = val;
    }

    if (!cnr || isNaN(advocate_id)) {
        showToast('Please provide valid CNR and Advocate ID.', 'warning');
        return;
    }

    try {
        const res = await fetch('/api/case-advocates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ cnr, advocate_id, case_role, assigned_by })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        closeModal('addAdvocateModal');
        showToast(`Counsel retained successfully (${case_role} Advocate)`, 'success');
        if (currentDossierCnr === cnr) {
            viewDossier(cnr);
        }
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

// ==============================================================
// 7. TAB 2: HEARINGS SCHEDULE & CAUSE LIST ROSTER
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
        params.append('limit', '500');

        const res = await fetch(`/api/hearings?${params.toString()}`, { headers: getAuthHeaders() });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        renderHearingsTable(json.data);
        countLabel.innerText = `Showing ${json.rowCount} hearings`;
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" class="table-loading text-danger">Error: ${escapeHtml(err.message)}</td></tr>`;
        countLabel.innerText = 'Failed to load hearings';
    }
}

function renderHearingsTable(hearings) {
    const tbody = document.getElementById('hearingTableBody');
    tbody.innerHTML = '';

    const isJudge = currentUser.user_role === 'Judge';

    if (!hearings || hearings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${isJudge ? 8 : 7}" class="table-loading">No hearings match the selected criteria.</td></tr>`;
        return;
    }

    let lastDate = null;
    hearings.forEach(h => {
        const dateStr = h.hearing_date ? formatDate(h.hearing_date) : 'Unscheduled / Unlisted';
        
        if (dateStr !== lastDate) {
            const groupHeader = document.createElement('tr');
            groupHeader.style.backgroundColor = 'var(--header-bg)';
            groupHeader.innerHTML = `
                <td colspan="${isJudge ? 8 : 7}" style="font-weight:700; color:var(--primary); padding:8px 16px; border-bottom:1px solid var(--border);">
                    Hearing Session Date: ${dateStr}
                </td>
            `;
            tbody.appendChild(groupHeader);
            lastDate = dateStr;
        }

        const tr = document.createElement('tr');
        let actionBtn = '<span class="text-muted" style="font-size:12px;">Hearing Record</span>';

        // Judge actions: Only the Presiding Judge on this hearing can record bench notes & outcome
        if (isJudge) {
            if (h.judge_id === currentUser.user_id) {
                const safeNote = (h.bench_note || '').replace(/'/g, "\\'");
                const safeOutcome = (h.outcome || '').replace(/'/g, "\\'");
                actionBtn = `<button class="btn btn-sm btn-outline" onclick="openJudgeBenchModal('${escapeHtml(h.cnr)}', ${h.hearing_seq_no}, '${safeOutcome}', '${safeNote}')">Bench Note / Outcome</button>`;
            } else {
                actionBtn = `<span class="text-muted" style="font-size:11.5px;">Bench #${h.judge_id}</span>`;
            }
        }

        let benchNoteCell = '';
        if (isJudge) {
            if (h.judge_id === currentUser.user_id) {
                benchNoteCell = `<td style="color:var(--text-muted); max-width:260px;">${h.bench_note ? escapeHtml(h.bench_note) : '<span class="text-muted">No notes recorded</span>'}</td>`;
            } else {
                benchNoteCell = `<td class="text-muted" style="font-size:12px;">Presiding: Judge #${h.judge_id}</td>`;
            }
        }

        tr.innerHTML = `
            <td>
                <a class="case-cnr-link font-mono" onclick="viewDossier('${escapeHtml(h.cnr)}')">
                    ${escapeHtml(h.cnr)}
                </a>
            </td>
            <td>Hearing #${h.hearing_seq_no}</td>
            <td>${dateStr}</td>
            <td><strong>${h.outcome ? escapeHtml(h.outcome) : '<span class="text-muted">Awaiting Outcome</span>'}</strong></td>
            ${benchNoteCell}
            <td>${h.judge_name ? `Hon. ${escapeHtml(h.judge_name)}` : 'Judge'} (#${h.judge_id || 'N/A'})</td>
            <td>${h.causelist_id ? `List #${h.causelist_id}` : '—'}</td>
            <td class="text-right">${actionBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

function openJudgeBenchModal(cnr, seq, outcome, benchNote) {
    document.getElementById('bench_hearing_cnr').value = cnr;
    document.getElementById('bench_hearing_seq').value = seq;
    document.getElementById('bench_display_cnr').innerText = `${cnr} (Hearing #${seq})`;
    document.getElementById('bench_outcome').value = outcome || 'Arguments Heard';
    document.getElementById('bench_note').value = benchNote || '';
    openModal('judgeBenchModal');
}

async function handleJudgeBenchSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveBenchRecord');
    btn.disabled = true;
    btn.innerText = 'Saving Record...';

    const cnr = document.getElementById('bench_hearing_cnr').value;
    const seq = document.getElementById('bench_hearing_seq').value;
    const outcome = document.getElementById('bench_outcome').value;
    const bench_note = document.getElementById('bench_note').value;

    try {
        const res = await fetch(`/api/hearings/${encodeURIComponent(cnr)}/${seq}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ outcome, bench_note })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        showToast(`Hearing #${seq} record updated by judicial officer.`, 'success');
        closeModal('judgeBenchModal');
        loadHearings();
        loadDashboardStats();
        loadAlerts();
        if (currentDossierCnr === cnr) viewDossier(cnr);
    } catch (err) {
        showToast(err.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Save Bench Record';
    }
}

// CAUSE LIST GENERATION ALGORITHM (REQ-05, P1)
async function handleGenerateCauseList(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitGenerateCauseList');
    btn.disabled = true;
    btn.innerText = 'Prioritizing Cases...';

    const list_date = document.getElementById('cl_target_date').value;

    try {
        const res = await fetch('/api/causelists/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ list_date, clerk_id: currentUser.user_id })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        showToast(json.message, 'success');
        closeModal('generateCauseListModal');
        loadHearings();
        loadDashboardStats();
        loadAlerts();
    } catch (err) {
        showToast(err.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Run Prioritization & Issue Roster';
    }
}

// SCHEDULE HEARING
async function handleScheduleHearing(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitScheduleHearing');
    btn.disabled = true;
    btn.innerText = 'Scheduling...';

    const cnr = document.getElementById('sched_cnr').value.trim();
    const judge_id = document.getElementById('sched_judge_id').value;
    const causelist_id = document.getElementById('sched_causelist_id').value;

    try {
        const res = await fetch('/api/hearings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ cnr, judge_id, causelist_id })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        showToast(json.message, 'success');
        closeModal('scheduleHearingModal');
        loadHearings();
        loadDashboardStats();
        loadAlerts();
    } catch (err) {
        showToast(err.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Schedule Session';
    }
}

// ==============================================================
// 8. TAB 3: ORDERS & JUDGMENTS (TWO-STEP JUDICIAL WORKFLOW)
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
        params.append('limit', '500');

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

    const isJudge = currentUser.user_role === 'Judge';

    orders.forEach(o => {
        const tr = document.createElement('tr');
        const pubBadge = o.publish_status === 'Published'
            ? '<span class="status-badge badge-published">Published</span>'
            : '<span class="status-badge badge-draft">Draft</span>';

        let actionBtn = '';
        if (o.publish_status === 'Draft') {
            if (isJudge && o.judge_id === currentUser.user_id) {
                actionBtn = `<button class="btn btn-sm btn-primary" onclick="confirmPublishOrder('${escapeHtml(o.cnr)}', ${o.order_seq_no}, '${escapeHtml(o.order_type)}')">Sign & Publish</button>`;
            } else {
                actionBtn = `<span class="text-muted" style="font-size:12px;">Draft (Judge #${o.judge_id})</span>`;
            }
        } else {
            actionBtn = '<span class="text-muted" style="font-size:12px;">Certified Decree</span>';
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
            <td>${o.judge_name ? `Hon. ${escapeHtml(o.judge_name)}` : 'Judge'} (#${o.judge_id})</td>
            <td class="text-right">${actionBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

// DRAFT ORDER SUBMISSION
async function handleDraftOrder(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitDraftOrder');
    btn.disabled = true;
    btn.innerText = 'Reserving Draft...';

    const cnr = document.getElementById('order_cnr').value.trim();
    const order_type = document.getElementById('order_type_select').value;
    const hearing_seq_no = document.getElementById('order_hearing_seq').value;

    try {
        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ cnr, order_type, hearing_seq_no })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        showToast(json.message, 'success');
        closeModal('draftOrderModal');
        loadOrders();
        loadDashboardStats();
        loadAlerts();
    } catch (err) {
        showToast(err.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Reserve Draft Order';
    }
}

// CONFIRM & PUBLISH ORDER (Automated Disposal on Final Judgment)
async function confirmPublishOrder(cnr, seq, orderType) {
    if (orderType === 'Final Judgment') {
        const ok = confirm(`Judicial Concurrence Required:\n\nSigning and publishing this Final Judgment decree will officially conclude this litigation and permanently mark case ${cnr} as DISPOSED.\n\nDo you wish to affix your digital judicial signature and pronounce decree?`);
        if (!ok) return;
    }

    try {
        const res = await fetch(`/api/orders/${encodeURIComponent(cnr)}/${seq}/publish`, {
            method: 'PUT',
            headers: getAuthHeaders()
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        showToast(json.message, 'success');
        loadOrders();
        loadDashboardStats();
        loadAlerts();
        if (currentDossierCnr === cnr) viewDossier(cnr);
    } catch (err) {
        showToast(err.message, 'danger');
    }
}

// ==============================================================
// 9. TAB 4: WITNESSES
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
            <td>${Number(w.summons_count) > 0 ? `<span class="status-badge badge-published">${w.summons_count} Summons Dispatched</span>` : '<span class="text-muted">Repository Only</span>'}</td>
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

        showToast(`Witness ${payload.name} registered.`, 'success');
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
// 10. TAB 5: PLEADINGS & LEGAL DOCUMENTS (R15 - Advocate Desk)
// ==============================================================
async function loadDocuments() {
    const tbody = document.getElementById('docTableBody');
    const search = document.getElementById('docSearchInput') ? document.getElementById('docSearchInput').value.trim() : '';
    const type = document.getElementById('docFilterType') ? document.getElementById('docFilterType').value : 'ALL';

    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Loading legal pleadings and briefs...</td></tr>';

    try {
        const params = new URLSearchParams();
        if (search) params.append('cnr', search);
        if (type !== 'ALL') params.append('type', type);
        params.append('limit', '100');

        const res = await fetch(`/api/documents?${params.toString()}`, { headers: getAuthHeaders() });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        if (!json.data || json.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="table-loading">No documents on file matching filter.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        json.data.forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><a class="case-cnr-link font-mono" onclick="viewDossier('${escapeHtml(d.cnr)}')">${escapeHtml(d.cnr)}</a></td>
                <td>Pleading #${d.doc_seq_no}</td>
                <td><strong>${escapeHtml(d.document_type)}</strong></td>
                <td>${formatDate(d.upload_date)}</td>
                <td>${escapeHtml(d.advocate_name || `Advocate #${d.advocate_id}`)}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="table-loading text-danger">Error: ${escapeHtml(err.message)}</td></tr>`;
    }
}

async function handleUploadDocSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitDoc');
    btn.disabled = true;
    btn.innerText = 'Submitting...';

    const cnr = document.getElementById('doc_cnr').value.trim();
    const document_type = document.getElementById('doc_type').value;

    try {
        const res = await fetch('/api/documents', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ cnr, document_type })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        showToast(`${document_type} filed successfully for case ${cnr}.`, 'success');
        closeModal('uploadDocModal');
        loadDocuments();
        loadAlerts();
        if (currentDossierCnr === cnr) viewDossier(cnr);
    } catch (err) {
        showToast(err.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Submit Document';
    }
}

// ==============================================================
// 11. TAB 6: VAKALATNAMA POWERS OF ATTORNEY (R16)
// ==============================================================
async function loadVakalatnamas() {
    const tbody = document.getElementById('vakalatnamaTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Loading registered powers of attorney...</td></tr>';

    try {
        const res = await fetch('/api/vakalatnamas', { headers: getAuthHeaders() });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        if (!json.data || json.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="table-loading">No vakalatnamas on record.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        json.data.forEach(v => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="font-mono">POA #${v.auth_id}</td>
                <td><a class="case-cnr-link font-mono" onclick="viewDossier('${escapeHtml(v.cnr)}')">${escapeHtml(v.cnr)}</a></td>
                <td>${escapeHtml(v.litigant_name || `Litigant #${v.litigant_id}`)}</td>
                <td><strong>${escapeHtml(v.advocate_name || `Advocate #${v.advocate_id}`)}</strong></td>
                <td>${formatDate(v.signed_date)}</td>
                <td>${v.e_signature_flag ? '<span class="status-badge badge-published">e-Signed Valid</span>' : '<span class="status-badge badge-draft">Physical Stamp</span>'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="table-loading text-danger">Error: ${escapeHtml(err.message)}</td></tr>`;
    }
}

// ==============================================================
// 12. TAB 7 & 8: COURT ADMINISTRATOR DESK & 18 BCNF TABLES AUDIT
// ==============================================================
async function loadSystemUsers() {
    const tbody = document.getElementById('adminUserTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="table-loading">Loading system user accounts...</td></tr>';

    try {
        const res = await fetch('/api/users', { headers: getAuthHeaders() });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        tbody.innerHTML = '';
        json.data.forEach(u => {
            let roleBadge = `<span class="status-badge badge-filed">${escapeHtml(u.user_role)}</span>`;
            if (u.user_role === 'Judge') roleBadge = `<span class="status-badge badge-pending">Judge</span>`;
            else if (u.user_role === 'Advocate') roleBadge = `<span class="status-badge badge-urgent">Advocate</span>`;
            else if (u.user_role === 'Court Administrator') roleBadge = `<span class="status-badge badge-statutory">Admin</span>`;

            let meta = '—';
            if (u.bar_enrollment_no) meta = `<span class="font-mono">${escapeHtml(u.bar_enrollment_no)}</span>`;
            else if (u.localization_setting) meta = `Locale: ${escapeHtml(u.localization_setting)}`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="font-mono">#${u.user_id}</td>
                <td><strong>${escapeHtml(u.name)}</strong></td>
                <td>${escapeHtml(u.email)}</td>
                <td>${roleBadge}</td>
                <td>${meta}</td>
                <td>${u.created_by_admin_id ? `Admin #${u.created_by_admin_id}` : '<span class="text-muted">Root</span>'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="table-loading text-danger">Error: ${escapeHtml(err.message)}</td></tr>`;
    }
}

async function loadSystemHealth() {
    const tbody = document.getElementById('systemHealthTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Querying 18 BCNF relational entities...</td></tr>';

    try {
        const res = await fetch('/api/system/health', { headers: getAuthHeaders() });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        tbody.innerHTML = '';
        json.tables.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="font-mono" style="font-weight:700; color:var(--primary);">${escapeHtml(t.relation)}</td>
                <td><code style="font-size:13px; font-weight:600;">${escapeHtml(t.table_name)}</code></td>
                <td>${escapeHtml(t.description)}</td>
                <td class="font-mono"><strong>${Number(t.row_count).toLocaleString()}</strong> tuples</td>
                <td><span class="status-badge badge-published">Normalized (BCNF)</span></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="table-loading text-danger">Audit Error: ${escapeHtml(err.message)}</td></tr>`;
        showToast(err.message, 'danger');
    }
}

// ==============================================================
// 13. MODAL & TOAST HELPERS
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
