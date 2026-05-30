const fs = require('fs');
const path = require('path');

const SCRATCH_DIR = path.resolve(__dirname, '../scratch');
const OUTPUT_FILE = path.resolve(__dirname, '../simulatedResponses.js');

const merged = {};

for (let i = 1; i <= 4; i++) {
  const batchFile = path.join(SCRATCH_DIR, `responses_batch${i}.json`);
  if (fs.existsSync(batchFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
      Object.assign(merged, data);
      console.log(`Merged batch ${i} (${Object.keys(data).length} tickets)`);
    } catch (err) {
      console.error(`Error parsing batch ${i}:`, err.message);
    }
  } else {
    console.warn(`Batch file ${batchFile} not found!`);
  }
}

const outputContent = `// Pre-computed high-quality simulated responses for all backlog tickets
window.simulatedResponses = ${JSON.stringify(merged, null, 2)};
`;

fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf8');
console.log(`Successfully compiled ${Object.keys(merged).length} simulated responses to ${OUTPUT_FILE}`);

// Cleanup temporary files
try {
  for (let i = 1; i <= 4; i++) {
    fs.unlinkSync(path.join(SCRATCH_DIR, `tickets_batch${i}.json`));
    fs.unlinkSync(path.join(SCRATCH_DIR, `responses_batch${i}.json`));
  }
  fs.rmdirSync(SCRATCH_DIR);
  console.log("Cleaned up temporary scratch files and directory.");
} catch (e) {
  console.warn("Error during cleanup:", e.message);
}
