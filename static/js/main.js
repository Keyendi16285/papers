// /**
//  * Papers.massfoia - Main Logic
//  */

// let selectedTarget = null;

// // 1. AUTH FETCH HELPER (Moved outside to be globally accessible)
// async function authFetch(url, options = {}) {
//     // Pull token fresh from storage on every call
//     const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
    
//     options.headers = {
//         ...options.headers,
//         'Authorization': `Bearer ${token}`
//     };
    
//     const response = await fetch(url, options);
    
//     if (response.status === 401) {
//         sessionStorage.removeItem("access_token");
//         localStorage.removeItem("access_token");
//         window.location.replace(window.location.origin); // Hard reset to trigger login redirect
//     }
//     return response;
// }

// document.addEventListener('DOMContentLoaded', () => {

// // 2. CAPTURE TOKEN FROM URL (SSO Handshake)
//     const urlParams = new URLSearchParams(window.location.search);
//     const tokenFromUrl = urlParams.get('token');

//     if (tokenFromUrl) {
//         sessionStorage.setItem("access_token", tokenFromUrl);
//         // Clean URL so the token doesn't stay in the address bar
//         const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
//         window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
//     }

//     // 3. TIGHTENED AUTHENTICATION CHECK
//     (function verifyAccess() {
//         const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");

//         if (!token) {
//             const currentUrl = window.location.origin;
//             // NOTE: Ensure CaseTracker expects "redirect_url". If it expects "redirect", change it here.
//             const loginUrl = `https://casetracker.massfoia.com/login?redirect_url=${encodeURIComponent(currentUrl)}`;

//             window.location.replace(loginUrl);
//             throw new Error("Redirecting to login...");
//         }
//     })();

//     // Initial load
//     fetchPapers();
//     addDateRow();

//     // Setup Search Logic
//     const searchInput = document.getElementById('target-search');
//     const resultsDiv = document.getElementById('search-results');

//     searchInput.addEventListener('input', async (e) => {
//         const query = e.target.value;
//         if (query.length < 2) {
//             resultsDiv.classList.add('hidden');
//             return;
//         }

//         try {
//             const response = await authFetch(`/api/search/targets?q=${encodeURIComponent(query)}`);
//             const targets = await response.json();

//             if (targets && targets.length > 0) {
//                 // FIXED: Removed all spaces in tags and improved quote handling for JSON
//                 resultsDiv.innerHTML = targets.map(t => {
//                     const name = t.name.replace(/'/g, "\\'"); // Escape single quotes for the name
//                     const caseNo = (t.case_number || t.case_no || 'N/A').replace(/'/g, "\\'");

//                     return `
//                         <div class="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0" 
//                              onclick="selectTarget({id: ${t.id}, case_id: ${t.case_id}, name: '${name}', case_no: '${caseNo}'})">
//                             <div class="text-sm font-bold text-slate-800">${t.name}</div>
//                             <div class="text-[10px] text-slate-500 font-mono uppercase tracking-tight">${t.case_number || t.case_no || 'N/A'}</div>
//                         </div>
//                     `;
//                 }).join('');
//                 resultsDiv.classList.remove('hidden');
//             } else {
//                 resultsDiv.innerHTML = '<div class="p-3 text-xs text-slate-400 italic">No matches found.</div>';
//                 resultsDiv.classList.remove('hidden');
//             }
//         } catch (err) {
//             console.error("Search fetch failed:", err);
//         }
//     });

//     // Handle Form Submission
//     document.getElementById('paper-form').onsubmit = handleFormSubmit;
// });

// // --- SEARCH & SELECTION ---

// function selectTarget(defendant) {
//     const searchInput = document.getElementById('target-search');
//     const displayCase = defendant.case_no || "N/A";

//     // Update the search bar text
//     searchInput.value = `${defendant.name} (${displayCase})`;

//     // Store the selection in window scope for the form submission
//     window.selectedDefendantId = defendant.id;
//     window.selectedCaseId = defendant.case_id;
//     window.selectedCaseName = displayCase;
//     window.selectedDefendantName = defendant.name;

//     // Hide results
//     document.getElementById('search-results').classList.add('hidden');
// }

// // --- DYNAMIC DATE ROWS ---

// function addDateRow() {
//     const container = document.getElementById('date-rows-container');
//     const row = document.createElement('div');
//     row.className = "flex flex-wrap md:flex-nowrap gap-3 items-end date-entry-row animate-in fade-in duration-300";

//     row.innerHTML = `
//         <div class="w-full md:w-1/3">
//             <input type="datetime-local" class="row-date w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500">
//         </div>
//         <div class="w-full md:w-20">
//             <select class="row-party w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none">
//                 <option value="P">P</option>
//                 <option value="D">D</option>
//             </select>
//         </div>
//         <div class="flex-grow">
//             <input type="text" class="row-text w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none" placeholder="Description">
//         </div>
//         <button type="button" onclick="this.parentElement.remove()" class="p-2 text-slate-300 hover:text-red-500 transition">
//             <i class="fa-solid fa-trash-can"></i>
//         </button>
//     `;
//     container.appendChild(row);
// }

// // --- API ACTIONS ---

// async function handleFormSubmit(e) {
//     e.preventDefault();

//     const typeEl = document.getElementById('paper-type');
//     const descEl = document.getElementById('paper-desc');

//     if (!typeEl || !descEl) {
//         console.error("Missing elements:", { typeEl, descEl });
//         return;
//     }

//     if (!window.selectedDefendantId) {
//         alert("Please select a defendant from the search list first.");
//         return;
//     }

//     const dateRows = document.querySelectorAll('.date-entry-row');
//     const dates = Array.from(dateRows).map(row => {
//         const dateInput = row.querySelector('.row-date');
//         return {
//             date: dateInput ? dateInput.value : "",
//             party: row.querySelector('.row-party').value,
//             optional_text: row.querySelector('.row-text').value
//         };
//     }).filter(d => d.date !== "");

//     const payload = {
//         case_id: window.selectedCaseId,
//         defendant_id: window.selectedDefendantId,
//         case_name: window.selectedCaseName,
//         defendant_name: window.selectedDefendantName,
//         type: typeEl.value,
//         description: descEl.value,
//         dates: dates
//     };

//     try {
//         const response = await authFetch('/api/papers', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify(payload)
//         });

//         if (response.ok) {
//             location.reload();
//         } else {
//             const err = await response.json();
//             alert("Error: " + JSON.stringify(err.detail));
//         }
//     } catch (err) {
//         console.error("Submit failed:", err);
//     }
// }

// async function fetchPapers(filter = 'upcoming') {
//     const container = document.getElementById('active-docket-body');
//     if (!container) return;

//     // Update button visual states
//     document.querySelectorAll('.filter-btn').forEach(btn => {
//         btn.classList.remove('bg-white', 'shadow-sm', 'text-blue-600');
//         if (btn.innerText.toLowerCase() === filter) {
//             btn.classList.add('bg-white', 'shadow-sm', 'text-blue-600');
//         }
//     });

//     try {
//         // We pass the filter as a query parameter to your API
//         const response = await authFetch(`/api/papers?filter=${filter}`);
//         if (!response.ok) throw new Error('Failed to fetch');

//         const papers = await response.json();

//         if (papers.length === 0) {
//             container.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400 italic">No ${filter} filings found.</td></tr>`;
//             return;
//         }

//         container.innerHTML = papers.map(paper => {
//             let nearestDateStr = 'No dates set';
//             if (paper.dates && paper.dates.length > 0) {
//                 const d = new Date(paper.dates[0].date);
//                 nearestDateStr = d.toLocaleDateString('en-US', {
//                     month: 'short',
//                     day: 'numeric',
//                     year: 'numeric'
//                 });
//             }

//             return `
//                 <tr class="border-b border-slate-100 hover:bg-slate-50/50 transition-all">
//                     <td class="col-type p-4">
//                         <div class="docket-title font-semibold text-slate-800">${paper.type}</div>
//                         <div class="docket-subtext text-xs text-slate-500 truncate" title="${paper.description}">${paper.description || 'No notes'}</div>
//                     </td>
//                     <td class="col-target p-4">
//                         <div class="docket-title text-blue-700 font-semibold">${paper.defendant_name}</div>
//                         <span class="case-pill bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-mono uppercase">${paper.case_name || 'N/A'}</span>
//                     </td>
//                     <td class="col-event p-4">
//                         <div class="text-sm font-medium text-slate-600">${nearestDateStr}</div>
//                         <div class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Nearest Event</div>
//                     </td>
//                     <td class="col-count p-4">
//                         <div class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
//                             ${paper.dates?.length || 0} Deadlines
//                         </div>
//                     </td>
//                     <td class="col-action p-4 text-right">
//                         <button class="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
//                             <i class="fas fa-external-link-alt text-xs"></i>
//                         </button>
//                     </td>
//                 </tr>
//             `;
//         }).join('');

//     } catch (err) {
//         console.error("Docket Load Error:", err);
//         container.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-red-500">Failed to load docket data.</td></tr>';
//     }
// }

/**
 * Papers.massfoia - Main Logic
 */

let selectedTarget = null;

// 1. AUTH FETCH HELPER (Moved outside to be globally accessible)
async function authFetch(url, options = {}) {
    // Pull token fresh from storage on every call
    const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
    
    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };
    
    const response = await fetch(url, options);
    
    if (response.status === 401) {
        sessionStorage.removeItem("access_token");
        localStorage.removeItem("access_token");
        window.location.replace(window.location.origin); // Hard reset to trigger login redirect
    }
    return response;
}

document.addEventListener('DOMContentLoaded', () => {

    // 2. CAPTURE TOKEN FROM URL (SSO Handshake)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');

    if (tokenFromUrl) {
        sessionStorage.setItem("access_token", tokenFromUrl);
        // Clean URL so the token doesn't stay in the address bar
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
    }

    // 3. TIGHTENED AUTHENTICATION CHECK
    (function verifyAccess() {
        const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");

        if (!token) {
            const currentUrl = window.location.origin;
            // NOTE: Ensure CaseTracker expects "redirect_url". If it expects "redirect", change it here.
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
                                <div class="text-[10px] text-slate-500 font-mono uppercase tracking-tight">${t.case_number || t.case_no || 'N/A'}</div>
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
    const displayCase = defendant.case_no || "N/A";

    searchInput.value = `${defendant.name} (${displayCase})`;

    window.selectedDefendantId = defendant.id;
    window.selectedCaseId = defendant.case_id;
    window.selectedCaseName = displayCase;
    window.selectedDefendantName = defendant.name;

    document.getElementById('search-results').classList.add('hidden');
}

// --- DYNAMIC DATE ROWS ---

function addDateRow() {
    const container = document.getElementById('date-rows-container');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = "flex flex-wrap md:flex-nowrap gap-3 items-end date-entry-row animate-in fade-in duration-300";

    row.innerHTML = `
        <div class="w-full md:w-1/3">
            <input type="datetime-local" class="row-date w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <div class="w-full md:w-20">
            <select class="row-party w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none">
                <option value="P">P</option>
                <option value="D">D</option>
            </select>
        </div>
        <div class="flex-grow">
            <input type="text" class="row-text w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none" placeholder="Description">
        </div>
        <button type="button" onclick="this.parentElement.remove()" class="p-2 text-slate-300 hover:text-red-500 transition">
            <i class="fa-solid fa-trash-can"></i>
        </button>
    `;
    container.appendChild(row);
}

// --- API ACTIONS ---

async function handleFormSubmit(e) {
    e.preventDefault();

    const typeEl = document.getElementById('paper-type');
    const descEl = document.getElementById('paper-desc');

    if (!window.selectedDefendantId) {
        alert("Please select a defendant from the search list first.");
        return;
    }

    const dateRows = document.querySelectorAll('.date-entry-row');
    const dates = Array.from(dateRows).map(row => {
        const dateInput = row.querySelector('.row-date');
        return {
            date: dateInput ? dateInput.value : "",
            party: row.querySelector('.row-party').value,
            optional_text: row.querySelector('.row-text').value
        };
    }).filter(d => d.date !== "");

    const payload = {
        case_id: window.selectedCaseId,
        defendant_id: window.selectedDefendantId,
        case_name: window.selectedCaseName,
        defendant_name: window.selectedDefendantName,
        type: typeEl.value,
        description: descEl.value,
        dates: dates
    };

    try {
        const response = await authFetch('/api/papers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            location.reload();
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

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'shadow-sm', 'text-blue-600');
        if (btn.innerText.toLowerCase() === filter) {
            btn.classList.add('bg-white', 'shadow-sm', 'text-blue-600');
        }
    });

    try {
        const response = await authFetch(`/api/papers?filter=${filter}`);
        if (!response.ok) throw new Error('Failed to fetch');

        const papers = await response.json();

        if (papers.length === 0) {
            container.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400 italic">No ${filter} filings found.</td></tr>`;
            return;
        }

        container.innerHTML = papers.map(paper => {
            let nearestDateStr = 'No dates set';
            if (paper.dates && paper.dates.length > 0) {
                const d = new Date(paper.dates[0].date);
                nearestDateStr = d.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
            }

            return `
                <tr class="border-b border-slate-100 hover:bg-slate-50/50 transition-all">
                    <td class="col-type p-4">
                        <div class="docket-title font-semibold text-slate-800">${paper.type}</div>
                        <div class="docket-subtext text-xs text-slate-500 truncate" title="${paper.description}">${paper.description || 'No notes'}</div>
                    </td>
                    <td class="col-target p-4">
                        <div class="docket-title text-blue-700 font-semibold">${paper.defendant_name}</div>
                        <span class="case-pill bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-mono uppercase">${paper.case_name || 'N/A'}</span>
                    </td>
                    <td class="col-event p-4">
                        <div class="text-sm font-medium text-slate-600">${nearestDateStr}</div>
                        <div class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Nearest Event</div>
                    </td>
                    <td class="col-count p-4">
                        <div class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                            ${paper.dates?.length || 0} Deadlines
                        </div>
                    </td>
                    <td class="col-action p-4 text-right">
                        <button class="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                            <i class="fas fa-external-link-alt text-xs"></i>
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

/**
 * Clear authentication and redirect to CaseTracker logout
 */
function handleLogout() {
    // 1. Clear local session data
    sessionStorage.removeItem("access_token");
    localStorage.removeItem("access_token");

    // 2. Redirect to the central CaseTracker logout 
    // This ensures the session is killed on the Hetzner auth server too
    const loginUrl = "https://casetracker.massfoia.com/logout?next=login";
    window.location.replace(loginUrl);
}