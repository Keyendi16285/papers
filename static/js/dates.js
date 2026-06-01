/**
 * Papers.massfoia - Deadlines & Calendar Logic
 */

// In-memory data states
let cachedDates = [];
let currentGroupingMode = 'default'; // 'default', 'case', 'defendant'
let activeDatesRegistry = {};

async function authFetch(url, options = {}) {
    const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
    options.headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
    const response = await fetch(url, options);
    if (response.status === 401) {
        sessionStorage.removeItem("access_token");
        localStorage.removeItem("access_token");
        window.location.replace(window.location.origin);
    }
    return response;
}

document.addEventListener('DOMContentLoaded', () => {
    const deadlineSearch = document.getElementById('paper-search-input');
    if (deadlineSearch) {
        deadlineSearch.addEventListener('input', (e) => {
            fetchAllDates(e.target.value);
        });
    }

    // Intercept form updates
    const editForm = document.getElementById('edit-date-form');
    if (editForm) {
        editForm.addEventListener('submit', handleFormSubmit);
    }

    fetchAllDates();
});

/**
 * Main Data Fetcher
 */
async function fetchAllDates(searchQuery = '') {
    try {
        let url = '/api/papers/dates/upcoming';
        if (searchQuery) url += `?q=${encodeURIComponent(searchQuery)}`;
        
        const response = await authFetch(url);
        cachedDates = await response.json();

        if (!Array.isArray(cachedDates)) {
            cachedDates = [];
        }

        renderDisplay();
    } catch (err) { 
        console.error("Failed to fetch dates data:", err); 
    }
}

/**
 * Entry-point switch responsible for choosing rendering templates
 */
function renderDisplay() {
    const body = document.getElementById('dates-table-body');
    if (!body) return;

    // Reset localized global references
    activeDatesRegistry = {};

    if (cachedDates.length === 0) {
        body.innerHTML = `<tr><td colspan="8" class="p-12 text-center text-slate-400 italic text-sm">No deadlines found matching your search.</td></tr>`;
        return;
    }

    // Direct routing to structural layouts
    if (currentGroupingMode === 'case') {
        renderGroupedLayout(body, 'case_title');
    } else if (currentGroupingMode === 'defendant') {
        renderGroupedLayout(body, 'defendant_name');
    } else {
        renderDefaultLayout(body);
    }
}

/**
 * 1. Standard Flat Layout Rendering (All Dates)
 */
function renderDefaultLayout(containerElement) {
    containerElement.innerHTML = cachedDates.map(d => {
        activeDatesRegistry[d.id] = d;
        return buildTableRowHtml(d);
    }).join('');
}

/**
 * 2. Grouped Sub-element Blocks Layout Rendering (Cases & Defendants)
 */
function renderGroupedLayout(containerElement, keyField) {
    // Structural mapping setup
    const groups = {};

    cachedDates.forEach(d => {
        activeDatesRegistry[d.id] = d;
        
        // Extract from relation objects safely
        let groupKey = 'Unassigned';
        if (keyField === 'case_title') {
            groupKey = d.case_title || d.paper?.case_name || 'No Case Specified';
        } else if (keyField === 'defendant_name') {
            groupKey = d.defendant_name || d.paper?.defendant_name || 'No Named Defendant';
        }

        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(d);
    });

    // Build collapsible grouping sections inside table structures
    let htmlOutput = '';
    Object.keys(groups).forEach(groupName => {
        const items = groups[groupName];
        
        // Dynamic group row banner spanning all 8 structural layout columns
        htmlOutput += `
            <tr class="bg-slate-100/80 border-y border-slate-200">
                <td colspan="8" class="px-6 py-3.5">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid ${keyField === 'case_title' ? 'fa-folder-open text-blue-500' : 'fa-user-shield text-indigo-500'} text-xs"></i>
                        <span class="text-xs font-black tracking-tight text-slate-700 uppercase">${groupName}</span>
                        <span class="ml-1 bg-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-600">${items.length}</span>
                    </div>
                </td>
            </tr>
        `;
        
        // Append all child table records mapping to the group key context
        htmlOutput += items.map(d => buildTableRowHtml(d)).join('');
    });

    containerElement.innerHTML = htmlOutput;
}

/**
 * Unified HTML String Component for consistent look across views
 */
function buildTableRowHtml(d) {
    const dateObj = new Date(d.date);
    const isPast = dateObj < new Date();
    
    const defendant = d.defendant_name || d.paper?.defendant_name || 'N/A';
    const caseTitle = d.case_title || d.paper?.case_name || '--';
    const stateCounty = d.location_name || d.paper?.location_name || 'Unknown';

    let badgeColor = 'bg-slate-100 text-slate-700';
    if (d.party === 'P') badgeColor = 'bg-red-100 text-red-700';
    else if (d.party === 'D') badgeColor = 'bg-blue-100 text-blue-700';
    else if (d.party?.includes('Court')) badgeColor = 'bg-amber-100 text-amber-700';

    const locationInfo = d.court_type ? `<span class="text-[10px] block text-slate-400 italic">${d.court_type}</span>` : '';
    const optionalTextSnippet = d.optional_text ? d.optional_text : (d.description || '--');
    const clickableLink = d.event_link ? `<a href="${d.event_link}" target="_blank" class="text-blue-500 hover:underline flex items-center gap-1"><i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i> Link</a>` : '<span class="text-slate-300">--</span>';

    return `
        <tr class="${isPast ? 'opacity-60' : ''} border-b border-slate-50 hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4">
                ${isPast 
                    ? '<span class="text-[10px] font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-500 uppercase">Past</span>' 
                    : '<span class="text-[10px] font-bold bg-green-100 px-2 py-0.5 rounded text-green-700 uppercase">Active</span>'}
            </td>
            <td class="px-6 py-4">
                <div class="text-sm font-bold text-slate-800">${defendant}</div>
                <div class="text-[10px] text-slate-400 font-medium tracking-tight">${caseTitle}</div>
            </td>
            <td class="px-6 py-4 text-xs font-bold text-slate-600 uppercase">
                ${stateCounty}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-bold ${isPast ? 'text-slate-400' : 'text-slate-800'}">${dateObj.toLocaleDateString()}</div>
                <div class="text-[10px] text-slate-400">${dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${badgeColor}">
                    ${d.party || 'N/A'}
                </span>
                ${locationInfo}
            </td>
            <td class="px-6 py-4 text-xs font-medium text-slate-600">
                ${d.type || 'Filing / Event Context'}
                <div class="mt-1">${clickableLink}</div>
            </td>
            <td class="px-6 py-4 text-xs text-slate-500 max-w-xs truncate" title="${optionalTextSnippet}">
                ${optionalTextSnippet}
            </td>
            <td class="px-6 py-4 text-right">
                <button onclick="openEditModal(${d.id})" class="text-slate-400 hover:text-blue-600 transition-colors p-2">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        </tr>
    `;
}

/**
 * Invoked Directly via Inline onclick triggers from filters
 */
function setGroupingMode(mode) {
    currentGroupingMode = mode;
    
    // Update Active Filter UI Button Highlights State Class Parameters
    const modes = ['default', 'case', 'defendant'];
    modes.forEach(m => {
        const btn = document.getElementById(`btn-group-${m}`);
        if (!btn) return;

        if (m === mode) {
            btn.className = "px-3.5 py-1.5 rounded-md text-xs font-bold transition-all bg-white text-slate-900 shadow-sm";
        } else {
            btn.className = "px-3.5 py-1.5 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all";
        }
    });

    renderDisplay();
}

/**
 * Handle Modal Operations Safely
 */
function openEditModal(id) {
    const item = activeDatesRegistry[id];
    if (!item) return;

    document.getElementById('edit-id').value = id;
    document.getElementById('edit-date').value = item.date ? item.date.substring(0, 16) : '';
    document.getElementById('edit-party').value = item.party || '';
    document.getElementById('edit-text').value = item.optional_text || item.description || '';
    document.getElementById('edit-court-type').value = item.court_type || '';
    document.getElementById('edit-defendant-name').value = item.defendant_name || item.paper?.defendant_name || '';
    document.getElementById('edit-case-name').value = item.case_title || item.paper?.case_name || '';
    document.getElementById('edit-paper-type').value = item.type || '';
    document.getElementById('edit-description').value = item.description || '';
    document.getElementById('edit-location-name').value = item.location_name || item.paper?.location_name || '';
    document.getElementById('edit-event-link').value = item.event_link || '';

    if (typeof toggleEditCourtType === 'function') toggleEditCourtType();

    const modal = document.getElementById('edit-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.getElementById('edit-modal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Intercept Data Submission
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;

    const payload = {
        date: document.getElementById('edit-date').value,
        party: document.getElementById('edit-party').value,
        optional_text: document.getElementById('edit-text').value,
        court_type: document.getElementById('edit-court-type').value,
        defendant_name: document.getElementById('edit-defendant-name').value,
        case_title: document.getElementById('edit-case-name').value,
        type: document.getElementById('edit-paper-type').value,
        description: document.getElementById('edit-description').value,
        location_name: document.getElementById('edit-location-name').value,
        event_link: document.getElementById('edit-event-link').value
    };

    try {
        const response = await authFetch(`/api/papers/dates/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            closeModal();
            fetchAllDates(document.getElementById('paper-search-input')?.value || '');
        } else {
            console.error("Failed to update date item parameters.");
        }
    } catch (err) {
        console.error(err);
    }
}