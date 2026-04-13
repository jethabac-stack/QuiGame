const { spawn } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'scripts', 'setup-firestore.js');

const child = spawn('node', [scriptPath], {
  cwd: __dirname,
  stdio: 'inherit'
});

child.on('close', (code) => {
  process.exit(code);
});

child.on('error', (error) => {
  console.error('Failed to start script:', error);
  process.exit(1);
});