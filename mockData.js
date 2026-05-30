// QueueMind Mock Data Store
// Exposed globally to avoid file:// CORS issues in local extension environments
// Automatically populates 70+ open tickets and 280+ closed tickets deterministically on load

window.queueMindMockData = (function() {
  const queueMindMockData = {};

  // 1. Base Engineers (Specialties are removed here and calculated dynamically from history)
  const baseEngineers = [
    { id: "eng_sarah", name: "Sarah Jenkins", avatar: "SJ", avatarImg: "avatar_female_1.png", title: "Associate Technical Support Engineer" },
    { id: "eng_dave", name: "Dave Miller", avatar: "DM", avatarImg: "avatar_male_1.png", title: "Technical Support Engineer" },
    { id: "eng_priya", name: "Priya Sharma", avatar: "PS", avatarImg: "avatar_female_2.png", title: "Sr. Technical Support Engineer" },
    { id: "eng_alex", name: "Alex Chen", avatar: "AC", avatarImg: "avatar_male_2.png", title: "Associate Principal Support Engineer" },
    { id: "eng_john", name: "John Doe", avatar: "JD", avatarImg: "avatar_male_1.png", title: "Principal Support Engineer" },
    { id: "eng_chloe", name: "Chloe Vance", avatar: "CV", avatarImg: "avatar_female_1.png", title: "Associate Technical Support Engineer" },
    { id: "eng_marcus", name: "Marcus Aurelius", avatar: "MA", avatarImg: "avatar_male_2.png", title: "Technical Support Engineer" },
    { id: "eng_elena", name: "Elena Rostova", avatar: "ER", avatarImg: "avatar_female_2.png", title: "Sr. Technical Support Engineer" }
  ];

  // Static detailed tickets crucial for manager demonstrations
  const staticHelpdeskTickets = [
    {
      id: "T-1002",
      account: "Stark Industries",
      contact: "tony@starkindustries.com",
      subject: "Salesforce CRM integration disconnected (OAuth expiry loop)",
      category: "Auth/OAuth",
      assignedTo: "John Doe",
      status: "In Progress",
      priority: "High",
      createdTime: new Date(Date.now() - 7200000 * 4).toISOString(), // 8 hours ago
      conversations: [
        { sender: "customer", name: "Tony Stark", message: "Our Salesforce Zap disconnects exactly every 2 hours. We have re-authorized the Salesforce connector multiple times today. This is blocking our logs sync for billing! Please escalate this to a manager immediately. My temporary API Client secret is: client_secret=sec_789xyza123. Can someone fix this? Contact my systems admin at tony@starkindustries.com or call 555-0199.", timestamp: new Date(Date.now() - 7200000 * 4).toISOString() },
        { sender: "agent", name: "John Doe", message: "Hi Tony, please try clicking 'Re-connect' on the My Apps page in Zapier, then check if your Salesforce sandbox user password expired.", timestamp: new Date(Date.now() - 7200000 * 3.8).toISOString() },
        { sender: "customer", name: "Tony Stark", message: "I literally just said I re-authorized it multiple times! The credentials work for 2 hours, then get kicked out. This is a Zapier bug, not our passwords. I am still waiting for that manager escalation.", timestamp: new Date(Date.now() - 7200000 * 3.5).toISOString() },
        { sender: "agent", name: "John Doe", message: "Have you cleared your browser cookies and cache? Sometimes old OAuth sessions get cached in the browser.", timestamp: new Date(Date.now() - 7200000 * 3.2).toISOString() },
        { sender: "customer", name: "Tony Stark", message: "Yes, cleared them on Chrome and Safari. Still disconnecting. We need this resolved. Send it to a developer.", timestamp: new Date(Date.now() - 7200000 * 3.0).toISOString() },
        { sender: "agent", name: "John Doe", message: "Could you send a screenshot of the Salesforce OAuth configuration window and the error code?", timestamp: new Date(Date.now() - 7200000 * 2.8).toISOString() },
        { sender: "customer", name: "Tony Stark", message: "I sent it in ticket #T-0982. It says: 'authentication expired: session validation failed'. Here is the link again: https://stark.sf.com/oauth/err.", timestamp: new Date(Date.now() - 7200000 * 2.6).toISOString() },
        { sender: "agent", name: "John Doe", message: "I see. Are you using a Salesforce Developer Account or Enterprise edition?", timestamp: new Date(Date.now() - 7200000 * 2.4).toISOString() },
        { sender: "customer", name: "Tony Stark", message: "Enterprise. IP range restrictions are active but we white-listed Zapier's IP blocks listed in your doc.", timestamp: new Date(Date.now() - 7200000 * 2.2).toISOString() },
        { sender: "agent", name: "John Doe", message: "Okay, is your Salesforce policy set to 'Refresh token is valid until revoked'?", timestamp: new Date(Date.now() - 7200000 * 2.0).toISOString() },
        { sender: "customer", name: "Tony Stark", message: "Yes, checked by security. It is set to until revoked. Why does the session disconnect exactly at 120 minutes?", timestamp: new Date(Date.now() - 7200000 * 1.8).toISOString() },
        { sender: "agent", name: "John Doe", message: "It might be due to the Salesforce Session Security setting. Salesforce has a default 2-hour timeout.", timestamp: new Date(Date.now() - 7200000 * 1.6).toISOString() },
        { sender: "customer", name: "Tony Stark", message: "But Zapier is supposed to use the refresh token to get a new session token automatically! Why is Zapier not executing the refresh?", timestamp: new Date(Date.now() - 7200000 * 1.4).toISOString() },
        { sender: "agent", name: "John Doe", message: "Could you delete the Salesforce connection completely from your Zapier account and add it again?", timestamp: new Date(Date.now() - 7200000 * 1.2).toISOString() },
        { sender: "customer", name: "Tony Stark", message: "I told you, we have over 50 production Zaps using this connection! If I delete it, it breaks 50 business-critical workflows. I cannot delete it. This is a ridiculous recommendation.", timestamp: new Date(Date.now() - 7200000 * 1.0).toISOString() },
        { sender: "agent", name: "John Doe", message: "Let me check with our tier 2 integration specialists.", timestamp: new Date(Date.now() - 7200000 * 0.9).toISOString() },
        { sender: "customer", name: "Tony Stark", message: "Please hurry. Our invoicing is stalled.", timestamp: new Date(Date.now() - 7200000 * 0.8).toISOString() },
        { sender: "agent", name: "John Doe", message: "Tier 2 suggests verifying if your connected app policies in Salesforce have 'All users may self-authorize' checked.", timestamp: new Date(Date.now() - 7200000 * 0.6).toISOString() },
        { sender: "customer", name: "Tony Stark", message: "Yes, it is checked. It has been checked for 3 years. The issue started yesterday after your platform release.", timestamp: new Date(Date.now() - 7200000 * 0.4).toISOString() },
        { sender: "agent", name: "John Doe", message: "Could you try setting up a webhook connection instead of using our native Salesforce trigger?", timestamp: new Date(Date.now() - 7200000 * 0.3).toISOString() },
        { sender: "customer", name: "Tony Stark", message: "No, we pay for your Enterprise Salesforce connector. I do not want webhooks. This is unacceptable support. I requested a manager callback earlier, and we need this resolved on a phone call. We are losing hours of syncing logs.", timestamp: new Date(Date.now() - 7200000 * 0.2).toISOString() },
        { sender: "agent", name: "John Doe", message: "I apologize for the frustration. I am looking into how we can trigger a manager callback.", timestamp: new Date(Date.now() - 7200000 * 0.1).toISOString() },
        { sender: "customer", name: "Tony Stark", message: "I am waiting. Have a manager review the token logs immediately or we are moving our flows to Make.", timestamp: new Date(Date.now() - 60000).toISOString() }
      ]
    },
    {
      id: "T-1001",
      account: "Acme Corp",
      contact: "brian.williams@acmecorp.com",
      subject: "Webhooks by Zapier flattening nested JSON payloads",
      category: "Webhooks",
      assignedTo: "Alex Chen",
      status: "Open",
      priority: "High",
      createdTime: new Date(Date.now() - 1000 * 2700).toISOString(), // 45 mins ago
      conversations: [
        {
          sender: "customer",
          name: "Brian Williams",
          message: "Hi team, we're testing the Webhooks by Zapier trigger. When we post a nested JSON payload, Zapier flattens the nested structures and drops array keys. Here is our temporary API endpoint key we are testing: api_key=sk_test_51MzZAp92KxLf89Bq2Jk. And our endpoint is https://hooks.zapier.com/hooks/catch/98765/x1y2z3/ in project dev. We need the nested array array items preserved. Can we bypass formatting? Help!",
          timestamp: new Date(Date.now() - 1000 * 2700).toISOString()
        }
      ]
    },
    {
      id: "T-1003",
      account: "Globex Corp",
      contact: "hank.scorpio@globex.org",
      subject: "HubSpot Trigger: Rate limit exceeded error 429",
      category: "API/CRM",
      assignedTo: "Chloe Vance",
      status: "Waiting on Customer",
      priority: "Normal",
      createdTime: new Date(Date.now() - 3600000 * 2).toISOString(),
      conversations: [
        { sender: "customer", name: "Hank Scorpio", message: "We are getting hundreds of 'HubSpot API rate limit exceeded (HTTP 429)' errors in our Zapier history. The Zap has paused. Is this an issue on HubSpot's side or is Zapier failing to queue the requests correctly?", timestamp: new Date(Date.now() - 3600000 * 2).toISOString() },
        { sender: "agent", name: "Chloe Vance", message: "Hi Hank, HubSpot has a rate limit of 10 requests per second for standard API keys. It looks like your trigger is firing too rapidly.", timestamp: new Date(Date.now() - 3600000 * 1.8).toISOString() },
        { sender: "customer", name: "Hank Scorpio", message: "We are updating contacts in bulk from our ERP. Doesn't Zapier automatically throttle or queue these to respect the partner's limits?", timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString() },
        { sender: "agent", name: "Chloe Vance", message: "Zapier executes actions as they trigger. To queue them, you would need to use our built-in 'Delay' tool or upgrade to a plan that includes Auto-Replay queueing.", timestamp: new Date(Date.now() - 3600000 * 1.2).toISOString() },
        { sender: "customer", name: "Hank Scorpio", message: "We are on the Professional plan which has auto-replay, but it keeps failing because all 5 retries execute within the rate limit window. We need a way to throttle the trigger to 5 requests per second.", timestamp: new Date(Date.now() - 3600000 * 1.0).toISOString() },
        { sender: "agent", name: "Chloe Vance", message: "Understood. You can use 'Delay by Zapier' to add a 1-second buffer before each HubSpot action.", timestamp: new Date(Date.now() - 3600000 * 0.8).toISOString() },
        { sender: "customer", name: "Hank Scorpio", message: "That slows down our entire sync. If we have 10,000 updates, a 1-second delay means it takes 3 hours. Can we aggregate updates?", timestamp: new Date(Date.now() - 3600000 * 0.5).toISOString() }
      ]
    },
    {
      id: "T-1004",
      account: "Initech",
      contact: "peter.gibbons@initech.com",
      subject: "HubSpot API down: 502 Bad Gateway during sync",
      category: "API/CRM",
      assignedTo: "Dave Miller",
      status: "Open",
      priority: "Highest", // Outages get highest priority
      createdTime: new Date(Date.now() - 900000).toISOString(), // 15 mins ago
      conversations: [
        { sender: "customer", name: "Peter Gibbons", message: "Hello, our HubSpot to Slack Zap is throwing '502 Bad Gateway' errors on every attempt to retrieve new contacts. Is there an outage? Please check HubSpot API status. Let us know.", timestamp: new Date(Date.now() - 900000).toISOString() }
      ]
    },
    {
      id: "T-1005",
      account: "Soylent Corp",
      contact: "robert.thorn@soylent.com",
      subject: "HubSpot Integration rate limiting (429) spikes on client updates",
      category: "API/CRM",
      assignedTo: "Elena Rostova",
      status: "In Progress",
      priority: "Highest", // Outage related priority
      createdTime: new Date(Date.now() - 3600000 * 3).toISOString(),
      conversations: [
        { sender: "customer", name: "Robert Thorn", message: "Getting hit with severe HubSpot 429 rate limits in our integration. We are doing standard updates but the queue is backing up and pausing Zaps. Help us clear the backlog or throttle the webhook delivery.", timestamp: new Date(Date.now() - 3600000 * 3).toISOString() }
      ]
    },
    {
      id: "T-1006",
      account: "Hooli",
      contact: "richard.hendricks@hooli.com",
      subject: "Python custom step timed out (10s CPU limit)",
      category: "Custom Code",
      assignedTo: "Alex Chen",
      status: "Open",
      priority: "Normal",
      createdTime: new Date(Date.now() - 3600000).toISOString(),
      conversations: [
        { sender: "customer", name: "Richard Hendricks", message: "Our custom Python code script is timing out on Zapier. It keeps throwing 'Task timed out after 10.0 seconds'. The code parses a JSON feed of compression logs. Why is the limit so low? I need 30 seconds.", timestamp: new Date(Date.now() - 3600000).toISOString() },
        { sender: "agent", name: "Alex Chen", message: "Hi Richard, the 10-second CPU limit is a hard restriction on Zapier to prevent infinite loops from locking up our runners. We need to optimize your script to run faster.", timestamp: new Date(Date.now() - 3600000 * 0.9).toISOString() },
        { sender: "customer", name: "Richard Hendricks", message: "It's a standard middle-out compression algorithm. It parses a 10MB nested array. I can't run it in under 10 seconds if I have to fetch the payload. Can you raise the timeout for Hooli's account?", timestamp: new Date(Date.now() - 3600000 * 0.8).toISOString() },
        { sender: "agent", name: "Alex Chen", message: "Unfortunately, we cannot override the CPU limit for individual accounts as it is enforced at the container sandbox level.", timestamp: new Date(Date.now() - 3600000 * 0.6).toISOString() },
        { sender: "customer", name: "Richard Hendricks", message: "Then how do I parse this payload? I have to process it.", timestamp: new Date(Date.now() - 3600000 * 0.5).toISOString() },
        { sender: "agent", name: "Alex Chen", message: "You could break the payload into smaller chunks using a webhook trigger to process one record at a time, rather than a single bulk payload.", timestamp: new Date(Date.now() - 3600000 * 0.4).toISOString() },
        { sender: "customer", name: "Richard Hendricks", message: "That means triggering 500 tasks instead of 1. It increases our task consumption by 500x. That's a billing trap.", timestamp: new Date(Date.now() - 3600000 * 0.3).toISOString() },
        { sender: "agent", name: "Alex Chen", message: "I understand, but bulk loops must be optimized. Are you pre-filtering the array?", timestamp: new Date(Date.now() - 3600000 * 0.2).toISOString() },
        { sender: "customer", name: "Richard Hendricks", message: "No, I need all records. This 10s limit makes custom coding on Zapier useless for large arrays. I'm stuck.", timestamp: new Date(Date.now() - 300000).toISOString() }
      ]
    },
    {
      id: "T-1007",
      account: "Tyrell Corp",
      contact: "elden.tyrell@tyrell.com",
      subject: "Formatter date extraction failing on custom format",
      category: "Logic/Formatting",
      assignedTo: "Chloe Vance",
      status: "In Progress",
      priority: "Low",
      createdTime: new Date(Date.now() - 3600000 * 3).toISOString(),
      conversations: [
        { sender: "customer", name: "Elden Tyrell", message: "The Formatter tool is failing to extract date strings like 'Nexus-6 Manufacture: June 2026' into ISO format. It returns '[Invalid Date]'. How do I parse custom strings?", timestamp: new Date(Date.now() - 3600000 * 3).toISOString() }
      ]
    },
    {
      id: "T-1008",
      account: "Veer Ltd",
      contact: "sara.singh@veer.co",
      subject: "Airtable loop creating thousands of duplicates",
      category: "Logic/Formatting",
      assignedTo: "Sarah Jenkins",
      status: "In Progress",
      priority: "High",
      createdTime: new Date(Date.now() - 3600000 * 4).toISOString(),
      conversations: [
        { sender: "customer", name: "Sara Singh", message: "HELP! My Zap went crazy. It triggered 45,000 tasks in 1 hour and created duplicate records in our Airtable! My account has been paused. I have a billing charge warning of $500. I need this escalated to a supervisor or billing manager immediately to get this fee waived and our tasks reset. Please help!", timestamp: new Date(Date.now() - 3600000 * 4).toISOString() },
        { sender: "agent", name: "Sarah Jenkins", message: "Hi Sara, it looks like a recursive loop was triggered: Airtable New Row -> Zap triggers -> Update Airtable Row -> updates trigger again.", timestamp: new Date(Date.now() - 3600000 * 3.8).toISOString() },
        { sender: "customer", name: "Sara Singh", message: "Oh no! Yes, the Zap updates a status column in the same row. How do I stop it? Please reset my tasks, I can't pay $500 for a bug.", timestamp: new Date(Date.now() - 3600000 * 3.6).toISOString() },
        { sender: "agent", name: "Sarah Jenkins", message: "You need to add a filter step to only continue if the status column was changed from 'Pending' to 'Complete'.", timestamp: new Date(Date.now() - 3600000 * 3.4).toISOString() },
        { sender: "customer", name: "Sara Singh", message: "I added the filter. Can you reset my task quota so I can turn the Zap back on?", timestamp: new Date(Date.now() - 3600000 * 3.2).toISOString() },
        { sender: "agent", name: "Sarah Jenkins", message: "I have applied a one-time task quota reset. You can resume your Zap now.", timestamp: new Date(Date.now() - 3600000 * 3.0).toISOString() },
        { sender: "customer", name: "Sara Singh", message: "I turned it on, and it used another 10,000 tasks! It's still loop testing. Why? The status filter is active.", timestamp: new Date(Date.now() - 3600000 * 2.8).toISOString() },
        { sender: "agent", name: "Sarah Jenkins", message: "Let me check the run history. Your filter checks if Status is 'Complete', but your Airtable action is setting Status to 'Complete'. That still triggers the update.", timestamp: new Date(Date.now() - 3600000 * 2.6).toISOString() },
        { sender: "customer", name: "Sara Singh", message: "So how do I check if a human changed it, not the Zap?", timestamp: new Date(Date.now() - 3600000 * 2.4).toISOString() },
        { sender: "agent", name: "Sarah Jenkins", message: "You should use Airtable's 'Last Modified By' column and filter out updates made by the Zapier API integration user.", timestamp: new Date(Date.now() - 3600000 * 2.2).toISOString() },
        { sender: "customer", name: "Sara Singh", message: "I don't know how to set up API users in Airtable. I need a billing supervisor to handle my refund request and help me fix this. We are losing sync updates.", timestamp: new Date(Date.now() - 3600000 * 2.0).toISOString() },
        { sender: "agent", name: "Sarah Jenkins", message: "We cannot log in to your accounts. You can create a formula field in Airtable checking the modification source.", timestamp: new Date(Date.now() - 3600000 * 1.8).toISOString() },
        { sender: "customer", name: "Sara Singh", message: "I tried the formula and it's throwing syntax errors. This is too complicated. I need a supervisor to call me or email back. And I need another task reset, I am at 0 tasks again.", timestamp: new Date(Date.now() - 3600000 * 1.6).toISOString() },
        { sender: "agent", name: "Sarah Jenkins", message: "I cannot do another task reset as we only allow one exception per billing cycle.", timestamp: new Date(Date.now() - 3600000 * 1.4).toISOString() },
        { sender: "customer", name: "Sara Singh", message: "This is a billing trap! Zapier's loop detection should have stopped it before using 10,000 tasks! I need a supervisor to resolve this. This is ridiculous.", timestamp: new Date(Date.now() - 3600000 * 1.2).toISOString() },
        { sender: "agent", name: "Sarah Jenkins", message: "I understand. I will check with our billing supervisor about the task charge.", timestamp: new Date(Date.now() - 3600000 * 1.0).toISOString() },
        { sender: "customer", name: "Sara Singh", message: "I need this sorted out now. I'm losing business leads because our database is paused.", timestamp: new Date(Date.now() - 3600000 * 0.8).toISOString() },
        { sender: "agent", name: "Sarah Jenkins", message: "I am escalating the ticket to our operations lead to review the billing exception.", timestamp: new Date(Date.now() - 3600000 * 0.5).toISOString() },
        { sender: "customer", name: "Sara Singh", message: "Okay, tell them to call me or email back. We are very disappointed with this service.", timestamp: new Date(Date.now() - 3600000 * 0.2).toISOString() }
      ]
    },
    {
      id: "T-1009",
      account: "Dunder Mifflin",
      contact: "michael.scott@dundermifflin.com",
      subject: "Slack Notification formatting broken in webhook trigger",
      category: "API/CRM",
      assignedTo: "Elena Rostova",
      status: "Waiting on Customer",
      priority: "Normal",
      createdTime: new Date(Date.now() - 3600000).toISOString(),
      conversations: [
        { sender: "customer", name: "Michael Scott", message: "The Slack messages we send from our CRM are coming out as raw HTML tags like <b>bold</b> instead of markdown. It looks terrible in the general channel. How do I fix this? I want bold text.", timestamp: new Date(Date.now() - 3600000).toISOString() }
      ]
    },
    {
      id: "T-1010",
      account: "Osborn Industries",
      contact: "norman@osborn.com",
      subject: "Microsoft Teams authorization token expired loop",
      category: "Auth/OAuth",
      assignedTo: "John Doe",
      status: "Open",
      priority: "High",
      createdTime: new Date(Date.now() - 7200000).toISOString(),
      conversations: [
        { sender: "customer", name: "Norman Osborn", message: "Microsoft Teams connector is failing with 'Invalid Authentication'. We re-authenticated, it worked for 1 day, now it's failing again. Please check your Teams OAuth integrations.", timestamp: new Date(Date.now() - 7200000).toISOString() },
        { sender: "agent", name: "John Doe", message: "Please check if your Microsoft 365 Global Admin revoked the Zapier Enterprise Connected App permission.", timestamp: new Date(Date.now() - 7200000 * 0.9).toISOString() },
        { sender: "customer", name: "Norman Osborn", message: "I am the Admin. The permissions are active. It disconnects randomly. Why is your OAuth handler not keeping the session alive?", timestamp: new Date(Date.now() - 7200000 * 0.8).toISOString() },
        { sender: "agent", name: "John Doe", message: "Sometimes Microsoft restricts token lifetimes if there is a detected sign-in risk or location change.", timestamp: new Date(Date.now() - 7200000 * 0.6).toISOString() },
        { sender: "customer", name: "Norman Osborn", message: "We run on white-listed servers. There is no sign-in risk. Fix the connection sync.", timestamp: new Date(Date.now() - 7200000 * 0.4).toISOString() }
      ]
    },
    {
      id: "T-1011",
      account: "Wayne Enterprises",
      contact: "bruce@wayne.tech",
      subject: "Stripe Webhook signature verification failing (400 Bad Request)",
      category: "Webhooks",
      assignedTo: "Priya Sharma",
      status: "Open",
      priority: "Normal",
      createdTime: new Date(Date.now() - 720000).toISOString(), // 12 mins ago
      conversations: [
        { sender: "customer", name: "Bruce Wayne", message: "Our custom app is posting Stripe webhook payloads to Catch Webhook. We enabled signature verification, but Zapier keeps returning HTTP 400. We validated our Stripe webhook signing secret: whsec_abc123XYZ. Why is signature match failing?", timestamp: new Date(Date.now() - 720000).toISOString() }
      ]
    },
    {
      id: "T-1012",
      account: "Soylent Corp",
      contact: "investor@soylent.com",
      subject: "Shopify order cancellations trigger not executing",
      category: "API/CRM",
      assignedTo: "Marcus Aurelius",
      status: "Open",
      priority: "Normal",
      createdTime: new Date(Date.now() - 300000).toISOString(), // 5 mins ago
      conversations: [
        { sender: "customer", name: "Soylent Logistics", message: "When we cancel an order in Shopify, the 'Order Cancelled' Zap doesn't fire. It works for 'Order Created' but not cancellations. Please check the webhook registry on Shopify app configurations.", timestamp: new Date(Date.now() - 300000).toISOString() }
      ]
    }
  ];

  // Helper: Deterministic Seeded Pseudo-Random Number Generator
  function seedRandom(seed) {
    let m = 0x80000000;
    let a = 1103515245;
    let c = 12345;
    let state = seed;
    return function() {
      state = (a * state + c) % m;
      return state / (m - 1);
    };
  }
  const nextRand = seedRandom(1337);

  // Helper arrays for content generation
  const accounts = ["Stark Industries", "Acme Corp", "Globex Corp", "Initech", "Umbrella Corp", "Hooli", "Wayne Enterprises", "Tyrell Corp", "Cyberdyne Systems", "Oscorp", "Soylent Corp", "Veer Ltd", "Momcorp", "Dunder Mifflin"];
  const contacts = ["admin@stark.com", "ops@acmecorp.com", "h.scorpio@globex.org", "pgibbons@initech.com", "t-1000@cyberdyne.com", "gwen@oscorp.com", "tyrell@nexus.net", "rip@weyland.org", "dwight@dundermifflin.com", "richard@hooli.com"];
  const categories = ["Auth/OAuth", "Webhooks", "Logic/Formatting", "API/CRM", "Custom Code", "MTA/Routing"];
  const priorities = ["Highest", "High", "Normal", "Low"];
  const statuses = ["Open", "In Progress", "Waiting on Customer", "Pending Engineering"];
  
  const subjectsMap = {
    "Auth/OAuth": [
      "Access token invalid for connector", "OAuth redirect URI mismatch error 400", 
      "Session disconnected on Salesforce step", "Refresh token missing from payload schema",
      "Box integration fails to re-authenticate", "HubSpot App credentials expired loop",
      "Intuit QuickBooks OAuth flow blocked by popup blocker", "Slack auth scope verification failed"
    ],
    "Webhooks": [
      "Stripe Webhook signature mismatch error", "Duplicate Webhook delivery for customer.subscription",
      "Webhooks returning 504 gateway timeout", "Custom webhook payload header auth missing",
      "HubSpot webhook trigger fails to fire on update", "GitHub push webhook returns 400",
      "Typeform webhooks flattening matrix variables", "JSON body payload parsing failed in raw webhook"
    ],
    "Logic/Formatting": [
      "Formatter failing to parse date from date string", "Text split regex cutting off tail characters",
      "Number utility returning NaN on blank spreadsheet values", "Date subtraction returning negative interval",
      "Line item utility failing to convert nested arrays", "Currency formatter dropping decimal zeros",
      "Lookup table failing to match keys on case sensitivity", "URL encoder replacing spaces with double escapes"
    ],
    "API/CRM": [
      "HubSpot contact sync dropping custom properties", "Salesforce lead creation returning 400 bad schema",
      "Shopify API query returning 403 Forbidden on inventory", "ActiveCampaign contact tag addition failing",
      "Intercom API rate limits throttling synced users", "Pipedrive custom field mapping disconnected",
      "Zoho CRM authentication timeout on lead sync", "Mailchimp subscriber addition loops on unsubscribed status"
    ],
    "Custom Code": [
      "Python custom script memory limit exceeded", "Node code block syntax error in nested promise",
      "JavaScript fetch timeout during external API call", "Regex patterns matching incorrectly in code step",
      "Async await block stalling task execution", "JSON.parse throws syntax error in custom handler",
      "Python pandas dependency missing in standard sandbox", "Variables mapping from previous steps returned undefined"
    ],
    "MTA/Routing": [
      "Mailgun webhook relay latency spikes", "SMTP relay error 550 invalid recipient address",
      "Inbound email parser dropping attachment names", "Email template variables mapping broken",
      "SendGrid API response 400 validation error", "Gmail integration mailbox connection throttled",
      "Outlook email trigger missing HTML content body", "DNS records validation warning in custom domain"
    ]
  };

  const subjectDetails = {
    // Auth/OAuth
    "Access token invalid for connector": {
      errorCode: "INVALID_GRANT",
      logSnippet: '{"error": "invalid_grant", "error_description": "expired access token"}',
      endpoint: "https://api.connector.com/oauth/token",
      param: "grant_type=refresh_token"
    },
    "OAuth redirect URI mismatch error 400": {
      errorCode: "redirect_uri_mismatch",
      logSnippet: "Error 400: redirect_uri_mismatch. The redirect URI in the request does not match the authorized redirect URIs.",
      endpoint: "https://auth.provider.com/oauth2/authorize",
      param: "redirect_uri"
    },
    "Session disconnected on Salesforce step": {
      errorCode: "EXPIRED_SESSION",
      logSnippet: '{"message": "Session expired or invalid", "errorCode": "INVALID_SESSION_ID"}',
      endpoint: "https://login.salesforce.com/services/OAuth",
      param: "session_id"
    },
    "Refresh token missing from payload schema": {
      errorCode: "MISSING_REFRESH_TOKEN",
      logSnippet: '{"warning": "No refresh_token returned. Ensure access_type=offline is passed."}',
      endpoint: "https://oauth2.googleapis.com/token",
      param: "access_type=offline"
    },
    "Box integration fails to re-authenticate": {
      errorCode: "BOX_AUTH_ERROR",
      logSnippet: '{"error": "invalid_client", "error_description": "Client authentication failed"}',
      endpoint: "https://api.box.com/oauth2/token",
      param: "client_assertion"
    },
    "HubSpot App credentials expired loop": {
      errorCode: "EXPIRED_CREDENTIALS",
      logSnippet: '{"status": "error", "message": "The integration credentials have expired. Please re-authenticate."}',
      endpoint: "https://api.hubapi.com/oauth/v1/token",
      param: "refresh_token"
    },
    "Intuit QuickBooks OAuth flow blocked by popup blocker": {
      errorCode: "POPUP_BLOCKED",
      logSnippet: "Browser Error: Window open failed. OAuth authorization popup was blocked by user agent settings.",
      endpoint: "https://appcenter.intuit.com/connect/oauth2",
      param: "popup=true"
    },
    "Slack auth scope verification failed": {
      errorCode: "SCOPE_NOT_ALLOWED",
      logSnippet: '{"ok": false, "error": "missing_scope", "needed": "admin.conversations.write"}',
      endpoint: "https://slack.com/api/oauth.v2.access",
      param: "scope"
    },

    // Webhooks
    "Stripe Webhook signature mismatch error": {
      errorCode: "SIGNATURE_MISMATCH",
      logSnippet: "Stripe-Signature verification failed. Expected signature matching whsec_... but got invalid hash.",
      endpoint: "https://hooks.zapier.com/hooks/catch/12345/stripe/",
      param: "Stripe-Signature header"
    },
    "Duplicate Webhook delivery for customer.subscription": {
      errorCode: "DUPLICATE_DELIVERY",
      logSnippet: "Warning: Received multiple webhook events with same ID evt_1Mza92. Processing skipped for duplicates.",
      endpoint: "https://hooks.zapier.com/hooks/catch/98765/stripe-sub/",
      param: "event_id"
    },
    "Webhooks returning 504 gateway timeout": {
      errorCode: "GATEWAY_TIMEOUT",
      logSnippet: "HTTP/1.1 504 Gateway Timeout. The origin server did not respond within the 10000ms limit.",
      endpoint: "https://hooks.zapier.com/hooks/catch/webhooks/",
      param: "timeout"
    },
    "Custom webhook payload header auth missing": {
      errorCode: "MISSING_AUTH_HEADER",
      logSnippet: "Error: Missing 'X-Webhook-Token' header in incoming request. Request rejected.",
      endpoint: "https://hooks.zapier.com/hooks/catch/custom/",
      param: "X-Webhook-Token"
    },
    "HubSpot webhook trigger fails to fire on update": {
      errorCode: "TRIGGER_NOT_FIRED",
      logSnippet: "HubSpot Webhook system reported success but target URL was never reached. Event dropped.",
      endpoint: "https://api.hubspot.com/webhooks/v1/",
      param: "subscriptionId"
    },
    "GitHub push webhook returns 400": {
      errorCode: "BAD_REQUEST",
      logSnippet: "HTTP/1.1 400 Bad Request. Content-Type must be application/json. Got application/x-www-form-urlencoded.",
      endpoint: "https://hooks.zapier.com/hooks/catch/github/",
      param: "Content-Type"
    },
    "Typeform webhooks flattening matrix variables": {
      errorCode: "FLATTENED_ARRAY",
      logSnippet: "Parsed payload warning: Nested matrix answers flattened into plain text key-value pairs.",
      endpoint: "https://hooks.zapier.com/hooks/catch/typeform/",
      param: "form_response.answers"
    },
    "JSON body payload parsing failed in raw webhook": {
      errorCode: "JSON_PARSE_FAILED",
      logSnippet: "SyntaxError: Unexpected token } in JSON at position 148. Incoming payload is malformed.",
      endpoint: "https://hooks.zapier.com/hooks/catch/raw-json/",
      param: "raw_body"
    },

    // Logic/Formatting
    "Formatter failing to parse date from date string": {
      errorCode: "INVALID_DATE_FORMAT",
      logSnippet: "Formatter output: [Invalid Date]. Input value 'Nexus-6 Manufacture: June 2026' could not be parsed with pattern 'MM-DD-YYYY'.",
      endpoint: "Formatter -> Date/Time -> Format",
      param: "input_format"
    },
    "Text split regex cutting off tail characters": {
      errorCode: "REGEX_SPLIT_TRUNCATION",
      logSnippet: "Formatter split output: ['part1', 'part2']. Warning: input string length 500 characters, output length 420. 80 characters truncated.",
      endpoint: "Formatter -> Text -> Split Text",
      param: "separator_regex"
    },
    "Number utility returning NaN on blank spreadsheet values": {
      errorCode: "NAN_ERROR",
      logSnippet: "Formatter output: NaN. Mathematical operation failed. Input values contain non-numeric value: ''.",
      endpoint: "Formatter -> Numbers -> Perform Math Operation",
      param: "input_values"
    },
    "Date subtraction returning negative interval": {
      errorCode: "NEGATIVE_INTERVAL",
      logSnippet: "Date calculation output: -482000. Warning: Start date '2026-05-30' is after End date '2026-05-25'.",
      endpoint: "Formatter -> Date/Time -> Subtract Time",
      param: "start_date"
    },
    "Line item utility failing to convert nested arrays": {
      errorCode: "NESTED_ARRAY_FAILED",
      logSnippet: "Formatter Line Item converter failed: Cannot convert nested JSON array '[[\"item1\", \"item2\"]]' to line items.",
      endpoint: "Formatter -> Utilities -> Line-itemizer",
      param: "input_array"
    },
    "Currency formatter dropping decimal zeros": {
      errorCode: "DECIMAL_TRUNCATION",
      logSnippet: "Currency output: '$150'. Expected: '$150.00'. Decimal precision parameter was set to 2 but ignored due to type coercion.",
      endpoint: "Formatter -> Numbers -> Format Currency",
      param: "decimal_places"
    },
    "Lookup table failing to match keys on case sensitivity": {
      errorCode: "LOOKUP_MISS",
      logSnippet: "Lookup Table Output: [No Match]. Key 'Email' did not match table keys: ['email', 'EMAIL', 'EmailAddress'].",
      endpoint: "Formatter -> Utilities -> Lookup Table",
      param: "lookup_key"
    },
    "URL encoder replacing spaces with double escapes": {
      errorCode: "DOUBLE_ESCAPE",
      logSnippet: "URL Output: 'https://site.com/file%2520name.pdf'. Space escaped as %2520 instead of %20.",
      endpoint: "Formatter -> Text -> URL Encode",
      param: "input_text"
    },

    // API/CRM
    "HubSpot contact sync dropping custom properties": {
      errorCode: "PROPERTY_NOT_CONFIGURED",
      logSnippet: '{"status": "error", "message": "Property \'lead_source_detail\' does not exist in HubSpot CRM schema."}',
      endpoint: "https://api.hubapi.com/crm/v3/objects/contacts",
      param: "properties"
    },
    "Salesforce lead creation returning 400 bad schema": {
      errorCode: "REQUIRED_FIELD_MISSING",
      logSnippet: '[{"message":"Required fields are missing: [LastName]","fields":["LastName"],"statusCode":"REQUIRED_FIELD_MISSING"}]',
      endpoint: "https://na100.salesforce.com/services/data/v55.0/sobjects/Lead",
      param: "payload"
    },
    "Shopify API query returning 403 Forbidden on inventory": {
      errorCode: "ACCESS_DENIED",
      logSnippet: '[{"message":"Access denied for inventory level queries. Ensure \'read_inventory\' OAuth scope is granted.","code":"ACCESS_DENIED"}]',
      endpoint: "https://shop.myshopify.com/admin/api/2023-04/inventory_levels.json",
      param: "scopes"
    },
    "ActiveCampaign contact tag addition failing": {
      errorCode: "TAG_NOT_FOUND",
      logSnippet: '{"errors": [{"title": "Tag name \'New Lead\' does not exist in the system and auto-creation is disabled."}]}',
      endpoint: "https://activecampaign.com/api/3/contactTags",
      param: "contactTag"
    },
    "Intercom API rate limits throttling synced users": {
      errorCode: "RATE_LIMIT_EXCEEDED",
      logSnippet: "HTTP/1.1 429 Too Many Requests. Rate limit of 150 requests per minute exceeded. Retry-After: 45",
      endpoint: "https://api.intercom.io/users",
      param: "RateLimit-Limit"
    },
    "Pipedrive custom field mapping disconnected": {
      errorCode: "FIELD_NOT_MAPPED",
      logSnippet: '{"success": false, "error": "Invalid custom field key \'4828b182a9bc298da\'. Field may have been deleted."}',
      endpoint: "https://api.pipedrive.com/v1/deals",
      param: "custom_field_key"
    },
    "Zoho CRM authentication timeout on lead sync": {
      errorCode: "ZOHO_TIMEOUT",
      logSnippet: '{"code": "AUTHENTICATION_FAILURE", "message": "The OAuth token has expired or is invalid. Connection timed out."}',
      endpoint: "https://www.zohoapis.com/crm/v2/Leads",
      param: "Authorization"
    },
    "Mailchimp subscriber addition loops on unsubscribed status": {
      errorCode: "SUBSCRIBER_LOOP",
      logSnippet: '{"type": "https://mailchimp.com/developer/marketing/docs/errors/", "title": "Member Exists", "status": 400, "detail": "Member is already unsubscribed and cannot be added back without double opt-in."}',
      endpoint: "https://us1.api.mailchimp.com/3.0/lists/",
      param: "status"
    },

    // Custom Code
    "Python custom script memory limit exceeded": {
      errorCode: "MEMORY_LIMIT_EXCEEDED",
      logSnippet: "Container Error: Memory limit of 256MB exceeded. Process was terminated with SIGKILL.",
      endpoint: "Code by Zapier -> Run Python",
      param: "memory_ceiling"
    },
    "Node code block syntax error in nested promise": {
      errorCode: "SYNTAX_ERROR",
      logSnippet: "SyntaxError: Unexpected token ')' at line 14: resolve(data)) -> extraneous parenthesis.",
      endpoint: "Code by Zapier -> Run NodeJS",
      param: "code_block"
    },
    "JavaScript fetch timeout during external API call": {
      errorCode: "TIMEOUT_EXCEEDED",
      logSnippet: "FetchError: request to https://slow-api.net/data failed, reason: Socket timeout after 10000ms.",
      endpoint: "Code by Zapier -> Run NodeJS",
      param: "fetch_timeout"
    },
    "Regex patterns matching incorrectly in code step": {
      errorCode: "REGEX_MATCH_ERROR",
      logSnippet: "TypeError: Cannot read properties of null (reading '1') at regexMatch (code.js:4:22) because no match was found.",
      endpoint: "Code by Zapier -> Run Python/Node",
      param: "regex_pattern"
    },
    "Async await block stalling task execution": {
      errorCode: "ASYNC_STALL",
      logSnippet: "Runner Warning: Code execution completed but open handles remain. The task did not resolve before timeout.",
      endpoint: "Code by Zapier -> Run NodeJS",
      param: "async_handles"
    },
    "JSON.parse throws syntax error in custom handler": {
      errorCode: "JSON_SYNTAX_ERROR",
      logSnippet: "SyntaxError: Unexpected token o in JSON at position 1. (Tried to parse '[object Object]')",
      endpoint: "Code by Zapier -> Run NodeJS",
      param: "input_data"
    },
    "Python pandas dependency missing in standard sandbox": {
      errorCode: "MODULE_NOT_FOUND",
      logSnippet: "ModuleNotFoundError: No module named 'pandas' in sandboxed Python execution runner.",
      endpoint: "Code by Zapier -> Run Python",
      param: "dependencies"
    },
    "Variables mapping from previous steps returned undefined": {
      errorCode: "UNDEFINED_VARIABLE",
      logSnippet: "ReferenceError: input_data.user_id is undefined. Checked values: input_data={username: \"brian\"}.",
      endpoint: "Code by Zapier -> Run Python/Node",
      param: "input_data"
    },

    // MTA/Routing
    "Mailgun webhook relay latency spikes": {
      errorCode: "RELAY_LATENCY",
      logSnippet: "Mailgun Warning: Delivery queue latency spiked to 450 seconds for destination hooks.zapier.com.",
      endpoint: "https://api.mailgun.net/v3/webhooks",
      param: "delivery_delay"
    },
    "SMTP relay error 550 invalid recipient address": {
      errorCode: "SMTP_550",
      logSnippet: "SMTP Error: 550 5.1.1 The email account that you tried to reach does not exist. Please double check.",
      endpoint: "SMTP by Zapier -> Send Email",
      param: "to_address"
    },
    "Inbound email parser dropping attachment names": {
      errorCode: "ATTACHMENT_PARSE_FAILURE",
      logSnippet: "Parser Log: Multipart MIME parsed successfully. Attachment count: 1. Warning: name header is missing or empty.",
      endpoint: "Email Parser by Zapier",
      param: "attachment_metadata"
    },
    "Email template variables mapping broken": {
      errorCode: "TEMPLATE_PARSE_ERROR",
      logSnippet: "Template Error: Variable {{contact.first_name}} could not be resolved in HTML body context.",
      endpoint: "Email by Zapier -> Send Outbound Email",
      param: "html_body"
    },
    "SendGrid API response 400 validation error": {
      errorCode: "SENDGRID_400",
      logSnippet: '{"errors":[{"message":"The from email address must be verified.","field":"from","help":"http://sendgrid.com/docs/ERRORS"}]}',
      endpoint: "https://api.sendgrid.com/v3/mail/send",
      param: "from_email"
    },
    "Gmail integration mailbox connection throttled": {
      errorCode: "GMAIL_THROTTLE",
      logSnippet: "Google API Error: 429 Rate Limit Exceeded. UserRateLimitExceeded. Mailbox sync frequency is too high.",
      endpoint: "https://gmail.googleapis.com/gmail/v1/users/",
      param: "rate_limit"
    },
    "Outlook email trigger missing HTML content body": {
      errorCode: "MISSING_HTML_BODY",
      logSnippet: "Outlook API Warning: HTML body type requested but only text/plain body was found in message payload.",
      endpoint: "https://graph.microsoft.com/v1.0/me/messages",
      param: "body_type"
    },
    "DNS records validation warning in custom domain": {
      errorCode: "DNS_INVALID",
      logSnippet: "DNS Validation failed. SPF record 'v=spf1 include:mailgun.org ~all' is missing target validation tag for zapier.com.",
      endpoint: "DNS lookup",
      param: "txt_records"
    }
  };

  function getAuthOAuthConversation(category, subject, details, account, contactName, contactEmail, agentName, createdTime) {
    return [
      {
        sender: "customer",
        name: contactName,
        message: `Hi team, we are facing an issue with our ${category} integration. The subject of the issue is: '${subject}'.\n\nWhen we try to authenticate our connection to ${account} via the endpoint \`${details.endpoint}\`, the authorization fails with this error:\n\`\`\`json\n${details.logSnippet}\n\`\`\`\nThis is blocking our production sync queue. We need this resolved. Could you please look at your internal logs and see why our tokens are being rejected?`,
        timestamp: new Date(new Date(createdTime).getTime()).toISOString()
      },
      {
        sender: "customer",
        name: contactName,
        message: `I forgot to add, here is the redirect query parameter we are passing during authentication:\n\`${details.param}\`. This is blocking our core automated synchronization tasks.`,
        timestamp: new Date(new Date(createdTime).getTime() + 60000).toISOString()
      },
      {
        sender: "agent",
        name: agentName,
        message: `Hello ${contactName}, thanks for reaching out. Looking at the error code \`${details.errorCode}\` from the server, this typically indicates that the authentication provider is rejecting the OAuth request parameters, often due to a configuration discrepancy. Could you confirm if you have verified the scopes and client settings in your developer portal for ${account}?`,
        timestamp: new Date(new Date(createdTime).getTime() + 1800000).toISOString()
      },
      {
        sender: "agent",
        name: agentName,
        message: `Also, please make sure that your client ID and client secret match exactly what is listed in your auth dashboard. Let me know if those match up.`,
        timestamp: new Date(new Date(createdTime).getTime() + 1860000).toISOString()
      },
      {
        sender: "customer",
        name: contactName,
        message: `Thanks for responding, ${agentName}. Yes, we double-checked our developer console. The client ID and client secret match what we entered in Zapier. We also verified that our redirect URL is set to \`https://zapier.com/dashboard/auth/oauth/return\` as required. We tried clearing cookies and re-authorizing in an incognito window, but the redirect fails with the same \`${details.errorCode}\` error.`,
        timestamp: new Date(new Date(createdTime).getTime() + 3600000).toISOString()
      },
      {
        sender: "agent",
        name: agentName,
        message: `Thanks for verifying. I took a closer look at our system logs for the OAuth exchange at \`${details.endpoint}\`. The server logs indicate that the request is failing when sending the query parameters, specifically around \`${details.param}\`. It seems the auth server is expecting a different parameter encoding. Are you using a custom security policy or firewall that might be stripping or modifying headers in transit?`,
        timestamp: new Date(new Date(createdTime).getTime() + 5400000).toISOString()
      },
      {
        sender: "customer",
        name: contactName,
        message: `We do have an API gateway that intercepts traffic, but it has been whitelisted for all Zapier IP ranges. If the issue is with \`${details.param}\`, is there a way for us to modify the query parameters passed by the connector, or do we need to set up a custom app configuration to handle this manually? We are losing hours of syncing logs here.`,
        timestamp: new Date(new Date(createdTime).getTime() + 7200000).toISOString()
      }
    ];
  }

  function getWebhooksConversation(category, subject, details, account, contactName, contactEmail, agentName, createdTime) {
    return [
      {
        sender: "customer",
        name: contactName,
        message: `Hello support, we are running into a webhooks issue: '${subject}'.\n\nWe have set up an endpoint at \`${details.endpoint}\` to capture webhooks from ${account}. However, the webhook trigger is failing or returning error logs like:\n\`\`\`\n${details.logSnippet}\n\`\`\`\nWe verified that our server is posting payloads, but Zapier does not seem to parse them correctly. Can you help us troubleshoot this?`,
        timestamp: new Date(new Date(createdTime).getTime()).toISOString()
      },
      {
        sender: "agent",
        name: agentName,
        message: `Hi ${contactName}, thanks for details. The error \`${details.errorCode}\` suggests that the signature verification or content-type parsing on the webhook listener is failing. Could you verify what headers are being sent by ${account} in the raw payload?`,
        timestamp: new Date(new Date(createdTime).getTime() + 1800000).toISOString()
      },
      {
        sender: "agent",
        name: agentName,
        message: `Specifically, are you verifying the webhook signature using the correct header, such as \`${details.param}\`? If the signature header is missing or hashed incorrectly, the server will block the payload.`,
        timestamp: new Date(new Date(createdTime).getTime() + 1860000).toISOString()
      },
      {
        sender: "customer",
        name: contactName,
        message: `Thanks ${agentName}. We checked our headers and we are indeed sending \`${details.param}\`. The raw body contains the correct JSON payload. In Postman, we can successfully post to our endpoint and retrieve a 200 OK.`,
        timestamp: new Date(new Date(createdTime).getTime() + 3600000).toISOString()
      },
      {
        sender: "customer",
        name: contactName,
        message: `Here is a sample header payload we intercepted from our server logs: \`${details.param}: t=1620000000,v1=abc123hash\`. It matches the signing keys exactly.`,
        timestamp: new Date(new Date(createdTime).getTime() + 3660000).toISOString()
      },
      {
        sender: "agent",
        name: agentName,
        message: `Thanks for sharing the headers. It looks like the webhook listener is expecting the raw payload to calculate the HMAC signature, but Zapier's webhook parser might be pre-processing or formatting the body, which alters the raw string structure and breaks the signature comparison. Can you confirm if you have enabled 'Silent/Raw Webhook Mode' on the webhook trigger setup to bypass our automatic formatting?`,
        timestamp: new Date(new Date(createdTime).getTime() + 5400000).toISOString()
      },
      {
        sender: "customer",
        name: contactName,
        message: `We checked and 'Silent/Raw Webhook Mode' is not enabled. If we enable raw mode, it will return the payload as a single text block, which means we will need a custom code step to parse the JSON. That increases our task consumption and code complexity. Is there any way to preserve the raw signature verification header while keeping the automatic body formatting?`,
        timestamp: new Date(new Date(createdTime).getTime() + 7200000).toISOString()
      }
    ];
  }

  function getLogicFormattingConversation(category, subject, details, account, contactName, contactEmail, agentName, createdTime) {
    return [
      {
        sender: "customer",
        name: contactName,
        message: `Hi, we are having trouble with the Formatter utility in our Zap. The specific issue is: '${subject}'.\n\nWe set up a step using \`${details.endpoint}\` to format variables from ${account}. However, it keeps throwing errors or outputting bad data:\n\`\`\`\n${details.logSnippet}\n\`\`\`\nWe configured the input parameter \`${details.param}\` but it doesn't parse it correctly. Can you explain why it's failing?`,
        timestamp: new Date(new Date(createdTime).getTime()).toISOString()
      },
      {
        sender: "customer",
        name: contactName,
        message: `This is causing downstream actions to fail since they expect clean output from \`${details.endpoint}\`. We need a workaround as soon as possible.`,
        timestamp: new Date(new Date(createdTime).getTime() + 60000).toISOString()
      },
      {
        sender: "agent",
        name: agentName,
        message: `Hello ${contactName}. Looking at the formatter output log \`${details.errorCode}\`, it appears the input value we receive from ${account} is not in the format the utility expects. For the step \`${details.endpoint}\`, the input parameter \`${details.param}\` must match our regex rules. Could you send me the raw input value that is passed into this Formatter step?`,
        timestamp: new Date(new Date(createdTime).getTime() + 1800000).toISOString()
      },
      {
        sender: "customer",
        name: contactName,
        message: `Thanks ${agentName}. The raw input value passed from the trigger step is: 'Nexus-6 Manufacture: June 2026' (or equivalent custom string). We set \`${details.param}\` to match this, but the output is still returning \`[Invalid Date]\` or similar parsing failures. It seems the parser is expecting a standard date format instead of a custom string wrapper.`,
        timestamp: new Date(new Date(createdTime).getTime() + 3600000).toISOString()
      },
      {
        sender: "agent",
        name: agentName,
        message: `Ah, I see the issue. The utility \`${details.endpoint}\` uses standard date-fns library internally, which struggles with arbitrary text wrappers like 'Nexus-6 Manufacture: '. To parse this correctly, you will first need a 'Text -> Split Text' or 'Text -> Replace' Formatter step to strip out the text prefixes, leaving only the clean date string 'June 2026' before passing it to the date formatter.`,
        timestamp: new Date(new Date(createdTime).getTime() + 5400000).toISOString()
      },
      {
        sender: "agent",
        name: agentName,
        message: `Alternatively, you can use our 'Formatter -> Text -> Extract Pattern' option which allows you to pass a regular expression to target and extract the date structure. The pattern \`(\\b[A-Za-z]+ \\d{4}\\b)\` should match the month and year. Let me know if that regex works for your various inputs.`,
        timestamp: new Date(new Date(createdTime).getTime() + 5460000).toISOString()
      },
      {
        sender: "customer",
        name: contactName,
        message: `We tried that regex in the Extract Pattern step, but it's throwing a null match error on some records that don't have a year. We need a fallback option when the extraction fails, but the Formatter step doesn't support conditional branching without stopping the Zap. We are trying to figure out how to structure the fallback logic.`,
        timestamp: new Date(new Date(createdTime).getTime() + 7200000).toISOString()
      }
    ];
  }

  function getApiCrmConversation(category, subject, details, account, contactName, contactEmail, agentName, createdTime) {
    return [
      {
        sender: "customer",
        name: contactName,
        message: `Hi support team, we are facing an issue with our CRM sync: '${subject}'.\n\nWhen we try to sync leads to ${account} using the endpoint \`${details.endpoint}\`, we receive the following API error:\n\`\`\`json\n${details.logSnippet}\n\`\`\`\nThis is causing our updates to fail and is creating sync gaps. Can you check what's wrong with the field mapping or connection?`,
        timestamp: new Date(new Date(createdTime).getTime()).toISOString()
      },
      {
        sender: "agent",
        name: agentName,
        message: `Hello ${contactName}, thank you for reaching out. The error code \`${details.errorCode}\` from ${account} indicates that the request fails verification or is missing a required parameter in the schema, specifically \`${details.param}\`. Could you verify if you have mapped a value to the field \`${details.param}\` in the Zap setup step?`,
        timestamp: new Date(new Date(createdTime).getTime() + 1800000).toISOString()
      },
      {
        sender: "agent",
        name: agentName,
        message: `If you have verified that the field is mapped, please check if the field value is being passed as the correct data type. Sometimes mapping an empty value can throw schema validation errors on CRM endpoints.`,
        timestamp: new Date(new Date(createdTime).getTime() + 1860000).toISOString()
      },
      {
        sender: "customer",
        name: contactName,
        message: `Thanks ${agentName}. We checked our mapping. The field \`${details.param}\` is mapped to the customer email address, which is present in all trigger records. We also checked that the API key has write permissions.`,
        timestamp: new Date(new Date(createdTime).getTime() + 3600000).toISOString()
      },
      {
        sender: "customer",
        name: contactName,
        message: `However, the API returns \`${details.errorCode}\` during bulk updates. Is it possible that Zapier is sending the payload as a string instead of a nested JSON object?`,
        timestamp: new Date(new Date(createdTime).getTime() + 3660000).toISOString()
      },
      {
        sender: "agent",
        name: agentName,
        message: `Thanks for checking. Looking at our integration client logs for \`${details.endpoint}\`, we are sending the request as structured JSON. However, during bulk updates, we are seeing a high volume of requests triggering rate limits or schema verification errors. The parameter \`${details.param}\` seems to require a specific datatype that might not match the string type we map. Can you verify what data type is expected for \`${details.param}\` in the developer portal?`,
        timestamp: new Date(new Date(createdTime).getTime() + 5400000).toISOString()
      },
      {
        sender: "customer",
        name: contactName,
        message: `The portal says \`${details.param}\` expects an array of strings or a boolean, not a plain string. But the Zapier action field only shows a text input box, which coerces the value to a string. How can we force Zapier to send it as the correct type, or is there a way to override the field structure?`,
        timestamp: new Date(new Date(createdTime).getTime() + 7200000).toISOString()
      }
    ];
  }

  function getCustomCodeConversation(category, subject, details, account, contactName, contactEmail, agentName, createdTime) {
    return [
      {
        sender: "customer",
        name: contactName,
        message: `Hi, we are experiencing an error in our custom code execution block: '${subject}'.\n\nWe are running a custom script under the step \`${details.endpoint}\` to process data from ${account}. The execution fails with the error:\n\`\`\`\n${details.logSnippet}\n\`\`\`\nWe tested the script locally and it works fine. Why is it failing in the Zapier container?`,
        timestamp: new Date(new Date(createdTime).getTime()).toISOString()
      },
      {
        sender: "customer",
        name: contactName,
        message: `The input data variable we map is \`input_data.${details.param}\`. It seems the script runner times out or crashes before resolving the handler.`,
        timestamp: new Date(new Date(createdTime).getTime() + 60000).toISOString()
      },
      {
        sender: "agent",
        name: agentName,
        message: `Hi ${contactName}. Looking at the error \`${details.errorCode}\` from the execution runner, this is typically caused by sandboxing restrictions in our code environment. For the step \`${details.endpoint}\`, we enforce limits on \`${details.param}\` to ensure container stability. Could you share the part of the script that handles memory allocation or network calls?`,
        timestamp: new Date(new Date(createdTime).getTime() + 1800000).toISOString()
      },
      {
        sender: "customer",
        name: contactName,
        message: `Thanks ${agentName}. Here is the script snippet we are running:\n\`\`\`javascript\n// fetching data from ${account}\nconst res = await fetch('https://api.site.com/data');\nconst data = await res.json();\n// process nested arrays\nconst output = data.items.map(item => item.value);\n\`\`\`\nThe input payload is around 15MB. The error \`${details.errorCode}\` occurs on the fetch call. Is there a library dependency we need to include or is the response size exceeding the runner limits?`,
        timestamp: new Date(new Date(createdTime).getTime() + 3600000).toISOString()
      },
      {
        sender: "agent",
        name: agentName,
        message: `Thanks for the script snippet. The error is due to the 10-second CPU runtime ceiling or the 256MB memory limit on Zapier's execution runner. Parsing a 15MB JSON payload in JavaScript and executing maps in memory frequently pushes past the container limits, triggering the \`${details.errorCode}\` termination. Can you pre-filter the data on the API server side or reduce the payload size?`,
        timestamp: new Date(new Date(createdTime).getTime() + 5400000).toISOString()
      },
      {
        sender: "agent",
        name: agentName,
        message: `Alternatively, you can run the network fetch outside Zapier using a serverless function, and pass only the filtered array back to your Zap. That would keep it well within the 10-second ceiling.`,
        timestamp: new Date(new Date(createdTime).getTime() + 5460000).toISOString()
      },
      {
        sender: "customer",
        name: contactName,
        message: `Unfortunately, the API server doesn't support pagination or server-side filtering, so we have to retrieve the entire 15MB payload. If the limit is at the container level, can we upgrade our Zapier account to increase the memory ceiling for custom scripts, or is there a way to split the execution?`,
        timestamp: new Date(new Date(createdTime).getTime() + 7200000).toISOString()
      }
    ];
  }

  function getMtaRoutingConversation(category, subject, details, account, contactName, contactEmail, agentName, createdTime) {
    return [
      {
        sender: "customer",
        name: contactName,
        message: `Hello support, we are experiencing an email routing failure: '${subject}'.\n\nWe set up a mail parser or outbound email step with ${account}. However, outbound emails are getting bounced or failing with logs:\n\`\`\`\n${details.logSnippet}\n\`\`\`\nWe configured the routing parameter \`${details.param}\` but it's throwing this validation error. Can you check our email delivery status?`,
        timestamp: new Date(new Date(createdTime).getTime()).toISOString()
      },
      {
        sender: "agent",
        name: agentName,
        message: `Hello ${contactName}, thanks for reaching out. The error code \`${details.errorCode}\` points to an issue with sender authorization or recipient mailbox restrictions. For \`${details.param}\`, this typically occurs when the sender domain DNS SPF/DKIM records are missing or invalid, or if the recipient mail server is blocking the SMTP handshake. Have you verified your domain records?`,
        timestamp: new Date(new Date(createdTime).getTime() + 1800000).toISOString()
      },
      {
        sender: "customer",
        name: contactName,
        message: `Thanks ${agentName}. We checked our DNS records. The SPF txt record is set to \`v=spf1 include:mailgun.org ~all\` and DKIM is verified. Outbound emails succeed when sent directly from our Gmail account, but when they originate from Zapier's mail servers using our domain, we receive the \`${details.errorCode}\` bounce error.`,
        timestamp: new Date(new Date(createdTime).getTime() + 3600000).toISOString()
      },
      {
        sender: "customer",
        name: contactName,
        message: `It seems Zapier's IP ranges are not included in our SPF record. Do you publish SPF guidelines?`,
        timestamp: new Date(new Date(createdTime).getTime() + 3660000).toISOString()
      },
      {
        sender: "agent",
        name: agentName,
        message: `Thanks for checking the records. Since you are using our SMTP/Email tool, our servers send the emails on your behalf. To authorize our IPs, you must add \`include:sendgrid.net\` or \`include:mailgun.org\` (depending on which mail service is routing your Zapier step) to your SPF record. The error \`${details.errorCode}\` is caused by the recipient server enforcing strict DMARC checks. Can you try adding our mail relays to your DNS configuration?`,
        timestamp: new Date(new Date(createdTime).getTime() + 5400000).toISOString()
      },
      {
        sender: "agent",
        name: agentName,
        message: `Alternatively, you can use our 'SMTP by Zapier' integration instead of the default 'Email by Zapier' tool. This allows you to configure your own SMTP host, port, username, and password, routing all outbound mail directly through your own servers. This resolves the SPF/DMARC issues entirely.`,
        timestamp: new Date(new Date(createdTime).getTime() + 5460000).toISOString()
      },
      {
        sender: "customer",
        name: contactName,
        message: `Our IT Security department has a strict policy against adding third-party email service inclusions directly to our root domain SPF record because of security risks. Is there a way to route these emails through a custom SMTP relay that we control, so we don't have to alter our main SPF configuration?`,
        timestamp: new Date(new Date(createdTime).getTime() + 7200000).toISOString()
      }
    ];
  }

  function generateConversation(category, subject, account, contact, engName, createdTime, convCountLimit, ticketId) {
    const details = subjectDetails[subject] || {
      errorCode: "UNKNOWN_ERROR",
      logSnippet: "An unexpected error occurred during execution.",
      endpoint: "https://api.zapier.com/v1/sync",
      param: "payload"
    };
    const contactName = contact.split('@')[0].split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    const contactEmail = contact;

    let fullConv = [];
    switch (category) {
      case "Auth/OAuth":
        fullConv = getAuthOAuthConversation(category, subject, details, account, contactName, contactEmail, engName, createdTime);
        break;
      case "Webhooks":
        fullConv = getWebhooksConversation(category, subject, details, account, contactName, contactEmail, engName, createdTime);
        break;
      case "Logic/Formatting":
        fullConv = getLogicFormattingConversation(category, subject, details, account, contactName, contactEmail, engName, createdTime);
        break;
      case "API/CRM":
        fullConv = getApiCrmConversation(category, subject, details, account, contactName, contactEmail, engName, createdTime);
        break;
      case "Custom Code":
        fullConv = getCustomCodeConversation(category, subject, details, account, contactName, contactEmail, engName, createdTime);
        break;
      case "MTA/Routing":
        fullConv = getMtaRoutingConversation(category, subject, details, account, contactName, contactEmail, engName, createdTime);
        break;
      default:
        fullConv = [
          { sender: "customer", name: contactName, message: `Hi support, we are facing an issue with our ${category} integration. Subject: ${subject}. We need help.`, timestamp: new Date(createdTime).toISOString() }
        ];
    }

    if (convCountLimit > 0) {
      return fullConv.slice(0, convCountLimit);
    }
    return fullConv;
  }

  // 2. Generate Engineers and their dynamic Backlogs (5-20 open tickets per engineer)
  const targetBacklogCounts = {
    "Sarah Jenkins": 8,
    "Dave Miller": 6,
    "Priya Sharma": 12,
    "Alex Chen": 9,
    "John Doe": 15,
    "Chloe Vance": 7,
    "Marcus Aurelius": 11,
    "Elena Rostova": 5
  };

  const engineersMap = {};
  baseEngineers.forEach(eng => {
    engineersMap[eng.name] = {
      id: eng.id,
      name: eng.name,
      avatar: eng.avatar,
      avatarImg: eng.avatarImg,
      title: eng.title,
      backlog: [],
      history: {
        closedTicketsCount: {},
        accountCSAT: {}
      }
    };
  });

  // Distribute static tickets to their assigned engineers
  const openHelpdeskTickets = [...staticHelpdeskTickets];
  
  openHelpdeskTickets.forEach(ticket => {
    const eng = engineersMap[ticket.assignedTo];
    if (eng) {
      // Map helpdesk ticket details to backlog format
      eng.backlog.push({
        id: `t_${ticket.id.replace('T-','')}`,
        account: ticket.account,
        subject: ticket.subject,
        category: ticket.category,
        complexity: ticket.complexity || "Medium",
        sentiment: ticket.conversations.length >= 3 ? "Frustrated" : "Neutral",
        lastUpdate: "3 hours ago",
        threadLength: ticket.conversations.length,
        priority: ticket.priority,
        status: ticket.status
      });
    }
  });

  // Generate more open tickets deterministically until each engineer reaches their target count
  let ticketIdCounter = 1013;
  
  for (const engName in targetBacklogCounts) {
    const eng = engineersMap[engName];
    const targetCount = targetBacklogCounts[engName];
    
    while (eng.backlog.length < targetCount) {
      const idStr = `T-${ticketIdCounter++}`;
      const category = categories[Math.floor(nextRand() * categories.length)];
      const account = accounts[Math.floor(nextRand() * accounts.length)];
      const contact = contacts[Math.floor(nextRand() * contacts.length)];
      const subjects = subjectsMap[category];
      const subject = subjects[Math.floor(nextRand() * subjects.length)];
      const priority = nextRand() < 0.15 ? "Highest" : priorities[Math.floor(nextRand() * priorities.length)];
      const status = statuses[Math.floor(nextRand() * statuses.length)];
      const complexity = nextRand() < 0.3 ? "High" : (nextRand() < 0.7 ? "Medium" : "Low");
      const hoursAgo = Math.round(nextRand() * 24 * 3) + 1; // 1 to 72 hours ago
      
      const createdTime = new Date(Date.now() - hoursAgo * 3600000).toISOString();

      // Keep nextRand in sync by doing the exact same random number consumption
      const originalConvCount = Math.floor(nextRand() * 3) + 1;
      for (let i = 0; i < originalConvCount; i++) {
        if (i % 2 === 0) {
          nextRand(); // consumed for customerMessage index
        }
      }

      // Create conversation using a separate random generator seeded with ticket ID
      const convRand = seedRandom(ticketIdCounter);
      
      // Determine the conversation slice length:
      // Exactly one dynamic ticket (T-1013) is a short thread (1 message, which has exactly 1 customer response).
      // All other dynamic tickets are long threads (5 or 7 messages, which corresponds to 3 or 4 customer responses).
      let messageLimit = 7;
      if (idStr === "T-1013") {
        // T-1013 has exactly 1 message (initial customer message)
        messageLimit = 1;
      } else {
        // Choose between 5 messages (3 customer responses) or 7 messages (3/4 customer responses depending on template)
        messageLimit = convRand() < 0.5 ? 5 : 7;
      }

      const conversations = generateConversation(category, subject, account, contact, eng.name, createdTime, messageLimit, ticketIdCounter);

      const isOutage = subject.toLowerCase().includes("down") || subject.toLowerCase().includes("outage") || subject.toLowerCase().includes("502 bad gateway");
      const finalPriority = isOutage ? "Highest" : priority;

      const newTicket = {
        id: idStr,
        account,
        contact,
        subject,
        category,
        assignedTo: eng.name,
        status,
        priority: finalPriority,
        createdTime,
        complexity,
        conversations
      };

      // Add to main Helpdesk list
      openHelpdeskTickets.push(newTicket);

      // Add to engineer's backlog
      eng.backlog.push({
        id: `t_${newTicket.id.replace('T-','')}`,
        account: newTicket.account,
        subject: newTicket.subject,
        category: newTicket.category,
        complexity: newTicket.complexity,
        sentiment: newTicket.conversations.length >= 3 ? "Frustrated" : "Neutral",
        lastUpdate: `${hoursAgo} hours ago`,
        threadLength: newTicket.conversations.length,
        priority: newTicket.priority,
        status: newTicket.status
      });
    }
  }

  // 3. Generate 35 Closed Tickets History per Engineer deterministically (for dynamic skill analysis)
  const closedTicketsDb = [];
  
  // Define engineer specialties mapping (for CSAT skewing)
  const implicitSpecialties = {
    "Sarah Jenkins": "Auth/OAuth",
    "Dave Miller": "MTA/Routing",
    "Priya Sharma": "Webhooks",
    "Alex Chen": "Custom Code",
    "John Doe": "API/CRM",
    "Chloe Vance": "Logic/Formatting",
    "Marcus Aurelius": "API/CRM", // E-Commerce/Shopify falls into API
    "Elena Rostova": "Webhooks"   // Security/Slack webhooks
  };

  let closedIdCounter = 5001;

  for (const engName in engineersMap) {
    const eng = engineersMap[engName];
    const specialty = implicitSpecialties[engName];
    
    // Track closed volumes
    const closedCountMap = {};
    categories.forEach(c => closedCountMap[c] = 0);
    
    for (let i = 0; i < 35; i++) {
      const idStr = `C-${closedIdCounter++}`;
      // Skew category towards their specialty
      let category;
      if (nextRand() < 0.6) {
        // 60% chance to assign specialty category
        category = specialty === "Webhooks" ? "Webhooks" : 
                   (specialty === "Auth/OAuth" ? "Auth/OAuth" : 
                    (specialty === "MTA/Routing" ? "MTA/Routing" : 
                     (specialty === "Custom Code" ? "Custom Code" : 
                      (specialty === "Logic/Formatting" ? "Logic/Formatting" : "API/CRM"))));
      } else {
        category = categories[Math.floor(nextRand() * categories.length)];
      }

      closedCountMap[category]++;

      const account = accounts[Math.floor(nextRand() * accounts.length)];
      const priority = priorities[Math.floor(nextRand() * priorities.length)];
      const daysAgo = Math.floor(nextRand() * 90) + 1; // 1 to 90 days ago
      const closedDate = new Date(Date.now() - daysAgo * 24 * 3600000).toISOString();

      // Skew CSAT: Specialty gets 4.5-5.0 average, others get 3.5-4.5
      const isSpecialty = (category === specialty || (specialty === "Auth/OAuth" && category === "Auth/OAuth"));
      let csat = 4;
      const roll = nextRand();
      
      if (isSpecialty) {
        csat = roll < 0.7 ? 5 : (roll < 0.95 ? 4 : 3); // High chance of 5/4
      } else {
        csat = roll < 0.3 ? 5 : (roll < 0.75 ? 4 : (roll < 0.95 ? 3 : 2)); // Normal curve
      }

      // Skew Time to Solve (hours)
      let timeToSolve = 8;
      if (isSpecialty) {
        timeToSolve = Math.round(nextRand() * 6) + 1; // 1 to 7 hours
      } else {
        timeToSolve = Math.round(nextRand() * 28) + 4; // 4 to 32 hours
      }

      const subjects = subjectsMap[category];
      const subject = subjects[Math.floor(nextRand() * subjects.length)];

      const closedCase = {
        id: idStr,
        category,
        account,
        subject,
        priority,
        csat,
        timeToSolveHours: timeToSolve,
        status: "Closed",
        closedAt: closedDate,
        assignedTo: eng.name
      };

      closedTicketsDb.push(closedCase);
      
      // Update account CSAT tracking in engineer profile
      if (!eng.history.accountCSAT[account]) {
        eng.history.accountCSAT[account] = [];
      }
      eng.history.accountCSAT[account].push(csat);
    }

    // Attach aggregated history counts to engineer object
    categories.forEach(c => {
      eng.history.closedTicketsCount[c] = closedCountMap[c];
    });

    // Resolve average account CSATs
    for (const acc in eng.history.accountCSAT) {
      const arr = eng.history.accountCSAT[acc];
      const sum = arr.reduce((a, b) => a + b, 0);
      eng.history.accountCSAT[acc] = parseFloat((sum / arr.length).toFixed(1));
    }
  }

  // Bind compiled and generated results to dynamic window object
  queueMindMockData.engineers = Object.values(engineersMap);
  queueMindMockData.helpdeskTickets = openHelpdeskTickets;
  queueMindMockData.closedTickets = closedTicketsDb;

  return queueMindMockData;
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.queueMindMockData;
}
