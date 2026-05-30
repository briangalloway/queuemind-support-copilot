// QueueMind Chrome Extension Side Panel Logic
// Configured to support both native extension scraping and local browser fallback

let currentTicket = null; // The ticket currently loaded in the analyzer
let selectedReassigneeId = null; // Stored reassignment selection

// -------------------------------------------------------------
// Security Utilities (Encryption and HTML Escaping)
// -------------------------------------------------------------
const ENCRYPTION_KEY = "QueueMindSecurityKey_2026";

function rc4(key, str) {
  let s = [], j = 0, x, res = '';
  for (let i = 0; i < 256; i++) {
    s[i] = i;
  }
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
    x = s[i]; s[i] = s[j]; s[j] = x;
  }
  let i = 0;
  j = 0;
  for (let y = 0; y < str.length; y++) {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    x = s[i]; s[i] = s[j]; s[j] = x;
    res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
  }
  return res;
}

function encryptData(text) {
  if (!text) return "";
  if (typeof text !== 'string') text = String(text);
  const cipher = rc4(ENCRYPTION_KEY, text);
  return btoa(unescape(encodeURIComponent(cipher)));
}

function decryptData(ciphertext) {
  if (!ciphertext) return "";
  try {
    const rawCipher = decodeURIComponent(escape(atob(ciphertext)));
    return rc4(ENCRYPTION_KEY, rawCipher);
  } catch (e) {
    // Return raw if it's not base64 or fails (backwards compatibility)
    return ciphertext;
  }
}

function setSecureItem(key, value) {
  if (value === null || value === undefined) {
    localStorage.removeItem(key);
    return;
  }
  const strVal = typeof value === 'string' ? value : JSON.stringify(value);
  localStorage.setItem(key, encryptData(strVal));
}

function getSecureItem(key, isJson = false) {
  const ciphertext = localStorage.getItem(key);
  if (!ciphertext) return null;
  const decrypted = decryptData(ciphertext);
  if (isJson) {
    try {
      return JSON.parse(decrypted);
    } catch (e) {
      // Fallback for unencrypted legacy JSON
      try {
        return JSON.parse(ciphertext);
      } catch (e2) {
        return null;
      }
    }
  }
  return decrypted;
}

function escapeHtml(str) {
  if (!str) return "";
  if (typeof str !== 'string') str = String(str);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let aiAnalysisCache = {}; // Global cache for AI ticket analysis
let snoozedRiskTickets = getSecureItem("queuemind_snoozed_risk", true) || {};
const expandedEngineerIds = new Set(); // Currently expanded engineer accordion IDs
const activeReassignRecsFilters = new Set(); // Engineers with active Reassign Recs filters
const trackedEngineerIds = new Set(); // Engineer IDs currently configured for tracking
let agentsFetched = false; // Whether agent list has been fetched from CRM
let ticketsSynced = false; // Whether ticket backlog data has been synced from CRM
let syncTimerId = null; // ID handle for background auto-sync timer

function getCrmServerUrl() {
  return getSecureItem("queuemind_crm_server") || "http://localhost:8282";
}

let historicalSolveTimeStats = {}; // Cache for category average solve times from server

async function fetchSolveTimeStats() {
  try {
    const res = await fetch(getCrmServerUrl() + "/api/stats/solve-times");
    if (res.ok) {
      historicalSolveTimeStats = await res.json();
      console.log("Successfully fetched category solve time stats from API:", historicalSolveTimeStats);
    }
  } catch (err) {
    console.warn("Failed to fetch solve time stats from API, using local calculations:", err);
  }
}

function getCategorySolveTimeStats(category) {
  if (historicalSolveTimeStats && historicalSolveTimeStats[category]) {
    return historicalSolveTimeStats[category];
  }
  // Fallback to local calculation if API failed or stats not loaded
  const closed = (window.queueMindMockData && window.queueMindMockData.closedTickets) || [];
  const catTickets = closed.filter(t => t.category === category);
  if (catTickets.length === 0) return { avgHours: 12.0, total: 0 };
  const sum = catTickets.reduce((acc, t) => acc + (t.timeToSolveHours || 0), 0);
  return {
    avgHours: parseFloat((sum / catTickets.length).toFixed(1)),
    total: catTickets.length
  };
}

function formatTicketId(id) {
  if (!id) return "";
  return id.replace(/^[tT][_-]/, "T-").replace(/^t_/, "T-").replace(/^t-/, "T-").toUpperCase();
}

function convertMarkdownToHtml(md) {
  if (!md) return "";
  let html = md;
  // Convert bold: **text** or __text__ to <strong>text</strong>
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  // Convert italic: *text* or _text_ to <em>text</em>
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  // Clean up any carriage returns
  html = html.replace(/\r/g, "");
  
  // Convert double newlines to paragraph breaks
  const paragraphs = html.split('\n\n');
  const parsedParagraphs = paragraphs.map(p => {
    if (!p.trim()) return "";
    const content = p.replace(/\n/g, '<br>');
    return `<p style="margin: 0 0 10px 0;">${content}</p>`;
  });
  
  return parsedParagraphs.filter(p => p !== "").join("");
}

function findFullTicket(backlogId) {
  if (!backlogId || !window.queueMindMockData) return null;
  const cleanId = backlogId.replace(/\D/g, '');
  const tickets = (window.queueMindMockData.helpdeskTickets || [])
    .concat(window.queueMindMockData.closedTickets || []);
  return tickets.find(ht => ht.id.replace(/\D/g, '') === cleanId);
}

function ensureContactDetails(ticket, result) {
  if (result.managerShouldCall && !result.contactPhone) {
    const idNum = parseInt(ticket.id.replace(/\D/g, '')) || 1001;
    result.contactPhone = `555-0${(idNum % 900) + 100}`;
  }
  if (!result.contactName) {
    result.contactName = ticket.account || "Customer";
  }
  if ((!result.contactEmail || result.contactEmail === "N/A") && ticket.contact) {
    result.contactEmail = ticket.contact;
  }
  if (!result.contactEmail) {
    result.contactEmail = ticket.contact || "N/A";
  }
}

function getMatchExplanation(eng, ticket) {
  if (!eng || !ticket || !window.queueMindMockData) return "";
  
  const category = ticket.category || "API/CRM";
  const account = ticket.account || "";
  
  // 1. Capacity Score (Max 40 points)
  const engLoad = calculateEngineerComplexity(eng);
  let capacityScore = 40;
  if (engLoad > 0) {
    capacityScore = Math.max(0, 40 - (engLoad / 50) * 40);
  }
  
  // 2. Skill Match Score (Max 40 points)
  const categoryCount = eng.history.closedTicketsCount[category] || 0;
  const maxCategoryCount = Math.max(...window.queueMindMockData.engineers.map(e => e.history.closedTicketsCount[category] || 0));
  let skillScore = 0;
  if (maxCategoryCount > 0) {
    skillScore = (categoryCount / maxCategoryCount) * 40;
  }
  
  // 3. Account Affinity Score (Max 20 points)
  const customerCSAT = eng.history.accountCSAT[account];
  let affinityScore = 5;
  if (customerCSAT) {
    affinityScore = (customerCSAT / 5.0) * 20;
  }
  
  const totalMatch = Math.round(capacityScore + skillScore + affinityScore);
  
  return `Match Score: ${totalMatch}%\n• Load/Capacity: ${Math.round(capacityScore)}/40 (Backlog Load: ${engLoad.toFixed(0)})\n• Skill Match: ${Math.round(skillScore)}/40 (${categoryCount} closed cases)\n• Client Affinity: ${Math.round(affinityScore)}/20 (CSAT: ${customerCSAT || 'N/A'})`;
}

function sortBacklogTickets(tickets) {
  if (!tickets) return [];
  return [...tickets].sort((a, b) => {
    const cacheKeyA = a.id.replace('t_', 'T-') + "_" + (a.conversations ? a.conversations.length : a.threadLength || 0);
    const cachedA = aiAnalysisCache[cacheKeyA];
    const isAtRiskA = cachedA && (cachedA.isAtRisk === true || (cachedA.isAtRisk === undefined && (cachedA.attentionScore >= 75 || cachedA.sentimentScore < 40)));
    const attnA = cachedA ? cachedA.attentionScore : 0;
    const sentA = cachedA ? cachedA.sentimentScore : 100;

    const cacheKeyB = b.id.replace('t_', 'T-') + "_" + (b.conversations ? b.conversations.length : b.threadLength || 0);
    const cachedB = aiAnalysisCache[cacheKeyB];
    const isAtRiskB = cachedB && (cachedB.isAtRisk === true || (cachedB.isAtRisk === undefined && (cachedB.attentionScore >= 75 || cachedB.sentimentScore < 40)));
    const attnB = cachedB ? cachedB.attentionScore : 0;
    const sentB = cachedB ? cachedB.sentimentScore : 100;

    if (isAtRiskA && !isAtRiskB) return -1;
    if (!isAtRiskA && isAtRiskB) return 1;

    if (attnA !== attnB) {
      return attnB - attnA;
    }

    return sentA - sentB;
  });
}

// Show floating toast notification helper
function getToastSvg(type) {
  if (type === "success") {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon" style="vertical-align: middle;"><polyline points="20 6 9 17 4 12"/></svg>`;
  } else if (type === "error") {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon" style="vertical-align: middle;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  } else if (type === "info") {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--secondary-accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon" style="vertical-align: middle;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  } else if (type === "warning") {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon" style="vertical-align: middle;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  }
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon" style="vertical-align: middle;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
}

// Show floating toast notification helper
function showToast(message, type = "success") {
  let toastEl = document.getElementById("queuemind-toast");
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.id = "queuemind-toast";
    toastEl.className = "toast-container";
    toastEl.innerHTML = `
      <span class="toast-icon" style="display: flex; align-items: center; justify-content: center; height: 16px; width: 16px;"></span>
      <span class="toast-message"></span>
      <button class="toast-close">&times;</button>
    `;
    document.body.appendChild(toastEl);
    toastEl.querySelector(".toast-close").addEventListener("click", () => {
      toastEl.classList.remove("show");
    });
  }

  const iconEl = toastEl.querySelector(".toast-icon");
  const messageEl = toastEl.querySelector(".toast-message");

  iconEl.innerHTML = getToastSvg(type);

  if (type === "success") {
    toastEl.style.borderLeft = "4px solid var(--color-success)";
  } else if (type === "error") {
    toastEl.style.borderLeft = "4px solid var(--color-danger)";
  } else if (type === "info") {
    toastEl.style.borderLeft = "4px solid var(--secondary-accent)";
  } else if (type === "warning") {
    toastEl.style.borderLeft = "4px solid var(--color-warning)";
  }

  messageEl.innerText = message;
  toastEl.classList.add("show");

  if (toastEl.timeoutId) {
    clearTimeout(toastEl.timeoutId);
  }
  toastEl.timeoutId = setTimeout(() => {
    toastEl.classList.remove("show");
  }, 4000);
}

// Show custom in-panel confirmation modal dialog
function showConfirm(title, message) {
  return new Promise((resolve) => {
    let overlay = document.getElementById("queuemind-modal-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "queuemind-modal-overlay";
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal-box">
          <div class="modal-title">Confirmation</div>
          <div class="modal-message"></div>
          <div class="modal-actions">
            <button class="modal-btn cancel" id="queuemind-modal-cancel">Cancel</button>
            <button class="modal-btn confirm" id="queuemind-modal-confirm">Confirm</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    const titleEl = overlay.querySelector(".modal-title");
    const messageEl = overlay.querySelector(".modal-message");
    const confirmBtn = overlay.querySelector("#queuemind-modal-confirm");
    const cancelBtn = overlay.querySelector("#queuemind-modal-cancel");

    titleEl.innerText = title;
    messageEl.innerText = message;

    // Clean up event listeners by cloning button elements
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    overlay.classList.add("show");

    newConfirmBtn.addEventListener("click", () => {
      overlay.classList.remove("show");
      resolve(true);
    });

    newCancelBtn.addEventListener("click", () => {
      overlay.classList.remove("show");
      resolve(false);
    });
  });
}

function wrapSelectionInTextarea(textarea, wrapCharBefore, wrapCharAfter = wrapCharBefore) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(start, end);
  const replacement = wrapCharBefore + selectedText + wrapCharAfter;
  textarea.value = text.substring(0, start) + replacement + text.substring(end);
  textarea.focus();
  textarea.selectionStart = start + wrapCharBefore.length;
  textarea.selectionEnd = start + wrapCharBefore.length + selectedText.length;
}

function showSlackPingModal(ticketId, assigneeName, defaultMessage, onSend) {
  let overlay = document.getElementById("queuemind-slack-modal-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "queuemind-slack-modal-overlay";
    overlay.className = "slack-modal-overlay";
    overlay.innerHTML = `
      <div class="slack-modal-container">
        <div class="slack-modal-title">Message Agent</div>
        <div class="slack-toolbar">
          <button type="button" class="btn-slack-bold" title="Bold">*Bold*</button>
          <button type="button" class="btn-slack-italic" title="Italic">_Italic_</button>
          <button type="button" class="btn-slack-strike" title="Strikethrough">~Strike~</button>
          <button type="button" class="btn-slack-code" title="Code">\`Code\`</button>
          <button type="button" class="btn-slack-quote" title="Quote">&gt;Quote</button>
        </div>
        <textarea class="slack-message-textarea" placeholder="Enter Slack message to assignee..."></textarea>
        <div class="slack-modal-footer">
          <label class="slack-snooze-label">
            <input type="checkbox" class="slack-snooze-checkbox" checked>
            Resolve risk alert (snooze until update)
          </label>
          <div class="slack-modal-buttons">
            <button class="modal-btn cancel" id="queuemind-slack-cancel" style="padding: 4px 10px; font-size:11px; margin-top:0;">Cancel</button>
            <button class="modal-btn confirm" id="queuemind-slack-send" style="padding: 4px 10px; font-size:11px; margin-top:0; background:var(--color-primary);">Send</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  const titleEl = overlay.querySelector(".slack-modal-title");
  if (titleEl) {
    titleEl.innerText = `Message Agent (${assigneeName})`;
  }

  const textarea = overlay.querySelector(".slack-message-textarea");
  textarea.value = defaultMessage;
  const snoozeCheckbox = overlay.querySelector(".slack-snooze-checkbox");
  snoozeCheckbox.checked = true;

  const boldBtn = overlay.querySelector(".btn-slack-bold");
  const italicBtn = overlay.querySelector(".btn-slack-italic");
  const strikeBtn = overlay.querySelector(".btn-slack-strike");
  const codeBtn = overlay.querySelector(".btn-slack-code");
  const quoteBtn = overlay.querySelector(".btn-slack-quote");

  const wrapSelection = (before, after) => {
    wrapSelectionInTextarea(textarea, before, after);
  };

  boldBtn.onclick = () => wrapSelection("*", "*");
  italicBtn.onclick = () => wrapSelection("_", "_");
  strikeBtn.onclick = () => wrapSelection("~", "~");
  codeBtn.onclick = () => wrapSelection("`", "`");
  quoteBtn.onclick = () => wrapSelection("> ", "");

  const sendBtn = overlay.querySelector("#queuemind-slack-send");
  const cancelBtn = overlay.querySelector("#queuemind-slack-cancel");

  const newSendBtn = sendBtn.cloneNode(true);
  const newCancelBtn = cancelBtn.cloneNode(true);
  sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  newSendBtn.addEventListener("click", () => {
    overlay.classList.remove("show");
    onSend(textarea.value, snoozeCheckbox.checked);
  });
  newCancelBtn.addEventListener("click", () => {
    overlay.classList.remove("show");
  });
  
  overlay.classList.add("show");
}

// Save AI cache helper
function saveAICache() {
  setSecureItem("queuemind_ai_cache", aiAnalysisCache);
}

// Setup background polling interval timer for ticket queue synchronization
function setupAutoSyncTimer() {
  if (syncTimerId) {
    clearInterval(syncTimerId);
    syncTimerId = null;
  }

  const intervalMin = parseInt(getSecureItem("queuemind_sync_interval") || "0", 10);
  if (intervalMin > 0 && agentsFetched && ticketsSynced) {
    console.log(`Setting up CRM Auto-Sync timer. Interval: ${intervalMin} minute(s).`);
    syncTimerId = setInterval(async () => {
      console.log("Background Auto-Sync: Fetching ticket queues...");
      try {
        const res = await fetch(getCrmServerUrl() + "/api/state");
        if (res.ok) {
          window.queueMindMockData = await res.json();
          setSecureItem("queuemind_cached_state", window.queueMindMockData);
          refreshTeamDashboard();
        }
      } catch (err) {
        console.warn("Background Auto-Sync failed:", err);
      }
    }, intervalMin * 60 * 1000);
  }
}

// Initialization of state
async function initState() {
  // Load AI Analysis cache from localStorage
  const cachedAi = getSecureItem("queuemind_ai_cache", true);
  if (cachedAi) {
    aiAnalysisCache = cachedAi;
  }

  // Load CRM states from localStorage (flags can stay raw or use secure getter)
  agentsFetched = localStorage.getItem("queuemind_agents_fetched") === "true";
  ticketsSynced = localStorage.getItem("queuemind_tickets_synced") === "true";

  // Load Tracked Engineers from localStorage
  const cachedTracked = getSecureItem("queuemind_tracked_engineers", true);
  if (cachedTracked && Array.isArray(cachedTracked)) {
    cachedTracked.forEach(id => trackedEngineerIds.add(id));
  }

  // Only load state from server/cache if CRM connection is active (agents fetched)
  if (!agentsFetched) {
    window.queueMindMockData = null;
    return;
  }

  // Attempt to load mockData from local server
  try {
    const res = await fetch(getCrmServerUrl() + "/api/state");
    if (res.ok) {
      window.queueMindMockData = await res.json();
      setSecureItem("queuemind_cached_state", window.queueMindMockData);
      console.log("Mock data loaded from state API server.");
    } else {
      throw new Error(`Server returned ${res.status}`);
    }
  } catch (err) {
    console.warn("Could not reach API server, trying local cache fallback:", err);
    const cachedState = getSecureItem("queuemind_cached_state", true);
    if (cachedState) {
      window.queueMindMockData = cachedState;
      console.log("Mock data loaded from localStorage cache fallback.");
    }
  }
  await fetchSolveTimeStats();
  setupAutoSyncTimer();
}

// Initialization
document.addEventListener("DOMContentLoaded", async () => {
  initTabs();
  initSettings();
  initPasswordToggles();
  initTooltipClickHandlers();
  
  // Load state and caches before rendering dashboard
  await initState();
  initTrackedEngineersConfig();
  
  initEventListeners();
  
  window.addEventListener("message", async (event) => {
    const data = event.data;
    if (data && data.type === "QUEUE_MIND_REPLY_SUBMITTED") {
      const ticketPrefix = data.ticketId.replace('t_','T-') + "_";
      for (const k in aiAnalysisCache) {
        if (k.startsWith(ticketPrefix)) {
          delete aiAnalysisCache[k];
        }
      }
      saveAICache();
      await performManualSync();
      refreshTeamDashboard();
    }
  });

  refreshTeamDashboard();

  // REMOVED auto-scraping on load to ensure the extension starts cleanly on the Team tab
  // and the Case Analyzer tab remains blank until manually triggered by the user.
  const statusEl = document.getElementById("extension-status");
  statusEl.innerText = "Ready";
  statusEl.style.backgroundColor = "rgba(255,255,255,0.05)";
  statusEl.style.color = "var(--color-text-muted)";
});

// Dynamic Data Update helper to update complexity and sentiment scores back into mockData state
function updateTicketDataFromAnalysis(ticketId, analysisResult) {
  if (!window.queueMindMockData) return;

  const cleanId = formatTicketId(ticketId); // e.g. T-1002

  // Map complexityScore to High/Medium/Low
  let complexity = "Medium";
  if (analysisResult.complexityScore !== undefined) {
    const score = analysisResult.complexityScore;
    if (score <= 33) complexity = "Low";
    else if (score <= 66) complexity = "Medium";
    else complexity = "High";
  }

  // Map sentimentScore to Frustrated/Confused/Neutral/Satisfied
  let sentiment = "Neutral";
  if (analysisResult.sentimentScore !== undefined) {
    const score = analysisResult.sentimentScore;
    if (score <= 30) sentiment = "Frustrated";
    else if (score <= 50) sentiment = "Confused";
    else if (score <= 70) sentiment = "Neutral";
    else sentiment = "Satisfied";
  }

  // 1. Update window.queueMindMockData.engineers backlogs
  if (window.queueMindMockData.engineers) {
    window.queueMindMockData.engineers.forEach(eng => {
      if (eng.backlog) {
        eng.backlog.forEach(t => {
          if (formatTicketId(t.id) === cleanId) {
            t.complexity = complexity;
            t.sentiment = sentiment;
            t.attentionScore = analysisResult.attentionScore;
            t.sentimentScore = analysisResult.sentimentScore;
            t.complexityScore = analysisResult.complexityScore;
          }
        });
      }
    });
  }

  // 2. Update window.queueMindMockData.helpdeskTickets and closedTickets
  const updateList = (tickets) => {
    if (tickets) {
      tickets.forEach(t => {
        if (formatTicketId(t.id) === cleanId) {
          t.complexity = complexity;
          t.sentiment = sentiment;
          t.attentionScore = analysisResult.attentionScore;
          t.sentimentScore = analysisResult.sentimentScore;
          t.complexityScore = analysisResult.complexityScore;
        }
      });
    }
  };
  updateList(window.queueMindMockData.helpdeskTickets);
  updateList(window.queueMindMockData.closedTickets);

  // Persist updated mockData back to localStorage
  localStorage.setItem("queuemind_cached_state", JSON.stringify(window.queueMindMockData));
}

// Tooltip interactive click toggle helper
function initTooltipClickHandlers() {
  document.addEventListener("click", (e) => {
    const infoIcon = e.target.closest(".info-icon");
    if (infoIcon) {
      e.stopPropagation();
      const isActive = infoIcon.classList.contains("active");
      document.querySelectorAll(".info-icon").forEach(icon => icon.classList.remove("active"));
      if (!isActive) {
        infoIcon.classList.add("active");
      }
    } else {
      document.querySelectorAll(".info-icon").forEach(icon => icon.classList.remove("active"));
    }
  });
}

// 1. Tab Navigation System
function initTabs() {
  const tabs = document.querySelectorAll(".tab-nav .tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      // Deactivate current active tab
      const currentActive = document.querySelector(".tab-nav .tab-btn.active");
      if (currentActive) {
        currentActive.classList.remove("active");
        currentActive.setAttribute("aria-selected", "false");
      }
      document.querySelector(".tab-content-container .tab-pane.active").classList.remove("active");

      // Activate clicked tab
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      const paneId = tab.getAttribute("data-tab");
      document.getElementById(paneId).classList.add("active");

      // Refresh data depending on the tab opened
      if (paneId === "tab-team") {
        refreshTeamDashboard();
      }
    });
  });
}

// 2. Settings Management (Persisted in LocalStorage)
function initSettings() {
  const slackUrl = getSecureItem("queuemind_slack_url") || "";
  document.getElementById("settings-slack-url").value = slackUrl;

  const slackMemberId = getSecureItem("queuemind_slack_member_id") || "";
  document.getElementById("settings-slack-member-id").value = slackMemberId;

  const geminiKey = getSecureItem("queuemind_gemini_key") || "";
  document.getElementById("settings-gemini-key").value = geminiKey;

  const geminiModel = getSecureItem("queuemind_gemini_model") || "gemini-2.5-flash";
  const modelSelect = document.getElementById("settings-gemini-model");
  if (modelSelect) {
    let exists = false;
    for (let i = 0; i < modelSelect.options.length; i++) {
      if (modelSelect.options[i].value === geminiModel) {
        exists = true;
        break;
      }
    }
    if (!exists) {
      const opt = document.createElement("option");
      opt.value = geminiModel;
      opt.innerText = geminiModel;
      modelSelect.appendChild(opt);
    }
    modelSelect.value = geminiModel;
  }

  // Load CRM Server URL & Auth settings
  const crmServer = getSecureItem("queuemind_crm_server") || "http://localhost:8282";
  document.getElementById("settings-crm-server").value = crmServer;

  const crmAuthType = getSecureItem("queuemind_crm_auth_type") || "None";
  document.getElementById("settings-crm-auth-type").value = crmAuthType;

  const crmUsername = getSecureItem("queuemind_crm_username") || "manager";
  document.getElementById("settings-crm-username").value = crmUsername;

  const crmPassword = getSecureItem("queuemind_crm_password") || "qm_api_token_mock_123456";
  document.getElementById("settings-crm-password").value = crmPassword;

  const syncOnSave = getSecureItem("queuemind_sync_on_save") !== "false";
  document.getElementById("settings-sync-on-save").checked = syncOnSave;

  updateCrmAuthVisibility();
}

function updateCrmAuthVisibility() {
  const typeSelect = document.getElementById("settings-crm-auth-type");
  if (!typeSelect) return;
  const type = typeSelect.value;
  const userBlock = document.getElementById("settings-crm-username-block");
  const passBlock = document.getElementById("settings-crm-password-block");
  const lblPass = document.getElementById("lbl-crm-password");
  const inputPass = document.getElementById("settings-crm-password");
  
  if (type === "None") {
    if (userBlock) userBlock.style.display = "none";
    if (passBlock) passBlock.style.display = "none";
  } else if (type === "Bearer") {
    if (userBlock) userBlock.style.display = "none";
    if (passBlock) passBlock.style.display = "block";
    if (lblPass) lblPass.innerText = "Bearer Token";
    if (inputPass) inputPass.placeholder = "qm_api_token_mock_123456";
  } else if (type === "Basic") {
    if (userBlock) userBlock.style.display = "block";
    if (passBlock) passBlock.style.display = "block";
    if (lblPass) lblPass.innerText = "CRM API Password";
    if (inputPass) inputPass.placeholder = "••••••••";
  }
}

// Toggle password input masking visibility
function initPasswordToggles() {
  const toggleBtnIds = [
    { btnId: "btn-toggle-slack-url", inputId: "settings-slack-url" },
    { btnId: "btn-toggle-slack-member-id", inputId: "settings-slack-member-id" },
    { btnId: "btn-toggle-gemini-key", inputId: "settings-gemini-key" },
    { btnId: "btn-toggle-crm-password", inputId: "settings-crm-password" }
  ];

  toggleBtnIds.forEach(({ btnId, inputId }) => {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (btn && input) {
      btn.addEventListener("click", () => {
        if (input.type === "password") {
          input.type = "text";
          btn.innerText = "Hide";
        } else {
          input.type = "password";
          btn.innerText = "Show";
        }
      });
    }
  });
}

// Scalable search-and-select tracked engineers setup
function initTrackedEngineersConfig() {
  const resetDbBtn = document.getElementById("btn-reset-db");


  // Render the entire Settings configuration card dynamically based on agentsFetched state
  function renderSettingsForm() {
    const formContainer = document.getElementById("settings-tracked-engineers-form");
    if (!formContainer) return;

    if (!agentsFetched) {
      formContainer.innerHTML = `
        <div style="text-align: center; padding: 20px 10px; line-height: 1.4; width: 100%;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-dim)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon" style="margin-bottom: 12px; opacity: 0.6; display: block; margin: 0 auto 12px auto;"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
          <strong style="color: var(--color-text-main); font-size: 13px; display: block; margin-bottom: 6px;">CRM Database Disconnected</strong>
          <p class="form-help" style="margin-bottom: 16px; text-align: center;">You must connect to the CRM ticketing system to pull available support agents.</p>
          <button type="button" class="primary-action-btn" id="btn-fetch-crm-agents" style="width: auto; padding: 8px 16px; margin: 0 auto; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 11.5px; font-weight: 600; cursor: pointer;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            Connect & Load Agents
          </button>
        </div>
      `;
      
      const fetchBtn = formContainer.querySelector("#btn-fetch-crm-agents");
      if (fetchBtn) {
        fetchBtn.addEventListener("click", async () => {
          fetchBtn.disabled = true;
          fetchBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon spin" style="animation: spin 0.8s linear infinite; margin-right: 4px;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>Connecting...`;
          
          try {
            const res = await fetch(getCrmServerUrl() + "/api/state");
            if (res.ok) {
              window.queueMindMockData = await res.json();
              localStorage.setItem("queuemind_cached_state", JSON.stringify(window.queueMindMockData));
            }
          } catch (err) {
            console.warn("Could not reach API server on fetch-crm-agents, using local fallback", err);
          }
          
          agentsFetched = true;
          localStorage.setItem("queuemind_agents_fetched", "true");
          
          // Render selection list UI
          renderSettingsForm();
          // Update dashboard empty state
          refreshTeamDashboard();
        });
      }
      return;
    }

    // Render selection controls
    formContainer.innerHTML = `
      <p class="form-help" style="margin-bottom: 10px;">Select which support engineers to display on your monitor dashboard.</p>
      
      <div style="position: relative; margin-bottom: 10px;">
        <input type="text" id="settings-engineer-search" class="form-input" placeholder="Search engineers to track..." style="width: 100%;">
      </div>

      <div style="display: flex; justify-content: space-between; margin-bottom: 6px; padding: 0 2px;">
        <button type="button" id="btn-select-all-engineers" style="background: transparent; border: none; color: var(--color-primary-light); font-size: 10.5px; cursor: pointer; padding: 0; font-weight: 600;">Select All</button>
        <button type="button" id="btn-clear-all-engineers" style="background: transparent; border: none; color: #ef4444; font-size: 10.5px; cursor: pointer; padding: 0; font-weight: 600;">Clear All</button>
      </div>

      <div id="settings-engineer-list-container" style="max-height: 180px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; background: rgba(0,0,0,0.15); padding: 4px; display: flex; flex-direction: column; gap: 4px;">
        <!-- Dynamically populated selectable rows -->
      </div>

      <div style="margin-top: 12px; margin-bottom: 12px;">
        <label class="form-label" for="settings-sync-interval">CRM Auto-Sync Interval</label>
        <select id="settings-sync-interval" class="form-input" style="width: 100%;">
          <option value="0">Off (Manual Only)</option>
          <option value="1">Every 1 minute</option>
          <option value="5">Every 5 minutes</option>
          <option value="15">Every 15 minutes</option>
          <option value="30">Every 30 minutes</option>
        </select>
        <p class="form-help">Choose how often QueueMind should poll the CRM database for ticket backlog updates.</p>
      </div>

      <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
        <input type="checkbox" id="settings-sync-on-save" checked style="cursor: pointer; width: auto; margin: 0;">
        <label for="settings-sync-on-save" style="font-size: 11px; font-weight: 500; color: var(--color-text-muted); cursor: pointer; user-select: none;">Sync tickets automatically on save</label>
      </div>
      
      <button class="primary-action-btn" id="btn-save-tracked-engineers" style="margin-top: 4px; width: 100%;">
        Save Tracked Engineers
      </button>
    `;

    const listContainer = document.getElementById("settings-engineer-list-container");
    const searchInput = document.getElementById("settings-engineer-search");
    const saveBtn = document.getElementById("btn-save-tracked-engineers");
    const btnSelectAll = document.getElementById("btn-select-all-engineers");
    const btnClearAll = document.getElementById("btn-clear-all-engineers");

    if (!listContainer || !searchInput || !saveBtn) return;

    const intervalSelect = document.getElementById("settings-sync-interval");
    if (intervalSelect) {
      intervalSelect.value = localStorage.getItem("queuemind_sync_interval") || "0";
    }

    const syncOnSaveCheckbox = document.getElementById("settings-sync-on-save");
    if (syncOnSaveCheckbox) {
      syncOnSaveCheckbox.checked = localStorage.getItem("queuemind_sync_on_save") !== "false";
    }

    // Populate checklist rows
    window.queueMindMockData.engineers.forEach(eng => {
      const isSelected = trackedEngineerIds.has(eng.id);
      
      const row = document.createElement("div");
      row.className = `engineer-select-row ${isSelected ? 'selected' : ''}`;
      row.setAttribute("data-eng-id", eng.id);
      row.setAttribute("data-eng-name", eng.name.toLowerCase());
      
      const initials = eng.avatar || eng.name.split(' ').map(n => n[0]).join('');
      const avatarHtml = eng.avatarImg 
        ? `<img src="${eng.avatarImg}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
        : initials;

      row.innerHTML = `
        <input type="checkbox" id="chk-eng-${escapeHtml(eng.id)}" ${isSelected ? 'checked' : ''} style="pointer-events: none;">
        <div class="engineer-select-row-avatar">${avatarHtml}</div>
        <span class="engineer-select-row-name">${escapeHtml(eng.name)}</span>
      `;

      row.addEventListener("click", (e) => {
        const checkbox = row.querySelector("input[type='checkbox']");
        let nextState;
        
        if (e.target.tagName === "INPUT") {
          // Checkbox was already toggled by the browser's default click behavior
          nextState = checkbox.checked;
        } else {
          // Row was clicked, toggle the checkbox state manually
          nextState = !checkbox.checked;
          checkbox.checked = nextState;
        }
        
        if (nextState) {
          trackedEngineerIds.add(eng.id);
          row.classList.add("selected");
        } else {
          trackedEngineerIds.delete(eng.id);
          row.classList.remove("selected");
        }
      });

      listContainer.appendChild(row);
    });

    // Filtering row list visibility
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.toLowerCase().trim();
      const rows = listContainer.querySelectorAll(".engineer-select-row");
      rows.forEach(row => {
        const name = row.getAttribute("data-eng-name");
        if (!query || name.includes(query)) {
          row.style.display = "flex";
        } else {
          row.style.display = "none";
        }
      });
    });

    // Select/Clear All operations
    btnSelectAll.addEventListener("click", () => {
      const visibleRows = listContainer.querySelectorAll(".engineer-select-row");
      visibleRows.forEach(row => {
        if (row.style.display !== "none") {
          const engId = row.getAttribute("data-eng-id");
          trackedEngineerIds.add(engId);
          row.querySelector("input[type='checkbox']").checked = true;
          row.classList.add("selected");
        }
      });
    });

    btnClearAll.addEventListener("click", () => {
      const visibleRows = listContainer.querySelectorAll(".engineer-select-row");
      visibleRows.forEach(row => {
        if (row.style.display !== "none") {
          const engId = row.getAttribute("data-eng-id");
          trackedEngineerIds.delete(engId);
          row.querySelector("input[type='checkbox']").checked = false;
          row.classList.remove("selected");
        }
      });
    });

    // Save tracking config
    saveBtn.addEventListener("click", async () => {
      setSecureItem("queuemind_tracked_engineers", Array.from(trackedEngineerIds));
      const intervalSelect = document.getElementById("settings-sync-interval");
      if (intervalSelect) {
        setSecureItem("queuemind_sync_interval", intervalSelect.value);
      }
      
      const syncOnSaveCheckbox = document.getElementById("settings-sync-on-save");
      const syncOnSave = syncOnSaveCheckbox ? syncOnSaveCheckbox.checked : true;
      setSecureItem("queuemind_sync_on_save", syncOnSave ? "true" : "false");
      
      setupAutoSyncTimer();
      
      if (syncOnSave && agentsFetched) {
        saveBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" style="vertical-align: middle; margin-right: 4px; animation: spin 1s linear infinite;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg> Saving & Syncing...`;
        saveBtn.disabled = true;
        await performManualSync();
        saveBtn.innerText = "Save Tracked Engineers";
        saveBtn.disabled = false;
        showToast("Tracked engineers configuration saved and tickets synced!", "success");
      } else {
        showToast("Tracked engineers configuration saved! Monitor updated.", "success");
      }
      
      refreshTeamDashboard();
    });
  }

  // Reset Database & Clear Caches handler
  if (resetDbBtn) {
    resetDbBtn.addEventListener("click", async () => {
      const confirmed = await showConfirm("Reset Database & Clear Caches", "Are you sure you want to reset the database and caches? This will clear all local caches (state, AI analysis) and reset the server database to original defaults.");
      if (!confirmed) {
        return;
      }

      // Call API reset
      try {
        await fetch(getCrmServerUrl() + "/api/reset", { method: "POST" });
      } catch (err) {
        console.warn("API server reset call failed:", err);
      }

      // Clear local storage keys
      localStorage.removeItem("queuemind_cached_state");
      localStorage.removeItem("queuemind_ai_cache");
      localStorage.removeItem("queuemind_tracked_engineers");
      localStorage.removeItem("queuemind_sync_interval");
      localStorage.setItem("queuemind_agents_fetched", "false");
      localStorage.setItem("queuemind_tickets_synced", "false");
      localStorage.removeItem("queuemind_demo_mode");
      localStorage.removeItem("queuemind_snoozed_risk");
      
      // Clear variables
      aiAnalysisCache = {};
      snoozedRiskTickets = {};
      trackedEngineerIds.clear();
      activeReassignRecsFilters.clear();
      agentsFetched = false;
      ticketsSynced = false;

      // Re-initialize and reload
      await initState();
      renderSettingsForm();
      refreshTeamDashboard();
      showToast("Database reset successfully! All local caches cleared and server database restored.", "success");
    });
  }

  // Initial draw
  renderSettingsForm();
}

function saveSettings() {
  const slackUrl = document.getElementById("settings-slack-url").value.trim();
  setSecureItem("queuemind_slack_url", slackUrl);

  const slackMemberId = document.getElementById("settings-slack-member-id").value.trim();
  setSecureItem("queuemind_slack_member_id", slackMemberId);

  const geminiKey = document.getElementById("settings-gemini-key").value.trim();
  setSecureItem("queuemind_gemini_key", geminiKey);

  const geminiModel = document.getElementById("settings-gemini-model").value;
  setSecureItem("queuemind_gemini_model", geminiModel);

  const crmServer = document.getElementById("settings-crm-server").value.trim();
  setSecureItem("queuemind_crm_server", crmServer);

  const crmAuthType = document.getElementById("settings-crm-auth-type").value;
  setSecureItem("queuemind_crm_auth_type", crmAuthType);

  const crmUsername = document.getElementById("settings-crm-username").value.trim();
  setSecureItem("queuemind_crm_username", crmUsername);

  const crmPassword = document.getElementById("settings-crm-password").value.trim();
  setSecureItem("queuemind_crm_password", crmPassword);

  const syncOnSave = document.getElementById("settings-sync-on-save").checked;
  setSecureItem("queuemind_sync_on_save", syncOnSave ? "true" : "false");
}

// 3. Event Listeners
function initEventListeners() {
  document.getElementById("btn-scrape-active").addEventListener("click", scrapeActiveTicket);
  
  // Settings updates
  document.getElementById("settings-slack-url").addEventListener("input", saveSettings);
  document.getElementById("settings-slack-member-id").addEventListener("input", saveSettings);
  document.getElementById("settings-gemini-key").addEventListener("input", saveSettings);
  document.getElementById("settings-gemini-model").addEventListener("change", saveSettings);

  // CRM Server Settings updates
  document.getElementById("settings-crm-server").addEventListener("input", saveSettings);
  document.getElementById("settings-crm-username").addEventListener("input", saveSettings);
  document.getElementById("settings-crm-password").addEventListener("input", saveSettings);
  document.getElementById("settings-sync-on-save").addEventListener("change", saveSettings);

  document.getElementById("settings-crm-server").addEventListener("change", async () => {
    saveSettings();
    if (document.getElementById("settings-sync-on-save").checked) {
      await performManualSync();
      refreshTeamDashboard();
    }
  });
  document.getElementById("settings-crm-auth-type").addEventListener("change", async () => {
    saveSettings();
    updateCrmAuthVisibility();
    if (document.getElementById("settings-sync-on-save").checked) {
      await performManualSync();
      refreshTeamDashboard();
    }
  });
  document.getElementById("settings-crm-username").addEventListener("change", async () => {
    saveSettings();
    if (document.getElementById("settings-sync-on-save").checked) {
      await performManualSync();
      refreshTeamDashboard();
    }
  });
  document.getElementById("settings-crm-password").addEventListener("change", async () => {
    saveSettings();
    if (document.getElementById("settings-sync-on-save").checked) {
      await performManualSync();
      refreshTeamDashboard();
    }
  });

  // Test Slack Webhook button
  document.getElementById("settings-test-slack").addEventListener("click", testSlackWebhook);

  // Test Gemini Connection button
  const testGeminiBtn = document.getElementById("settings-test-gemini");
  if (testGeminiBtn) {
    testGeminiBtn.addEventListener("click", testGeminiConnection);
  }

  // List Models button
  const listModelsBtn = document.getElementById("settings-list-models");
  if (listModelsBtn) {
    listModelsBtn.addEventListener("click", listSupportedModels);
  }

  // Execute Reassignment button
  document.getElementById("btn-execute-reassign").addEventListener("click", executeSelectedReassign);

  // Manual AI Refresh Analysis Button
  const refreshAiBtn = document.getElementById("btn-refresh-ai");
  if (refreshAiBtn) {
    refreshAiBtn.addEventListener("click", () => {
      if (currentTicket) {
        processScrapedTicket(currentTicket, { forceRefresh: true });
      }
    });
  }

  // Batch Analyze Backlogs Button
  const batchAnalyzeBtn = document.getElementById("btn-batch-analyze");
  if (batchAnalyzeBtn) {
    batchAnalyzeBtn.addEventListener("click", runBatchAnalysis);
  }
}

// 4. Ingest/Scraper Engine
// Runs DOM extraction script on active tab
function scrapeActiveTicket() {
  const statusEl = document.getElementById("extension-status");
  statusEl.innerText = "Analyzing...";
  statusEl.style.backgroundColor = "rgba(245, 158, 11, 0.15)";
  statusEl.style.color = "#fcd34d";

  // Check if we are running inside a real Chrome Extension environment
  if (typeof chrome !== "undefined" && chrome.tabs && chrome.scripting) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length === 0) {
        statusEl.innerText = "No Tab";
        attemptLocalFallback();
        return;
      }
      
      const activeTab = tabs[0];
      
      // Inject scraping script
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: scrapeHelpdeskDOM
      }, function(results) {
        // Handle runtime errors (like missing permissions on file:// URLs)
        if (chrome.runtime.lastError) {
          console.warn("Script injection failed:", chrome.runtime.lastError.message);
          
          const isFileUrl = activeTab.url && activeTab.url.startsWith("file:///");
          const isMockPage = activeTab.url && activeTab.url.includes("mock_helpdesk.html");

          if (isFileUrl && isMockPage) {
            showFileAccessWarning();
          } else {
            attemptLocalFallback();
          }
          return;
        }

        if (results && results[0] && results[0].result) {
          const ticketData = results[0].result;
          processScrapedTicket(ticketData);
          statusEl.innerText = "Active Tab Linked";
          statusEl.style.backgroundColor = "rgba(16, 185, 129, 0.15)";
          statusEl.style.color = "#34d399";
        } else {
          // If scraping returns null (not a mock page), run fallback which will show the blank/prompt state
          console.warn("Could not scrape page DOM. Check active page is mock_helpdesk.html.");
          attemptLocalFallback();
        }
      });
    });
  } else {
    // Local Fallback (for debugging sidepanel directly as HTML page in browser)
    console.log("Chrome scripting APIs unavailable. Checking window contexts.");
    attemptLocalFallback();
  }
}

// Scraper function injected into the target tab's context
function scrapeHelpdeskDOM() {
  const container = document.getElementById("active-ticket-container");
  if (!container) return null;

  const ticketId = container.getAttribute("data-ticket-id") || "";
  if (!ticketId) return null;

  const subject = container.getAttribute("data-subject") || 
                  document.getElementById("ticket-subject")?.innerText || "";
  const account = container.getAttribute("data-account") || "";
  const contact = container.getAttribute("data-contact") || "";
  const category = container.getAttribute("data-category") || "";
  const assignee = container.getAttribute("data-assignee") || "";
  const status = container.getAttribute("data-status") || "";
  const complexity = container.getAttribute("data-complexity") || "Medium";
  const createdTime = container.getAttribute("data-created") || "";

  // Extract message histories
  const cards = container.querySelectorAll(".message-card");
  const conversations = Array.from(cards).map(card => {
    const sender = card.classList.contains("customer") ? "customer" : "agent";
    
    // Find text safely
    const senderName = card.querySelector(".message-header .message-sender span:nth-child(2)")?.innerText || "";
    const message = card.querySelector(".message-body")?.innerText || "";
    const timestampText = card.querySelector(".message-header .message-time")?.innerText || "";
    const timestamp = timestampText ? new Date(timestampText).toISOString() : new Date().toISOString();
    
    return { sender, name: senderName, message, timestamp };
  });

  return { 
    id: ticketId, 
    ticketId: ticketId,
    subject: subject, 
    account: account, 
    contact: contact, 
    category: category, 
    assignee: assignee, 
    assignedTo: assignee,
    status: status, 
    complexity: complexity, 
    createdTime: createdTime,
    conversations: conversations 
  };
}

// Shows file access settings instruction when execution fails on file:// page
function showFileAccessWarning() {
  const statusEl = document.getElementById("extension-status");
  const emptyEl = document.getElementById("analyzer-empty");
  const resultsEl = document.getElementById("analyzer-results");
  const emptyTextEl = document.getElementById("empty-state-text");

  emptyEl.style.display = "flex";
  resultsEl.style.display = "none";

  emptyTextEl.innerHTML = `
    <div style="text-align: left; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); padding: 12px; border-radius: 8px; font-size:11.5px; line-height: 1.55;">
      <strong style="color:var(--color-danger); font-size:12px; display:block; margin-bottom:6px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon" style="vertical-align: middle; margin-right: 4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Chrome File Access Required</strong>
      To allow the extension to read and analyze local HTML pages, you must toggle Chrome's file permission:
      <ol style="margin-left:16px; margin-top:6px; display:flex; flex-direction:column; gap:4px;">
        <li>Open <code style="font-family:var(--font-mono); background:#111; padding:1px 4px; border-radius:3px;">chrome://extensions/</code> in a new tab.</li>
        <li>Find <strong>QueueMind Support Copilot</strong> and click <strong>Details</strong>.</li>
        <li>Scroll down and toggle <strong>"Allow access to file URLs"</strong> to <strong style="color:var(--color-success)">ON</strong>.</li>
        <li>Return here, refresh your Helpdesk tab, and click <strong>Analyze Active Ticket</strong>.</li>
      </ol>
      <div style="margin-top:10px; border-top:1px solid rgba(239, 68, 68, 0.15); padding-top:8px; text-align:center;">
        <strong>Alternative:</strong> Use our local server at <a href="${getCrmServerUrl()}/" target="_blank" style="color:var(--secondary-accent); font-weight:600; text-decoration:underline;">${getCrmServerUrl()}/</a> to bypass this restriction entirely!
      </div>
    </div>
  `;

  statusEl.innerText = "Permissions Blocked";
  statusEl.style.backgroundColor = "rgba(239, 68, 68, 0.12)";
  statusEl.style.color = "var(--color-danger)";
}

// Fallback logic when Chrome scripting is unavailable or page cannot be parsed
function attemptLocalFallback() {
  const statusEl = document.getElementById("extension-status");
  const emptyEl = document.getElementById("analyzer-empty");
  const resultsEl = document.getElementById("analyzer-results");
  const emptyTextEl = document.getElementById("empty-state-text");

  // Read ticket ID from URL parameter (e.g. ?ticket=T-1002 or ?id=T-1002)
  const urlParams = new URLSearchParams(window.location.search);
  let targetId = urlParams.get("ticket") || urlParams.get("id");

  // If not found in own URL, attempt to read from opener window's URL
  if (!targetId && window.opener) {
    try {
      const openerParams = new URLSearchParams(window.opener.location.search);
      targetId = openerParams.get("ticket") || openerParams.get("id");
      if (!targetId && window.opener.activeTicketId) {
        targetId = window.opener.activeTicketId;
      }
    } catch (e) {
      console.warn("Could not read opener URL parameters:", e);
    }
  }

  // Fallback to first ticket in mock data
  if (!targetId && typeof window !== 'undefined' && window.queueMindMockData) {
    if (window.location.href.includes("mock_helpdesk.html") || window.location.host.includes("localhost")) {
      targetId = window.queueMindMockData.helpdeskTickets[0].id;
    }
  }

  if (targetId) {
    const mockTicket = window.queueMindMockData.helpdeskTickets.find(t => t.id === targetId);
    if (mockTicket) {
      processScrapedTicket(mockTicket);
      statusEl.innerText = "Mock Shared DB Link";
      statusEl.style.backgroundColor = "rgba(16, 185, 129, 0.15)";
      statusEl.style.color = "#34d399";
      return;
    }
  }

  // Show completely blank state with instructions to browse and open a ticket
  emptyTextEl.innerHTML = `<strong>Helpdesk Ticket Not Detected</strong><br>Could not find an active ticket in the current tab. Please open <a href="${getCrmServerUrl()}/" target="_blank" style="color:var(--secondary-accent); font-weight:600; text-decoration:underline;">${getCrmServerUrl()}/</a>, click a ticket to select it, and then press "Analyze Active Ticket" again.`;
  
  emptyEl.style.display = "flex";
  resultsEl.style.display = "none";
  
  statusEl.innerText = "No Ticket linked";
  statusEl.style.backgroundColor = "rgba(239, 68, 68, 0.12)";
  statusEl.style.color = "var(--color-danger)";
}


// 5. Data Processing & Scoring Logic
async function processScrapedTicket(ticket, options = {}) {
  // Normalize the ticket structure to handle both scraped DOM formats and raw mock JSON database formats
  const normalizedTicket = {
    id: ticket.id || ticket.ticketId || "",
    subject: ticket.subject || "",
    account: ticket.account || "",
    contact: ticket.contact || "",
    category: ticket.category || "",
    assignee: ticket.assignee || ticket.assignedTo || "",
    status: ticket.status || "",
    complexity: ticket.complexity || "Medium",
    createdTime: ticket.createdTime || ticket.closedAt || "",
    conversations: ticket.conversations || []
  };

  currentTicket = normalizedTicket;
  selectedReassigneeId = null; // Clear reassignment cache
  // Hide empty state, show results
  document.getElementById("analyzer-empty").style.display = "none";
  document.getElementById("analyzer-results").style.display = "flex";

  // Bind summary header
  document.getElementById("res-ticket-id").innerText = formatTicketId(normalizedTicket.id);
  document.getElementById("res-ticket-category").innerText = normalizedTicket.category;
  document.getElementById("res-ticket-subject").innerText = normalizedTicket.subject;
  document.getElementById("res-ticket-account").innerText = normalizedTicket.account;
  document.getElementById("res-ticket-assignee").innerText = normalizedTicket.assignee;

  // Set UI to visual loading states while analyzing
  document.getElementById("res-attention-score").innerText = "...";
  document.getElementById("res-sentiment-score").innerText = "...";
  document.getElementById("res-complexity-score").innerText = "...";
  
  const attentionRingReset = document.getElementById("res-attention-ring");
  const sentimentRingReset = document.getElementById("res-sentiment-ring");
  const complexityRingReset = document.getElementById("res-complexity-ring");
  if (attentionRingReset) {
    attentionRingReset.className = "metric-circle";
    attentionRingReset.removeAttribute("data-tooltip");
  }
  if (sentimentRingReset) {
    sentimentRingReset.className = "metric-circle";
    sentimentRingReset.removeAttribute("data-tooltip");
  }
  if (complexityRingReset) {
    complexityRingReset.className = "metric-circle";
    complexityRingReset.removeAttribute("data-tooltip");
  }

  document.getElementById("res-ai-summary").innerText = "Analyzing ticket conversation thread with AI Copilot...";
  document.getElementById("res-intervention-guidance").innerHTML = "Determining recommended action...";
  document.getElementById("res-loop-alert").style.display = "none";

  const refreshBtn = document.getElementById("btn-refresh-ai");
  if (refreshBtn) {
    const svg = refreshBtn.querySelector("svg");
    if (svg) svg.classList.add("spin");
  }

  // Resolve caching & fetch pipeline
  const cacheKey = normalizedTicket.id.replace('t_', 'T-') + "_" + normalizedTicket.conversations.length;
  let analysisResult = null;
  const apiKey = localStorage.getItem("queuemind_gemini_key") || "";

  if (options.forceRefresh === true && aiAnalysisCache[cacheKey]) {
    const confirmReRun = await showConfirm("Re-run Analysis", "This ticket has not changed since the last analysis. Do you want to analyze it again anyway?");
    if (!confirmReRun) {
      analysisResult = aiAnalysisCache[cacheKey];
    }
  }

  if (!analysisResult) {
    const cached = aiAnalysisCache[cacheKey];
    const isSimulated = cached && (!cached.provider || cached.provider.includes("Simulated Sandbox"));
    if (options.forceRefresh !== true && cached && cached.isDetailed === true && !isSimulated) {
      analysisResult = cached;
    } else {
      if (apiKey) {
        try {
          analysisResult = await callGeminiAPI(normalizedTicket, apiKey);
          analysisResult.isDetailed = true;
          const selectedModel = localStorage.getItem("queuemind_gemini_model") || "gemini-2.5-flash";
          const friendlyModelMap = {
            "gemini-2.0-flash": "Google Gemini 2.0 Flash",
            "gemini-2.5-flash": "Google Gemini 2.5 Flash",
            "gemini-2.0-flash-lite": "Google Gemini 2.0 Flash Lite",
            "gemini-2.5-pro": "Google Gemini 2.5 Pro",
            "gemini-3.5-flash": "Google Gemini 3.5 Flash"
          };
          const friendlyModelName = friendlyModelMap[selectedModel] || selectedModel;
          analysisResult.provider = `${friendlyModelName} (Live AI)`;
          
          aiAnalysisCache[cacheKey] = analysisResult;
          saveAICache();
          
          // DYNAMIC DATA UPDATE: Update complexity and sentiment dynamically!
          updateTicketDataFromAnalysis(normalizedTicket.id, analysisResult);
          refreshTeamDashboard();
        } catch (err) {
          console.error("Gemini API call failed:", err);
          showToast(`Gemini API call failed: ${err.message}`, "error");
          
          analysisResult = {
            isAtRisk: false,
            attentionScore: 0,
            attentionReason: "API Call Failed",
            sentimentScore: 0,
            sentimentReason: "API Call Failed",
            complexityScore: 0,
            complexityReason: "API Call Failed",
            summary: `Error running Gemini API: ${err.message}`,
            diagnosis: "Gemini API Call Failed.",
            nextAction: "Ensure your API key is valid and you have quota, then try analyzing again.",
            recommendReassign: false,
            provider: `Error: ${err.message}`,
            isDetailed: false
          };
        }
      } else {
        showToast("Gemini API Key is not configured. Please enter one in the Settings tab.", "warning");
        analysisResult = {
          isAtRisk: false,
          attentionScore: 0,
          attentionReason: "API Key Missing",
          sentimentScore: 0,
          sentimentReason: "API Key Missing",
          complexityScore: 0,
          complexityReason: "API Key Missing",
          summary: "Gemini API Key Required. Please configure your key in the Settings tab.",
          diagnosis: "Google Gemini API Key has not been configured.",
          nextAction: "Configure a valid Gemini API Key in the Settings tab to analyze this ticket.",
          recommendReassign: false,
          provider: "Google Gemini (No API Key)",
          isDetailed: false
        };
      }
    }
  }

  // Ensure all result fields exist
  analysisResult = Object.assign({
    attentionScore: 50,
    sentimentScore: 50,
    complexityScore: 50,
    summary: "No summary available.",
    diagnosis: "",
    nextAction: "No action recommended.",
    recommendReassign: false
  }, analysisResult);

  ensureContactDetails(normalizedTicket, analysisResult);

  // Stop refresh animation
  if (refreshBtn) {
    const svg = refreshBtn.querySelector("svg");
    if (svg) svg.classList.remove("spin");
  }

  // Bind scores and visual status indicators (attention, sentiment, complexity)
  const attentionVal = document.getElementById("res-attention-score");
  attentionVal.innerText = analysisResult.attentionScore;
  const attentionRing = document.getElementById("res-attention-ring");
  attentionRing.className = "metric-circle score-badge-tooltip tooltip-align-left";
  attentionRing.setAttribute("data-tooltip", analysisResult.attentionReason || "No explanation provided.");
  if (analysisResult.attentionScore >= 75) attentionRing.classList.add("score-red");
  else if (analysisResult.attentionScore >= 40) attentionRing.classList.add("score-yellow");
  else attentionRing.classList.add("score-green");

  const sentimentVal = document.getElementById("res-sentiment-score");
  sentimentVal.innerText = analysisResult.sentimentScore;
  const sentimentRing = document.getElementById("res-sentiment-ring");
  sentimentRing.className = "metric-circle score-badge-tooltip";
  sentimentRing.setAttribute("data-tooltip", analysisResult.sentimentReason || "No explanation provided.");
  if (analysisResult.sentimentScore <= 30) sentimentRing.classList.add("score-red");
  else if (analysisResult.sentimentScore <= 70) sentimentRing.classList.add("score-yellow");
  else sentimentRing.classList.add("score-green");

  const complexityVal = document.getElementById("res-complexity-score");
  complexityVal.innerText = analysisResult.complexityScore;
  const complexityRing = document.getElementById("res-complexity-ring");
  complexityRing.className = "metric-circle score-badge-tooltip tooltip-align-right";
  complexityRing.setAttribute("data-tooltip", analysisResult.complexityReason || "No explanation provided.");
  if (analysisResult.complexityScore >= 75) complexityRing.classList.add("score-red");
  else if (analysisResult.complexityScore >= 40) complexityRing.classList.add("score-yellow");
  else complexityRing.classList.add("score-green");

  // Bind AI diagnostic description text & alerts
  document.getElementById("res-ai-summary").innerHTML = scrubPII(analysisResult.summary);

  const alertBox = document.getElementById("res-loop-alert");
  const loopDesc = document.getElementById("res-loop-desc");
  if (analysisResult.diagnosis) {
    alertBox.style.display = "flex";
    loopDesc.innerHTML = scrubPII(analysisResult.diagnosis);
  } else {
    alertBox.style.display = "none";
  }
  document.getElementById("res-intervention-guidance").innerHTML = scrubPII(formatNextAction(analysisResult.nextAction));
  // Manage green styling on coaching directions if no manager action is required
  const coachingBox = document.querySelector(".coaching-directions");
  const lowerAction = (analysisResult.nextAction || "").toLowerCase();
  const noActionTriggers = [
    "no immediate manager action",
    "proceeding normally",
    "do nothing",
    "no action",
    "no immediate action",
    "no intervention",
    "tracking resolution",
    "no reassignment needed"
  ];
  const isNoAction = (analysisResult.attentionScore < 40 && !analysisResult.recommendReassign) || 
                     noActionTriggers.some(trigger => lowerAction.includes(trigger));
                     
  if (coachingBox) {
    if (isNoAction) {
      coachingBox.classList.add("coaching-green");
    } else {
      coachingBox.classList.remove("coaching-green");
    }
  }

  // Render provider badge
  document.getElementById("ai-provider-badge").innerText = analysisResult.provider || "Running in simulated sandbox mode";

  // Populate smart reassignment matrix
  calculateReassignmentMatrix(normalizedTicket, analysisResult.complexityScore, analysisResult.attentionScore, analysisResult.recommendReassign);

  // Render manager actions in Case View
  const actionsCard = document.getElementById("res-actions-card");
  const actionsContainer = document.getElementById("res-actions-container");
  if (actionsCard && actionsContainer) {
    if (analysisResult) {
      actionsCard.style.display = "flex";
      renderManagerActions(actionsContainer, normalizedTicket, analysisResult, normalizedTicket.assignee, () => {
        const updatedTicket = findFullTicket(normalizedTicket.id) || normalizedTicket;
        processScrapedTicket(updatedTicket);
        refreshTeamDashboard();
      });
    } else {
      actionsCard.style.display = "none";
    }
  }
}

// Robust fetch utility with automatic retry handling for rate limits (HTTP 429)
async function fetchWithRetry(url, options, maxRetries = 3, initialDelay = 2000) {
  let delay = initialDelay;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        if (i === maxRetries) {
          return response; // Out of retries, return the 429 response
        }
        console.warn(`Gemini API returned 429 (Rate Limit). Retrying in ${delay}ms... (Attempt ${i + 1} of ${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        continue;
      }
      return response;
    } catch (err) {
      if (i === maxRetries) {
        throw err;
      }
      console.warn(`Network error during fetch. Retrying in ${delay}ms... (Attempt ${i + 1} of ${maxRetries})`, err);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

// Live Gemini API post fetch utility
async function callGeminiAPI(ticket, apiKey) {
  const selectedModel = localStorage.getItem("queuemind_gemini_model") || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

  const convText = ticket.conversations.map(c => {
    return `[${c.timestamp || 'N/A'}] ${c.sender === 'customer' ? 'Customer' : 'Agent'} (${c.name || c.sender}): ${c.message}`;
  }).join('\n\n');

  const stats = getCategorySolveTimeStats(ticket.category);

  const prompt = `You are QueueMind AI, a customer support operations analyzer. Your job is to analyze the following support ticket and the conversation history between the customer and the support agent.

TICKET DETAILS:
Ticket ID: ${ticket.id}
Subject: ${ticket.subject}
Account: ${ticket.account}
Category: ${ticket.category}
Category Historical Average Solve Time: ${stats.avgHours} hours (based on ${stats.total} historical cases)
Assigned To: ${ticket.assignee}
Status: ${ticket.status}

CONVERSATION HISTORY:
${convText}

INSTRUCTIONS:
1. "isAtRisk" (boolean): true if this ticket has active operational risks, severe customer frustration from repetitive troubleshooting, explicit threats of churn/cancellation, or if the customer has explicitly requested an escalation or reported that they followed standard documentation but it is still failing. It must be false for standard technical troubleshooting, polite status checks, early-stage tickets (1-2 messages), and normal complex issues, even if they have been open for a while.
2. "attentionScore" (integer 0-100): Calculate an urgency index where 100 is high risk. The attention score must focus on:
   - How long it has been since the last contact or response (longer delays increase the score).
   - Whether the customer is actively having to ask us for updates, follow-ups, or escalations (increases the score).
   - Customer sentiment distress or frustration (increases the score).
   - Standard technical questions, early-stage tickets (1-2 messages overall), and polite queries (such as checking if the system is down) must remain low-to-moderate (under 50) unless they have been ignored or are overdue.
3. "attentionReason" (string): A short, single-sentence explanation of why this attention score was assigned.
4. "sentimentScore" (integer 0-100): Customer sentiment from 0 (extremely hostile, angry, or severely frustrated) to 100 (delighted or highly satisfied). Standard technical troubleshooting questions, error reports, and polite requests for assistance must be scored as neutral (around 50). Note: If the customer explicitly requests an escalation (e.g. "We need this escalated"), asks for manager/supervisor intervention, or reports that they followed documentation/instructions but the issue is still failing/unresolved, this is an expression of frustration and distress and must NOT be scored as neutral (50); it must receive a low sentiment score (typically between 15 and 35) depending on severity.
5. "sentimentReason" (string): A short, single-sentence explanation of why this sentiment score was assigned.
6. "complexityScore" (integer 0-100): Technical severity/complexity rating from 0 (low) to 100 (high). Ground this score in the provided category historical average solve time. The score must be proportional to how long similar issues historically took to resolve compared to other categories (e.g., categories with higher historical average solve times must establish a higher baseline complexity score), rather than being subjective or keyword-driven.
7. "complexityReason" (string): A short, single-sentence explanation of why this complexity score was assigned.
8. "summary" (string): A concise 2-sentence summary of the core issue and current status of the thread.
9. "diagnosis" (string): Short diagnosis of the operational risk (e.g. "Customer frustration due to repetitive troubleshooting cycles"). Return an empty string if there is no immediate risk.
10. "nextAction" (string): Provide a detailed next action recommendation for the support manager. Use HTML markup like <strong> or <em> if helpful.
   CRITICAL CRITERIA:
   - If the customer sentiment is low (sentimentScore < 40), do not just default to recommending reassignment. If the customer is upset about a product bug, billing policy, or something that won't be fixed by starting over with a different engineer, recommend a real next action (e.g. issuing a credit, escalating to engineering, manager joining the thread directly to de-escalate). Only recommend reassignment if the current assignee is overloaded or lacks technical skills in this category.
   - If the ticket involves custom code errors or script issues (e.g. Python/Javascript timeouts, exceptions, memory limits) but the customer's actual code script or error traceback logs are not yet shared in the conversation history, the recommendation should prioritize requesting the customer to share their custom script and the complete error log/traceback so we can troubleshoot it. Do not recommend reviewing their code if the code is not in the thread.
   - If the ticket involves authentication or OAuth failures (e.g. Slack auth scope verification failed, Salesforce authorization errors) but the conversation history lacks any specific error traceback, screenshot, details of which scopes are failing, or workspace/client settings, the recommendation should prioritize asking the customer to share the exact error details/screenshots and OAuth configuration info, rather than recommending escalation to Security or specialized OAuth engineering teams.
   - Never include raw client secrets, API keys, passwords, tokens, or other private credentials in your summary or recommendation. If a credential exposure is detected in the conversation, the recommendation should state generally that "exposed API secrets/credentials must be rotated/secured immediately" without printing or mentioning the actual credential value. If you recommend security rotation, you must explicitly note in the "summary" that credential exposure was detected in the conversation history.
   - Do not make unconfirmed or subjective claims about the account value (e.g. calling it a "high-value account") or churn risk in your scoring reasons or recommendations unless the customer explicitly threatens to cancel or move to a competitor in the conversation text. Maintain objective, data-grounded assessments.
11. "recommendReassign" (boolean): true if reassignment is recommended, false otherwise. Set to false if the current assignee has the right context and reassigning would further frustrate the customer.
12. "managerDraftResponse" (string): If the suggested next action involves the manager replying to the customer or joining the thread directly to de-escalate, draft an empathetic, personalized email response from the manager (Brian, a Sr. Manager with Zapier Support). The draft should follow the style and flow of the example below but be customized specifically to the customer's actual ticket issue, operational impact/blockers, and next steps:
    "[Customer Name or Account Name],

    Hi I'm Brian, a Sr. Manager with Zapier Support. I just called to follow up with you on this ticket. I wanted to let you know that I have reviewed this issue and am working with our internal teams to address the issue. I understand your integration is [custom-tailored empathetic description of their issue, e.g., encountering a session expired error on the Salesforce authentication step, blocking your core automated synchronization tasks], and the resolution has not met your needs so far. [Empathetic statement referencing the recommended action, e.g., I am escalating this to our OAuth engineering team to review the scope expiration settings / I will be joining your thread directly to troubleshoot]. I will reach out with an update for you in the first half of the day tomorrow regardless of progress on the root cause.

    Regards,
    Brian"
    Substitute the customer contact's name (or account name if contact name is unavailable) in the greeting. Custom-tailor the issue description and recommended action statements so it reads as a highly personalized, empathetic manager check-in rather than a rigid template. You may use standard Markdown formatting (such as \`**bold**\` or \`_italic_\`) for emphasis in the draft response. If a manager response is not recommended or not needed, return an empty string.
13. "managerShouldCall" (boolean): true if the severity/urgency warrants a direct phone call to the customer (e.g. if the customer explicitly requests a phone call/callback or if the issue is highly critical), false otherwise.
14. "contactName" (string): The customer contact's name (extracted from conversation or metadata).
15. "contactPhone" (string): The customer's phone number extracted from the conversation if mentioned, or an empty string.
16. "contactEmail" (string): The customer's email address (extracted from conversation or metadata).
17. Professionalism and Constructive Feedback: The "summary", "diagnosis", and "nextAction" must always be constructive, factual, and action-oriented. Do not use accusatory, personal, or blame-oriented language directed at the individual support agent (e.g. avoid saying "the agent failed" or "agent is repeating generic steps"). Frame the feedback around the flow of the conversation, technical blockers, and concrete manager actions (e.g. "Repetitive troubleshooting cycles detected" instead of "Agent is repeating basic steps").

You must reply with ONLY a JSON object that strictly adheres to this schema. Do not wrap the JSON in markdown code blocks.`;

  const payload = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          isAtRisk: { type: "BOOLEAN" },
          attentionScore: { type: "INTEGER" },
          attentionReason: { type: "STRING" },
          sentimentScore: { type: "INTEGER" },
          sentimentReason: { type: "STRING" },
          complexityScore: { type: "INTEGER" },
          complexityReason: { type: "STRING" },
          summary: { type: "STRING" },
          diagnosis: { type: "STRING" },
          nextAction: { type: "STRING" },
          recommendReassign: { type: "BOOLEAN" },
          managerDraftResponse: { type: "STRING" },
          managerShouldCall: { type: "BOOLEAN" },
          contactName: { type: "STRING" },
          contactPhone: { type: "STRING" },
          contactEmail: { type: "STRING" }
        },
        required: [
          "isAtRisk", "attentionScore", "attentionReason",
          "sentimentScore", "sentimentReason",
          "complexityScore", "complexityReason",
          "summary", "diagnosis", "nextAction", "recommendReassign",
          "managerDraftResponse", "managerShouldCall",
          "contactName", "contactPhone", "contactEmail"
        ]
      }
    }
  };

  let response = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (response.status === 404) {
    const v1Url = `https://generativelanguage.googleapis.com/v1/models/${selectedModel}:generateContent?key=${apiKey}`;
    console.warn("Gemini v1beta endpoint returned 404. Retrying with stable v1 endpoint and stripped schema fields...");
    
    // Clone and strip schema fields not supported in older stable v1 endpoint APIs
    const v1Payload = JSON.parse(JSON.stringify(payload));
    if (v1Payload.generationConfig) {
      delete v1Payload.generationConfig.responseMimeType;
      delete v1Payload.generationConfig.responseSchema;
    }

    response = await fetchWithRetry(v1Url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(v1Payload)
    });
  }

  if (!response.ok) {
    let errorMsg = `Gemini API returned status ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.error && errJson.error.message) {
        errorMsg = `${errJson.error.message} (status ${response.status})`;
      }
    } catch (e) {
      try {
        const textBody = await response.text();
        if (textBody) {
          errorMsg = `${textBody.slice(0, 150)} (status ${response.status})`;
        }
      } catch (innerE) {}
    }
    throw new Error(errorMsg);
  }

  const json = await response.json();
  if (!json.candidates || json.candidates.length === 0 || !json.candidates[0].content || !json.candidates[0].content.parts || json.candidates[0].content.parts.length === 0) {
    throw new Error("No text response returned from Gemini. The response might have been blocked by safety filters.");
  }
  const text = json.candidates[0].content.parts[0].text;
  return cleanAndParseJSON(text);
}

// Safely parses a JSON object returned from the LLM, cleaning out any markdown triple backtick fences.
function cleanAndParseJSON(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n/, ""); // Remove opening block
    cleaned = cleaned.replace(/\n```$/, "");         // Remove closing block
  }
  cleaned = cleaned.trim();
  return JSON.parse(cleaned);
}

function formatNextAction(text) {
  if (!text) return "";

  // Check if text contains numbered patterns like "1. ", "2. ", etc.
  if (/\b\d+\.\s+/.test(text)) {
    const listStartIndex = text.search(/\b1\.\s+/);
    if (listStartIndex !== -1) {
      const intro = text.substring(0, listStartIndex);
      const listPart = text.substring(listStartIndex);

      const items = [];
      const regex = /\b\d+\.\s+([^]+?)(?=(?:\b\d+\.\s+|$))/g;
      let match;
      while ((match = regex.exec(listPart)) !== null) {
        items.push(match[1].trim());
      }

      if (items.length > 0) {
        const listHtml = `<ol>${items.map(item => `<li>${item}</li>`).join('')}</ol>`;
        return intro + listHtml;
      }
    }
  }
  return text;
}

// Client-side local PII Scrubber using Regular Expressions
function scrubPII(text) {
  if (!text) return "";
  const doScrubKeys = true;
  const doScrubPII = true;

  let processed = text;

  if (doScrubKeys) {
    // OAuth credentials / token secrets: Bearer, api_key=..., client_secret=..., sk_live...
    processed = processed.replace(
      /(client_secret|api_key|sk_live|sk_test)\s*=\s*([a-zA-Z0-9_.-]{6,})/gi,
      `$1=<span class="scrub-redact-highlight">&lt;REDACTED_CREDENTIALS&gt;</span>`
    );
    // Secret links
    processed = processed.replace(
      /https:\/\/hooks\.zapier\.com\/hooks\/catch\/\d+\/[a-zA-Z0-9]+\//gi,
      `https://hooks.zapier.com/hooks/catch/<span class="scrub-redact-highlight">&lt;REDACTED_HOOK_PATH&gt;</span>/`
    );
  }

  if (doScrubPII) {
    // Emails
    processed = processed.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      `<span class="scrub-redact-highlight">&lt;REDACTED_EMAIL&gt;</span>`
    );
    // Phone numbers (matches formats like 555-0199, (123) 456-7890, +1 123 456 7890)
    processed = processed.replace(
      /\b(?:\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
      `<span class="scrub-redact-highlight">&lt;REDACTED_PHONE&gt;</span>`
    );
  }

  return processed;
}

// Evaluate customer sentiment based on keywords and loop status
// Evaluate customer sentiment based on positive and negative keyword scoring
function assessSentiment(conversations) {
  const customerMsgs = conversations.filter(c => c.sender === "customer").map(c => c.message.toLowerCase());
  if (customerMsgs.length === 0) {
    return { label: "Neutral Score: 0%", positive: 0, negative: 0 };
  }

  const fullText = customerMsgs.join(" ");

  // Standard sentiment keywords
  const positiveWords = ["thanks", "thank", "great", "appreciate", "helpful", "perfect", "resolved", "awesome", "good", "solved", "fixed", "yes"];
  const negativeWords = [
    "unacceptable", "terrible", "frustrated", "awful", "horrible", "angry", 
    "compensation", "losing money", "escalate", "escalated", "escalation", "manager", 
    "supervisor", "call me", "phone", "immediately", "asap", 
    "urgently", "disappointed", "useless", "worst", "ridiculous",
    "fail", "failed", "failing", "failure", "broken", "down", "error", "errors",
    "stuck", "blocked", "slow", "delay"
  ];

  let posCount = 0;
  let negCount = 0;

  // Count positive matches (using word boundaries for accuracy)
  positiveWords.forEach(w => {
    const regex = new RegExp("\\b" + w + "\\b", "gi");
    const matches = fullText.match(regex);
    if (matches) posCount += matches.length;
  });

  // Count negative matches
  negativeWords.forEach(w => {
    const regex = new RegExp("\\b" + w + "\\b", "gi");
    const matches = fullText.match(regex);
    if (matches) negCount += matches.length;
  });

  // Base adjustments: thread depth increases negative sentiment weight
  if (customerMsgs.length >= 3) {
    negCount += (customerMsgs.length - 2) * 2;
  }

  // Default to neutral if no sentiment words found
  if (posCount === 0 && negCount === 0) {
    return { label: "Neutral Score: 0%", positive: 0, negative: 0 };
  }

  const total = posCount + negCount;
  const positivePct = Math.round((posCount / total) * 100);
  const negativePct = 100 - positivePct;

  let label = `Neg: ${negativePct}% / Pos: ${positivePct}%`;
  if (positivePct > negativePct) {
    label = `Pos: ${positivePct}% / Neg: ${negativePct}%`;
  } else if (positivePct === negativePct) {
    label = `Pos: 50% / Neg: 50%`;
  }

  return {
    label: label,
    positive: positivePct,
    negative: negativePct
  };
}

function checkForEscalationKeywords(conversations) {
  const customerMsgs = conversations.filter(c => c.sender === "customer").map(c => c.message.toLowerCase()).join(" ");
  const keywords = ["escalate", "supervisor", "manager", "director", "call me", "phone", "unacceptable"];
  return keywords.some(k => customerMsgs.includes(k));
}

// Quantitatively calculate ticket attention priority rating (0 - 100)
function calculateAttentionScore(conversations, sentimentObj) {
  let score = 10; // base score

  // Loop Thread Length weight
  const loopCount = conversations.filter(c => c.sender === "customer").length;
  score += loopCount * 15;

  // Sentiment weight (scaled by negative sentiment percentage, max 40 points)
  score += Math.round((sentimentObj.negative / 100) * 40);

  // Escalation trigger keywords
  if (checkForEscalationKeywords(conversations)) {
    score += 45;
  }

  // Idle simulated time penalty (Stalled status = extra weight)
  const isStalled = conversations.length >= 3;
  if (isStalled) score += 15;

  return Math.min(100, score);
}

// Calculate the backlog complexity score for an individual engineer (burnout risk index)
function calculateEngineerComplexity(engineer) {
  let totalComplexity = 0;
  
  engineer.backlog.forEach(ticket => {
    // Base weight
    let weight = 10;
    if (ticket.complexity === "High") weight = 30;
    else if (ticket.complexity === "Medium") weight = 15;
    else if (ticket.complexity === "Low") weight = 5;

    // Sentiment modifier
    let multiplier = 1.0;
    if (ticket.sentiment === "Frustrated" || ticket.sentiment === "Demanding") multiplier = 1.5;
    else if (ticket.sentiment === "Confused") multiplier = 1.2;

    totalComplexity += weight * multiplier;
  });

  return Math.round(totalComplexity);
}

// Evaluates and renders the match recommendation grid for the active ticket
function calculateReassignmentMatrix(ticket, complexity, attentionScore, recommendReassignOverride) {
  const container = document.getElementById("res-reassign-container");
  container.innerHTML = "";

  const currentAssigneeName = ticket.assignee;
  
  // Find current assignee to show load
  const currentEng = window.queueMindMockData.engineers.find(e => e.name === currentAssigneeName);
  const currentLoadVal = currentEng ? calculateEngineerComplexity(currentEng) : 35;

  // Calculate team average load for relative normalization
  const allLoads = window.queueMindMockData.engineers.map(e => calculateEngineerComplexity(e));
  const totalLoad = allLoads.reduce((a, b) => a + b, 0);
  const avgLoad = totalLoad / (allLoads.length || 1);

  const relativeLoadScore = avgLoad > 0 ? Math.min(100, Math.round((currentLoadVal / avgLoad) * 50)) : 50;
  let loadLabel = "Average";
  let loadClass = "warning"; // yellow

  if (relativeLoadScore > 60) {
    loadLabel = "Above Average";
    loadClass = "danger"; // red
  } else if (relativeLoadScore < 40) {
    loadLabel = "Below Average";
    loadClass = "success"; // green
  }
  
  const loadLblEl = document.getElementById("res-assignee-load-lbl");
  if (loadLblEl) {
    loadLblEl.innerText = `Current: ${currentAssigneeName}'s Capacity Load:`;
  }

  const loadValEl = document.getElementById("res-assignee-load-val");
  loadValEl.innerText = `${relativeLoadScore} (${loadLabel})`;
  loadValEl.className = loadClass;

  // Reassignment recommendation logic: if override is provided, use it, otherwise default to load/attention threshold
  const recommendReassign = recommendReassignOverride !== undefined ? recommendReassignOverride : (currentLoadVal > avgLoad * 1.3 || attentionScore >= 75);
  const wrapper = document.getElementById("reassign-collapsible-wrapper");
  const toggleIcon = document.getElementById("reassign-toggle-icon");
  const header = document.getElementById("reassign-matrix-header");

  if (recommendReassign) {
    wrapper.style.display = "block";
    toggleIcon.innerText = "▲ Recommended";
    toggleIcon.style.color = "var(--color-danger)";
  } else {
    wrapper.style.display = "none";
    toggleIcon.innerText = "▼ Show Options";
    toggleIcon.style.color = "var(--color-text-muted)";
  }

  header.onclick = () => {
    if (wrapper.style.display === "none") {
      wrapper.style.display = "block";
      toggleIcon.innerText = recommendReassign ? "▲ Recommended" : "▲ Hide Options";
    } else {
      wrapper.style.display = "none";
      toggleIcon.innerText = recommendReassign ? "▼ Recommended" : "▼ Show Options";
    }
  };

  // Score all engineers
  const scoredEngineers = window.queueMindMockData.engineers.map(eng => {
    // 1. Capacity Score (Max 40 points)
    // Low backlog complexity score = high capacity score
    const engLoad = calculateEngineerComplexity(eng);
    let capacityScore = 40;
    if (engLoad > 0) {
      capacityScore = Math.max(0, 40 - (engLoad / 50) * 40);
    }

    // 2. Skill Match Score (Max 40 points)
    // Check their history closed ticket volume in this specific category
    const categoryCount = eng.history.closedTicketsCount[ticket.category] || 0;
    // Find the max count for this category across the entire team to normalize
    const maxCategoryCount = Math.max(...window.queueMindMockData.engineers.map(e => e.history.closedTicketsCount[ticket.category] || 0));
    let skillScore = 0;
    if (maxCategoryCount > 0) {
      skillScore = (categoryCount / maxCategoryCount) * 40;
    }

    // 3. Account Affinity Score (Max 20 points)
    // Check customer relationship CSAT history
    const customerCSAT = eng.history.accountCSAT[ticket.account];
    let affinityScore = 5; // baseline points for no history
    if (customerCSAT) {
      affinityScore = (customerCSAT / 5.0) * 20;
    }

    const totalMatch = Math.round(capacityScore + skillScore + affinityScore);
    
    return {
      engineer: eng,
      matchPct: totalMatch,
      load: engLoad,
      skillScore: Math.round(skillScore),
      capacityScore: Math.round(capacityScore),
      affinityScore: Math.round(affinityScore)
    };
  });

  // Sort by match percentage descending, excluding the current assignee
  const eligibleEngineers = scoredEngineers
    .filter(se => se.engineer.name !== currentAssigneeName)
    .sort((a, b) => b.matchPct - a.matchPct);

  // Render top 3 choices
  const displayList = eligibleEngineers.slice(0, 3);
  
  displayList.forEach((se, idx) => {
    const card = document.createElement("div");
    const isTop = idx === 0;
    
    card.className = `reassign-card ${isTop ? 'recommended' : ''}`;
    card.setAttribute("data-eng-id", se.engineer.id);
    card.onclick = () => selectReassignee(se.engineer.id);

    // Calculate normalized relative capacity load score for this engineer (50 is team average)
    const relativeEngLoadScore = avgLoad > 0 ? Math.min(100, Math.round((se.load / avgLoad) * 50)) : 50;
    const capacityClass = relativeEngLoadScore > 60 ? 'load-high' : (relativeEngLoadScore > 40 ? 'load-med' : 'load-low');

    // Dynamic specialties calculation
    const specialties = getEngineerSpecialties(se.engineer.name);
    const primarySpecialty = specialties.length > 0 ? specialties[0].category : "Generalist";

    const avatarContent = se.engineer.avatarImg ? `<img src="${se.engineer.avatarImg}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : se.engineer.avatar;

    card.innerHTML = `
      <div class="reassign-profile">
        <div class="reassign-avatar">${avatarContent}</div>
        <div class="reassign-meta">
          <div class="reassign-name">
            ${se.engineer.name}
            ${isTop ? '<span class="badge-recommend">Best Match</span>' : ''}
          </div>
          <div class="reassign-desc">${se.engineer.title || 'Technical Support Engineer'} | CSAT with Account: ${se.engineer.history.accountCSAT[ticket.account] || 'No History'}</div>
        </div>
      </div>
      <div class="reassign-scores">
        <span class="match-pct">${se.matchPct}%</span>
        <span class="capacity-indicator">Backlog Load Index: <span class="${capacityClass}">${relativeEngLoadScore}</span></span>
      </div>
    `;
    container.appendChild(card);
    
    // Auto-select the top recommendation on render
    if (isTop) {
      selectReassignee(se.engineer.id);
    }
  });
}

function selectReassignee(engId) {
  selectedReassigneeId = engId;
  
  // Update selected class in sidebar UI
  const cards = document.querySelectorAll(".reassign-card");
  cards.forEach(c => c.classList.remove("selected-active"));
  
  const targetCard = document.querySelector(`.reassign-card[data-eng-id="${engId}"]`);
  if (targetCard) {
    targetCard.classList.add("selected-active");
  }

  // Show execution button
  const execBtn = document.getElementById("btn-execute-reassign");
  const eng = window.queueMindMockData.engineers.find(e => e.id === engId);
  execBtn.innerText = `Reassign Ticket to ${eng.name.split(' ')[0]}`;
  execBtn.style.display = "block";
}

// 6. Action Execution (State sync and Slack trigger)
function executeSelectedReassign() {
  if (!currentTicket || !selectedReassigneeId) return;

  const ticketId = currentTicket.id;

  // 0. Sync reassignment with local API server
  fetch(getCrmServerUrl() + "/api/reassign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticketId: ticketId, targetEngId: selectedReassigneeId })
  }).then(res => {
    if (res.ok) {
      console.log("Reassignment persisted to server.");
      localStorage.setItem("queuemind_cached_state", JSON.stringify(window.queueMindMockData));
    }
  }).catch(err => {
    console.warn("Server sync failed, running in local-only mode:", err);
  });
  const targetEng = window.queueMindMockData.engineers.find(e => e.id === selectedReassigneeId);
  if (!targetEng) return;

  const oldAssigneeName = currentTicket.assignee;

  // 1. Update Mock Helpdesk list state in Javascript
  const helpdeskTicket = window.queueMindMockData.helpdeskTickets.find(t => t.id === ticketId);
  if (helpdeskTicket) {
    helpdeskTicket.assignedTo = targetEng.name;
    helpdeskTicket.status = "Open"; // reset stalled status
  }

  // 2. Transfer ticket in our simulated engineers' backlogs
  // Remove from old engineer's backlog array
  const oldEng = window.queueMindMockData.engineers.find(e => e.name === oldAssigneeName);
  if (oldEng) {
    oldEng.backlog = oldEng.backlog.filter(t => t.id !== ticketId && t.id.replace('t_','') !== ticketId.replace('T-',''));
  }

  // Push into new engineer's backlog array
  targetEng.backlog.push({
    id: `t_${ticketId.replace('T-','')}`,
    account: currentTicket.account,
    subject: currentTicket.subject,
    category: currentTicket.category,
    complexity: currentTicket.complexity || "Medium",
    sentiment: "Neutral",
    lastUpdate: "Just reassigned",
    threadLength: currentTicket.conversations.length
  });

  // 3. Send event to target webpage to update on-screen Helpdesk assignee name dynamically
  if (typeof chrome !== "undefined" && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length > 0) {
        // Send a postMessage payload into active tab
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: (tId, name, id) => {
            window.postMessage({
              type: "QUEUE_MIND_REASSIGN",
              ticketId: tId,
              newAssigneeName: name,
              newAssigneeId: id
            }, "*");
          },
          args: [ticketId, targetEng.name, targetEng.id]
        });
      }
    });
  } else {
    // Direct postMessage fallback if opened in same tab/iframe window
    window.postMessage({
      type: "QUEUE_MIND_REASSIGN",
      ticketId: ticketId,
      newAssigneeName: targetEng.name,
      newAssigneeId: targetEng.id
    }, "*");
  }

  // 4. Send Slack notification
  const slackUrl = localStorage.getItem("queuemind_slack_url");
  if (slackUrl && slackUrl.startsWith("http")) {
    const slackMemberId = localStorage.getItem("queuemind_slack_member_id") || "";
    const mentionText = slackMemberId ? `<@${slackMemberId}> ` : "";

    // Calculate relative loads for the message (50 is team average)
    const allLoads = window.queueMindMockData.engineers.map(e => calculateEngineerComplexity(e));
    const avgLoad = allLoads.reduce((a, b) => a + b, 0) / (allLoads.length || 1);
    const oldEngLoad = oldEng ? calculateEngineerComplexity(oldEng) : 0;
    const targetEngLoad = calculateEngineerComplexity(targetEng);
    
    const oldLoadScore = avgLoad > 0 ? Math.min(100, Math.round((oldEngLoad / avgLoad) * 50)) : 50;
    const targetLoadScore = avgLoad > 0 ? Math.min(100, Math.round((targetEngLoad / avgLoad) * 50)) : 50;
    
    const oldLoadLabel = oldLoadScore > 60 ? "Above Average" : (oldLoadScore < 40 ? "Below Average" : "Average");
    const targetLoadLabel = targetLoadScore > 60 ? "Above Average" : (targetLoadScore < 40 ? "Below Average" : "Average");

    const slackPayload = {
      text: `*QueueMind AI Copilot: Reassignment Alert*`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*QueueMind Escalation Intervention Resolved* ${mentionText}`
          }
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Ticket ID:* #${formatTicketId(ticketId)}` },
            { type: "mrkdwn", text: `*Account:* ${currentTicket.account}` },
            { type: "mrkdwn", text: `*Category:* ${currentTicket.category}` },
            { type: "mrkdwn", text: `*Impact Sentiment:* Frustrated` }
          ]
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Operational Fix Applied:* Reassigned from *${oldAssigneeName}* (Capacity Load Index: ${oldLoadScore}, ${oldLoadLabel}) to *${targetEng.name}* (${targetEng.title || 'Technical Support Engineer'}).\n*New Capacity Load Index:* ${targetLoadScore} (${targetLoadLabel})`
          }
        }
      ]
    };
    sendSlackPost(slackUrl, slackPayload);
  }

  // 5. Success feedback & refresh lists
  showToast(`Ticket reassigned to ${targetEng.name}! Dashboard metrics updated.`, "success");
  scrapeActiveTicket();
  refreshTeamDashboard();
}

// Perform manual CRM tickets sync
async function performManualSync() {
  try {
    const res = await fetch(getCrmServerUrl() + "/api/state");
    if (res.ok) {
      window.queueMindMockData = await res.json();
      localStorage.setItem("queuemind_cached_state", JSON.stringify(window.queueMindMockData));
    }
  } catch (err) {
    console.warn("Could not reach API server on performManualSync, using local fallback", err);
  }
  
  await fetchSolveTimeStats();
  ticketsSynced = true;
  localStorage.setItem("queuemind_tickets_synced", "true");
  setupAutoSyncTimer();
}

// Unified helper function to render manager actions (Draft editor, Slack ping, supervisor callback card, action buttons)
function renderManagerActions(container, ticket, cached, assigneeName, onActionComplete) {
  container.innerHTML = "";
  if (!cached) return;

  const cacheKey = ticket.id.replace('t_','T-') + "_" + (ticket.conversations ? ticket.conversations.length : ticket.threadLength || 0);

  // 1. Supervisor Callback Card
  if (cached.managerShouldCall) {
    const callbackCard = document.createElement("div");
    callbackCard.className = "manager-callback-card";
    callbackCard.innerHTML = `
      <div class="manager-callback-header"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" style="vertical-align: middle; margin-right: 4px; margin-bottom: 2px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> Supervisor Callback Suggested</div>
      <div class="manager-callback-detail"><strong>Contact:</strong> ${escapeHtml(cached.contactName || ticket.account || 'Customer')}</div>
      ${cached.contactPhone ? `<div class="manager-callback-detail"><strong>Phone:</strong> <span class="phone-highlight" title="Call Customer">${escapeHtml(cached.contactPhone)}</span></div>` : ''}
      <div class="manager-callback-detail"><strong>Email:</strong> <span>${escapeHtml(cached.contactEmail || ticket.contact || 'N/A')}</span></div>
    `;
    
    const phoneHighlight = callbackCard.querySelector(".phone-highlight");
    if (phoneHighlight) {
      phoneHighlight.addEventListener("click", (e) => {
        e.stopPropagation();
        showToast(`Initiating outbound callback call to ${cached.contactName || ticket.account} at ${cached.contactPhone}...`, "success");
      });
    }
    container.appendChild(callbackCard);
  }

  // 2. Respond on Ticket (Draft Editor)
  let textarea = null;
  if (cached.managerDraftResponse) {
    const draftSection = document.createElement("div");
    draftSection.className = "manager-draft-reply-section";
    
    draftSection.innerHTML = `
      <div class="manager-draft-reply-toggle" role="button" tabindex="0" aria-expanded="false" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 12px; font-weight: bold; color: var(--color-primary-light); background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; padding: 8px 10px; margin-bottom: 8px; outline: none; transition: all 0.2s;">
        <span style="display: flex; align-items: center; gap: 6px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>Respond on Ticket</span>
        <span class="draft-toggle-icon" style="font-size: 10px; color: var(--color-text-dim);">▼</span>
      </div>
      
      <div class="manager-draft-reply-body" style="display: none; border: 1px solid rgba(255,255,255,0.05); border-radius: 4px; padding: 8px; background: rgba(255,255,255,0.01); margin-bottom: 10px;">
        <div class="manager-rich-text-toolbar" style="display: flex; gap: 4px; margin-bottom: 6px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; padding: 2px;">
          <button class="toolbar-btn btn-bold" type="button" style="background: none; border: none; color: var(--color-text-main); font-weight: bold; cursor: pointer; padding: 2px 6px; font-size: 11px;">B</button>
          <button class="toolbar-btn btn-italic" type="button" style="background: none; border: none; color: var(--color-text-main); font-style: italic; cursor: pointer; padding: 2px 6px; font-size: 11px;">I</button>
          <button class="toolbar-btn btn-underline" type="button" style="background: none; border: none; color: var(--color-text-main); text-decoration: underline; cursor: pointer; padding: 2px 6px; font-size: 11px;">U</button>
        </div>
        <div class="manager-draft-reply-textarea" contenteditable="true" placeholder="Review and edit manager reply..." style="outline: none; margin-bottom: 6px; min-height: 80px; font-size: 11.5px; line-height: 1.4; color: var(--color-text-main);"></div>
        <div class="manager-revision-row" style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <div style="display: flex; gap: 6px; align-items: center; flex: 1;">
            <button class="mini-action-btn secondary btn-revise-draft" style="flex: none; font-size: 8px; padding: 2px 6px; text-transform: none; margin-top: 0; display: inline-flex; align-items: center; gap: 3px;"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M12 3v1M12 20v1M20 12h1M3 12h1M18.36 5.64l-.7.7M6.34 17.66l-.7.7M18.36 18.36l-.7-.7M6.34 6.34l-.7-.7"/></svg>Revise with AI</button>
            <div class="revision-prompt-container" style="display: none; flex: 1; gap: 4px; align-items: center;">
              <input type="text" class="manager-revision-input" placeholder="e.g. make it shorter, friendlier" style="flex: 1; font-size: 10px; padding: 2px 4px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-glass); color: #fff; border-radius: 3px;">
              <button class="mini-action-btn btn-submit-revision" style="flex: none; font-size: 8px; padding: 2px 6px; text-transform: none; margin-top: 0;">Go</button>
            </div>
          </div>
          <button class="mini-action-btn btn-submit-reply" style="flex: none; background: var(--color-success); color: #fff; font-size: 8px; padding: 2px 8px; border-radius: 3px; font-weight: 600; cursor: pointer; border: none; margin-top: 0;">Submit Reply</button>
        </div>
      </div>
    `;
    
    textarea = draftSection.querySelector(".manager-draft-reply-textarea");
    textarea.innerHTML = convertMarkdownToHtml(cached.managerDraftResponse);
    
    const toggleBtn = draftSection.querySelector(".manager-draft-reply-toggle");
    const replyBody = draftSection.querySelector(".manager-draft-reply-body");
    const toggleIcon = draftSection.querySelector(".draft-toggle-icon");

    const toggleDraftFn = () => {
      if (replyBody.style.display === "none") {
        replyBody.style.display = "block";
        toggleIcon.innerText = "▲";
        toggleBtn.setAttribute("aria-expanded", "true");
      } else {
        replyBody.style.display = "none";
        toggleIcon.innerText = "▼";
        toggleBtn.setAttribute("aria-expanded", "false");
      }
    };

    toggleBtn.addEventListener("click", toggleDraftFn);
    toggleBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleDraftFn();
      }
    });
    
    draftSection.querySelector(".btn-bold").onclick = (e) => {
      e.stopPropagation();
      document.execCommand('bold');
    };
    draftSection.querySelector(".btn-italic").onclick = (e) => {
      e.stopPropagation();
      document.execCommand('italic');
    };
    draftSection.querySelector(".btn-underline").onclick = (e) => {
      e.stopPropagation();
      document.execCommand('underline');
    };

    syncDraftToHelpdesk(ticket.id, convertMarkdownToHtml(cached.managerDraftResponse));
    
    textarea.addEventListener("input", (e) => {
      cached.managerDraftResponse = e.target.innerHTML;
      saveAICache();
      syncDraftToHelpdesk(ticket.id, e.target.innerHTML);
    });
    
    const reviseBtn = draftSection.querySelector(".btn-revise-draft");
    const promptContainer = draftSection.querySelector(".revision-prompt-container");
    reviseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (promptContainer.style.display === "none") {
        promptContainer.style.display = "flex";
        reviseBtn.innerText = "Cancel";
      } else {
        promptContainer.style.display = "none";
        reviseBtn.innerHTML = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M12 3v1M12 20v1M20 12h1M3 12h1M18.36 5.64l-.7.7M6.34 17.66l-.7.7M18.36 18.36l-.7-.7M6.34 6.34l-.7-.7"/></svg>Revise with AI`;
      }
    });
    
    const submitRevBtn = draftSection.querySelector(".btn-submit-revision");
    const revInput = draftSection.querySelector(".manager-revision-input");
    submitRevBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const promptText = revInput.value.trim();
      if (!promptText) return;
      
      submitRevBtn.innerText = "...";
      submitRevBtn.disabled = true;
      revInput.disabled = true;
      textarea.contentEditable = "false";
      
      try {
        const currentDraftText = textarea.innerHTML.trim();
        const apiKey = localStorage.getItem("queuemind_gemini_key") || "";
        const selectedModel = localStorage.getItem("queuemind_gemini_model") || "gemini-2.5-flash";
        
        let revisedText = "";
        if (apiKey) {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;
          const systemPrompt = `You are a professional customer support manager. Take this HTML formatted draft response to a customer and revise/rewrite it according to this instruction.\n\nInstruction: "${promptText}"\n\nCurrent Draft:\n"${currentDraftText}"\n\nReturn ONLY the revised response HTML/text. Do not wrap in markdown or add commentary. Return just the revised text.`;
          
          const revisionPayload = {
            contents: [{ parts: [{ text: systemPrompt }] }]
          };
          
          const res = await fetchWithRetry(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(revisionPayload)
          });
          
          if (res.ok) {
            const dataJson = await res.json();
            if (dataJson.candidates && dataJson.candidates[0].content && dataJson.candidates[0].content.parts[0].text) {
              revisedText = dataJson.candidates[0].content.parts[0].text.trim();
            }
          }
        }
        
        if (!revisedText) {
          revisedText = `${currentDraftText}<br><br>[Revised: ${promptText}]`;
        }
        
        const htmlText = convertMarkdownToHtml(revisedText);
        textarea.innerHTML = htmlText;
        cached.managerDraftResponse = revisedText;
        saveAICache();
        syncDraftToHelpdesk(ticket.id, htmlText);
        showToast("Draft revised successfully using Gemini.", "success");
        
        promptContainer.style.display = "none";
        reviseBtn.innerHTML = `<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M12 3v1M12 20v1M20 12h1M3 12h1M18.36 5.64l-.7.7M6.34 17.66l-.7.7M18.36 18.36l-.7-.7M6.34 6.34l-.7-.7"/></svg>Revise with AI`;
        revInput.value = "";
      } catch (err) {
        console.error("Revision failed:", err);
        showToast(`Failed to revise: ${err.message}`, "error");
      } finally {
        submitRevBtn.innerText = "Go";
        submitRevBtn.disabled = false;
        revInput.disabled = false;
        textarea.contentEditable = "true";
      }
    });

    const submitReplyBtn = draftSection.querySelector(".btn-submit-reply");
    submitReplyBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      submitReplyBtn.innerText = "Submitting...";
      submitReplyBtn.disabled = true;
      
      try {
        const currentText = textarea.innerHTML.trim();
        const res = await fetch(getCrmServerUrl() + "/api/reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId: ticket.id, message: currentText })
        });
        
        if (res.ok) {
          // Invalidate cache key
          const ticketPrefix = ticket.id.replace('t_','T-') + "_";
          for (const k in aiAnalysisCache) {
            if (k.startsWith(ticketPrefix)) {
              delete aiAnalysisCache[k];
            }
          }
          saveAICache();
          
          await performManualSync(); // Sync to server state
          showToast("Manager response submitted directly to ticket thread.", "success");
          
          const confirmResolve = await showConfirm("Resolve Alert", "Would you like to resolve this At Risk alert until the next customer update?");
          if (confirmResolve) {
            snoozedRiskTickets[cacheKey] = true;
            setSecureItem("queuemind_snoozed_risk", snoozedRiskTickets);
          }
          
          if (onActionComplete) onActionComplete("reply");
        } else {
          throw new Error(`Server returned ${res.status}`);
        }
      } catch (err) {
        console.error("Submit reply failed:", err);
        showToast(`Failed to submit reply: ${err.message}`, "error");
        submitReplyBtn.innerText = "Submit Reply";
        submitReplyBtn.disabled = false;
      }
    });

    container.appendChild(draftSection);
  }

  // 3. Action Buttons Row (Open Ticket, Message Agent, Resolve Alert)
  const btnRow = document.createElement("div");
  btnRow.className = "quick-action-btn-row";

  const openCaseBtn = document.createElement("button");
  openCaseBtn.className = "mini-action-btn";
  openCaseBtn.innerText = "Open Ticket";
  openCaseBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    deepLinkMockHelpdesk(ticket.id);
  });

  const msgAgentBtn = document.createElement("button");
  msgAgentBtn.className = "mini-action-btn secondary";
  msgAgentBtn.innerText = "Message Agent";
  msgAgentBtn.addEventListener("click", (event) => {
    messageAssigneeSlack(ticket.id.replace('t_','T-'), assigneeName, event);
  });

  const resolveAlertBtn = document.createElement("button");
  resolveAlertBtn.className = "mini-action-btn secondary";
  resolveAlertBtn.innerText = "Resolve Alert";
  resolveAlertBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    snoozedRiskTickets[cacheKey] = true;
    setSecureItem("queuemind_snoozed_risk", snoozedRiskTickets);
    showToast("Risk alert resolved/snoozed until next customer update.", "success");
    if (onActionComplete) onActionComplete("resolve");
  });

  btnRow.appendChild(openCaseBtn);
  btnRow.appendChild(msgAgentBtn);
  btnRow.appendChild(resolveAlertBtn);
  container.appendChild(btnRow);
}

// 7. Team Dashboard Rendering (Macro Workflow)
function refreshTeamDashboard() {
  const container = document.getElementById("team-engineers-container");
  if (!container) return;
  container.innerHTML = "";

  const descEl = document.getElementById("team-monitor-desc");
  const bannerContainer = document.getElementById("team-crm-banner-container");
  if (bannerContainer) bannerContainer.innerHTML = "";

  // 1. CRM Not Connected State
  if (!agentsFetched) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 16px; border: 1px dashed rgba(255,255,255,0.08); border-radius: 8px; margin: 10px 0; line-height: 1.4;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-dim)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon" style="margin-bottom: 10px; opacity: 0.6; display: block; margin: 0 auto 10px auto;"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
        <strong style="color: var(--color-text-main); font-size: 13px;">CRM Database Disconnected</strong><br>
        <span style="font-size: 11.5px; color: var(--color-text-dim); display: block; margin-top: 6px;">Go to the <strong>Settings</strong> tab and click "Connect & Load Agents from CRM" to pull database records.</span>
      </div>
    `;
    if (descEl) descEl.innerText = "CRM disconnected";
    const healthEl = document.getElementById("team-health-pct");
    if (healthEl) healthEl.innerText = "--";
    return;
  }

  if (!window.queueMindMockData || !window.queueMindMockData.engineers) {
    container.innerHTML = `<div class="empty-state-message" style="text-align: center; padding: 24px; color: var(--color-text-muted);">
      <strong>No database connection</strong><br>Start the local server or check connection settings.
    </div>`;
    if (descEl) descEl.innerText = "No connection to state database";
    const healthEl = document.getElementById("team-health-pct");
    if (healthEl) healthEl.innerText = "--";
    return;
  }

  const displayEngineers = window.queueMindMockData.engineers.filter(e => trackedEngineerIds.has(e.id));

  // 2. No Engineers Tracked State
  if (displayEngineers.length === 0) {
    container.innerHTML = `
      <div class="empty-state-message" style="text-align: center; padding: 24px 16px; color: var(--color-text-muted); border: 1px dashed rgba(255,255,255,0.08); border-radius: 8px; margin: 10px 0; line-height: 1.4;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-dim)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon" style="margin-bottom: 8px; opacity: 0.6; display: block; margin: 0 auto 8px auto;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <strong>No Engineers Tracked</strong><br>
        <span style="font-size: 11.5px; color: var(--color-text-dim); display: block; margin-top: 4px;">Go to the <strong>Settings</strong> tab to search and add team members to your active monitoring queue.</span>
      </div>
    `;
    if (descEl) descEl.innerText = "No support engineers tracked";
    const healthEl = document.getElementById("team-health-pct");
    if (healthEl) healthEl.innerText = "100%";
    return;
  }

  // 3. Tickets Not Synced Banner State
  if (!ticketsSynced && bannerContainer) {
    bannerContainer.innerHTML = `
      <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 6px; padding: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; line-height: 1.4;">
        <div style="font-size: 11.5px; color: var(--color-text-main);">
          <strong>CRM Connection Active:</strong> Tracked personnel loaded. Ready to pull ticket queues.
        </div>
        <button class="primary-action-btn" id="btn-sync-crm-tickets" style="margin: 0; width: auto; padding: 5px 12px; font-size: 11px; display: flex; align-items: center; gap: 4px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Sync CRM Tickets
        </button>
      </div>
    `;
    const syncBtn = bannerContainer.querySelector("#btn-sync-crm-tickets");
    if (syncBtn) {
      syncBtn.addEventListener("click", async () => {
        syncBtn.disabled = true;
        syncBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" style="animation: spin 1s linear infinite;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg> Syncing backlog...`;
        
        await performManualSync();
        
        bannerContainer.innerHTML = "";
        refreshTeamDashboard();
      });
    }
  }

  if (descEl) {
    descEl.innerText = `Active queue load for ${displayEngineers.length} Support Engineer${displayEngineers.length > 1 ? 's' : ''}`;
  }

  // Calculate team average load for relative normalization
  const allLoads = window.queueMindMockData.engineers.map(e => calculateEngineerComplexity(e));
  const totalLoad = allLoads.reduce((a, b) => a + b, 0);
  const avgLoad = totalLoad / (allLoads.length || 1);

  // Calculate if any ticket has been analyzed
  let anyTicketAnalyzed = false;
  displayEngineers.forEach(e => {
    const activeBacklog = ticketsSynced ? e.backlog : [];
    activeBacklog.forEach(t => {
      const cacheKey = t.id.replace('t_','T-') + "_" + (t.conversations ? t.conversations.length : t.threadLength || 0);
      if (aiAnalysisCache[cacheKey]) {
        anyTicketAnalyzed = true;
      }
    });
  });

  let totalCapacity = 0;
  let activeBacklogCount = 0;

  displayEngineers.forEach(eng => {
    const activeBacklog = ticketsSynced ? eng.backlog : [];
    const engLoad = ticketsSynced ? calculateEngineerComplexity(eng) : 0;
    totalCapacity += engLoad;
    activeBacklogCount += activeBacklog.length;

    // Calculate relative load score (normalized where 50 is average)
    let relativeLoadScoreHtml = "—";
    let loadClass = "";

    if (ticketsSynced && anyTicketAnalyzed) {
      const relativeLoadScore = avgLoad > 0 ? Math.min(100, Math.round((engLoad / avgLoad) * 50)) : 0;
      relativeLoadScoreHtml = relativeLoadScore.toString();
      
      loadClass = "val-green";
      if (relativeLoadScore > 60) {
        loadClass = "val-red";
      } else if (relativeLoadScore >= 40) {
        loadClass = "val-yellow";
      }
    }

    // Count tickets needing attention (only count analyzed tickets that meet attention thresholds and are not snoozed)
    const needAttentionTickets = activeBacklog.filter(t => {
      const cacheKey = t.id.replace('t_','T-') + "_" + (t.conversations ? t.conversations.length : t.threadLength || 0);
      if (snoozedRiskTickets[cacheKey]) return false;
      const cached = aiAnalysisCache[cacheKey];
      if (!cached) return false;
      return cached.isAtRisk === true || (cached.isAtRisk === undefined && (cached.attentionScore >= 75 || cached.sentimentScore < 40));
    });
    const needAttentionCount = needAttentionTickets.length;
    const isExpanded = expandedEngineerIds.has(eng.id);
    const accordion = document.createElement("div");
    accordion.className = `eng-accordion-card ${needAttentionCount > 0 ? 'has-danger' : ''} ${isExpanded ? 'expanded' : ''}`;
    accordion.setAttribute("id", `eng-card-${eng.id}`);

    // Create header programmatically for CSP compliance
    const header = document.createElement("div");
    header.className = "eng-card-header";
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.setAttribute("aria-expanded", isExpanded ? "true" : "false");
    header.setAttribute("aria-label", `${eng.name}, Backlog size ${activeBacklog.length}, Load Complexity ${relativeLoadScoreHtml}. Press Enter or Space to toggle details.`);

    const specialties = getEngineerSpecialties(eng.name);
    const primarySpecialty = specialties.length > 0 ? specialties[0].category : "Generalist";
    const topCustomers = eng.history && eng.history.accountCSAT 
      ? Object.entries(eng.history.accountCSAT)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3) 
      : [];

    const accountSurveyCounts = {};
    if (window.queueMindMockData && window.queueMindMockData.closedTickets) {
      window.queueMindMockData.closedTickets.forEach(t => {
        if (t.assignedTo === eng.name) {
          accountSurveyCounts[t.account] = (accountSurveyCounts[t.account] || 0) + 1;
        }
      });
    }

    const avatarContent = eng.avatarImg ? `<img src="${eng.avatarImg}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : eng.avatar;

    header.innerHTML = `
      <div class="eng-identity">
        <div class="eng-avatar">${avatarContent}</div>
        <div class="eng-details">
          <div class="eng-name">
            ${eng.name}
            ${needAttentionCount > 0 ? `<span class="badge-risk">${needAttentionCount} At Risk</span>` : ''}
          </div>
          <div class="eng-specialty">${eng.title || 'Technical Support Engineer'}</div>
        </div>
      </div>
      <div class="eng-stats">
        <div class="stat-item">
          <span class="stat-val">${activeBacklog.length}</span>
          <span class="stat-lbl">Count</span>
        </div>
        <div class="stat-item">
          <span class="stat-val ${loadClass}">${relativeLoadScoreHtml}</span>
          <span class="stat-lbl">Complexity</span>
        </div>
      </div>
    `;

    // Add programmatic accordion toggle listener
    header.addEventListener("click", () => {
      toggleEngineerAccordion(eng.id);
      const isNowExpanded = expandedEngineerIds.has(eng.id);
      header.setAttribute("aria-expanded", isNowExpanded ? "true" : "false");
    });
    header.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleEngineerAccordion(eng.id);
        const isNowExpanded = expandedEngineerIds.has(eng.id);
        header.setAttribute("aria-expanded", isNowExpanded ? "true" : "false");
      }
    });
    
    accordion.appendChild(header);

    // Create card body container
    const body = document.createElement("div");
    body.className = "eng-card-body";
    
    // Render computed specialties profile combined into a single collapsible card
    let specialtiesHtml = `
      <div class="eng-profile-toggle" data-eng-id="${eng.id}" role="button" tabindex="0" aria-expanded="false">
        <span style="display: flex; align-items: center; gap: 6px;">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Skills & Client Affinity
        </span>
        <span class="profile-toggle-icon">▼</span>
      </div>
      
      <div class="eng-profile-content" style="display: none; margin-bottom: 8px; border-bottom: 1px dashed rgba(255,255,255,0.08); padding-bottom: 8px;">
        <div style="display: flex; gap: 10px;">
          <!-- Left Column: Strongest Skills -->
          <div style="flex: 1;">
            <div class="eng-card-body-title" style="margin-bottom: 6px; font-size: 9.5px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px dashed rgba(255,255,255,0.08); padding-bottom: 2px;">
              Strongest Skills
              <span class="info-icon" tabindex="0" role="note" data-tooltip="Top categories dynamically calculated based on CSAT, closed case volume, and solve speeds over 3 months.">i</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
      `;
      specialties.forEach(spec => {
        specialtiesHtml += `
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 4px; padding: 4px 6px; font-size: 10px;">
            <div style="font-weight: 600; color: var(--color-primary-light); margin-bottom: 2px; font-size: 9.5px;">${spec.category}</div>
            <div style="display: flex; justify-content: space-between; color: var(--color-text-dim); font-size: 8.5px; gap: 2px;">
              <span>Vol: ${spec.volume}</span>
              <span>CSAT: ${spec.avgCSAT}★</span>
              <span>Solve: ${spec.avgSolveTime}h</span>
            </div>
          </div>
        `;
      });
      specialtiesHtml += `
            </div>
          </div>
          
          <!-- Right Column: Top Customers -->
          <div style="flex: 1;">
            <div class="eng-card-body-title" style="margin-bottom: 6px; font-size: 9.5px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px dashed rgba(255,255,255,0.08); padding-bottom: 2px;">
              Top Customers
              <span class="info-icon" tabindex="0" role="note" data-tooltip="Customers where this engineer achieves the highest average CSAT rating in historical closed tickets.">i</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
      `;
      if (topCustomers.length === 0) {
        specialtiesHtml += `<div style="font-size:10px; color:var(--color-text-dim); text-align:center; padding: 10px 0;">No customer history</div>`;
      } else {
        topCustomers.forEach(cust => {
          const count = accountSurveyCounts[cust[0]] || 0;
          specialtiesHtml += `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 4px; padding: 4px 6px; font-size: 10px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 500; color: var(--color-text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55px; font-size: 9.5px;" title="${cust[0]}">${cust[0]}</span>
              <span style="color: var(--color-success); font-weight: 600; font-size: 9.5px; white-space: nowrap;">${cust[1]}★ (${count} survey${count !== 1 ? 's' : ''})</span>
            </div>
          `;
        });
      }
      
      const isFilterActive = activeReassignRecsFilters.has(eng.id);
      const filterBtnStyle = isFilterActive 
        ? 'background: rgba(16, 185, 129, 0.15); border-color: var(--color-success); color: var(--color-success);'
        : '';

      specialtiesHtml += `
            </div>
          </div>
        </div>
      </div>
      <div class="eng-section-header" style="${isFilterActive ? 'border-left-color: var(--color-success); background: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.2);' : ''}">
        <div class="eng-card-body-title" id="backlog-title-${eng.id}" style="margin-bottom: 0; border: none; padding-bottom: 0; display: flex; align-items: center; gap: 6px; color: ${isFilterActive ? 'var(--color-success)' : 'var(--color-text-main)'}; font-weight: 700;">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          ${isFilterActive ? 'Reassignment Recommendations' : 'Active Backlog'}
        </div>
        <button class="secondary-action-btn btn-reassign-recs" data-eng-id="${eng.id}" aria-pressed="${isFilterActive ? 'true' : 'false'}" style="font-size: 10px; padding: 4px 8px; font-weight: 600; display: flex; align-items: center; gap: 4px; cursor: pointer; transition: all 0.2s; ${filterBtnStyle}">
          Reassign Recs
        </button>
      </div>
    `;
    body.innerHTML = specialtiesHtml;

    // Register profile toggle click listener programmatically
    const profileToggle = body.querySelector(".eng-profile-toggle");
    if (profileToggle) {
      const toggleProfileFn = (e) => {
        const content = body.querySelector(".eng-profile-content");
        const icon = body.querySelector(".profile-toggle-icon");
        if (content.style.display === "none") {
          content.style.display = "block";
          icon.innerText = "▲";
          profileToggle.setAttribute("aria-expanded", "true");
        } else {
          content.style.display = "none";
          icon.innerText = "▼";
          profileToggle.setAttribute("aria-expanded", "false");
        }
      };

      profileToggle.addEventListener("click", (e) => {
        e.stopPropagation(); // prevent accordion collapse
        toggleProfileFn(e);
      });

      profileToggle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation(); // prevent accordion collapse
          toggleProfileFn(e);
        }
      });
    }

    // Register toggle click listener for Reassign Recs filter button programmatically
    const filterBtn = body.querySelector(".btn-reassign-recs");
    if (filterBtn) {
      filterBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // prevent accordion collapse
        if (activeReassignRecsFilters.has(eng.id)) {
          activeReassignRecsFilters.delete(eng.id);
        } else {
          activeReassignRecsFilters.add(eng.id);
        }
        refreshTeamDashboard();
      });
    }

    const ticketsContainer = document.createElement("div");
    ticketsContainer.className = "eng-tickets-list";
    ticketsContainer.setAttribute("id", `eng-tickets-list-${eng.id}`);
    if (isFilterActive) {
      ticketsContainer.style.border = "1px dashed rgba(16, 185, 129, 0.4)";
      ticketsContainer.style.background = "rgba(16, 185, 129, 0.04)";
      ticketsContainer.style.borderRadius = "6px";
      ticketsContainer.style.padding = "6px";
    }
    
    body.appendChild(ticketsContainer);
    accordion.appendChild(body);
    container.appendChild(accordion);

    // Filter tickets if Reassign Recs filter is active for this engineer
    const sortedBacklog = sortBacklogTickets(activeBacklog);
    let displayedTickets = sortedBacklog;
    let showingRebalanceOptions = false;
    if (isFilterActive) {
      displayedTickets = sortedBacklog.filter(t => findReassignmentRecommendation(t, eng) !== null);
      if (displayedTickets.length === 0) {
        // If there are no easy recommendations, show all tickets sorted by complexity (High first) so the user can reassign
        displayedTickets = [...sortedBacklog].sort((a, b) => {
          const score = { "High": 3, "Medium": 2, "Low": 1 };
          return (score[b.complexity] || 2) - (score[a.complexity] || 2);
        });
        showingRebalanceOptions = true;
      }
    }

    // Populate tickets list in expanded body
    if (displayedTickets.length === 0) {
      if (isFilterActive) {
        ticketsContainer.innerHTML = `<div style="font-size:11px; color:var(--color-text-dim); text-align:center; padding: 10px 0;">No easy reassignment candidates in backlog.</div>`;
      } else {
        ticketsContainer.innerHTML = `<div style="font-size:11px; color:var(--color-text-dim); text-align:center; padding: 10px 0;">Queue empty (Healthy)</div>`;
      }
    } else {
      displayedTickets.forEach(t => {
        const row = document.createElement("div");
        row.className = "eng-ticket-row";
        row.style.cursor = "pointer";
        row.tabIndex = 0;
        row.setAttribute("role", "link");
        if (isFilterActive) {
          row.style.borderLeft = "3px solid var(--color-success-light)";
          row.style.borderColor = "rgba(16, 185, 129, 0.25)";
          row.style.background = "rgba(10, 15, 29, 0.6)";
        }
        
        // Check if this ticket has a cached AI analysis
        const cacheKey = t.id.replace('t_','T-') + "_" + (t.conversations ? t.conversations.length : t.threadLength || 0);
        const cached = aiAnalysisCache[cacheKey];

        // Compute relative or actual scores for tags
        let attnScore = 50;
        let sentScore = 55;
        let compScore = 50;

        if (t.sentiment === "Frustrated") sentScore = 15;
        else if (t.sentiment === "Demanding") sentScore = 25;
        else if (t.sentiment === "Confused") sentScore = 45;
        else if (t.sentiment === "Neutral") sentScore = 55;
        else if (t.sentiment === "Satisfied") sentScore = 85;

        if (t.complexity === "High") compScore = 80;
        else if (t.complexity === "Medium") compScore = 50;
        else if (t.complexity === "Low") compScore = 20;

        if (t.sentiment === "Frustrated" || t.sentiment === "Demanding") attnScore = t.complexity === "High" ? 90 : 75;
        else if (t.threadLength >= 3) attnScore = 65;
        else attnScore = compScore === 80 ? 60 : 35;

        if (cached) {
          attnScore = cached.attentionScore;
          sentScore = cached.sentimentScore;
          compScore = cached.complexityScore;
        }

        const hasAttentionIssue = cached && 
                                  (cached.isAtRisk === true || 
                                   (cached.isAtRisk === undefined && (attnScore >= 75 || sentScore < 40))) && 
                                  !snoozedRiskTickets[cacheKey];

        const attnColor = attnScore >= 75 ? "danger" : (attnScore >= 40 ? "warning" : "success");
        const sentColor = sentScore <= 30 ? "danger" : (sentScore <= 70 ? "warning" : "success");
        const compColor = compScore >= 75 ? "danger" : (compScore >= 35 ? "warning" : "success");

        let aiCompactHtml = "";
        if (cached) {
          const scrubbedDiagnosis = scrubPII(cached.diagnosis);
          const scrubbedNextAction = scrubPII(cached.nextAction);
          const recHtml = scrubbedNextAction
            ? `<div style="color: var(--color-text-muted); font-size: 10.5px; margin-top: 4px;">
                 <strong style="font-weight: 600;">Recommendation:</strong> <span style="font-weight: normal;">${scrubbedNextAction}</span>
               </div>`
            : "";

          aiCompactHtml = `
            <div class="eng-ticket-ai-compact" style="margin-top: 8px; padding: 8px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; font-size: 11px; line-height: 1.4;">
              <div style="color: var(--color-text-main); display: flex; align-items: flex-start; gap: 6px;">
                ${scrubbedDiagnosis ? `
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon" style="margin-top: 2px; flex-shrink: 0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <div style="flex: 1;">
                    <strong style="font-weight: 600; color: var(--color-text-main);">Diagnosis:</strong>
                    <span style="font-weight: normal; color: var(--color-text-main);">${scrubbedDiagnosis}</span>
                    ${recHtml}
                  </div>
                ` : `
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="icon" style="margin-top: 2px; flex-shrink: 0;"><polyline points="20 6 9 17 4 12"/></svg>
                  <div style="flex: 1;">
                    <strong style="font-weight: 600; color: var(--color-text-main);">Status:</strong>
                    <span style="font-weight: normal; color: var(--color-text-muted);">Backlog stable.</span>
                    ${recHtml}
                  </div>
                `}
              </div>
            </div>
          `;
        }

        const rec = cached ? findReassignmentRecommendation(t, eng) : null;
        let recHtml = "";
        if (rec) {
          const recLoadScore = avgLoad > 0 ? Math.min(100, Math.round((rec.load / avgLoad) * 50)) : 50;
          recHtml = `
            <div class="reassign-recommendation-alert" style="margin-top: 8px; padding: 8px; background: rgba(16, 185, 129, 0.08); border: 1px dashed rgba(16, 185, 129, 0.3); border-radius: 4px; font-size: 11px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
              <div style="color: var(--color-text-main);">
                <strong>Easy Reassign:</strong> Suggest <strong class="score-badge-tooltip" tabindex="0" role="note" data-tooltip="${getMatchExplanation(rec.engineer, t)}">${rec.engineer.name}</strong> (${rec.matchPct}% match, Load Index: ${recLoadScore})
              </div>
              <button class="mini-action-btn btn-quick-reassign" data-target-eng-id="${rec.engineer.id}" style="background: var(--color-success); color: #fff; border: none; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 600; cursor: pointer; white-space: nowrap;">Reassign</button>
            </div>
          `;
        } else if (showingRebalanceOptions) {
          const candidates = getReassignmentCandidates(t, eng).slice(0, 2);
          if (candidates.length > 0) {
            let optionsHtml = candidates.map(cand => {
              const candLoadScore = avgLoad > 0 ? Math.min(100, Math.round((cand.load / avgLoad) * 50)) : 50;
              return `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; padding: 4px 6px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 3px;">
                  <span style="color: var(--color-text-muted);"><strong class="score-badge-tooltip" tabindex="0" role="note" data-tooltip="${escapeHtml(getMatchExplanation(cand.engineer, t))}">${escapeHtml(cand.engineer.name)}</strong> (Match: ${cand.matchPct}%, Load: ${candLoadScore})</span>
                  <button class="mini-action-btn btn-quick-reassign" data-target-eng-id="${cand.engineer.id}" style="background: var(--color-primary); color: #fff; border: none; padding: 1px 6px; border-radius: 2px; font-size: 9px; cursor: pointer;">Reassign</button>
                </div>
              `;
            }).join('');
            
            recHtml = `
              <div class="reassign-recommendation-alert" style="margin-top: 8px; padding: 8px; background: rgba(255, 255, 255, 0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 4px; font-size: 11px;">
                <div style="color: var(--color-text-main); font-weight: 600; margin-bottom: 4px;">Team Rebalance Options:</div>
                ${optionsHtml}
              </div>
            `;
          }
        }

        let tagsHtml = "";
        if (cached) {
          tagsHtml = `
            <span class="score-badge-tooltip tooltip-align-left" tabindex="0" role="note" data-tooltip="${escapeHtml(cached.attentionReason || 'Reasoning details not analyzed.')}" style="border: 1px solid var(--color-${attnColor}); color: var(--color-${attnColor}); font-size: 9px; padding: 1px 4px; border-radius: 3px; font-weight: 600; text-transform: uppercase;">ATTN: ${attnScore}</span>
            <span class="score-badge-tooltip tooltip-align-left" tabindex="0" role="note" data-tooltip="${escapeHtml(cached.sentimentReason || 'Reasoning details not analyzed.')}" style="border: 1px solid var(--color-${sentColor}); color: var(--color-${sentColor}); font-size: 9px; padding: 1px 4px; border-radius: 3px; font-weight: 600; text-transform: uppercase;">SENT: ${sentScore}</span>
            <span class="score-badge-tooltip" tabindex="0" role="note" data-tooltip="${escapeHtml(cached.complexityReason || 'Reasoning details not analyzed.')}" style="border: 1px solid var(--color-${compColor}); color: var(--color-${compColor}); font-size: 9px; padding: 1px 4px; border-radius: 3px; font-weight: 600; text-transform: uppercase;">COMP: ${compScore}</span>
          `;
        } else {
          tagsHtml = `
            <span tabindex="0" role="note" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: var(--color-text-dim); font-size: 8.5px; padding: 1px 4px; border-radius: 3px; font-weight: 600; text-transform: uppercase;">Pending AI Scan</span>
          `;
        }

        row.innerHTML = `
          <div class="eng-ticket-row-header" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span class="eng-ticket-ref" style="cursor: pointer; text-decoration: underline;" title="Deep Link to Helpdesk">${escapeHtml(t.id.replace('t_','T-'))}</span>
              <span style="margin-left: 5px; font-weight: 500;">${escapeHtml(t.account)}</span>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button class="mini-analyze-btn refresh-tooltip" title="${cached ? 'Re-run AI Analysis' : 'Run AI Analysis'}" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; padding: 2px 6px; color: var(--color-primary-light); font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg></button>
              <button class="mini-deep-dive-btn" title="Go to Case View" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; padding: 2px 6px; color: var(--color-primary-light); font-size: 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>Case View</button>
            </div>
          </div>
          <div class="eng-ticket-subject" style="margin-top: 4px;">${escapeHtml(t.subject)}</div>
          <div class="eng-ticket-footer" style="margin-top: 4px;">
            <div class="eng-ticket-tags" style="display: flex; gap: 4px; align-items: center;">
              ${tagsHtml}
            </div>
            <span style="font-size:10px; color:var(--color-text-muted);">${escapeHtml(t.lastUpdate || '')}</span>
          </div>
          ${aiCompactHtml}
          ${recHtml}
        `;

        // Add event listener to the quick-reassign button(s) if rendered
        const quickReassignBtns = row.querySelectorAll(".btn-quick-reassign");
        quickReassignBtns.forEach(btn => {
          btn.addEventListener("click", (event) => {
            event.stopPropagation();
            const targetEngId = btn.getAttribute("data-target-eng-id");
            const ticketIdClean = t.id.replace('t_','T-');
            executeQuickReassign(ticketIdClean, eng.name, targetEngId, event);
          });
        });

        // Programmatic click listener for row (deep link only)
        row.addEventListener("click", () => {
          deepLinkMockHelpdesk(t.id);
        });
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            deepLinkMockHelpdesk(t.id);
          }
        });

        // Programmatic click listener for Analyze button (inline quick analysis!)
        const analyzeBtn = row.querySelector(".mini-analyze-btn");
        const svgIcon = analyzeBtn.querySelector("svg");
        analyzeBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          
          if (aiAnalysisCache[cacheKey]) {
            const confirmReRun = await showConfirm("Re-run Analysis", "This ticket has not changed since the last analysis. Do you want to analyze it again anyway?");
            if (!confirmReRun) {
              return;
            }
          }
          
          if (svgIcon) svgIcon.classList.add("spin");
          analyzeBtn.title = "AI Analyzing ticket...";
          analyzeBtn.disabled = true;

          const fullTicket = findFullTicket(t.id);
          const normalizedTicket = {
            id: t.id.replace('t_','T-'),
            subject: t.subject || "",
            account: t.account || "",
            contact: fullTicket ? fullTicket.contact : (t.contact || ""),
            category: t.category || "",
            assignee: eng.name,
            status: t.status || "",
            complexity: t.complexity || "Medium",
            conversations: fullTicket && fullTicket.conversations ? fullTicket.conversations : []
          };

          const apiKey = localStorage.getItem("queuemind_gemini_key") || "";
          let result = null;
          
          try {
            if (apiKey) {
              result = await callGeminiAPI(normalizedTicket, apiKey);
              result.isDetailed = true;
              const selectedModel = localStorage.getItem("queuemind_gemini_model") || "gemini-2.5-flash";
              const friendlyModelMap = {
                "gemini-2.0-flash": "Google Gemini 2.0 Flash",
                "gemini-2.5-flash": "Google Gemini 2.5 Flash",
                "gemini-2.0-flash-lite": "Google Gemini 2.0 Flash Lite",
                "gemini-2.5-pro": "Google Gemini 2.5 Pro",
                "gemini-3.5-flash": "Google Gemini 3.5 Flash"
              };
              result.provider = `${friendlyModelMap[selectedModel] || selectedModel} (Live AI)`;
              
              ensureContactDetails(normalizedTicket, result);
              aiAnalysisCache[cacheKey] = result;
              saveAICache();
              
              // DYNAMIC DATA UPDATE: Update complexity and sentiment dynamically!
              updateTicketDataFromAnalysis(normalizedTicket.id, result);
            } else {
              showToast("Gemini API Key is not configured. Please enter one in the Settings tab.", "warning");
              if (svgIcon) svgIcon.classList.remove("spin");
              analyzeBtn.title = "Analyze with AI";
              analyzeBtn.disabled = false;
            }
          } catch (err) {
            console.error("Quick analyze failed:", err);
            showToast(`Quick analysis failed: ${err.message}`, "error");
            if (svgIcon) svgIcon.classList.remove("spin");
            analyzeBtn.title = "Analyze with AI";
            analyzeBtn.disabled = false;
          }

          // Re-render the team dashboard to display the new analysis inline!
          refreshTeamDashboard();
        });

        // Programmatic click listener for Deep Dive button
        const deepDiveBtn = row.querySelector(".mini-deep-dive-btn");
        deepDiveBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          loadTicketInAnalyzer(t.id.replace('t_','T-'));
        });

        // Only render the quick action panel (warning box) if the ticket is analyzed and meets the attention thresholds and we are not under reassign recommendations filter
        if (hasAttentionIssue && !isFilterActive) {
          const actionBox = document.createElement("div");
          actionBox.className = "quick-action-panel";
          actionBox.style.borderTop = "none";
          actionBox.style.paddingTop = "0";
          actionBox.style.marginTop = "4px";
          
          renderManagerActions(actionBox, t, cached, eng.name, () => {
            refreshTeamDashboard();
            const caseTabPane = document.getElementById("tab-analyzer");
            if (caseTabPane.classList.contains("active") && currentTicket && currentTicket.id === t.id.replace('t_','T-')) {
              const updatedTicket = findFullTicket(t.id) || t;
              processScrapedTicket(updatedTicket);
            }
          });
          row.appendChild(actionBox);
        }

        ticketsContainer.appendChild(row);
      });
    }
  });

  // Calculate dynamic SLA health index (ratio of un-stalled queues)
  const totalTickets = window.queueMindMockData.helpdeskTickets.length + activeBacklogCount;
  const stalledTickets = window.queueMindMockData.helpdeskTickets.filter(t => t.status === "Stalled").length + 
    window.queueMindMockData.engineers.reduce((acc, e) => acc + e.backlog.filter(t => t.threadLength >= 3).length, 0);

  const slaPct = totalTickets > 0 ? Math.round(((totalTickets - stalledTickets) / totalTickets) * 100) : 100;
  const healthEl = document.getElementById("team-health-pct");
  if (healthEl) {
    healthEl.innerText = `${slaPct}%`;
    healthEl.style.color = slaPct > 85 ? "var(--color-success)" : "var(--color-danger)";
  }
}

function toggleEngineerAccordion(engId) {
  const card = document.getElementById(`eng-card-${engId}`);
  if (card) {
    card.classList.toggle("expanded");
    if (card.classList.contains("expanded")) {
      expandedEngineerIds.add(engId);
    } else {
      expandedEngineerIds.delete(engId);
    }
  }
}

// Dynamically compute engineer specialties based on closed cases history
function getEngineerSpecialties(engName) {
  if (!window.queueMindMockData || !window.queueMindMockData.closedTickets) {
    return [];
  }
  const closed = window.queueMindMockData.closedTickets.filter(t => t.assignedTo === engName);
  const categoriesMap = {};
  closed.forEach(t => {
    if (!categoriesMap[t.category]) {
      categoriesMap[t.category] = {
        volume: 0,
        totalCSAT: 0,
        totalTimeToSolve: 0
      };
    }
    categoriesMap[t.category].volume++;
    categoriesMap[t.category].totalCSAT += t.csat;
    categoriesMap[t.category].totalTimeToSolve += t.timeToSolveHours;
  });

  const scores = [];
  for (const cat in categoriesMap) {
    const data = categoriesMap[cat];
    const avgCSAT = data.totalCSAT / data.volume;
    const avgSolveTime = data.totalTimeToSolve / data.volume;
    // Skill Score = Average CSAT * Volume / Average Time to Solve
    const skillScore = avgCSAT * data.volume / (avgSolveTime || 1);
    scores.push({
      category: cat,
      score: skillScore,
      avgCSAT: avgCSAT.toFixed(1),
      avgSolveTime: avgSolveTime.toFixed(1),
      volume: data.volume
    });
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  return scores.slice(0, 2);
}

// Quantitative scoring matching calculations for inline accordion items
function calculateCapacityAndSkillMatch(eng, category, account) {
  const engLoad = calculateEngineerComplexity(eng);
  const capScore = Math.max(0, 40 - (engLoad / 50) * 40);

  const categoryCount = eng.history.closedTicketsCount[category] || 0;
  const maxCategoryCount = Math.max(...window.queueMindMockData.engineers.map(e => e.history.closedTicketsCount[category] || 0));
  const skillScore = maxCategoryCount > 0 ? (categoryCount / maxCategoryCount) * 40 : 15;

  const affinity = eng.history.accountCSAT[account] ? 20 : 5;

  return Math.round(capScore + skillScore + affinity);
}

// Calculate reassignment candidates ranked by matching score for team rebalancing
function getReassignmentCandidates(ticket, currentEngineer) {
  if (!window.queueMindMockData || !window.queueMindMockData.engineers) return [];

  const category = ticket.category || "API/CRM";
  const account = ticket.account || "";

  const candidates = [];

  window.queueMindMockData.engineers.forEach(eng => {
    if (eng.id === currentEngineer.id) return;

    const candLoad = calculateEngineerComplexity(eng);
    const capacityScore = Math.max(0, 40 - (candLoad / 50) * 40);

    const categoryCount = eng.history.closedTicketsCount[category] || 0;
    const maxCategoryCount = Math.max(...window.queueMindMockData.engineers.map(e => e.history.closedTicketsCount[category] || 0));
    const skillScore = maxCategoryCount > 0 ? (categoryCount / maxCategoryCount) * 40 : 15;

    const customerCSAT = eng.history.accountCSAT[account];
    const affinityScore = customerCSAT ? (customerCSAT / 5.0) * 20 : 5;

    const matchPct = Math.round(capacityScore + skillScore + affinityScore);

    candidates.push({
      engineer: eng,
      matchPct: matchPct,
      load: candLoad
    });
  });

  // Sort by match percentage descending
  candidates.sort((a, b) => b.matchPct - a.matchPct);
  return candidates;
}

// Core algorithm to find if a ticket is easy to reassign to another engineer
function findReassignmentRecommendation(ticket, currentEngineer) {
  if (!window.queueMindMockData || !window.queueMindMockData.engineers) return null;

  const currentLoad = calculateEngineerComplexity(currentEngineer);
  const currentBacklogCount = currentEngineer.backlog.length;

  const category = ticket.category || "API/CRM";
  const account = ticket.account || "";

  const currCustomerCSAT = currentEngineer.history.accountCSAT[account] || 0;
  const currTopicCount = currentEngineer.history.closedTicketsCount[category] || 0;

  const candidates = [];

  window.queueMindMockData.engineers.forEach(eng => {
    if (eng.id === currentEngineer.id) return;

    // Calculate capacity-and-skill match score (identical to smart reassignment logic)
    const candLoad = calculateEngineerComplexity(eng);
    const capacityScore = Math.max(0, 40 - (candLoad / 50) * 40);

    const categoryCount = eng.history.closedTicketsCount[category] || 0;
    const maxCategoryCount = Math.max(...window.queueMindMockData.engineers.map(e => e.history.closedTicketsCount[category] || 0));
    const skillScore = maxCategoryCount > 0 ? (categoryCount / maxCategoryCount) * 40 : 15;

    const customerCSAT = eng.history.accountCSAT[account];
    const affinityScore = customerCSAT ? (customerCSAT / 5.0) * 20 : 5;

    const matchPct = Math.round(capacityScore + skillScore + affinityScore);

    // Rule 1: High match score (>= 70%)
    if (matchPct < 70) return;

    // Rule 2: Lower complexity load OR smaller backlog count than current engineer
    const hasLowerLoad = candLoad < currentLoad || eng.backlog.length < currentBacklogCount;
    if (!hasLowerLoad) return;

    // Rule 3: As strong or stronger with customer or topic compared to current assignee
    const candCustomerCSAT = customerCSAT || 0;
    const isAsStrongCustomer = candCustomerCSAT >= currCustomerCSAT;
    const isAsStrongTopic = categoryCount >= currTopicCount;

    if (!isAsStrongCustomer && !isAsStrongTopic) return;

    candidates.push({
      engineer: eng,
      matchPct: matchPct,
      load: candLoad
    });
  });

  if (candidates.length === 0) return null;

  // Sort by match percentage descending, then by capacity load ascending to tie-break
  candidates.sort((a, b) => {
    if (b.matchPct !== a.matchPct) {
      return b.matchPct - a.matchPct;
    }
    return a.load - b.load;
  });

  return candidates[0];
}

// 8. Dynamic Reassign Quick-Click Actions in Team Grid View
function executeQuickReassign(ticketId, oldName, targetEngId, event) {
  event.stopPropagation(); // prevent collapsing accordion card
  
  // Set current context manually to match reassignment calculations
  const activeTicket = window.queueMindMockData.helpdeskTickets.find(t => t.id === ticketId) || 
    window.queueMindMockData.engineers.flatMap(e => e.backlog).find(t => t.id === `t_${ticketId.replace('T-','')}`);
    
  if (activeTicket) {
    // Normalise fields
    const formattedTicket = {
      id: ticketId,
      subject: activeTicket.subject,
      account: activeTicket.account,
      category: activeTicket.category || "API/CRM",
      assignee: oldName,
      conversations: activeTicket.conversations || [{ sender: "customer", message: activeTicket.subject }]
    };
    
    currentTicket = formattedTicket;
    selectedReassigneeId = targetEngId;
    executeSelectedReassign();
  }
}

function pushQuickSlackPing(ticketId, targetName, event) {
  event.stopPropagation();
  const slackUrl = localStorage.getItem("queuemind_slack_url");
  if (!slackUrl) {
    showToast("Slack Webhook URL is not configured in the Settings tab.", "warning");
    return;
  }

  const slackMemberId = localStorage.getItem("queuemind_slack_member_id") || "";
  const mentionText = slackMemberId ? `<@${slackMemberId}> ` : "";

  const payload = {
    text: `[ACTION REQUIRED] *QueueMind Action Ping:* Escalation alert for *Ticket #${formatTicketId(ticketId)}* ${mentionText}. Suggested action is reassignment to *${targetName}* due to workload constraints.`
  };
  sendSlackPost(slackUrl, payload);
  showToast("Manager Alert pushed to your Slack channel!", "success");
}

// Open and analyze a ticket selected from the Team Monitor
function loadTicketInAnalyzer(ticketId) {
  // Find the ticket by ID in helpdeskTickets or in engineers' backlogs
  let ticket = window.queueMindMockData.helpdeskTickets.find(t => t.id === ticketId);
  if (!ticket) {
    // Check if it's in engineers backlog (e.g., ID is "t_209" or "T-1002")
    const searchId = ticketId.startsWith("T-") ? `t_${ticketId.replace('T-','')}` : ticketId;
    const backlogTicket = window.queueMindMockData.engineers.flatMap(e => e.backlog).find(t => t.id === searchId);
    if (backlogTicket) {
      // Find which engineer owns it
      const ownerEng = window.queueMindMockData.engineers.find(e => e.backlog.some(t => t.id === searchId));
      ticket = {
        id: ticketId.startsWith("T-") ? ticketId : `T-${ticketId.replace('t_','')}`,
        subject: backlogTicket.subject,
        account: backlogTicket.account,
        category: backlogTicket.category || "API/CRM",
        assignee: ownerEng ? ownerEng.name : "Unassigned",
        status: "Open",
        complexity: backlogTicket.complexity || "Medium",
        conversations: backlogTicket.conversations || [{ sender: "customer", name: backlogTicket.account, message: backlogTicket.subject }]
      };
    }
  }

  if (ticket) {
    // 1. Switch sidebar to Case Analyzer tab
    const currentActive = document.querySelector(".tab-nav .tab-btn.active");
    if (currentActive) {
      currentActive.classList.remove("active");
      currentActive.setAttribute("aria-selected", "false");
    }
    document.querySelector(".tab-content-container .tab-pane.active").classList.remove("active");

    const caseTabBtn = document.querySelector(".tab-nav .tab-btn[data-tab='tab-analyzer']");
    caseTabBtn.classList.add("active");
    caseTabBtn.setAttribute("aria-selected", "true");
    document.getElementById("tab-analyzer").classList.add("active");

    // 2. Load the ticket into processScrapedTicket
    processScrapedTicket(ticket);

    // 3. Update status indicator to show active analyzer context
    const statusEl = document.getElementById("extension-status");
    statusEl.innerText = "Analyzing";
    statusEl.style.backgroundColor = "rgba(255,255,255,0.05)";
    statusEl.style.color = "var(--color-text-muted)";

    // 4. Update the active ticket selection on the main mock_helpdesk page via URL parameters
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs.length > 0) {
          const activeTab = tabs[0];
          const urlStr = activeTab.url || "";
          if (urlStr.includes("mock_helpdesk.html") || urlStr.includes("localhost")) {
            const baseUrl = urlStr.split('?')[0];
            const newUrl = `${baseUrl}?ticket=${ticket.id}`;
            chrome.tabs.update(activeTab.id, { url: newUrl });
          }
        }
      });
    } else {
      // Direct window link for testing sidepanel as standalone page
      if (window.opener) {
        try {
          const baseUrl = window.opener.location.href.split('?')[0];
          window.opener.location.href = `${baseUrl}?ticket=${ticket.id}`;
        } catch (e) {
          console.warn("Unable to update opener window URL:", e);
        }
      } else {
        const baseUrl = window.location.href.split('?')[0];
        window.location.href = `${baseUrl}?ticket=${ticket.id}`;
      }
    }
  }
}

// Deep-link the mock Helpdesk page to a specific ticket without changing sidepanel tabs
function deepLinkMockHelpdesk(ticketId) {
  let formattedId = ticketId;
  if (!ticketId.startsWith("T-")) {
    formattedId = `T-${ticketId.replace('t_', '')}`;
  }

  if (typeof chrome !== "undefined" && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length > 0) {
        const activeTab = tabs[0];
        const urlStr = activeTab.url || "";
        if (urlStr.includes("mock_helpdesk.html") || urlStr.includes("localhost")) {
          const baseUrl = urlStr.split('?')[0];
          const newUrl = `${baseUrl}?ticket=${formattedId}`;
          chrome.tabs.update(activeTab.id, { url: newUrl });
        } else {
          console.warn("Active tab URL is empty or not mock helpdesk:", urlStr);
        }
      }
    });
  } else {
    // Standalone / local context fallback
    if (window.opener) {
      try {
        const baseUrl = window.opener.location.href.split('?')[0];
        window.opener.location.href = `${baseUrl}?ticket=${formattedId}`;
      } catch (e) {
        console.warn("Unable to update opener window URL:", e);
      }
    } else {
      const baseUrl = window.location.href.split('?')[0];
      window.location.href = `${baseUrl}?ticket=${formattedId}`;
    }
  }
}

// Sync draft text to the Mock Helpdesk tab
function syncDraftToHelpdesk(ticketId, draft) {
  let formattedId = ticketId;
  if (!ticketId.startsWith("T-")) {
    formattedId = `T-${ticketId.replace('t_', '')}`;
  }

  if (typeof chrome !== "undefined" && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length > 0) {
        const activeTab = tabs[0];
        const urlStr = activeTab.url || "";
        if (urlStr.includes("mock_helpdesk.html") || urlStr.includes("localhost")) {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (tId, text) => {
              window.postMessage({
                type: "QUEUE_MIND_SYNC_DRAFT",
                ticketId: tId,
                draft: text
              }, "*");
            },
            args: [formattedId, draft]
          }).catch(err => console.warn("Failed script injection for syncDraft:", err));
        }
      }
    });
  } else {
    // Fallback if opener exists or standalone page
    window.postMessage({
      type: "QUEUE_MIND_SYNC_DRAFT",
      ticketId: formattedId,
      draft: draft
    }, "*");
    
    if (window.opener) {
      try {
        window.opener.postMessage({
          type: "QUEUE_MIND_SYNC_DRAFT",
          ticketId: formattedId,
          draft: draft
        }, "*");
      } catch (e) {
        console.warn("Unable to post message to opener window:", e);
      }
    }
  }
}

// 10. Slack Network POST Handler
function sendSlackPost(url, payload) {
  fetch(url, {
    method: "POST",
    mode: "no-cors", // supports standard incoming webhooks without complex CORS options
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })
  .then(() => console.log("Slack notification pushed successfully."))
  .catch(err => console.error("Slack integration error:", err));
}

function testSlackWebhook() {
  const url = document.getElementById("settings-slack-url").value.trim();
  if (!url || !url.startsWith("http")) {
    showToast("Please enter a valid HTTP Webhook URL first.", "warning");
    return;
  }

  const payload = {
    text: "[NOTIFICATION] *QueueMind AI Copilot Integration Test:* Webhook connected successfully! Real-time manager escalations will post to this channel."
  };
  
  sendSlackPost(url, payload);
  showToast("Test signal sent to Slack. Check your channel!", "success");
}

async function testGeminiConnection() {
  const resultDiv = document.getElementById("settings-gemini-test-result");
  const testBtn = document.getElementById("settings-test-gemini");
  
  if (!resultDiv || !testBtn) return;
  
  const apiKey = document.getElementById("settings-gemini-key").value.trim();
  const selectedModel = document.getElementById("settings-gemini-model").value;
  
  if (!apiKey) {
    resultDiv.style.display = "block";
    resultDiv.style.backgroundColor = "rgba(239, 68, 68, 0.15)";
    resultDiv.style.color = "#f87171";
    resultDiv.style.border = "1px solid rgba(239, 68, 68, 0.3)";
    resultDiv.innerText = "Error: Please enter a Gemini API Key first.";
    return;
  }
  
  testBtn.disabled = true;
  testBtn.innerText = "Testing Connection...";
  resultDiv.style.display = "block";
  resultDiv.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
  resultDiv.style.color = "var(--color-text-muted)";
  resultDiv.style.border = "1px solid var(--border-glass)";
  resultDiv.innerText = "Sending test request to Google Gemini API...";

  const payload = {
    contents: [{
      parts: [{ text: "Say 'OK'" }]
    }]
  };

  const betaUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;
  const v1Url = `https://generativelanguage.googleapis.com/v1/models/${selectedModel}:generateContent?key=${apiKey}`;

  try {
    let response = await fetch(betaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.status === 404) {
      console.warn("Test: v1beta returned 404. Trying stable v1...");
      response = await fetch(v1Url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }

    if (response.ok) {
      resultDiv.style.backgroundColor = "rgba(16, 185, 129, 0.15)";
      resultDiv.style.color = "#34d399";
      resultDiv.style.border = "1px solid rgba(16, 185, 129, 0.3)";
      resultDiv.innerText = `Success! Connection to ${selectedModel} is active and fully functional.`;
    } else {
      let errDetail = `Status ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.error && errJson.error.message) {
          errDetail = errJson.error.message;
        }
      } catch (e) {}

      // Fetch list of authorized models to assist troubleshooting
      let modelsListHtml = "";
      try {
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (listRes.ok) {
          const listJson = await listRes.json();
          if (listJson && listJson.models) {
            const names = listJson.models
              .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
              .map(m => m.name.replace("models/", ""))
              .filter(name => !name.includes("vision") && !name.includes("embedding") && !name.includes("aqa") && !name.includes("talk"));
            if (names.length > 0) {
              modelsListHtml = `<br><br><strong style="font-size:10px; color: var(--color-text-main);">Models Available For Your Key:</strong><br><span style="font-size:10px; font-family: monospace; display:block; margin-top:4px; line-height:1.3; word-break: break-all; color: var(--color-text-muted);">${names.join(", ")}</span>`;
            }
          }
        }
      } catch (e) {
        console.warn("Could not retrieve models list:", e);
      }

      resultDiv.style.backgroundColor = "rgba(239, 68, 68, 0.15)";
      resultDiv.style.color = "#f87171";
      resultDiv.style.border = "1px solid rgba(239, 68, 68, 0.3)";

      if (response.status === 429) {
        resultDiv.style.backgroundColor = "rgba(245, 158, 11, 0.15)";
        resultDiv.style.color = "#fbbf24";
        resultDiv.style.border = "1px solid rgba(245, 158, 11, 0.3)";
        resultDiv.innerHTML = `<strong>Rate Limit Exceeded (429):</strong> The API key is valid and connected, but has exhausted its current quota. Try switching models or waiting a few minutes. <br><br><span style="font-size:10px;">Details: ${errDetail}</span>${modelsListHtml}`;
      } else if (response.status === 404) {
        resultDiv.innerHTML = `<strong>Model Not Found (404):</strong> This model version is not enabled or available for your API key/region. Try switching to a different model in the settings. <br><br><span style="font-size:10px;">Details: ${errDetail}</span>${modelsListHtml}`;
      } else if (response.status === 400 || response.status === 403 || response.status === 401) {
        resultDiv.innerHTML = `<strong>Authentication/Permission Error (${response.status}):</strong> Please verify your API Key is correct and that the "Generative Language API" is enabled in Google AI Studio/Cloud Console. <br><br><span style="font-size:10px;">Details: ${errDetail}</span>${modelsListHtml}`;
      } else {
        resultDiv.innerHTML = `<strong>API Error (${response.status}):</strong> ${errDetail}${modelsListHtml}`;
      }
    }
  } catch (error) {
    resultDiv.style.backgroundColor = "rgba(239, 68, 68, 0.15)";
    resultDiv.style.color = "#f87171";
    resultDiv.style.border = "1px solid rgba(239, 68, 68, 0.3)";
    resultDiv.innerText = `Network Error: Failed to fetch. Please check your network connection and verify that the API Key is valid. (Error: ${error.message})`;
  } finally {
    testBtn.disabled = false;
  }
}

async function listSupportedModels() {
  const resultDiv = document.getElementById("settings-gemini-test-result");
  const listBtn = document.getElementById("settings-list-models");
  
  if (!resultDiv || !listBtn) return;
  
  const apiKey = document.getElementById("settings-gemini-key").value.trim();
  
  if (!apiKey) {
    resultDiv.style.display = "block";
    resultDiv.style.backgroundColor = "rgba(239, 68, 68, 0.15)";
    resultDiv.style.color = "#f87171";
    resultDiv.style.border = "1px solid rgba(239, 68, 68, 0.3)";
    resultDiv.innerText = "Error: Please enter a Gemini API Key first.";
    return;
  }
  
  listBtn.disabled = true;
  listBtn.innerText = "Listing...";
  resultDiv.style.display = "block";
  resultDiv.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
  resultDiv.style.color = "var(--color-text-muted)";
  resultDiv.style.border = "1px solid var(--border-glass)";
  resultDiv.innerText = "Requesting model metadata from Google Gemini API...";

  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    
    if (listRes.ok) {
      const listJson = await listRes.json();
      if (listJson && listJson.models) {
        let names = listJson.models
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
          .map(m => m.name.replace("models/", ""));
          
        // Filter out TTS, nano, banana, preview, deep-research, vision, embedding, aqa, talk
        names = names.filter(name => {
          const lower = name.toLowerCase();
          return !lower.includes("vision") &&
                 !lower.includes("embedding") &&
                 !lower.includes("aqa") &&
                 !lower.includes("talk") &&
                 !lower.includes("tts") &&
                 !lower.includes("nano") &&
                 !lower.includes("banana") &&
                 !lower.includes("preview") &&
                 !lower.includes("deep-research");
        });

        // Group models: Flash-lite, Flash, Pro, Others
        const liteList = [];
        const flashList = [];
        const proList = [];
        const othersList = [];

        names.forEach(name => {
          const lower = name.toLowerCase();
          if (lower.includes("flash-lite") || lower.includes("lite")) {
            liteList.push(name);
          } else if (lower.includes("flash")) {
            flashList.push(name);
          } else if (lower.includes("pro")) {
            proList.push(name);
          } else {
            othersList.push(name);
          }
        });

        // Sort each sublist naturally
        const sortFn = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        liteList.sort(sortFn);
        flashList.sort(sortFn);
        proList.sort(sortFn);
        othersList.sort(sortFn);

        names = [...liteList, ...flashList, ...proList, ...othersList];
          
        if (names.length > 0) {
          // Dynamically update the dropdown options!
          const modelSelect = document.getElementById("settings-gemini-model");
          if (modelSelect) {
            const currentValue = modelSelect.value;
            modelSelect.innerHTML = "";
            names.forEach(name => {
              const opt = document.createElement("option");
              opt.value = name;
              opt.innerText = name;
              modelSelect.appendChild(opt);
            });
            // Try to restore previous selection if it's in the new list, otherwise prefer gemini-2.5-flash, fallback to the first one
            if (names.includes(currentValue)) {
              modelSelect.value = currentValue;
            } else if (names.includes("gemini-2.5-flash")) {
              modelSelect.value = "gemini-2.5-flash";
              localStorage.setItem("queuemind_gemini_model", "gemini-2.5-flash");
            } else {
              modelSelect.value = names[0];
              localStorage.setItem("queuemind_gemini_model", names[0]);
            }
          }

          resultDiv.style.backgroundColor = "rgba(16, 185, 129, 0.08)";
          resultDiv.style.color = "var(--color-text-main)";
          resultDiv.style.border = "1px solid rgba(16, 185, 129, 0.25)";
          resultDiv.innerHTML = `<strong>Supported Models Found:</strong><br><span style="font-family: monospace; display:block; margin-top:6px; line-height:1.4; word-break: break-all; color: var(--color-text-muted);">${names.join(", ")}</span><br><em style="font-size:10px; color: var(--color-text-muted);">Dropdown has been updated with these models.</em>`;
        } else {
          resultDiv.style.backgroundColor = "rgba(245, 158, 11, 0.15)";
          resultDiv.style.color = "#fbbf24";
          resultDiv.style.border = "1px solid rgba(245, 158, 11, 0.3)";
          resultDiv.innerText = "Connected successfully, but no text generation models were listed for your key.";
        }
      } else {
        resultDiv.innerText = "Invalid list response format from API.";
      }
    } else {
      let errDetail = `Status ${listRes.status}`;
      try {
        const errJson = await listRes.json();
        if (errJson && errJson.error && errJson.error.message) {
          errDetail = errJson.error.message;
        }
      } catch (e) {}
      
      resultDiv.style.backgroundColor = "rgba(239, 68, 68, 0.15)";
      resultDiv.style.color = "#f87171";
      resultDiv.style.border = "1px solid rgba(239, 68, 68, 0.3)";
      resultDiv.innerHTML = `<strong>Failed to List Models (${listRes.status}):</strong> ${errDetail}`;
    }
  } catch (error) {
    resultDiv.style.backgroundColor = "rgba(239, 68, 68, 0.15)";
    resultDiv.style.color = "#f87171";
    resultDiv.style.border = "1px solid rgba(239, 68, 68, 0.3)";
    resultDiv.innerText = `Network Error: Failed to fetch model list. (Error: ${error.message})`;
  } finally {
    listBtn.disabled = false;
    listBtn.innerText = "List Models";
  }
}

async function callGeminiBatchAPI(tickets, apiKey, mode = "scoring") {
  const selectedModel = localStorage.getItem("queuemind_gemini_model") || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

  const formattedTickets = tickets.map(t => {
    const conversations = t.conversations || [];
    const convText = conversations.map(c => {
      return `[${c.timestamp || 'N/A'}] ${c.sender === 'customer' ? 'Customer' : 'Agent'} (${c.name || c.sender}): ${c.message}`;
    }).join('\n');
    const stats = getCategorySolveTimeStats(t.category);
    return `---
TICKET ID: ${t.id}
Subject: ${t.subject}
Account: ${t.account}
Category: ${t.category}
Category Historical Average Solve Time: ${stats.avgHours} hours (based on ${stats.total} historical cases)
Assigned To: ${t.assignee}
Status: ${t.status}
Complexity: ${t.complexity}

CONVERSATION HISTORY:
${convText}`;
  }).join('\n\n');

  let prompt = "";
  let responseSchema = null;

  if (mode === "scoring") {
    prompt = `You are QueueMind AI, a customer support operations analyzer. Your job is to analyze the following batch of support tickets and their conversation histories.

TICKETS BATCH:
${formattedTickets}

INSTRUCTIONS FOR EACH TICKET:
Perform the following analysis and return values for each:
1. "ticketId" (string): The ID of the ticket (e.g. T-1001) matching the input exactly.
2. "isAtRisk" (boolean): true if this ticket has active operational risks, severe customer frustration from repetitive troubleshooting, explicit threats of churn/cancellation, or if the customer has explicitly requested an escalation or reported that they followed standard documentation but it is still failing. It must be false for standard technical troubleshooting, polite status checks, early-stage tickets (1-2 messages), and normal complex issues, even if they have been open for a while.
3. "attentionScore" (integer 0-100): Urgency index where 100 is high risk. The attention score must focus on:
   - How long it has been since the last contact or response (longer delays increase the score).
   - Whether the customer is actively having to ask us for updates, follow-ups, or escalations (increases the score).
   - Customer sentiment distress or frustration (increases the score).
   - Standard technical questions, early-stage tickets (1-2 messages overall), and polite status check queries should remain low-to-moderate (under 50) unless they have been ignored or are overdue.
4. "attentionReason" (string): A short, single-sentence explanation of why this attention score was assigned.
5. "sentimentScore" (integer 0-100): Customer sentiment from 0 (angry/frustrated) to 100 (satisfied). Polite error reports are neutral (50). Note: If the customer explicitly requests an escalation (e.g. "We need this escalated"), asks for manager/supervisor intervention, or reports that they followed documentation/instructions but the issue is still failing/unresolved, this is an expression of frustration and distress and must NOT be scored as neutral (50); it must receive a low sentiment score (typically between 15 and 35) depending on severity.
6. "sentimentReason" (string): A short, single-sentence explanation of why this sentiment score was assigned.
7. "complexityScore" (integer 0-100): Technical severity/complexity rating from 0 (low) to 100 (high). Ground this score in the provided category historical average solve time. The score must be proportional to how long similar issues historically took to resolve compared to other categories (e.g., categories with higher historical average solve times must establish a higher baseline complexity score), rather than being subjective or keyword-driven.
8. "complexityReason" (string): A short, single-sentence explanation of why this complexity score was assigned.
9. "recommendReassign" (boolean): true if reassignment is recommended, false otherwise. Set to false if the current assignee has the right context and reassigning would further frustrate the customer.

You must reply with ONLY a JSON object containing an array "results" where each item strictly adheres to this schema. Do not wrap the JSON in markdown code blocks.`;

    responseSchema = {
      type: "OBJECT",
      properties: {
        results: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              ticketId: { type: "STRING" },
              isAtRisk: { type: "BOOLEAN" },
              attentionScore: { type: "INTEGER" },
              attentionReason: { type: "STRING" },
              sentimentScore: { type: "INTEGER" },
              sentimentReason: { type: "STRING" },
              complexityScore: { type: "INTEGER" },
              complexityReason: { type: "STRING" },
              recommendReassign: { type: "BOOLEAN" }
            },
            required: [
              "ticketId", "isAtRisk", "attentionScore", "attentionReason",
              "sentimentScore", "sentimentReason",
              "complexityScore", "complexityReason", "recommendReassign"
            ]
          }
        }
      },
      required: ["results"]
    };
  } else {
    // details mode
    prompt = `You are QueueMind AI, a customer support operations analyzer. Your job is to analyze the following batch of support tickets and their conversation histories.

TICKETS BATCH:
${formattedTickets}

INSTRUCTIONS FOR EACH TICKET:
Perform the following detailed analysis and return values for each:
1. "ticketId" (string): The ID of the ticket (e.g. T-1001) matching the input exactly.
2. "summary" (string): A concise 2-sentence summary of the core issue and current status.
3. "diagnosis" (string): Short diagnosis of the operational risk (e.g. "Customer frustration due to repetitive troubleshooting cycles"). Return an empty string if there is no immediate risk.
4. "nextAction" (string): Provide a detailed next action recommendation for the support manager. Use HTML markup like <strong> or <em> if helpful.
   CRITICAL CRITERIA:
   - If the customer sentiment is low, do not just default to recommending reassignment. If the customer is upset about a product bug, billing policy, or something that won't be fixed by starting over with a different engineer, recommend a real next action (e.g. issuing a credit, escalating to engineering, manager joining the thread directly to de-escalate). Only recommend reassignment if the current assignee is overloaded or lacks technical skills in this category.
   - If the ticket involves custom code errors or script issues but the customer's actual code script or error traceback logs are not yet shared in the conversation history, the recommendation should prioritize requesting the customer to share their custom script and the complete error log/traceback so we can troubleshoot it.
   - If the ticket involves authentication or OAuth failures but the conversation history lacks any specific error traceback, screenshot, details of which scopes are failing, or workspace/client settings, the recommendation should prioritize asking the customer to share the exact error details/screenshots and OAuth configuration info.
   - Never include raw client secrets, API keys, passwords, tokens, or other private credentials in your summary or recommendation. If a credential exposure is detected in the conversation, the recommendation should state generally that "exposed API secrets/credentials must be rotated/secured immediately" without printing or mentioning the actual credential value. If you recommend security rotation, you must explicitly note in the "summary" that credential exposure was detected in the conversation history.
   - Do not make unconfirmed or subjective claims about the account value (e.g. calling it a "high-value account") or churn risk in your scoring reasons or recommendations unless the customer explicitly threatens to cancel or move to a competitor in the conversation text. Maintain objective, data-grounded assessments.
5. "managerDraftResponse" (string): If the suggested next action involves the manager replying to the customer or joining the thread directly to de-escalate, draft an empathetic, personalized email response from the manager (Brian, a Sr. Manager with Zapier Support). The draft should follow the style and flow of the example below but be customized specifically to the customer's actual ticket issue, operational impact/blockers, and next steps:
    "[Customer Name or Account Name],

    Hi I'm Brian, a Sr. Manager with Zapier Support. I just called to follow up with you on this ticket. I wanted to let you know that I have reviewed this issue and am working with our internal teams to address the issue. I understand your integration is [custom-tailored empathetic description of their issue, e.g., encountering a session expired error on the Salesforce authentication step, blocking your core automated synchronization tasks], and the resolution has not met your needs so far. [Empathetic statement referencing the recommended action, e.g., I am escalating this to our OAuth engineering team to review the scope expiration settings / I will be joining your thread directly to troubleshoot]. I will reach out with an update for you in the first half of the day tomorrow regardless of progress on the root cause.

    Regards,
    Brian"
    Substitute the customer contact's name (or account name if contact name is unavailable) in the greeting. Custom-tailor the issue description and recommended action statements so it reads as a highly personalized, empathetic manager check-in rather than a rigid template. You may use standard Markdown formatting (such as \`**bold**\` or \`_italic_\`) for emphasis in the draft response. If a manager response is not recommended or not needed, return an empty string.
6. "managerShouldCall" (boolean): true if the severity/urgency warrants a direct phone call to the customer (e.g. if the customer explicitly requests a phone call/callback or if the issue is highly critical), false otherwise.
7. "contactName" (string): The customer contact's name (extracted from conversation or metadata).
8. "contactPhone" (string): The customer's phone number extracted from the conversation if mentioned, or an empty string.
9. "contactEmail" (string): The customer's email address (extracted from conversation or metadata).

You must reply with ONLY a JSON object containing an array "results" where each item strictly adheres to this schema. Do not wrap the JSON in markdown code blocks.`;

    responseSchema = {
      type: "OBJECT",
      properties: {
        results: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              ticketId: { type: "STRING" },
              summary: { type: "STRING" },
              diagnosis: { type: "STRING" },
              nextAction: { type: "STRING" },
              managerDraftResponse: { type: "STRING" },
              managerShouldCall: { type: "BOOLEAN" },
              contactName: { type: "STRING" },
              contactPhone: { type: "STRING" },
              contactEmail: { type: "STRING" }
            },
            required: [
              "ticketId", "summary", "diagnosis", "nextAction",
              "managerDraftResponse", "managerShouldCall",
              "contactName", "contactPhone", "contactEmail"
            ]
          }
        }
      },
      required: ["results"]
    };
  }

  const payload = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema
    }
  };

  let response = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (response.status === 404) {
    const v1Url = `https://generativelanguage.googleapis.com/v1/models/${selectedModel}:generateContent?key=${apiKey}`;
    console.warn("Gemini v1beta endpoint returned 404. Retrying with stable v1 endpoint and stripped schema fields...");
    const v1Payload = JSON.parse(JSON.stringify(payload));
    if (v1Payload.generationConfig) {
      delete v1Payload.generationConfig.responseMimeType;
      delete v1Payload.generationConfig.responseSchema;
    }
    response = await fetchWithRetry(v1Url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v1Payload)
    });
  }

  if (!response.ok) {
    let errorMsg = `Gemini API returned status ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.error && errJson.error.message) {
        errorMsg = `${errJson.error.message} (status ${response.status})`;
      }
    } catch (e) {}
    throw new Error(errorMsg);
  }

  const json = await response.json();
  if (!json.candidates || json.candidates.length === 0 || !json.candidates[0].content || !json.candidates[0].content.parts || json.candidates[0].content.parts.length === 0) {
    throw new Error("No text response returned from Gemini.");
  }
  const text = json.candidates[0].content.parts[0].text;
  return cleanAndParseJSON(text);
}

// Dynamic progress bar driver with logarithmic deceleration easing and rotating status text
function startProgressLoader(progressBar, progressPercent, progressText) {
  let currentProgress = 0;
  let targetProgress = 10;
  
  const messages = [
    "Initializing neural network modules...",
    "Scanning backlog ticket queues...",
    "Ingesting historical resolution profiles...",
    "Redacting sensitive PII credentials...",
    "Calculating initial sentiment distress indicators...",
    "Benchmarking assignee queue performance...",
    "Mapping technical complexity baselines...",
    "Executing batch sentiment analysis...",
    "Running priority scoring regressions...",
    "Correlating customer distress with SLAs...",
    "Identifying critical operational and churn risks...",
    "Generating contextual next-action diagnoses...",
    "Drafting manager de-escalation responses...",
    "Synthesizing coaching and reassignment feedback...",
    "Finalizing metrics and updating dashboard..."
  ];
  
  let msgIndex = 0;
  let tickCount = 0;
  
  if (progressText && messages.length > 0) {
    progressText.innerText = messages[0];
  }
  
  const intervalId = setInterval(() => {
    if (currentProgress < targetProgress) {
      // Step towards the target with slight easing
      let diff = targetProgress - currentProgress;
      currentProgress += Math.min(diff * 0.15 + 0.5, 2.5);
      if (currentProgress > targetProgress) currentProgress = targetProgress;
    } else {
      // Easing curve as we approach 99% (logarithmic crawl)
      let remaining = 99 - currentProgress;
      if (remaining > 0) {
        currentProgress += remaining * 0.006; // continuous deceleration
      }
    }
    
    const displayVal = Math.round(currentProgress);
    if (progressBar) progressBar.style.width = `${currentProgress}%`;
    if (progressPercent) progressPercent.innerText = `${displayVal}%`;
    
    // Cycle text messages every 4 seconds (40 ticks of 100ms)
    tickCount++;
    if (tickCount >= 40) {
      tickCount = 0;
      msgIndex = (msgIndex + 1) % messages.length;
      if (progressText && currentProgress < 99) {
        progressText.innerText = messages[msgIndex];
      }
    }
  }, 100);

  return {
    setTarget: (val) => { 
      targetProgress = val; 
    },
    complete: () => {
      clearInterval(intervalId);
      if (progressBar) progressBar.style.width = "100%";
      if (progressPercent) progressPercent.innerText = "100%";
      if (progressText) progressText.innerText = "Analysis complete!";
    },
    stop: () => {
      clearInterval(intervalId);
    }
  };
}

// Lightweight Promise-based concurrent task executor
async function runTasksWithConcurrency(limit, tasks) {
  const results = [];
  const executing = [];
  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);
    if (limit <= tasks.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

async function runBatchAnalysis() {
  const batchBtn = document.getElementById("btn-batch-analyze");
  if (!batchBtn) return;

  const apiKey = localStorage.getItem("queuemind_gemini_key") || "";
  if (!apiKey) {
    showToast("Gemini API Key is not configured. Please enter one in the Settings tab.", "warning");
    return;
  }

  if (!ticketsSynced) {
    showToast("Please sync tickets from CRM before running AI batch analysis.", "warning");
    return;
  }

  const displayEngineers = window.queueMindMockData.engineers.filter(e => trackedEngineerIds.has(e.id));

  if (displayEngineers.length === 0) {
    showToast("No engineers are currently tracked. Please add team members under Settings to analyze their backlogs.", "warning");
    return;
  }

  const ticketsToAnalyze = [];
  let skippedCount = 0;

  displayEngineers.forEach(eng => {
    eng.backlog.forEach(t => {
      const cacheKey = t.id.replace('t_','T-') + "_" + (t.conversations ? t.conversations.length : t.threadLength || 0);
      const cached = aiAnalysisCache[cacheKey];
      
      let isUpToDate = false;
      if (cached) {
        const isSimulated = !cached.provider || cached.provider.includes("Simulated Sandbox");
        const isFlaggedWithoutDetails = (cached.isAtRisk === true || cached.recommendReassign === true) && !cached.nextAction;
        if (cached.isDetailed === true && !isSimulated && !isFlaggedWithoutDetails) {
          isUpToDate = true;
        }
      }

      if (isUpToDate) {
        skippedCount++;
      } else {
        const fullTicket = findFullTicket(t.id);
        const conversations = fullTicket && fullTicket.conversations ? fullTicket.conversations : [{ sender: "customer", message: t.subject }];
        const contact = fullTicket ? fullTicket.contact : (t.contact || "");
        
        ticketsToAnalyze.push({
          id: t.id.replace('t_','T-'),
          subject: t.subject || "",
          account: t.account || "",
          contact: contact,
          category: t.category || "",
          assignee: eng.name,
          status: t.status || "",
          complexity: t.complexity || "Medium",
          conversations: conversations,
          cacheKey: cacheKey
        });
      }
    });
  });

  if (ticketsToAnalyze.length === 0) {
    showToast("All backlog tickets are up to date!", "info");
    return;
  }

  batchBtn.disabled = true;
  const originalText = batchBtn.innerHTML;
  batchBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon spin" style="animation: spin 0.8s linear infinite; margin-right: 4px;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>Analyzing backlog...`;

  const progressContainer = document.getElementById("batch-progress-container");
  const progressText = document.getElementById("batch-progress-text");
  const progressPercent = document.getElementById("batch-progress-percent");
  const progressBar = document.getElementById("batch-progress-bar");

  // Show progress container
  if (progressContainer) {
    progressContainer.style.display = "block";
  }
  if (progressBar) progressBar.style.width = "0%";
  if (progressPercent) progressPercent.innerText = "0%";
  if (progressText) progressText.innerText = "Preparing backlog analysis...";

  let results = [];
  let loader = null;

  try {
    loader = startProgressLoader(progressBar, progressPercent, progressText);
    
    const selectedModel = localStorage.getItem("queuemind_gemini_model") || "gemini-2.5-flash";
    const friendlyModelMap = {
      "gemini-2.0-flash": "Google Gemini 2.0 Flash",
      "gemini-2.5-flash": "Google Gemini 2.5 Flash",
      "gemini-2.0-flash-lite": "Google Gemini 2.0 Flash Lite",
      "gemini-2.5-pro": "Google Gemini 2.5 Pro",
      "gemini-3.5-flash": "Google Gemini 3.5 Flash"
    };
    const provider = `${friendlyModelMap[selectedModel] || selectedModel} (Live AI)`;

    loader.setTarget(5);

    let completedCount = 0;
    const totalTickets = ticketsToAnalyze.length;

    const tasks = ticketsToAnalyze.map((t) => async () => {
      try {
        const res = await callGeminiAPI(t, apiKey);
        res.ticketId = t.id;
        res.isDetailed = true;
        res.provider = provider;
        
        ensureContactDetails(t, res);
        aiAnalysisCache[t.cacheKey] = res;
        
        // DYNAMIC DATA UPDATE: Update complexity and sentiment dynamically!
        updateTicketDataFromAnalysis(t.id, res);
        saveAICache();
        refreshTeamDashboard();
        
        return res;
      } catch (err) {
        console.warn(`Analysis failed for ticket ${t.id}:`, err);
        showToast(`Analysis failed for ticket ${t.id}: ${err.message}`, "error");
        return null; // DO NOT fall back to simulated responses!
      } finally {
        completedCount++;
        const progressPercentValue = Math.min(95, 5 + Math.round((completedCount / totalTickets) * 90));
        loader.setTarget(progressPercentValue);
      }
    });

    // Run concurrent requests (unthrottled concurrency limit equal to totalTickets)
    results = await runTasksWithConcurrency(totalTickets, tasks);

    if (loader) loader.complete();
    if (progressText) progressText.innerText = "Analysis complete!";

    // Give a short delay for the user to see 100% before hiding it
    await new Promise(resolve => setTimeout(resolve, 500));
    if (progressContainer) progressContainer.style.display = "none";

    results.forEach(res => {
      if (!res) return; // Skip failed analyses
      const matchingTicket = ticketsToAnalyze.find(t => t.id === res.ticketId);
      if (matchingTicket) {
        ensureContactDetails(matchingTicket, res);
        res.provider = res.provider || provider;
        aiAnalysisCache[matchingTicket.cacheKey] = res;
      }
    });

    saveAICache();
    refreshTeamDashboard();
    showToast("Batch analysis complete!", "success");
  } catch (err) {
    if (loader) loader.stop();
    if (progressContainer) progressContainer.style.display = "none";
    console.error("Batch analysis failed:", err);
    showToast(`Batch analysis failed: ${err.message}`, "error");
  } finally {
    if (loader) loader.stop();
    batchBtn.disabled = false;
    batchBtn.innerHTML = originalText;
  }
}

function frameMessageToAgent(nextAction, ticketId, assigneeName) {
  const firstName = assigneeName ? assigneeName.split(" ")[0] : "there";
  const cleanId = formatTicketId(ticketId);
  
  if (!nextAction) {
    return `Hi ${firstName}, regarding Ticket #${cleanId}, please review the ticket details and see if we can help steer the customer towards a resolution.`;
  }
  
  // Strip HTML tags
  let actionText = nextAction.replace(/<\/?[^>]+(>|$)/g, "").trim();
  
  // 1. Identify specific reassignment or manager callback scenarios
  if (/reassign(?:ment)?/i.test(actionText) && /manager/i.test(actionText)) {
    return `Hi ${firstName}, regarding Ticket #${cleanId}, I'm looking into this escalation and will coordinate a manager follow-up. Please prepare the ticket logs for review.`;
  }
  
  if (/manager (?:must|should) call/i.test(actionText) || /manager callback/i.test(actionText)) {
    return `Hi ${firstName}, regarding Ticket #${cleanId}, I am going to handle the manager callback/escalation on this. Please pause active customer updates for now.`;
  }
  
  if (/reassign(?:ment)?/i.test(actionText)) {
    return `Hi ${firstName}, regarding Ticket #${cleanId}, I saw this ticket is flagged for reassignment. Please make sure the notes are updated so we can transition it smoothly.`;
  }

  // 2. Clean up prefix for standard instructions
  // Remove third-person manager-coaching subjects
  actionText = actionText.replace(/^(?:Coaching advice:\s*)?(?:Suggest that the agent guide|Suggest that the agent|Manager should instruct agent to|Instruct agent to|Instruct assignee to|Support engineer to|Support engineer should|Agent to|Agent should|The assignee should|The assignee to|Advisor:|Review:)\s+/i, "");
  
  // Reframe starting verbs to please + imperative
  if (actionText.length > 0) {
    const words = actionText.split(" ");
    const firstWord = words[0].toLowerCase();
    const directVerbs = ["check", "verify", "inspect", "ask", "review", "coordinate", "look", "investigate", "follow", "update", "suggest", "confirm", "prioritize", "provide", "inform", "guide"];
    
    if (directVerbs.includes(firstWord)) {
      if (firstWord === "prioritize") {
        actionText = "please prioritize " + actionText.slice(firstWord.length).trim();
      } else if (firstWord === "ask") {
        actionText = "please ask " + actionText.slice(firstWord.length).trim();
      } else if (firstWord === "inform") {
        actionText = "please inform " + actionText.slice(firstWord.length).trim();
      } else {
        actionText = "please " + firstWord + " " + actionText.slice(words[0].length).trim();
      }
    } else {
      actionText = actionText.charAt(0).toLowerCase() + actionText.slice(1);
    }
  }

  // 3. Construct the message
  return `Hi ${firstName}, I was reviewing Ticket #${cleanId} and wanted to ask you to ${actionText}`;
}

function messageAssigneeSlack(ticketId, assigneeName, event) {
  event.stopPropagation();
  const slackUrl = localStorage.getItem("queuemind_slack_url");
  if (!slackUrl) {
    showToast("Slack Webhook URL is not configured in the Settings tab.", "warning");
    return;
  }

  // Find the ticket and its cached AI analysis
  let matchingTicket = null;
  if (window.queueMindMockData) {
    // Find inside engineers backlog
    window.queueMindMockData.engineers.forEach(eng => {
      const found = eng.backlog.find(bt => bt.id.replace('t_','T-') === ticketId || bt.id === ticketId);
      if (found) matchingTicket = found;
    });
  }
  
  const cacheKey = ticketId.replace('t_','T-') + "_" + (matchingTicket && matchingTicket.conversations ? matchingTicket.conversations.length : (matchingTicket ? matchingTicket.threadLength : 0));
  const cached = aiAnalysisCache[cacheKey];

  const defaultMsg = frameMessageToAgent(cached ? cached.nextAction : null, ticketId, assigneeName);

  showSlackPingModal(ticketId, assigneeName, defaultMsg, (msg, shouldSnooze) => {
    const payload = { text: msg };
    sendSlackPost(slackUrl, payload);
    showToast(`De-escalation alert pushed to Slack for ${assigneeName}!`, "success");

    if (shouldSnooze) {
      snoozedRiskTickets[cacheKey] = true;
      setSecureItem("queuemind_snoozed_risk", snoozedRiskTickets);
      refreshTeamDashboard();
    }
  });
}
