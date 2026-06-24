/**
 * Papers.massfoia - Travel Page Logistics Controller
 */

// Isolated In-Memory State for the Travel Docket
let cachedTravelPapers = [];
let currentTravelGroupingMode = 'default'; // Supports: 'default', 'case', 'defendant'

document.addEventListener('DOMContentLoaded', () => {
    // Active Search Binding for Travel Input
    const travelSearchInput = document.getElementById('travel-search-input');
    if (travelSearchInput) {
        travelSearchInput.addEventListener('input', (e) => {
            loadTravelDocket(e.target.value);
        });
    }

    // Initial load execution specifically targeting the travel canvas container
    if (document.getElementById('travel-docket-body')) {
        loadTravelDocket();
    }
});

/**
 * Fetch filtered 'In-person' records from the dedicated travel API
 */
async function loadTravelDocket(searchQuery = '') {
    const tableBody = document.getElementById('travel-docket-body');
    if (!tableBody) return;

    try {
        let url = '/api/travel';
        if (searchQuery) url += `?q=${encodeURIComponent(searchQuery)}`;

        // Uses the globally available authFetch wrapper from auth.js
        const response = await authFetch(url);
        if (!response.ok) throw new Error("Failed to load travel itineraries.");

        cachedTravelPapers = await response.json();
        if (!Array.isArray(cachedTravelPapers)) {
            cachedTravelPapers = [];
        }

        renderTravelDisplay();
    } catch (err) {
        console.error("Travel layout engine error:", err);
        tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-12 text-center text-red-500 font-medium text-sm">Failed to retrieve travel matrix data.</td></tr>`;
    }
}

/**
 * Directs cached data states to chosen layout algorithms
 */
function renderTravelDisplay() {
    const tableBody = document.getElementById('travel-docket-body');
    if (!tableBody) return;

    if (cachedTravelPapers.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-12 text-center text-slate-400 italic text-sm">No upcoming in-person appearances scheduled.</td></tr>`;
        return;
    }

    if (currentTravelGroupingMode === 'case') {
        renderGroupedTravelDashboard(tableBody, 'case_name');
    } else if (currentTravelGroupingMode === 'defendant') {
        renderGroupedTravelDashboard(tableBody, 'defendant_name');
    } else {
        renderDefaultTravelDashboard(tableBody);
    }
}

/**
 * Standard View Layout
 */
function renderDefaultTravelDashboard(container) {
    container.innerHTML = cachedTravelPapers.map(paper => buildTravelRowHtml(paper)).join('');
}

/**
 * Sub-grouped Card View Layout
 */
function renderGroupedTravelDashboard(container, groupKeyField) {
    const groups = {};

    cachedTravelPapers.forEach(paper => {
        let key = 'Unassigned';
        if (groupKeyField === 'case_name') {
            key = paper.case_name || 'No Associated Case Context';
        } else if (groupKeyField === 'defendant_name') {
            key = paper.defendant_name || 'No Linked Defendant Identity';
        }

        if (!groups[key]) groups[key] = [];
        groups[key].push(paper);
    });

    let html = '';
    Object.keys(groups).forEach(groupTitle => {
        const items = groups[groupTitle];

        html += `
            <tr class="bg-slate-100/90 border-y border-slate-200">
                <td colspan="6" class="px-6 py-3.5">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid ${groupKeyField === 'case_name' ? 'fa-folder-tree text-blue-500' : 'fa-users-rectangle text-indigo-500'} text-xs"></i>
                        <span class="text-xs font-black tracking-tight text-slate-700 uppercase">${groupTitle}</span>
                        <span class="ml-1 bg-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-600">${items.length} records</span>
                    </div>
                </td>
            </tr>
        `;

        html += items.map(paper => buildTravelRowHtml(paper)).join('');
    });

    container.innerHTML = html;
}

/**
 * Component Row Builder for Travel Matrix Row Items
 */
function buildTravelRowHtml(paper) {
    let nearestDateStr = '<span class="text-slate-400 italic">No scheduled entries</span>';
    if (paper.nearest_date) {
        const dObj = new Date(paper.nearest_date);
        nearestDateStr = `
            <div class="text-sm font-bold text-slate-800">${dObj.toLocaleDateString()}</div>
            <div class="text-[10px] text-slate-400">${dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        `;
    }

    const parsedContextHtml = (() => {
        const sourceLink = paper.dates?.source_link || paper.source_link || '';
        const eventLink = paper.dates?.event_link || paper.event_link || '';

        let filingReplacement = 'Filing';
        if (sourceLink) {
            filingReplacement = `<a href="${sourceLink}" target="_blank" class="text-blue-500 hover:underline inline-flex items-center gap-0.5"><i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>Filing</a>`;
        }

        let eventReplacement = 'Event';
        if (eventLink) {
            eventReplacement = `<a href="${eventLink}" target="_blank" class="text-blue-500 hover:underline inline-flex items-center gap-0.5"><i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>Event</a>`;
        }

        let finalOutput = 'Filing / Event';
        if (sourceLink) finalOutput = finalOutput.replace(/Filing/g, filingReplacement);
        if (eventLink) finalOutput = finalOutput.replace(/Event/g, eventReplacement);

        return finalOutput;
    })();

        return `
        <tr class="border-b border-slate-50 hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex flex-col items-start gap-1">
                    <span class="px-2.5 py-1 rounded text-xs font-bold bg-amber-100 text-amber-800 tracking-wide uppercase">
                        In-Person
                    </span>
                    <span class="text-[11px] font-medium text-slate-500">
                        ${paper.location_name || 'Unknown Location'}
                    </span>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm font-bold text-slate-800">${paper.defendant_name || 'N/A'}</div>
                <div class="text-[10px] text-slate-400 font-semibold tracking-tight">${paper.case_name || '--'}</div>
            </td>
            <td class="px-6 py-4 text-center whitespace-nowrap">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${paper.party === 'P' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}">
                    ${paper.party || 'D'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                ${nearestDateStr}
            </td>
            <td class="px-6 py-4 text-center whitespace-nowrap text-xs font-bold text-slate-500">
                ${paper.date_count || 0}
            </td>
            <td class="px-6 py-4 text-xs font-medium text-slate-600">
                ${parsedContextHtml}
            </td>
            <td class="px-6 py-4 text-right whitespace-nowrap">
                <!-- Uses globally exposed viewPaperDetails from main.js -->
                <button onclick="redirectToEditDate(${paper.id})" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition font-medium">
                    Edit Event
                </button>
            </td>
        </tr>
    `;
    }

/**
 * Separate Dynamic Filtering Toggle Function specifically mapped for travel.html elements
 */
function setTravelGroupingMode(mode) {
        currentTravelGroupingMode = mode;

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

        renderTravelDisplay();
    }

    function redirectToEditDate(dateId) {
        if (!dateId) {
            console.error("Cannot redirect: Missing date ID context.");
            return;
        }
        // Store the ID in localStorage so dates.html can read it upon loading
        localStorage.setItem('pendingEditDateId', dateId);
        // Redirect the browser to the upcoming dates page
        window.location.href = '/dates';
    }