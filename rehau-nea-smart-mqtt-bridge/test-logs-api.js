// Quick test script to check logs API
const fs = require('fs');
const path = require('path');

async function testLogExporter() {
  console.log('Testing log exporter...\n');
  
  const logFile = path.join(__dirname, 'logs', 'combined.log');
  console.log('Log file path:', logFile);
  console.log('File exists:', fs.existsSync(logFile));
  
  if (fs.existsSync(logFile)) {
    const content = fs.readFileSync(logFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    console.log('Total lines:', lines.length);
    console.log('First 5 lines:');
    lines.slice(0, 5).forEach((line, i) => {
      console.log(`  ${i + 1}: ${line.substring(0, 100)}...`);
    });
    console.log('\nLast 5 lines:');
    lines.slice(-5).forEach((line, i) => {
      console.log(`  ${i + 1}: ${line.substring(0, 100)}...`);
    });
  }
}

testLogExporter().catch(console.error);
