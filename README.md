# QueueMind: AI-Driven Support Operations Copilot

QueueMind is a modern, privacy-first Google Chrome Extension (Manifest V3 Side Panel API) built to assist technical support managers and lead engineers in directing support queues. It integrates seamlessly into a support agent's helpdesk workspace, providing real-time local PII redaction, a weighted ticket attention scoring engine, capacity-aware smart routing reassignment matrices, and automated Slack escalations.

---

## 🚀 Key Features

### 🔒 1. Client-Side PII & Credential Redaction (Compliance by Design)
Before any ticket thread or raw customer data is sent to external LLMs (e.g., Google Gemini), QueueMind executes client-side regular expression filters to redact:
*   Email addresses, names, and phone numbers.
*   Security authorization headers, API tokens (`Bearer`, `sk_live_...`, `sk_test_...`), and client secrets.
*   Webhook destination URLs.
This ensures strict compliance by keeping confidential data inside the local browser container.

### ⚙️ 2. Quantitative Incident Analysis
QueueMind calculates two vital metrics to drive team operations:
*   **Ticket Attention Score (0 - 100):** A weighted metric indicating priority and urgency for manager intervention. Points accumulate based on communication loop length, customer sentiment (frustrated, demanding, confused), explicit escalation keywords (*"supervisor"*, *"escalate"*, *"manager"*, *"call me"*), and queue idle time.
*   **Engineer Backlog Complexity Score:** A holistic index representing the true workload on an engineer, calculated by weighting active ticket complexities against customer sentiment modifiers to prevent developer burnout.

### 🔀 3. Smart Capacity-Aware Reassignment Matrix
When a ticket is flagged as stalled or escalated, the extension scores team members to suggest the optimal assignee based on:
*   **Technical Skill Match (40%):** Evaluated against their historical category resolution rates.
*   **Capacity Load (40%):** Inversely proportional to their active Backlog Complexity Score.
*   **Account Affinity (20%):** Based on historical client CSAT ratings.

### 📢 4. Incident Radar & Slack Integration
*   **Systemic Outage Spotter:** Automatically flags active queues if two or more tickets share a failure category (e.g., HubSpot API authentication error), loading the incident response playbook.
*   **Slack Webhook Automation:** Posts real-time notifications directly to the team's Slack channels with actionable recommendations (e.g., `🚨 Escalation Alert: #T-1002 stalling. Suggest reassigning to Sarah Jenkins. [Apply Reassign]`).

### 🛡️ 5. Premium Security Standards
*   **Symmetric Local Storage Encryption:** All settings (including Gemini API keys, Slack Webhooks, and cached backlog states) are symmetrically encrypted using an RC4 cipher and Base64 encoded before being stored in `localStorage`.
*   **XSS Protection:** Strict HTML escaping filters protect DOM rendering templates from executing unauthorized script injections.
*   **Eliminated VM Sandbox Execution:** Secure server-side exports eliminate dynamic string evaluation context risks.

---

## 🛠️ Architecture & Tech Stack

*   **Frontend**: HTML5, Vanilla CSS3 (Premium glassmorphic dark theme), and Vanilla JavaScript (ES6+).
*   **Extension API**: Manifest V3 Side Panel API, Background Service Worker.
*   **Backend Server**: Zero-dependency Node.js stateful API server.
*   **AI Integration**: Direct Google Gemini API integration (with user-provided API keys).

---

## 💻 Quick Start & Local Setup

### 1. Run the Stateful CRM Server
Start the local mock CRM server using Node.js:
```bash
node server.js
```
The server will start at: **`http://localhost:8282`**. Open this URL in Google Chrome to access the mock customer helpdesk portal.

### 2. Install the Chrome Extension
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** (top-left button).
4. Select the project directory (`zealous-bell`).

### 3. Configure and Analyze
1. Click the extension toolbar icon or sidepanel trigger to open the **QueueMind Copilot**.
2. Go to the **Settings** tab and enter a valid **Gemini API Key**.
3. Navigate back to the **Active Tickets** tab and select any ticket from the mock helpdesk queue.
4. Click **Analyze Active Ticket** to view the live AI diagnosis, attention score, recommended next actions, reassignment scores, and draft response templates!
