/**
 * Papers.massfoia - Deadlines & Calendar Logic
 */

document.addEventListener('DOMContentLoaded', fetchAllDates);

// --- CORE DATA FETCHING ---

async function fetchAllDates() {
    const body = document.getElementById('dates-table-body');
    
    try {
        const response = await fetch('/api/dates');
        const dates = await response.json();
        
        if (dates.length === 0) {
            body.innerHTML = `<tr><td colspan="6" class="p-12 text-center text-slate-400 italic text-sm">No deadlines currently scheduled.</td></tr>`;
            return;
        }

        body.innerHTML = dates.map(d => {
            const dateObj = new Date(d.date);
            const isPast = dateObj < new Date();
            
            // Requirement #9: P is light red, D is light blue
            const partyRowColor = d.party === 'P' ? 'bg-red-50/50' : 'bg-blue-50/50';
            const badgeColor = d.party === 'P' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700';
            
            // Clean strings for the onclick function to prevent JS breaks
            const safeText = (d.optional_text || "").replace(/'/g, "\\'");

            return `
                <tr class="${partyRowColor} hover:bg-slate-100 transition-colors border-b border-slate-50 ${isPast ? 'opacity-50' : ''}">
                    <td class="px-6 py-4">
                        ${isPast 
                            ? '<span class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Past</span>' 
                            : '<span class="text-[10px] font-bold text-green-600 uppercase tracking-tighter">Upcoming</span>'}
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
                    </td>
                    <td class="px-6 py-4">
                        <div class="text-xs font-bold text-slate-700 uppercase tracking-tighter">
                            ${d.paper?.type || 'Filing'}
                        </div>
                        <div class="text-[10px] text-slate-400 truncate max-w-[180px]">
                            ${d.paper?.defendant_name || 'N/A'}
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="text-xs text-slate-600 font-medium italic">
                            "${d.optional_text || '--'}"
                        </div>
                    </td>
                    <td class="px-6 py-4 text-right">
                        <button 
                            onclick="openEditModal(${d.id}, '${d.date}', '${d.party}', '${safeText}')"
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
        body.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-red-400 font-bold">Failed to connect to papers.db</td></tr>`;
    }
}

// --- MODAL & EDIT LOGIC ---

function openEditModal(id, dateStr, party, text) {
    // Convert to local format YYYY-MM-DDTHH:MM for input[type="datetime-local"]
    const date = new Date(dateStr);
    const localISO = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    document.getElementById('edit-id').value = id;
    document.getElementById('edit-date').value = localISO;
    document.getElementById('edit-party').value = party;
    document.getElementById('edit-text').value = text;
    
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
        optional_text: document.getElementById('edit-text').value
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
window.onclick = function(event) {
    const modal = document.getElementById('edit-modal');
    if (event.target == modal) {
        closeModal();
    }
}