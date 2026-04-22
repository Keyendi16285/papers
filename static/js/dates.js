/**
 * Papers.massfoia - Deadlines & Calendar Logic
 */

document.addEventListener('DOMContentLoaded', fetchAllDates);

// --- CORE DATA FETCHING ---

// async function fetchAllDates() {
//     const body = document.getElementById('dates-table-body');

//     try {
//         const response = await fetch('/api/dates');
//         const dates = await response.json();

//         if (dates.length === 0) {
//             body.innerHTML = `<tr><td colspan="6" class="p-12 text-center text-slate-400 italic text-sm">No deadlines currently scheduled.</td></tr>`;
//             return;
//         }

//         body.innerHTML = dates.map(d => {
//             const dateObj = new Date(d.date);
//             const isPast = dateObj < new Date();

//             let badgeColor = 'bg-slate-100 text-slate-700';
//             let partyRowColor = 'bg-white';

//             if (d.party === 'P') {
//                 badgeColor = 'bg-red-100 text-red-700';
//                 partyRowColor = 'bg-red-50/50';
//             } else if (d.party === 'D') {
//                 badgeColor = 'bg-blue-100 text-blue-700';
//                 partyRowColor = 'bg-blue-50/50';
//             } else if (d.party.includes('Court')) {
//                 badgeColor = 'bg-purple-100 text-purple-700';
//                 partyRowColor = 'bg-purple-50/50';
//             }

//             const locationInfo = d.court_type ? `<span class="text-[10px] block text-slate-400 italic">${d.court_type}</span>` : '';
//             const safeText = (d.optional_text || "").replace(/'/g, "\\'");
//             // Ensure court_type is passed safely to the modal
//             const safeCourtType = (d.court_type || "").replace(/'/g, "\\'");

//             return `
//                 <tr class="${partyRowColor} hover:bg-slate-100 transition-colors border-b border-slate-50 ${isPast ? 'opacity-50' : ''}">
//                     <td class="px-6 py-4">
//                         ${isPast
//                             ? '<span class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Past</span>'
//                             : '<span class="text-[10px] font-bold text-green-600 uppercase tracking-tighter">Upcoming</span>'}
//                     </td>
//                     <td class="px-6 py-4">
//                         <div class="text-sm font-mono font-bold text-slate-800">
//                             ${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
//                         </div>
//                         <div class="text-[10px] text-slate-400 font-medium">
//                             ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
//                         </div>
//                     </td>
//                     <td class="px-6 py-4">
//                         <span class="px-3 py-1 rounded-full text-[10px] font-black border border-slate-200 ${badgeColor}">
//                             ${d.party}
//                         </span>
//                         ${locationInfo}
//                     </td>
//                     <td class="px-6 py-4">
//                         <div class="text-xs font-bold text-slate-700 uppercase tracking-tighter">
//                             ${d.paper?.type || 'Filing'}
//                         </div>
//                         <div class="text-[10px] text-slate-400 truncate max-w-[180px]">
//                             ${d.paper?.defendant_name || 'N/A'}
//                         </div>
//                     </td>
//                     <td class="px-6 py-4">
//                         <div class="text-xs text-slate-600 font-medium italic">
//                             "${d.optional_text || '--'}"
//                         </div>
//                     </td>
//                     <td class="px-6 py-4 text-right">
//                         <button 
//                             onclick="openEditModal(${d.id}, '${d.date}', '${d.party}', '${safeText}', '${safeCourtType}')"
//                             class="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all"
//                         >
//                             <i class="fa-solid fa-pen-to-square"></i>
//                         </button>
//                     </td>
//                 </tr>
//             `;
//         }).join('');

//     } catch (err) {
//         console.error("Error fetching dates:", err);
//         body.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-red-400 font-bold">Failed to connect to papers.db</td></tr>`;
//     }
// }

async function fetchAllDates() {
    const body = document.getElementById('dates-table-body');

    try {
        const response = await fetch('/api/dates');
        const dates = await response.json();

        if (dates.length === 0) {
            body.innerHTML = `<tr><td colspan="8" class="p-12 text-center text-slate-400 italic text-sm">No deadlines currently scheduled.</td></tr>`;
            return;
        }

        body.innerHTML = dates.map(d => {
            const dateObj = new Date(d.date);
            const isPast = dateObj < new Date();

            // DATA MAPPING
            // defendant_name and case_name (title) from the parent paper
            const defendant = d.paper?.defendant_name || 'N/A';
            const caseTitle = d.paper?.case_name || '--';
            
            // This pulls the NEW location_name field we are fetching from Case Tracker
            const stateCounty = d.paper?.location_name || 'Unknown';

            let badgeColor = 'bg-slate-100 text-slate-700';
            let partyRowColor = 'bg-white';

            if (d.party === 'P') {
                badgeColor = 'bg-red-100 text-red-700';
                partyRowColor = 'bg-red-50/50';
            } else if (d.party === 'D') {
                badgeColor = 'bg-blue-100 text-blue-700';
                partyRowColor = 'bg-blue-50/50';
            } else if (d.party.includes('Court')) {
                badgeColor = 'bg-purple-100 text-purple-700';
                partyRowColor = 'bg-purple-50/50';
            }

            const locationInfo = d.court_type ? `<span class="text-[10px] block text-slate-400 italic">${d.court_type}</span>` : '';
            const safeText = (d.optional_text || "").replace(/'/g, "\\'");
            const safeCourtType = (d.court_type || "").replace(/'/g, "\\'");

            return `
                <tr class="${partyRowColor} hover:bg-slate-100 transition-colors border-b border-slate-50 ${isPast ? 'opacity-50' : ''}">
                    <td class="px-6 py-4">
                        ${isPast
                            ? '<span class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Past</span>'
                            : '<span class="text-[10px] font-bold text-green-600 uppercase tracking-tighter">Upcoming</span>'}
                    </td>

                    <td class="px-6 py-4">
                        <div class="text-sm font-bold text-blue-600">${defendant}</div>
                        <div class="text-[10px] text-slate-400 font-mono tracking-tighter">${caseTitle}</div>
                    </td>

                    <td class="px-6 py-4">
                        <div class="text-xs font-bold text-slate-600 uppercase tracking-tight">
                            ${stateCounty}
                        </div>
                    </td>

                    <td class="px-6 py-4">
                        <div class="text-sm font-mono font-bold text-slate-800">
                            ${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div class="text-[10px] text-slate-400 font-medium">
                            ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <span class="px-3 py-1 rounded-full text-[10px] font-black border border-slate-200 ${badgeColor}">
                            ${d.party}
                        </span>
                        ${locationInfo}
                    </td>
                    <td class="px-6 py-4">
                        <div class="text-xs font-bold text-slate-700 uppercase tracking-tighter">
                            ${d.paper?.type || 'Filing'}
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="text-xs text-slate-600 font-medium italic truncate max-w-[150px]">
                            "${d.optional_text || '--'}"
                        </div>
                    </td>
                    <td class="px-6 py-4 text-right">
                        <button 
                            onclick="openEditModal(${d.id}, '${d.date}', '${d.party}', '${safeText}', '${safeCourtType}')"
                            class="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all"
                        >
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Error fetching dates:", err);
        body.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-red-400 font-bold">Failed to connect to papers.db</td></tr>`;
    }
}

// --- MODAL & EDIT LOGIC ---

function openEditModal(id, dateStr, party, text, courtType = null) {
    // Convert to local format YYYY-MM-DDTHH:MM for input[type="datetime-local"]
    const date = new Date(dateStr);
    const localISO = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    document.getElementById('edit-id').value = id;
    document.getElementById('edit-date').value = localISO;
    document.getElementById('edit-party').value = party;
    document.getElementById('edit-text').value = text;

    // Set the court type value if it exists
    const courtTypeField = document.getElementById('edit-court-type');
    if (courtTypeField) {
        courtTypeField.value = courtType || "";
        // Show/Hide logic: only show if party includes 'Court'
        const container = document.getElementById('court-type-container'); 
        if (container) {
            container.classList.toggle('hidden', !party.includes('Court'));
        }
    }

    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

// Handle Update Submission
document.getElementById('edit-date-form').onsubmit = async (e) => {
    e.preventDefault();

    const id = document.getElementById('edit-id').value;
    const payload = {
        date: document.getElementById('edit-date').value,
        party: document.getElementById('edit-party').value,
        optional_text: document.getElementById('edit-text').value,
        court_type: document.getElementById('edit-court-type') ? document.getElementById('edit-court-type').value : null
    };

    try {
        const response = await fetch(`/api/papers/dates/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            closeModal();
            fetchAllDates(); // Refresh the table automatically
        } else {
            const err = await response.json();
            alert("Update Failed: " + (err.detail || "Unknown error"));
        }
    } catch (err) {
        console.error("Critical error during update:", err);
        alert("Could not reach the server.");
    }
};

// Close modal if user clicks outside the box
window.onclick = function (event) {
    const modal = document.getElementById('edit-modal');
    if (event.target == modal) {
        closeModal();
    }
}