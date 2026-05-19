

/**
 * Papers.massfoia - Deadlines & Calendar Logic
 */

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
    fetchAllDates();
});

async function fetchAllDates(searchQuery = '') {
    const body = document.getElementById('dates-table-body');
    if (!body) return;

    try {
        // Append query to the upcoming dates endpoint
        let url = '/api/papers/dates/upcoming';
        if (searchQuery) url += `?q=${encodeURIComponent(searchQuery)}`;
        
        const response = await authFetch(url);
        const dates = await response.json();

        // if (!Array.isArray(dates)) {
        //     console.error("Server error:", dates);
        //     body.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-red-500 italic">Error loading data. ${dates.detail || ''}</td></tr>`;
        //     return;
        // }

        if (dates.length === 0) {
            body.innerHTML = `<tr><td colspan="8" class="p-12 text-center text-slate-400 italic text-sm">No deadlines found matching your search.</td></tr>`;
            return;
        }

        activeDatesRegistry = {};

        body.innerHTML = dates.map(d => {
            activeDatesRegistry[d.id] = d;

            const dateObj = new Date(d.date);
            const isPast = dateObj < new Date();
            
            // DATA MAPPING
            const defendant = d.paper?.defendant_name || 'N/A';
            const caseNo = d.paper?.case_name || '--';
            const stateCounty = d.paper?.location_name || 'Unknown'; // RESTORED logic

            let badgeColor = 'bg-slate-100 text-slate-700';
            if (d.party === 'P') badgeColor = 'bg-red-100 text-red-700';
            else if (d.party === 'D') badgeColor = 'bg-blue-100 text-blue-700';
            else if (d.party?.includes('Court')) badgeColor = 'bg-amber-100 text-amber-700';

            const locationInfo = d.court_type ? `<span class="text-[10px] block text-slate-400 italic">${d.court_type}</span>` : '';

            return `
                <tr class="${isPast ? 'opacity-60' : ''} border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <!-- Column 1: Status (Restored) -->
                    <td class="p-4">
                        ${isPast 
                            ? '<span class="text-[10px] font-bold text-slate-400 uppercase">Past</span>' 
                            : '<span class="text-[10px] font-bold text-green-600 uppercase">Upcoming</span>'}
                    </td>

                    <!-- Column 2: Linked Case/Defendant (Updated format) -->
                    <td class="p-4">
                        <div class="text-sm font-bold text-blue-600">${defendant}</div>
                        <div class="text-[10px] text-slate-400 font-mono">${caseNo}</div>
                    </td>

                    <!-- Column 3: State/County (Fixed mapping) -->
                    <td class="p-4 text-xs font-bold text-slate-600 uppercase">
                        ${stateCounty}
                    </td>

                    <!-- Column 4: Due Date -->
                    <td class="p-4">
                        <div class="text-sm font-bold ${isPast ? 'text-slate-400' : 'text-slate-800'}">${dateObj.toLocaleDateString()}</div>
                        <div class="text-[10px] text-slate-400">${dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </td>

                    <!-- Column 5: Party -->
                    <td class="p-4">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${badgeColor}">${d.party}</span>
                        ${locationInfo}
                    </td>

                    <!-- Column 6: Filing / Context -->
                    <td class="p-4 text-xs font-medium text-slate-600">
                        ${d.paper?.type || '--'}
                    </td>

                    <!-- Column 7: Description -->
                    <td class="p-4 text-xs text-slate-600 italic">
                        ${d.optional_text || ''}
                    </td>

                    <!-- Column 8: Edit Button -->
                    <td class="p-4 text-right">
                        <button onclick="openEditModal(${d.id}, '${d.date}', '${d.party}', '${(d.optional_text || "").replace(/'/g, "\\'")}')" class="text-slate-400 hover:text-blue-600">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        body.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-red-500">Could not connect to server.</td></tr>`;
    }
}

function openEditModal(id) {
    const dateInfo = activeDatesRegistry[id];
    if (!dateInfo) return;
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-date').value = dateInfo.date.slice(0, 16);
    document.getElementById('edit-party').value = dateInfo.party;
    document.getElementById('edit-text').value = dateInfo.optional_text || '';

    document.getElementById('edit-court-type').value = dateInfo.court_type || '';
    document.getElementById('edit-defendant-name').value = dateInfo.paper?.defendant_name || '';
    document.getElementById('edit-case-name').value = dateInfo.paper?.case_title || '';
    document.getElementById('edit-paper-type').value = dateInfo.paper?.type || '';
    document.getElementById('edit-description').value = dateInfo.paper?.description || '';
    document.getElementById('edit-location-name').value = dateInfo.paper?.location_name || '';
    document.getElementById('edit-event-link').value = dateInfo.paper?.event_link || '';

    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

if (document.getElementById('edit-date-form')) {
    document.getElementById('edit-date-form').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        
        // Assemble combined update payload mapping back to backend schema configurations
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
    };
}