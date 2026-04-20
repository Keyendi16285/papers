/**
 * Papers.massfoia - Main Logic
 */

let selectedTarget = null;
let editingPaperId = null;

// 1. AUTH FETCH HELPER
async function authFetch(url, options = {}) {
    const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");

    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };

    const response = await fetch(url, options);

    if (response.status === 401) {
        sessionStorage.removeItem("access_token");
        localStorage.removeItem("access_token");
        window.location.replace(window.location.origin);
    }
    return response;
}

document.addEventListener('DOMContentLoaded', () => {

    // 2. SSO HANDSHAKE
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');

    if (tokenFromUrl) {
        sessionStorage.setItem("access_token", tokenFromUrl);
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
    }

    // 3. AUTHENTICATION CHECK
    (function verifyAccess() {
        const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
        if (!token) {
            const currentUrl = window.location.origin;
            const loginUrl = `https://casetracker.massfoia.com/login?redirect_url=${encodeURIComponent(currentUrl)}`;
            window.location.replace(loginUrl);
            throw new Error("Redirecting to login...");
        }
    })();

    // 4. INITIAL LOAD
    fetchPapers();
    addDateRow();

    // 5. SEARCH LOGIC
    const searchInput = document.getElementById('target-search');
    const resultsDiv = document.getElementById('search-results');

    if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
            const query = e.target.value;
            if (query.length < 2) {
                resultsDiv.classList.add('hidden');
                return;
            }

            try {
                const response = await authFetch(`/api/search/targets?q=${encodeURIComponent(query)}`);
                const targets = await response.json();

                if (targets && targets.length > 0) {
                    resultsDiv.innerHTML = targets.map(t => {
                        const name = t.name.replace(/'/g, "\\'");
                        const caseNo = (t.case_number || t.case_no || 'N/A').replace(/'/g, "\\'");

                        return `
                            <div class="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0" 
                                 onclick="selectTarget({id: ${t.id}, case_id: ${t.case_id}, name: '${name}', case_no: '${caseNo}'})">
                                <div class="text-sm font-bold text-slate-800">${t.name}</div>
                                <div class="text-[10px] text-slate-500 font-mono uppercase tracking-tight">${caseNo}</div>
                            </div>
                        `;
                    }).join('');
                    resultsDiv.classList.remove('hidden');
                } else {
                    resultsDiv.innerHTML = '<div class="p-3 text-xs text-slate-400 italic">No matches found.</div>';
                    resultsDiv.classList.remove('hidden');
                }
            } catch (err) {
                console.error("Search fetch failed:", err);
            }
        });
    }

    const paperForm = document.getElementById('paper-form');
    if (paperForm) paperForm.onsubmit = handleFormSubmit;
});

// --- SEARCH & SELECTION ---

function selectTarget(defendant) {
    const searchInput = document.getElementById('target-search');
    const displayCase = defendant.case_no || defendant.case_number || defendant.case_name || "N/A";

    searchInput.value = `${defendant.name} (${displayCase})`;

    window.selectedDefendantId = defendant.id;
    window.selectedCaseId = defendant.case_id;
    window.selectedCaseName = displayCase;
    window.selectedDefendantName = defendant.name;

    document.getElementById('search-results').classList.add('hidden');
}

// --- DYNAMIC DATE ROWS ---

function addDateRow(data = null) {
    const container = document.getElementById('date-rows-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = "flex flex-wrap md:flex-nowrap gap-3 items-end date-entry-row animate-in fade-in duration-300 mb-3";

    let dateVal = "";
    if (data && data.date) {
        // Fix: Ensure we handle various date formats and convert to YYYY-MM-DDTHH:mm
        try {
            const d = new Date(data.date);
            if (!isNaN(d.getTime())) {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                dateVal = `${year}-${month}-${day}T${hours}:${minutes}`;
            }
        } catch (e) {
            console.error("Date parsing error:", e);
        }
    }

    const isCourtCategory = data?.party === 'Court Hearing' || data?.party === 'Court Other';

    row.innerHTML = `
        <div class="w-full md:w-1/3">
            <input type="datetime-local" class="row-date w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500" 
                   value="${dateVal}">
        </div>
        <div class="w-full md:w-32">
            <select class="row-party w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none" 
                    onchange="toggleCourtColumn(this)">
                <option value="P" ${data?.party === 'P' ? 'selected' : ''}>P</option>
                <option value="D" ${data?.party === 'D' ? 'selected' : ''}>D</option>
                <option value="Court Hearing" ${data?.party === 'Court Hearing' ? 'selected' : ''}>Court Hearing</option>
                <option value="Court Other" ${data?.party === 'Court Other' ? 'selected' : ''}>Court Other</option>
            </select>
        </div>
        <div class="row-court-type-container ${isCourtCategory ? '' : 'hidden'} w-full md:w-32">
            <select class="row-court-type w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none">
                <option value="In Person" ${data?.court_type === 'In Person' ? 'selected' : ''}>In Person</option>
                <option value="Zoom" ${data?.court_type === 'Zoom' ? 'selected' : ''}>Zoom</option>
                <option value="Hybrid" ${data?.court_type === 'Hybrid' ? 'selected' : ''}>Hybrid</option>
                <option value="Clerk" ${data?.court_type === 'Clerk' ? 'selected' : ''}>Clerk</option>
                <option value="Unknown" ${data?.court_type === 'Unknown' ? 'selected' : ''}>Unknown</option>
            </select>
        </div>
        <div class="flex-grow">
            <input type="text" class="row-text w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none" 
                   placeholder="Description" 
                   value="${data?.optional_text || ''}">
        </div>
        <button type="button" onclick="this.parentElement.remove()" class="p-2 text-slate-300 hover:text-red-500 transition">
            <i class="fa-solid fa-trash-can"></i>
        </button>
    `;
    container.appendChild(row);
}

function toggleCourtColumn(selectElement) {
    const row = selectElement.closest('.date-entry-row');
    const courtContainer = row.querySelector('.row-court-type-container');
    const value = selectElement.value;

    if (value === 'Court Hearing' || value === 'Court Other') {
        courtContainer.classList.remove('hidden');
    } else {
        courtContainer.classList.add('hidden');
        // Optional: Reset court type value when hidden
        courtContainer.querySelector('.row-court-type').value = "In Person";
    }
}

// --- EDIT LOGIC ---

async function editPaper(paperId) {
    try {
        const response = await authFetch(`/api/papers/${paperId}`);
        if (!response.ok) throw new Error("Failed to fetch paper details");

        const paper = await response.json();
        editingPaperId = paperId;

        // Populate basic fields
        document.getElementById('paper-type').value = paper.type;
        document.getElementById('paper-desc').value = paper.description || '';

        const searchInput = document.getElementById('target-search');
        searchInput.value = `${paper.defendant_name} (${paper.case_name})`;

        // Update global selection variables
        window.selectedDefendantId = paper.defendant_id;
        window.selectedCaseId = paper.case_id;
        window.selectedCaseName = paper.case_name;
        window.selectedDefendantName = paper.defendant_name;

        // Clear container and repopulate dates
        const container = document.getElementById('date-rows-container');
        container.innerHTML = '';

        if (paper.dates && paper.dates.length > 0) {
            paper.dates.forEach(d => {
                addDateRow(d);
            });
        } else {
            addDateRow(); // Add one blank row if no dates exist
        }

        // Change button text and scroll
        document.getElementById('cancel-edit-btn').classList.remove('hidden');
        const submitBtn = document.querySelector('#paper-form button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Update Filing & Dates';
        document.getElementById('paper-form').scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
        console.error("Edit Error:", err);
    }
}

// --- API ACTIONS ---

async function handleFormSubmit(e) {
    e.preventDefault();

    if (!window.selectedDefendantId) {
        alert("Please select a defendant from the search list first.");
        return;
    }

    const dateRows = document.querySelectorAll('.date-entry-row');
    const dates = Array.from(dateRows).map(row => {
        const dateInput = row.querySelector('.row-date');
        const partySelect = row.querySelector('.row-party');
        const courtTypeSelect = row.querySelector('.row-court-type');
        return {
            date: dateInput ? dateInput.value : "",
            party: partySelect.value,
            court_type: partySelect.value.includes('Court') ? courtTypeSelect.value : null,
            optional_text: row.querySelector('.row-text').value
        };
    }).filter(d => d.date !== "");

    const payload = {
        case_id: window.selectedCaseId,
        defendant_id: window.selectedDefendantId,
        case_name: window.selectedCaseName,
        defendant_name: window.selectedDefendantName,
        type: document.getElementById('paper-type').value,
        description: document.getElementById('paper-desc').value,
        dates: dates
    };

    const url = editingPaperId ? `/api/papers/${editingPaperId}` : '/api/papers';
    const method = editingPaperId ? 'PATCH' : 'POST';

    try {
        const response = await authFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            // INSTEAD OF location.reload():
            // Use the resetForm function to clear the UI state and hide the cancel button
            resetForm();

            // Re-fetch the table data so the UI updates immediately
            fetchPapers();

            // Optional: small notification or scroll
            console.log("Filing saved successfully");
        } else {
            const err = await response.json();
            alert("Error: " + (err.detail || "Failed to save"));
        }
    } catch (err) {
        console.error("Submit failed:", err);
    }
}

async function fetchPapers(filter = 'upcoming') {
    const container = document.getElementById('active-docket-body');
    if (!container) return;

    // Handle button styles
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'shadow-sm', 'text-blue-600');
        if (btn.textContent.trim().toLowerCase() === filter.toLowerCase()) {
            btn.classList.add('bg-white', 'shadow-sm', 'text-blue-600');
        }
    });

    try {
        const response = await authFetch(`/api/papers?filter=${filter}`);
        const papers = await response.json();

        if (papers.length === 0) {
            container.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400 italic">No ${filter} filings found.</td></tr>`;
            return;
        }

        // Replace the mapping logic in fetchPapers with this fixed-width version
        container.innerHTML = papers.map(paper => {
            let nearestDateStr = 'No dates set';
            if (paper.dates && paper.dates.length > 0) {
                // Sort to find the actual nearest date
                const sortedDates = [...paper.dates].sort((a, b) => new Date(a.date) - new Date(b.date));
                const d = new Date(sortedDates[0].date);
                nearestDateStr = d.toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                });
            }

            return `
                <tr class="border-b border-slate-50 hover:bg-slate-50/30 transition-all">
                    <td class="p-4 align-top w-[25%]">
                        <div class="text-[14px] font-bold text-slate-700 leading-tight">${paper.type}</div>
                        <div class="text-[12px] text-slate-400 mt-0.5 line-clamp-1" title="${paper.description}">
                            ${paper.description || 'No notes'}
                        </div>
                    </td>

                    <td class="p-4 align-top w-[25%]">
                        <div class="text-[14px] font-bold text-blue-600 leading-tight truncate">${paper.defendant_name}</div>
                        <div class="mt-1">
                            <span class="bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded font-mono uppercase tracking-tighter">
                                ${paper.case_name || 'N/A'}
                            </span>
                        </div>
                    </td>

                    <td class="p-4 align-top w-[20%]">
                        <div class="text-[13px] font-bold text-slate-600 leading-none">${nearestDateStr}</div>
                        <div class="text-[10px] text-slate-400 font-medium uppercase mt-1 tracking-tight">NEAREST EVENT</div>
                    </td>

                    <td class="p-4 align-top w-[20%]">
                        <div class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-600">
                            ${paper.dates?.length || 0} Deadlines
                        </div>
                    </td>

                    <td class="p-4 text-right align-top w-[10%]">
                        <button onclick="editPaper(${paper.id})" class="text-slate-300 hover:text-blue-500 transition-colors">
                            <i class="fa-solid fa-pen-to-square text-[14px]"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Docket Load Error:", err);
        container.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-red-500">Failed to load docket data.</td></tr>';
    }
}

function resetForm() {
    // 1. Reset the edit state
    editingPaperId = null;
    window.selectedDefendantId = null;
    window.selectedCaseId = null;
    window.selectedCaseName = null;
    window.selectedDefendantName = null;

    // 2. Clear the form fields
    const paperForm = document.getElementById('paper-form');
    if (paperForm) paperForm.reset();

    // 3. Clear dynamic date rows and add one fresh row
    const container = document.getElementById('date-rows-container');
    if (container) {
        container.innerHTML = '';
        addDateRow();
    }

    // 4. Restore the buttons
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    const submitBtn = document.querySelector('#paper-form button[type="submit"]');
    submitBtn.innerHTML = 'Save Filing & Dates';
}

function handleLogout() {
    sessionStorage.removeItem("access_token");
    localStorage.removeItem("access_token");
    window.location.replace("https://casetracker.massfoia.com/logout?next=login");
}