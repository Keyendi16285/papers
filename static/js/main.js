// /**
//  * Papers.massfoia - Main Logic
//  */

// let editingPaperId = null;

// // Global Selection State
// window.selectedDefendantId = null;
// window.selectedCaseId = null;
// window.selectedCaseName = null;
// window.selectedDefendantName = null;

// // Helper variables for the new naming logic
// window.currentCaseTitle = null;
// window.currentDefendantBaseName = null;
// window.totalDefendantsInCase = 1;

// // 1. AUTH FETCH HELPER
// async function authFetch(url, options = {}) {
//     const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
//     options.headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
//     const response = await fetch(url, options);
//     if (response.status === 401) {
//         sessionStorage.removeItem("access_token");
//         localStorage.removeItem("access_token");
//         window.location.replace(window.location.origin);
//     }
//     return response;
// }

// document.addEventListener('DOMContentLoaded', () => {
//     // SSO Handshake
//     const urlParams = new URLSearchParams(window.location.search);
//     const tokenFromUrl = urlParams.get('token');
//     if (tokenFromUrl) {
//         sessionStorage.setItem("access_token", tokenFromUrl);
//         const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
//         window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
//     }

//     // Auth Check
//     (function verifyAccess() {
//         const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
//         if (!token) {
//             const currentUrl = window.location.origin;
//             const loginUrl = `https://casetracker.massfoia.com/login?redirect_url=${encodeURIComponent(currentUrl)}`;
//             window.location.replace(loginUrl);
//             throw new Error("Redirecting to login...");
//         }
//     })();

//     fetchPapers();
//     addDateRow();

//     // Search Logic
//     const searchInput = document.getElementById('target-search');
//     const resultsDiv = document.getElementById('search-results');

//     if (searchInput) {
//         searchInput.addEventListener('input', async (e) => {
//             const query = e.target.value;
//             if (query.length < 2) {
//                 resultsDiv.classList.add('hidden');
//                 return;
//             }

//             try {
//                 const response = await authFetch(`/api/search/targets?q=${encodeURIComponent(query)}`);
//                 const targets = await response.json();

//                 if (targets && targets.length > 0) {
//                     resultsDiv.innerHTML = targets.map(t => {
//                         const name = t.name.replace(/'/g, "\\'");
//                         const caseNo = (t.case_number || t.case_no || 'N/A').replace(/'/g, "\\'");
//                         // Capture the full case title and defendant count from the API response
//                         const caseTitle = (t.case_name || "Multiple Def v. Defendants").replace(/'/g, "\\'");
//                         const totalDefs = t.total_defendants || 1;

//                         return `
//                             <div class="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0" 
//                                  onclick="selectTarget({id: ${t.id}, case_id: ${t.case_id}, name: '${name}', case_no: '${caseNo}', case_name_full: '${caseTitle}', total_defendants: ${totalDefs}})">
//                                 <div class="text-sm font-bold text-slate-800">${t.name}</div>
//                                 <div class="text-[10px] text-slate-500 font-mono uppercase tracking-tight">${caseNo}</div>
//                             </div>
//                         `;
//                     }).join('');
//                     resultsDiv.classList.remove('hidden');
//                 } else {
//                     resultsDiv.innerHTML = '<div class="p-3 text-xs text-slate-400 italic">No matches found.</div>';
//                     resultsDiv.classList.remove('hidden');
//                 }
//             } catch (err) { console.error("Search failed:", err); }
//         });
//     }

//     const paperForm = document.getElementById('paper-form');
//     if (paperForm) paperForm.onsubmit = handleFormSubmit;
// });

// // --- CASEWIDE UI MODE & NAMING LOGIC ---

// function selectTarget(defendant) {
//     const searchInput = document.getElementById('target-search');
//     const isCasewide = document.getElementById('add_is_casewide').checked;
//     const displayCaseNo = defendant.case_no || defendant.case_number || "N/A";

//     // Cache values for dynamic toggling
//     window.currentCaseTitle = defendant.case_name_full;
//     window.currentDefendantBaseName = defendant.name;
//     window.totalDefendantsInCase = defendant.total_defendants || 1;
//     window.selectedCaseId = defendant.case_id;
//     window.selectedDefendantId = defendant.id;
//     window.selectedCaseName = displayCaseNo;

//     updateNamingConvention(isCasewide);
    
//     document.getElementById('search-results').classList.add('hidden');
// }

// function toggleCasewideMode(isCasewide) {
//     const banner = document.getElementById('casewide-banner');
//     const icon = document.getElementById('casewide-icon');

//     if (isCasewide) {
//         banner.classList.add('bg-amber-50', 'border-amber-100');
//         icon.classList.add('text-amber-500');
//     } else {
//         banner.classList.remove('bg-amber-50', 'border-amber-100');
//         icon.classList.remove('text-amber-500');
//     }

//     // Update name dynamically if a target is already selected
//     if (window.selectedCaseId) {
//         updateNamingConvention(isCasewide);
//     }
// }

// function updateNamingConvention(isCasewide) {
//     const searchInput = document.getElementById('target-search');
    
//     if (isCasewide) {
//         // 1. Casewide: Use the full Case Title
//         window.selectedDefendantName = window.currentCaseTitle;
//         searchInput.value = `CASEWIDE: ${window.selectedDefendantName}`;
//     } else {
//         // 2. Individual: Use Single name or "et al" format
//         if (window.totalDefendantsInCase > 1) {
//             window.selectedDefendantName = `${window.currentDefendantBaseName} et al (all ${window.totalDefendantsInCase} Defendants)`;
//         } else {
//             window.selectedDefendantName = window.currentDefendantBaseName;
//         }
//         searchInput.value = `${window.selectedDefendantName} (${window.selectedCaseName})`;
//     }
// }

// // --- DYNAMIC ROWS & RENDERING ---

// function addDateRow(data = null) {
//     const container = document.getElementById('date-rows-container');
//     if (!container) return;
//     const row = document.createElement('div');
//     row.className = "flex flex-wrap md:flex-nowrap gap-3 items-end date-entry-row animate-in fade-in duration-300 mb-3 border-b border-slate-100 pb-3 last:border-0";

//     let dateVal = "";
//     if (data?.date) {
//         const d = new Date(data.date);
//         if (!isNaN(d.getTime())) {
//             dateVal = d.toISOString().slice(0, 16);
//         }
//     }

//     const isCourt = data?.party?.includes('Court');
//     row.innerHTML = `
//         <div class="w-full md:w-1/4">
//             <label class="text-[9px] uppercase font-bold text-slate-400 block mb-1">Date/Time</label>
//             <input type="datetime-local" class="row-date w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500" value="${dateVal}">
//         </div>
//         <div class="w-full md:w-32">
//             <label class="text-[9px] uppercase font-bold text-slate-400 block mb-1">Party</label>
//             <select class="row-party w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none" onchange="toggleCourtColumn(this)">
//                 <option value="P" ${data?.party === 'P' ? 'selected' : ''}>P</option>
//                 <option value="D" ${data?.party === 'D' ? 'selected' : ''}>D</option>
//                 <option value="Court Hearing" ${data?.party === 'Court Hearing' ? 'selected' : ''}>Court Hearing</option>
//                 <option value="Court Other" ${data?.party === 'Court Other' ? 'selected' : ''}>Court Other</option>
//             </select>
//         </div>
//         <div class="row-court-type-container ${isCourt ? '' : 'hidden'} w-full md:w-32">
//             <label class="text-[9px] uppercase font-bold text-slate-400 block mb-1">Format</label>
//             <select class="row-court-type w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none">
//                 <option value="In Person" ${data?.court_type === 'In Person' ? 'selected' : ''}>In Person</option>
//                 <option value="Zoom" ${data?.court_type === 'Zoom' ? 'selected' : ''}>Zoom</option>
//                 <option value="Hybrid" ${data?.court_type === 'Hybrid' ? 'selected' : ''}>Hybrid</option>
//                 <option value="Clerk" ${data?.court_type === 'Clerk' ? 'selected' : ''}>Clerk</option>
//                 <option value="Unknown" ${data?.court_type === 'Unknown' ? 'selected' : ''}>Unknown</option>
//             </select>
//         </div>
//         <div class="flex-grow">
//             <label class="text-[9px] uppercase font-bold text-slate-400 block mb-1">Event Note</label>
//             <input type="text" class="row-text w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none" placeholder="e.g. Status Report Due" value="${data?.optional_text || ''}">
//         </div>
//         <div class="w-full md:w-1/4">
//             <label class="text-[9px] uppercase font-bold text-slate-400 block mb-1">Order URL (Optional)</label>
//             <div class="relative">
//                 <i class="fa-solid fa-link absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]"></i>
//                 <input type="url" class="row-link w-full pl-7 pr-2 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500" placeholder="Paste link..." value="${data?.event_link || ''}">
//             </div>
//         </div>
//         <button type="button" onclick="this.parentElement.remove()" class="p-2 text-slate-300 hover:text-red-500 transition mb-0.5"><i class="fa-solid fa-trash-can"></i></button>
//     `;
//     container.appendChild(row);
// }

// function toggleCourtColumn(select) {
//     const row = select.closest('.date-entry-row');
//     const container = row.querySelector('.row-court-type-container');
//     if (select.value.includes('Court')) container.classList.remove('hidden');
//     else container.classList.add('hidden');
// }

// // --- API ACTIONS ---

// async function handleFormSubmit(e) {
//     e.preventDefault();
//     if (!window.selectedCaseId) { alert("Please search and select a case/defendant first."); return; }

//     const dateRows = document.querySelectorAll('.date-entry-row');
//     const dates = Array.from(dateRows).map(row => ({
//         date: row.querySelector('.row-date').value,
//         party: row.querySelector('.row-party').value,
//         court_type: row.querySelector('.row-party').value.includes('Court') ? row.querySelector('.row-court-type').value : null,
//         optional_text: row.querySelector('.row-text').value,
//         event_link: row.querySelector('.row-link').value
//     })).filter(d => d.date !== "");

//     const payload = {
//         case_id: window.selectedCaseId,
//         defendant_id: window.selectedDefendantId,
//         case_name: window.selectedCaseName,
//         case_title: window.currentCaseTitle, // Include the full case title for backend processing
//         defendant_name: window.selectedDefendantName,
//         type: document.getElementById('paper-type').value,
//         description: document.getElementById('paper-desc').value,
//         is_casewide: document.getElementById('add_is_casewide').checked,
//         dates: dates
//     };

//     const method = editingPaperId ? 'PATCH' : 'POST';
//     const url = editingPaperId ? `/api/papers/${editingPaperId}` : '/api/papers';

//     try {
//         const response = await authFetch(url, {
//             method: method,
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify(payload)
//         });
//         if (response.ok) { resetForm(); fetchPapers(); }
//     } catch (err) { console.error("Submit failed:", err); }
// }

// async function fetchPapers(filter = 'upcoming') {
//     const container = document.getElementById('active-docket-body');
//     if (!container) return;
//     try {
//         const response = await authFetch(`/api/papers?filter=${filter}`);
//         const papers = await response.json();
//         if (papers.length === 0) {
//             container.innerHTML = '<tr><td colspan="6" class="p-12 text-center text-slate-400 italic">No filings found.</td></tr>';
//             return;
//         }
//         container.innerHTML = papers.map(p => {
//             const nearestDate = p.dates?.sort((a, b) => new Date(a.date) - new Date(b.date))[0];
//             const casewideBadge = p.is_casewide ? `<span class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-amber-100 text-amber-700 border border-amber-200 uppercase tracking-tighter"><i class="fa-solid fa-users-line mr-1"></i> Casewide</span>` : '';
            
//             const linkIcon = nearestDate?.event_link ? `
//                 <a href="${nearestDate.event_link}" target="_blank" class="ml-1 text-blue-500 hover:text-blue-700 transition-colors" title="View Order">
//                     <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
//                 </a>
//             ` : '';

//             return `
//                 <tr class="hover:bg-slate-50 transition-colors border-b border-slate-50">
//                     <td class="p-4">
//                         <div class="flex items-center">
//                             <div class="text-sm font-bold text-slate-700">${p.type}</div>
//                             ${casewideBadge}
//                         </div>
//                     </td>
//                     <td class="p-4">
//                         <div class="text-sm font-bold text-blue-600">${p.defendant_name}</div>
//                         <div class="text-[10px] text-slate-400 font-mono">${p.case_name}</div>
//                     </td>
//                     <td class="p-4 text-center">
//                         <span class="px-2 py-0.5 rounded-full text-[9px] font-black border border-slate-200 bg-slate-100">${nearestDate?.party || '--'}</span>
//                     </td>
//                     <td class="p-4">
//                         <div class="flex items-center gap-1">
//                             <div class="text-xs font-bold text-slate-700">${nearestDate ? new Date(nearestDate.date).toLocaleDateString() : 'N/A'}</div>
//                             ${linkIcon}
//                         </div>
//                         <div class="text-[9px] text-slate-400 truncate max-w-[120px]">${nearestDate?.optional_text || ''}</div>
//                     </td>
//                     <td class="p-4 text-center">
//                         <div class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-xs font-black">${p.dates.length}</div>
//                     </td>
//                     <td class="p-4 text-right">
//                         <button onclick="editPaper(${p.id})" class="p-2 text-slate-400 hover:text-blue-500 transition-colors">
//                             <i class="fa-solid fa-pen-to-square"></i>
//                         </button>
//                     </td>
//                 </tr>
//             `;
//         }).join('');
//     } catch (err) { console.error("Load failed:", err); }
// }

// async function editPaper(id) {
//     try {
//         const response = await authFetch(`/api/papers/${id}`);
//         const paper = await response.json();
//         editingPaperId = id;
//         document.getElementById('paper-type').value = paper.type;
//         document.getElementById('paper-desc').value = paper.description || '';
//         document.getElementById('add_is_casewide').checked = paper.is_casewide;
        
//         // Setup initial state for selection logic
//         window.currentCaseTitle = paper.case_name; // We treat this as the title in edit mode
//         window.currentDefendantBaseName = paper.defendant_name.split(' et al')[0];
//         window.selectedCaseId = paper.case_id;
//         window.selectedDefendantId = paper.defendant_id;
//         window.selectedCaseName = paper.case_name;

//         toggleCasewideMode(paper.is_casewide);
        
//         const searchInput = document.getElementById('target-search');
//         searchInput.value = paper.defendant_name;

//         const container = document.getElementById('date-rows-container');
//         container.innerHTML = '';
//         if (paper.dates && paper.dates.length > 0) {
//             paper.dates.forEach(d => addDateRow(d));
//         } else {
//             addDateRow();
//         }

//         document.getElementById('cancel-edit-btn').classList.remove('hidden');
//         document.querySelector('#paper-form button[type="submit"]').innerHTML = 'Update Filing';
//     } catch (e) { console.error(e); }
// }

// function resetForm() {
//     editingPaperId = null;
//     window.selectedDefendantId = null;
//     window.selectedCaseId = null;
//     window.currentCaseTitle = null;
//     window.currentDefendantBaseName = null;
//     const form = document.getElementById('paper-form');
//     if (form) form.reset();
//     toggleCasewideMode(false);
//     const container = document.getElementById('date-rows-container');
//     container.innerHTML = '';
//     addDateRow();
//     document.getElementById('cancel-edit-btn').classList.add('hidden');
//     document.querySelector('#paper-form button[type="submit"]').innerHTML = 'Save Filing & Dates';
// }

// function handleLogout() {
//     sessionStorage.clear();
//     window.location.replace("https://casetracker.massfoia.com/logout?next=login");
// }

/**
 * Papers.massfoia - Main Logic
 */

let editingPaperId = null;

// Global Selection State
window.selectedDefendantId = null;
window.selectedCaseId = null;
window.selectedCaseName = null;     // Stores Case Number (e.g., 2026CH3)
window.selectedDefendantName = null; // Stores the formatted display name (The 3 Rules)

// Helper variables for the naming logic
window.currentCaseTitle = null;      // Stores Case Title (e.g., Multiple Def v. Defendants)
window.currentDefendantBaseName = null;
window.totalDefendantsInCase = 1;

// 1. AUTH FETCH HELPER
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
    // SSO Handshake
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
        sessionStorage.setItem("access_token", tokenFromUrl);
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
    }

    // Auth Check
    (function verifyAccess() {
        const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
        if (!token) {
            const currentUrl = window.location.origin;
            const loginUrl = `https://casetracker.massfoia.com/login?redirect_url=${encodeURIComponent(currentUrl)}`;
            window.location.replace(loginUrl);
            throw new Error("Redirecting to login...");
        }
    })();

    fetchPapers();
    addDateRow();

    // Search Logic
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
                        const caseTitle = (t.case_name || "Case Title Unknown").replace(/'/g, "\\'");
                        const totalDefs = t.total_defendants || 1;

                        return `
                            <div class="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0" 
                                 onclick="selectTarget({id: ${t.id}, case_id: ${t.case_id}, name: '${name}', case_no: '${caseNo}', case_name_full: '${caseTitle}', total_defendants: ${totalDefs}})">
                                <div class="text-sm font-bold text-slate-800">${t.name}</div>
                                <div class="text-[10px] text-slate-500 font-mono uppercase tracking-tight">${caseNo} | ${caseTitle}</div>
                            </div>
                        `;
                    }).join('');
                    resultsDiv.classList.remove('hidden');
                } else {
                    resultsDiv.innerHTML = '<div class="p-3 text-xs text-slate-400 italic">No matches found.</div>';
                    resultsDiv.classList.remove('hidden');
                }
            } catch (err) { console.error("Search failed:", err); }
        });
    }

    const paperForm = document.getElementById('paper-form');
    if (paperForm) paperForm.onsubmit = handleFormSubmit;
});

// --- CASEWIDE UI MODE & NAMING LOGIC ---

function selectTarget(defendant) {
    const searchInput = document.getElementById('target-search');
    const isCasewide = document.getElementById('add_is_casewide').checked;
    
    // Cache background values
    window.currentCaseTitle = defendant.case_name_full; 
    window.currentDefendantBaseName = defendant.name;
    window.totalDefendantsInCase = defendant.total_defendants || 1;
    
    window.selectedCaseId = defendant.case_id;
    window.selectedDefendantId = defendant.id;
    window.selectedCaseName = defendant.case_no || defendant.case_number || "N/A";

    updateNamingConvention(isCasewide);
    
    document.getElementById('search-results').classList.add('hidden');
}

function toggleCasewideMode(isCasewide) {
    const banner = document.getElementById('casewide-banner');
    const icon = document.getElementById('casewide-icon');

    if (isCasewide) {
        banner.classList.add('bg-amber-50', 'border-amber-100');
        icon.classList.add('text-amber-500');
    } else {
        banner.classList.remove('bg-amber-50', 'border-amber-100');
        icon.classList.remove('text-amber-500');
    }

    // Update name dynamically if a target is already selected
    if (window.selectedCaseId) {
        updateNamingConvention(isCasewide);
    }
}

function updateNamingConvention(isCasewide) {
    const searchInput = document.getElementById('target-search');
    
    if (isCasewide) {
        // RULE 1: Casewide -> Use Case Title
        window.selectedDefendantName = window.currentCaseTitle;
        searchInput.value = `CASEWIDE: ${window.selectedDefendantName}`;
    } else {
        // RULE 2 & 3: Individual
        if (window.totalDefendantsInCase > 1) {
            window.selectedDefendantName = `${window.currentDefendantBaseName} et al.  (${window.totalDefendantsInCase})`;
        } else {
            window.selectedDefendantName = window.currentDefendantBaseName;
        }
        searchInput.value = `${window.selectedDefendantName} (${window.selectedCaseName})`;
    }
}

// --- DYNAMIC ROWS & RENDERING ---

function addDateRow(data = null) {
    const container = document.getElementById('date-rows-container');
    if (!container) return;
    const row = document.createElement('div');
    row.className = "flex flex-wrap md:flex-nowrap gap-3 items-end date-entry-row animate-in fade-in duration-300 mb-3 border-b border-slate-100 pb-3 last:border-0";

    let dateVal = "";
    if (data?.date) {
        const d = new Date(data.date);
        if (!isNaN(d.getTime())) {
            dateVal = d.toISOString().slice(0, 16);
        }
    }

    const isCourt = data?.party?.includes('Court');
    row.innerHTML = `
        <div class="w-full md:w-1/4">
            <label class="text-[9px] uppercase font-bold text-slate-400 block mb-1">Date/Time</label>
            <input type="datetime-local" class="row-date w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500" value="${dateVal}">
        </div>
        <div class="w-full md:w-32">
            <label class="text-[9px] uppercase font-bold text-slate-400 block mb-1">Party</label>
            <select class="row-party w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none" onchange="toggleCourtColumn(this)">
                <option value="P" ${data?.party === 'P' ? 'selected' : ''}>P</option>
                <option value="D" ${data?.party === 'D' ? 'selected' : ''}>D</option>
                <option value="Court Hearing" ${data?.party === 'Court Hearing' ? 'selected' : ''}>Court Hearing</option>
                <option value="Court Other" ${data?.party === 'Court Other' ? 'selected' : ''}>Court Other</option>
            </select>
        </div>
        <div class="row-court-type-container ${isCourt ? '' : 'hidden'} w-full md:w-32">
            <label class="text-[9px] uppercase font-bold text-slate-400 block mb-1">Format</label>
            <select class="row-court-type w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none">
                <option value="In Person" ${data?.court_type === 'In Person' ? 'selected' : ''}>In Person</option>
                <option value="Zoom" ${data?.court_type === 'Zoom' ? 'selected' : ''}>Zoom</option>
                <option value="Hybrid" ${data?.court_type === 'Hybrid' ? 'selected' : ''}>Hybrid</option>
                <option value="Clerk" ${data?.court_type === 'Clerk' ? 'selected' : ''}>Clerk</option>
                <option value="Unknown" ${data?.court_type === 'Unknown' ? 'selected' : ''}>Unknown</option>
            </select>
        </div>
        <div class="flex-grow">
            <label class="text-[9px] uppercase font-bold text-slate-400 block mb-1">Event Note</label>
            <input type="text" class="row-text w-full p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none" placeholder="e.g. Status Report Due" value="${data?.optional_text || ''}">
        </div>
        <div class="w-full md:w-1/4">
            <label class="text-[9px] uppercase font-bold text-slate-400 block mb-1">Order URL (Optional)</label>
            <div class="relative">
                <i class="fa-solid fa-link absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]"></i>
                <input type="url" class="row-link w-full pl-7 pr-2 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500" placeholder="Paste link..." value="${data?.event_link || ''}">
            </div>
        </div>
        <button type="button" onclick="this.parentElement.remove()" class="p-2 text-slate-300 hover:text-red-500 transition mb-0.5"><i class="fa-solid fa-trash-can"></i></button>
    `;
    container.appendChild(row);
}

function toggleCourtColumn(select) {
    const row = select.closest('.date-entry-row');
    const container = row.querySelector('.row-court-type-container');
    if (select.value.includes('Court')) container.classList.remove('hidden');
    else container.classList.add('hidden');
}

// --- API ACTIONS ---

async function handleFormSubmit(e) {
    e.preventDefault();
    if (!window.selectedCaseId) { alert("Please search and select a case/defendant first."); return; }

    const dateRows = document.querySelectorAll('.date-entry-row');
    const dates = Array.from(dateRows).map(row => ({
        date: row.querySelector('.row-date').value,
        party: row.querySelector('.row-party').value,
        court_type: row.querySelector('.row-party').value.includes('Court') ? row.querySelector('.row-court-type').value : null,
        optional_text: row.querySelector('.row-text').value,
        event_link: row.querySelector('.row-link').value
    })).filter(d => d.date !== "");

    const payload = {
        case_id: window.selectedCaseId,
        defendant_id: window.selectedDefendantId,
        case_name: window.selectedCaseName,    // Number (2026CH3)
        case_title: window.currentCaseTitle,  // Title (Multiple Def v. Defendants)
        defendant_name: window.selectedDefendantName, // The formatted rule string
        total_defendants: window.totalDefendantsInCase, // For backend logic if needed
        type: document.getElementById('paper-type').value,
        description: document.getElementById('paper-desc').value,
        is_casewide: document.getElementById('add_is_casewide').checked,
        dates: dates
    };

    const method = editingPaperId ? 'PATCH' : 'POST';
    const url = editingPaperId ? `/api/papers/${editingPaperId}` : '/api/papers';

    try {
        const response = await authFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (response.ok) { resetForm(); fetchPapers(); }
    } catch (err) { console.error("Submit failed:", err); }
}

async function fetchPapers(filter = 'upcoming') {
    const container = document.getElementById('active-docket-body');
    if (!container) return;
    try {
        const response = await authFetch(`/api/papers?filter=${filter}`);
        const papers = await response.json();
        if (papers.length === 0) {
            container.innerHTML = '<tr><td colspan="6" class="p-12 text-center text-slate-400 italic">No filings found.</td></tr>';
            return;
        }
        container.innerHTML = papers.map(p => {
            const nearestDate = p.dates?.sort((a, b) => new Date(a.date) - new Date(b.date))[0];
            const casewideBadge = p.is_casewide ? `<span class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-amber-100 text-amber-700 border border-amber-200 uppercase tracking-tighter"><i class="fa-solid fa-users-line mr-1"></i> Casewide</span>` : '';
            
            const linkIcon = nearestDate?.event_link ? `
                <a href="${nearestDate.event_link}" target="_blank" class="ml-1 text-blue-500 hover:text-blue-700 transition-colors" title="View Order">
                    <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                </a>
            ` : '';

            return `
                <tr class="hover:bg-slate-50 transition-colors border-b border-slate-50">
                    <td class="p-4">
                        <div class="flex items-center">
                            <div class="text-sm font-bold text-slate-700">${p.type}</div>
                            ${casewideBadge}
                        </div>
                    </td>
                    <td class="p-4">
                        <div class="text-sm font-bold text-blue-600">${p.defendant_name}</div>
                        <div class="text-[10px] text-slate-400 font-mono uppercase tracking-tight">${p.case_name}</div>
                    </td>
                    <td class="p-4 text-center">
                        <span class="px-2 py-0.5 rounded-full text-[9px] font-black border border-slate-200 bg-slate-100">${nearestDate?.party || '--'}</span>
                    </td>
                    <td class="p-4">
                        <div class="flex items-center gap-1">
                            <div class="text-xs font-bold text-slate-700">${nearestDate ? new Date(nearestDate.date).toLocaleDateString() : 'N/A'}</div>
                            ${linkIcon}
                        </div>
                        <div class="text-[9px] text-slate-400 truncate max-w-[120px]">${nearestDate?.optional_text || ''}</div>
                    </td>
                    <td class="p-4 text-center">
                        <div class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-xs font-black">${p.dates.length}</div>
                    </td>
                    <td class="p-4 text-right">
                        <button onclick="editPaper(${p.id})" class="p-2 text-slate-400 hover:text-blue-500 transition-colors">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) { console.error("Load failed:", err); }
}

async function editPaper(id) {
    try {
        const response = await authFetch(`/api/papers/${id}`);
        const paper = await response.json();
        editingPaperId = id;
        document.getElementById('paper-type').value = paper.type;
        document.getElementById('paper-desc').value = paper.description || '';
        document.getElementById('add_is_casewide').checked = paper.is_casewide;
        
        // Setup initial state for re-applying selection logic
        window.currentCaseTitle = paper.case_title || paper.case_name;
        window.currentDefendantBaseName = paper.defendant_name.split(' et al.')[0];
        window.selectedCaseId = paper.case_id;
        window.selectedDefendantId = paper.defendant_id;
        window.selectedCaseName = paper.case_name;

        toggleCasewideMode(paper.is_casewide);
        
        const searchInput = document.getElementById('target-search');
        searchInput.value = paper.defendant_name;

        const container = document.getElementById('date-rows-container');
        container.innerHTML = '';
        if (paper.dates && paper.dates.length > 0) {
            paper.dates.forEach(d => addDateRow(d));
        } else {
            addDateRow();
        }

        document.getElementById('cancel-edit-btn').classList.remove('hidden');
        document.querySelector('#paper-form button[type=\"submit\"]').innerHTML = 'Update Filing';
    } catch (e) { console.error(e); }
}

function resetForm() {
    editingPaperId = null;
    window.selectedDefendantId = null;
    window.selectedCaseId = null;
    window.currentCaseTitle = null;
    window.currentDefendantBaseName = null;
    const form = document.getElementById('paper-form');
    if (form) form.reset();
    toggleCasewideMode(false);
    const container = document.getElementById('date-rows-container');
    container.innerHTML = '';
    addDateRow();
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    document.querySelector('#paper-form button[type=\"submit\"]').innerHTML = 'Save Filing & Dates';
}

function handleLogout() {
    sessionStorage.clear();
    window.location.replace("https://casetracker.massfoia.com/logout?next=login");
}