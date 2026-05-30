const fs = require('fs');
const path = require('path');

const FILE_PATH = path.resolve(__dirname, '../simulatedResponses.js');

let content = fs.readFileSync(FILE_PATH, 'utf8');
const startIdx = content.indexOf('{');
let jsonStr = content.substring(startIdx).trim();
if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1);

const db = JSON.parse(jsonStr);

// Core 4 critical tickets we want to preserve in high quality
const keepRiskIds = ["T-1002", "T-1008", "T-1006", "T-1021"];

let refinedCount = 0;
let preservedCount = 0;

Object.entries(db).forEach(([id, res]) => {
  const normId = id.replace('t_','T-');
  
  if (keepRiskIds.includes(normId)) {
    // Preserve core demo tickets exactly as designed
    res.isAtRisk = true;
    if (normId === "T-1002") {
      res.attentionScore = 98;
      res.sentimentScore = 10;
    } else if (normId === "T-1008") {
      res.attentionScore = 95;
      res.sentimentScore = 15;
    } else if (normId === "T-1006") {
      res.attentionScore = 75;
      res.sentimentScore = 30;
    } else if (normId === "T-1021") {
      res.attentionScore = 85;
      res.sentimentScore = 30;
    }
    preservedCount++;
  } else {
    // Reset all other 69 tickets to healthy/stable parameters
    res.isAtRisk = false;
    res.recommendReassign = false;
    res.managerShouldCall = false;
    res.managerDraftResponse = "";
    res.diagnosis = "";
    
    // Normalize attention score to moderate range (e.g. 25-50)
    if (res.attentionScore > 50) {
      const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      res.attentionScore = 25 + (hash % 26); // deterministic random between 25-50
    }
    
    // Normalize sentiment score to standard/healthy range (e.g. 50-65)
    if (res.sentimentScore < 45) {
      const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      res.sentimentScore = 50 + (hash % 16); // deterministic random between 50-65
    }
    
    // Make next action helpful coaching rather than escalations
    if (res.nextAction && (res.nextAction.toLowerCase().includes("reassign") || res.nextAction.toLowerCase().includes("manager") || res.nextAction.toLowerCase().includes("escalat"))) {
      if (res.complexityScore >= 70) {
        res.nextAction = "Coaching: Guide the customer to check integration field mappings. Verify if API credentials have the correct scopes.";
      } else {
        res.nextAction = "Advisor: Ensure standard troubleshooting guides are shared. Check if the latest action trigger step was reloaded.";
      }
    }
    
    refinedCount++;
  }
});

const outputContent = `// Pre-computed high-quality simulated responses for all backlog tickets
window.simulatedResponses = ${JSON.stringify(db, null, 2)};
`;

fs.writeFileSync(FILE_PATH, outputContent, 'utf8');
console.log(`Refining complete! Preserved: ${preservedCount} at-risk tickets, Refined: ${refinedCount} tickets to healthy.`);
