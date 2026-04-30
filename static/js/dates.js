

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

document.addEventListener('DOMContentLoaded', fetchAllDates);

async function fetchAllDates() {
    const body = document.getElementById('dates-table-body');
    if (!body) return;

    try {
        const response = await authFetch('/api/papers/dates/upcoming');
        const dates = await response.json();

        if (!Array.isArray(dates)) {
            console.error("Server error:", dates);
            body.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-red-500 italic">Error loading data. ${dates.detail || ''}</td></tr>`;
            return;
        }

        if (dates.length === 0) {
            body.innerHTML = `<tr><td colspan="8" class="p-12 text-center text-slate-400 italic text-sm">No deadlines currently scheduled.</td></tr>`;
            return;
        }

        body.innerHTML = dates.map(d => {
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

function openEditModal(id, date, party, text) {
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-date').value = date.slice(0, 16);
    document.getElementById('edit-party').value = party;
    document.getElementById('edit-text').value = text;
    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

document.getElementById('edit-date-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const payload = {
        date: document.getElementById('edit-date').value,
        party: document.getElementById('edit-party').value,
        optional_text: document.getElementById('edit-text').value
    };

    try {
        const response = await authFetch(`/api/papers/dates/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            closeModal();
            fetchAllDates();
        }
    } catch (err) { console.error(err); }
};