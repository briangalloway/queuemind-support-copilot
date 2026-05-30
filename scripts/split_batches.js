const fs = require('fs');
const path = require('path');

const DB_FILE = path.resolve(__dirname, '../db.json');
const SCRATCH_DIR = path.resolve(__dirname, '../scratch');

if (!fs.existsSync(SCRATCH_DIR)) {
  fs.mkdirSync(SCRATCH_DIR);
}

const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const tickets = db.helpdeskTickets || [];

const batchSize = Math.ceil(tickets.length / 4);
console.log(`Total tickets: ${tickets.length}. Batch size: ${batchSize}`);

for (let i = 0; i < 4; i++) {
  const start = i * batchSize;
  const end = Math.min(tickets.length, (i + 1) * batchSize);
  const batchTickets = tickets.slice(start, end);
  
  const batchFile = path.join(SCRATCH_DIR, `tickets_batch${i + 1}.json`);
  fs.writeFileSync(batchFile, JSON.stringify(batchTickets, null, 2), 'utf8');
  console.log(`Saved batch ${i + 1} (${batchTickets.length} tickets) to ${batchFile}`);
}
