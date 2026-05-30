const fs = require('fs');
const path = require('path');

const DB_FILE = path.resolve(__dirname, '../db.json');
const OUTPUT_FILE = path.resolve(__dirname, '../simulatedResponses.js');

// 15 manually designed high-quality static demo responses
const staticResponses = {
  "T-1002": {
    isAtRisk: true,
    attentionScore: 98,
    attentionReason: "Urgent escalation. Salesforce auth failure occurring regularly every 2 hours, and customer explicitly threatened to churn to competitor Make.",
    sentimentScore: 10,
    sentimentReason: "Extremely high frustration score due to repetitive validation questions while billing sync is blocked on 50+ production workflows.",
    complexityScore: 90,
    complexityReason: "OAuth refresh tokens on enterprise Salesforce integration require API/dev intervention.",
    summary: "Tony Stark's Salesforce Zap is disconnecting exactly every 2 hours, blocking billing log synchronization. An exposed API client secret was detected in the initial message. The customer is frustrated by repetitive credential checks on their 50+ production workflows and explicitly threatened to migrate to Make.",
    diagnosis: "Customer frustration due to repetitive troubleshooting. The troubleshooting process has repeated basic verification steps, which are insufficient to address the underlying Salesforce enterprise token refresh limitations.",
    nextAction: "<strong>DO NOT REASSIGN YET.</strong> The client has context and is extremely distressed; switching engineers will start the cycle over. Manager must: 1. Directly call Tony Stark to de-escalate and address their threat to migrate to Make. 2. Coordinate rotation of the exposed API client secret immediately. 3. Contact the Core Zapier API/Integration Engineering team to inspect Salesforce auth token renew policies.",
    recommendReassign: false,
    managerDraftResponse: "Tony,\n\nHi I'm Brian, a Sr. Manager with Zapier Support. I just called to follow up with you on this ticket. I wanted to let you know that I have reviewed this issue and am working with our internal teams to address the issue. I understand your integration is disconnecting exactly every 2 hours and the resolution has not met your needs so far. I will reach out with an update for you in the first half of the day tomorrow regardless of progress on the root cause.\n\nRegards,\nBrian",
    managerShouldCall: true,
    contactName: "Tony Stark",
    contactPhone: "555-0199",
    contactEmail: "tony@starkindustries.com"
  },
  "T-1008": {
    isAtRisk: true,
    attentionScore: 95,
    attentionReason: "High risk. Client lead pipeline is frozen with $500 billing/task quota warning.",
    sentimentScore: 15,
    sentimentReason: "Angry/Demanding tone as strict billing policy prevents workflow resumption.",
    complexityScore: 80,
    complexityReason: "Recursive loops on Airtable API require setting up query parameter filters.",
    summary: "Sara Singh's Airtable Zap triggered 45,000 tasks in 1 hour due to a recursive loop, freezing their database and causing a $500 task quota warning. The agent provided filtering tips but declined further quota resets, stalling the client's critical leads pipeline.",
    diagnosis: "High billing dispute and loop block. The client is experiencing severe business downtime due to a paused database and is frustrated by strict billing enforcement.",
    nextAction: "<strong>DO NOT REASSIGN.</strong> Changing the owner will not resolve the billing escalation. Manager must: 1. Issue an immediate task quota credit reset. 2. Send the exact Airtable formula syntax that checks the modification source to filter out Zapier updates. 3. Help the client set up an independent API user account in Airtable to isolate manual edits.",
    recommendReassign: false,
    managerDraftResponse: "Sara,\n\nHi I'm Brian, a Sr. Manager with Zapier Support. I just called to follow up with you on this ticket. I wanted to let you know that I have reviewed this issue and am working with our internal teams to address the issue. I understand your integration is generating duplicate records in Airtable and the resolution has not met your needs so far. I will reach out with an update for you in the first half of the day tomorrow regardless of progress on the root cause.\n\nRegards,\nBrian",
    managerShouldCall: true,
    contactName: "Sara Singh",
    contactPhone: "",
    contactEmail: "sara.singh@veer.co"
  },
  "T-1001": {
    isAtRisk: false,
    attentionScore: 45,
    attentionReason: "Initial contact regarding nested JSON flattening on Catch Webhooks trigger.",
    sentimentScore: 50,
    sentimentReason: "Customer is asking for standard technical assistance regarding webhook payload formatting.",
    complexityScore: 70,
    complexityReason: "Webhooks category average solve time is 11.2 hours. Flattened arrays require custom code to restructure.",
    summary: "Brian Williams is reporting that Webhooks by Zapier is flattening nested JSON arrays and dropping keys. Credential exposure of a Stripe test API key was detected in the initial message.",
    diagnosis: "",
    nextAction: "Review Catch Webhook trigger configuration. Note: <strong>Exposed Stripe API credentials detected</strong>; instruct customer to rotate sk_test_51MzZAp92KxLf89Bq2Jk immediately. Recommend using a Code by Zapier (JavaScript/Python) step to parse the raw body if native nesting is dropped.",
    recommendReassign: false,
    managerDraftResponse: "",
    managerShouldCall: false,
    contactName: "Brian Williams",
    contactPhone: "",
    contactEmail: "brian.williams@acmecorp.com"
  },
  "T-1003": {
    isAtRisk: false,
    attentionScore: 70,
    attentionReason: "Customer is blocked on bulk data sync limits and standard rate limit workarounds are insufficient.",
    sentimentScore: 35,
    sentimentReason: "Low sentiment due to customer rejection of the standard delay workaround which slows updates down to 3 hours.",
    complexityScore: 65,
    complexityReason: "CRM integration average solve time is 9.5 hours. Bulk synchronizations require design optimization.",
    summary: "Hank Scorpio is experiencing HubSpot API 429 rate limits during bulk ERP contact syncs. The agent suggested using a Delay step, which the customer rejects because it slows their 10,000 sync actions down to 3 hours.",
    diagnosis: "Sync pipeline throughput bottleneck. Standard single-record delay workaround is non-viable for bulk workloads.",
    nextAction: "Coaching advice: Suggest that the agent guide Hank to use <strong>HubSpot Batch API endpoints</strong> if they are using custom code triggers, or set up a scheduler trigger to run updates in batch pools. Monitor thread for SLA health.",
    recommendReassign: false,
    managerDraftResponse: "",
    managerShouldCall: false,
    contactName: "Hank Scorpio",
    contactPhone: "",
    contactEmail: "hank.scorpio@globex.org"
  },
  "T-1004": {
    isAtRisk: false,
    attentionScore: 75,
    attentionReason: "High priority due to HubSpot API returning 502 Bad Gateway errors, suggesting a partner outage.",
    sentimentScore: 50,
    sentimentReason: "Polite initial error report regarding a partner service disruption.",
    complexityScore: 40,
    complexityReason: "Standard external outage verification process is simple but high priority.",
    summary: "Peter Gibbons reports that the HubSpot to Slack Zap is throwing '502 Bad Gateway' errors on contact retrieval. The customer wants to check if there is an active partner outage.",
    diagnosis: "Suspected HubSpot API service outage or regional API routing failure.",
    nextAction: "Verify HubSpot status page for API disruptions. Confirm regional API routing logs in our admin tools. Reply to Peter confirming the outage status and explaining that <strong>Auto-Replay</strong> will queue and process tasks once HubSpot services resume.",
    recommendReassign: false,
    managerDraftResponse: "",
    managerShouldCall: false,
    contactName: "Peter Gibbons",
    contactPhone: "",
    contactEmail: "peter.gibbons@initech.com"
  },
  "T-1005": {
    isAtRisk: false,
    attentionScore: 55,
    attentionReason: "Initial report of HubSpot 429 rate limit spikes during standard CRM sync updates.",
    sentimentScore: 50,
    sentimentReason: "Customer is reporting a technical rate limit block in a polite, neutral tone.",
    complexityScore: 60,
    complexityReason: "CRM integration average solve time is 9.5 hours. Queue throttling settings require configuration adjustments.",
    summary: "Robert Thorn reports HubSpot 429 rate limits backing up their updates queue and pausing Zaps. The customer is asking for assistance with queue throttling settings.",
    diagnosis: "",
    nextAction: "Review update volumes. Recommend checking if <strong>Auto-Replay</strong> is active on their plan. Suggest scheduling bulk updates in smaller chunks or using a Delay step to spread out webhook executions.",
    recommendReassign: false,
    managerDraftResponse: "",
    managerShouldCall: false,
    contactName: "Robert Thorn",
    contactPhone: "",
    contactEmail: "robert.thorn@soylent.com"
  },
  "T-1007": {
    isAtRisk: false,
    attentionScore: 30,
    attentionReason: "Polite question regarding Formatter tool date extraction from a custom text format.",
    sentimentScore: 55,
    sentimentReason: "Customer is politely asking for custom configuration assistance.",
    complexityScore: 35,
    complexityReason: "Logic/Formatting solve time averages 6.5 hours. Standard utilities resolve this easily.",
    summary: "Elden Tyrell reports that Formatter by Zapier is returning '[Invalid Date]' when parsing 'Nexus-6 Manufacture: June 2026'. They are seeking instructions for custom date parsing.",
    diagnosis: "",
    nextAction: "Provide custom regex logic to parse the date. Instruct Elden to first use a <strong>Formatter (Text -> Segment/Extract)</strong> step with a custom regex pattern matching the date, then pass that isolated value to a Date/Time Formatter step.",
    recommendReassign: false,
    managerDraftResponse: "",
    managerShouldCall: false,
    contactName: "Elden Tyrell",
    contactPhone: "",
    contactEmail: "elden.tyrell@tyrell.com"
  },
  "T-1009": {
    isAtRisk: false,
    attentionScore: 40,
    attentionReason: "Initial query regarding Slack API markdown rendering vs HTML format.",
    sentimentScore: 45,
    sentimentReason: "Customer is annoyed by raw HTML formatting in their channel, but requesting standard help.",
    complexityScore: 45,
    complexityReason: "Slack integration average solve time is 9.5 hours, but formatting problems are low complexity.",
    summary: "Michael Scott is reporting that Slack webhook notification messages are showing raw HTML tags like <b>bold</b> instead of markdown formatting in the general channel.",
    diagnosis: "",
    nextAction: "Instruct Michael to update the Slack Action step settings by changing the <strong>'Send as HTML'</strong> field to false, or formatting the payload text using Slack-specific markdown (*bold* instead of HTML tags), as Slack's API rejects raw HTML tags in standard text blocks.",
    recommendReassign: false,
    managerDraftResponse: "",
    managerShouldCall: false,
    contactName: "Michael Scott",
    contactPhone: "",
    contactEmail: "michael.scott@dundermifflin.com"
  },
  "T-1010": {
    isAtRisk: false,
    attentionScore: 78,
    attentionReason: "Customer is frustrated by recurring daily auth token failures on Microsoft Teams on an enterprise admin account.",
    sentimentScore: 30,
    sentimentReason: "Low sentiment due to critical tone ('Fix the connection sync') and repeated authentication dropouts.",
    complexityScore: 75,
    complexityReason: "Auth/OAuth solve time averages 14.3 hours. Azure AD OAuth token policies require administrative tenant settings review.",
    summary: "Norman Osborn reports Microsoft Teams disconnecting every 24 hours. The agent suggested checking location risks, which the customer (the admin) rejected, confirming they are on white-listed servers and demanding a resolution.",
    diagnosis: "Enterprise OAuth token lifetime policy mismatch. Azure Active Directory is likely enforcing a conditional access policy that revokes OAuth refresh tokens daily.",
    nextAction: "Coaching advice: Instruct John Doe to direct Norman Osborn to inspect their <strong>Azure Active Directory Conditional Access Policies</strong> and <strong>Session Lifetime settings</strong> in Microsoft Admin Center, as Azure tenant-level security rules can override Zapier's default refresh lifetime.",
    recommendReassign: false,
    managerDraftResponse: "",
    managerShouldCall: false,
    contactName: "Norman Osborn",
    contactPhone: "",
    contactEmail: "norman@osborn.com"
  },
  "T-1011": {
    isAtRisk: false,
    attentionScore: 45,
    attentionReason: "Initial report of Stripe webhook signature verification failure (HTTP 400).",
    sentimentScore: 50,
    sentimentReason: "Customer is requesting technical assistance regarding signature validation settings.",
    complexityScore: 72,
    complexityReason: "Webhooks category average solve time is 11.2 hours. Signature verification mismatch requires checking hashing formats.",
    summary: "Bruce Wayne reports Stripe webhook signature verification failing with HTTP 400. An exposed Stripe webhook signing secret was detected in the initial message.",
    diagnosis: "",
    nextAction: "Review Stripe webhook verification settings. Note: <strong>Exposed Stripe signing secret detected</strong>; inform the customer they must rotate whsec_abc123XYZ immediately. Verify if the payload is modified before hashing.",
    recommendReassign: false,
    managerDraftResponse: "",
    managerShouldCall: false,
    contactName: "Bruce Wayne",
    contactPhone: "",
    contactEmail: "bruce@wayne.tech"
  },
  "T-1012": {
    isAtRisk: false,
    attentionScore: 45,
    attentionReason: "Initial contact regarding Shopify order cancellations webhook trigger.",
    sentimentScore: 50,
    sentimentReason: "Polite question about why order cancellations trigger is not firing.",
    complexityScore: 65,
    complexityReason: "CRM integration average solve time is 9.5 hours. Webhook trigger failures require checking Shopify webhook sync logs.",
    summary: "Soylent Logistics reports Shopify order cancellations trigger failing to execute, while order creation works correctly. They suspect a webhook registration issue.",
    diagnosis: "",
    nextAction: "Instruct Marcus Aurelius to check the Shopify app webhook registrations. Verify if the <strong>orders/cancelled</strong> webhook topic was successfully registered on the Shopify store's API settings.",
    recommendReassign: false,
    managerDraftResponse: "",
    managerShouldCall: false,
    contactName: "Soylent Logistics",
    contactPhone: "",
    contactEmail: "investor@soylent.com"
  },
  "T-1006": {
    isAtRisk: true,
    attentionScore: 75,
    attentionReason: "Stalled thread. Customer is blocked on platform limits (10-second timeout limit).",
    sentimentScore: 30,
    sentimentReason: "Frustrated customer rejecting basic webhook workaround suggestions.",
    complexityScore: 95,
    complexityReason: "Middle-out compression routine optimization is highly technical, custom Python.",
    summary: "Richard Hendricks is encountering sandbox CPU timeouts (10.0 seconds limit) running a custom Python middle-out compression routine. The agent recommended a webhook breakdown that would consume 500x more tasks, which the client rejects as a billing trap.",
    diagnosis: "Sandbox CPU limit blocker. The customer feels stuck between timeout limits and high billing consumption workarounds.",
    nextAction: "<strong>Reassignment recommended.</strong> Reassign the ticket to John Doe or Elena Rostova (Custom Code specialists) to: 1. Optimize the script's array chunking. 2. Check if Hooli is eligible for an enterprise sandbox extension to override the CPU ceiling.",
    recommendReassign: true,
    managerDraftResponse: "",
    managerShouldCall: false,
    contactName: "Richard Hendricks",
    contactPhone: "",
    contactEmail: "richard.hendricks@hooli.com"
  },
  "T-1021": {
    isAtRisk: true,
    attentionScore: 85,
    attentionReason: "Customer requested escalation and suspected system outage because authentication is still failing despite following our documentation.",
    sentimentScore: 30,
    sentimentReason: "Frustrated tone, explicit escalation request, and authentication failure despite following instructions.",
    complexityScore: 85,
    complexityReason: "Custom Python pandas environment dependency requires engineering package installation.",
    summary: "Richard is encountering a missing pandas library dependency in standard sandbox custom code. The customer has followed our documentation, but the authentication is still failing, leading them to request an escalation and check if the system is down.",
    diagnosis: "Customer frustration due to lack of progress after following documentation, resulting in suspected system outage.",
    nextAction: "<strong>Reassignment recommended.</strong> This requires Custom Code specialist intervention to check sandbox environment packages. Customer has followed documentation but authentication is still failing. Coordinate with Engineering to add pandas to standard sandbox or provide alternative import instructions.",
    recommendReassign: true,
    managerDraftResponse: "Richard,\n\nHi I'm Brian, a Sr. Manager with Zapier Support. I wanted to follow up with you on this ticket. I understand you have followed our documentation but authentication is still failing due to the missing pandas dependency, and you requested an escalation. I am working with our engineering team to review sandbox environment dependency options. I will update you in the first half of the day tomorrow with our findings.\n\nRegards,\nBrian",
    managerShouldCall: false,
    contactName: "Richard",
    contactEmail: "richard@hooli.com",
    contactPhone: "555-0121"
  },
  "T-1056": {
    isAtRisk: false,
    attentionScore: 40,
    attentionReason: "Auth failure on Slack integration. Initial thread investigation phase.",
    sentimentScore: 55,
    sentimentReason: "Customer is focused on verification failure but polite.",
    complexityScore: 70,
    complexityReason: "OAuth scope verification failures can have multiple root causes.",
    summary: "Hank Scorpio is encountering a Slack auth scope verification failure. The conversation has just started, and no specific error details or configuration have been shared yet.",
    diagnosis: "Authentication setup issue. Stalled due to lack of error details.",
    nextAction: "Advisor: Ask the customer to share the exact error message or a screenshot of the scope screen they see when trying to authenticate, and verify if they have admin rights to add integrations to their Slack workspace.",
    recommendReassign: false,
    managerDraftResponse: "Hank,\n\nHi I'm Brian, a Sr. Manager with Zapier Support. I just called to follow up with you on this ticket. I wanted to let you know that I have reviewed this issue and am working with our internal teams to address the issue. I understand your Slack authentication scope verification is failing and the resolution has not met your needs so far. To help us troubleshoot, could you please reply with a screenshot or text of the exact error message you receive, and confirm if your Slack workspace has restrictions on third-party app installations? I will reach out with an update for you in the first half of the day tomorrow regardless of progress on the root cause.\n\nRegards,\nBrian",
    managerShouldCall: false,
    contactName: "Hank Scorpio",
    contactPhone: "",
    contactEmail: "h.scorpio@globex.org"
  },
  "T-1062": {
    isAtRisk: false,
    attentionScore: 55,
    attentionReason: "Customer requested workaround ASAP. Medium urgency.",
    sentimentScore: 40,
    sentimentReason: "Customer is focused on workflow blocker but polite.",
    complexityScore: 85,
    complexityReason: "Custom Python script memory limit issues are highly technical.",
    summary: "Customer is running a custom Python script that is exceeding memory limits and blocking workflow. The conversation has just started, and the script code has not been provided yet.",
    diagnosis: "Custom code execution error. Stalled due to lack of script context.",
    nextAction: "Advisor: Ask the customer to share their custom Python script and complete error traceback logs for review, as we cannot troubleshoot the memory issue without seeing the code.",
    recommendReassign: false,
    managerDraftResponse: "Hank,\n\nHi I'm Brian, a Sr. Manager with Zapier Support. I just called to follow up with you on this ticket. I wanted to let you know that I have reviewed this issue and am working with our internal teams to address the issue. I understand your custom Python script is exceeding memory limits and the resolution has not met your needs so far. To help us troubleshoot, could you please reply with the exact custom script you are running and any error logs/tracebacks? I will reach out with an update for you in the first half of the day tomorrow regardless of progress on the root cause.\n\nRegards,\nBrian",
    managerShouldCall: false,
    contactName: "Hank Scorpio",
    contactPhone: "",
    contactEmail: "h.scorpio@globex.org"
  }
};

// Solve times stats mapping (from CRM server defaults)
const solveTimeStats = {
  "Auth/OAuth": { avgHours: 14.3, total: 31 },
  "MTA/Routing": { avgHours: 12.8, total: 35 },
  "Webhooks": { avgHours: 11.2, total: 29 },
  "Custom Code": { avgHours: 9.8, total: 27 },
  "Logic/Formatting": { avgHours: 6.5, total: 11 },
  "API/CRM": { avgHours: 9.5, total: 25 }
};

const maxAvgHours = 14.3; // max of the above categories

function getContactInfo(ticket) {
  let name = ticket.account || "Customer";
  let email = ticket.contact || "N/A";
  
  if (ticket.contact) {
    name = ticket.contact.split("@")[0].split(".").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
  }
  
  return { name, email };
}

// Generate tailored response for any ticket
function generateResponse(ticket) {
  const normId = ticket.id.replace('t_','T-');
  
  // Use static high-quality mock response if pre-designed
  if (staticResponses[normId]) {
    return staticResponses[normId];
  }
  
  // Heuristic-based dynamic generation
  const category = ticket.category || "API/CRM";
  const stats = solveTimeStats[category] || { avgHours: 10.0, total: 10 };
  
  // Scores
  let sentimentScore = 50;
  if (ticket.sentiment === "Frustrated") sentimentScore = 20;
  else if (ticket.sentiment === "Demanding") sentimentScore = 30;
  else if (ticket.sentiment === "Confused") sentimentScore = 40;
  else if (ticket.sentiment === "Neutral") sentimentScore = 50;
  else if (ticket.sentiment === "Satisfied") sentimentScore = 80;
  
  let attentionScore = 45;
  if (ticket.priority === "Highest") attentionScore = 80;
  else if (ticket.priority === "High") attentionScore = 65;
  else if (ticket.priority === "Normal") attentionScore = 45;
  else if (ticket.priority === "Low") attentionScore = 25;
  
  if (sentimentScore < 40) attentionScore = Math.min(100, attentionScore + 15);
  
  let complexityScore = Math.round((stats.avgHours / maxAvgHours) * 80) + 10;
  if (ticket.complexity === "High") complexityScore = Math.min(100, complexityScore + 10);
  else if (ticket.complexity === "Low") complexityScore = Math.max(0, complexityScore - 15);
  
  // Reasons
  const attentionReason = `High priority based on priority flag (${ticket.priority || 'Normal'}) and sentiment score (${sentimentScore}).`;
  const sentimentReason = `Calculated based on customer's current status: ${ticket.sentiment || 'Neutral'}.`;
  const complexityReason = `Ground truth baseline: ${category} issues take an average of ${stats.avgHours} hours to solve (${stats.total} closed cases).`;
  
  // Context-specific actions
  let diagnosis = "";
  let nextAction = `Support engineer is investigating the issue. Ensure integration credentials and action mappings are verified.`;
  let isAtRisk = attentionScore >= 75 || sentimentScore < 30;
  let recommendReassign = false;
  let managerDraftResponse = "";
  let managerShouldCall = false;
  
  const contact = getContactInfo(ticket);
  
  if (category === "Auth/OAuth") {
    diagnosis = sentimentScore < 40 ? "OAuth token expiry and authentication blockage." : "";
    nextAction = `Check customer's OAuth connector redirect URLs and scope permissions. Suggest running the authentication step in an Incognito browser window.`;
  } else if (category === "MTA/Routing") {
    diagnosis = sentimentScore < 40 ? "Email deliverability breakdown and SPF/DKIM authentication failure." : "";
    nextAction = `Instruct agent to verify domain DNS hosting records. Check for SPF/DKIM verification status using administrative lookup tools.`;
  } else if (category === "Webhooks") {
    diagnosis = sentimentScore < 40 ? "Webhook payload parsing latency or payload mapping exception." : "";
    nextAction = `Inspect raw payload headers in Catch Webhook logs. Ask customer to verify payload structure and check if any fields are dropped during JSON flattening.`;
  } else if (category === "Custom Code") {
    diagnosis = sentimentScore < 40 ? "Code sandbox memory overflow or script runtime limit exceeded." : "";
    nextAction = `Ask customer to share their custom code snippet and complete script execution logs. Verify memory consumption limits and check for infinite loops.`;
  } else if (category === "Logic/Formatting") {
    diagnosis = sentimentScore < 40 ? "Spreadsheet row index matching or datetime extraction error." : "";
    nextAction = `Review date format variables or array parsing parameters in Formatter tool. Verify regex patterns match sample strings.`;
  } else {
    diagnosis = sentimentScore < 40 ? "CRM API syncing rate limits or endpoint field discrepancy." : "";
    nextAction = `Inspect API sync records and throttle limits. Recommend optimizing bulk sync intervals or updating fields using batch endpoints.`;
  }
  
  if (isAtRisk) {
    const firstName = contact.name.split(" ")[0];
    managerDraftResponse = `${firstName},\n\nHi I'm Brian, a Sr. Manager with Zapier Support. I wanted to follow up with you on this ticket. I understand your integration is experiencing ${ticket.subject.toLowerCase()} and the resolution has not met your needs so far. I will reach out with an update for you in the first half of the day tomorrow regardless of progress on the root cause.\n\nRegards,\nBrian`;
  }
  
  return {
    isAtRisk,
    attentionScore,
    attentionReason,
    sentimentScore,
    sentimentReason,
    complexityScore,
    complexityReason,
    summary: `Customer is reporting "${ticket.subject}" in their ${ticket.account || 'standard'} integration backlog. Currently assigned to ${ticket.assignee || 'general queue'}.`,
    diagnosis,
    nextAction,
    recommendReassign,
    managerDraftResponse,
    managerShouldCall,
    contactName: contact.name,
    contactEmail: contact.email,
    contactPhone: ""
  };
}

function run() {
  console.log("Loading db.json...");
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  
  const database = {};
  
  console.log("Compiling simulated responses database...");
  db.engineers.forEach(eng => {
    eng.backlog.forEach(ticket => {
      // Set assignee name dynamically
      ticket.assignee = eng.name;
      const normId = ticket.id.replace('t_','T-');
      const response = generateResponse(ticket);
      database[normId] = response;
    });
  });
  
  const outputCode = `// Pre-computed high-quality simulated responses for all backlog tickets
window.simulatedResponses = ${JSON.stringify(database, null, 2)};
`;
  
  fs.writeFileSync(OUTPUT_FILE, outputCode, 'utf8');
  console.log(`Successfully generated ${Object.keys(database).length} simulated responses! Saved to ${OUTPUT_FILE}`);
}

run();
