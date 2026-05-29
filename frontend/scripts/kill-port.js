const { execSync } = require('child_process');

const port = process.argv[2];
if (!port) {
  console.error('Usage: node kill-port.js <port>');
  process.exit(1);
}

try {
  if (process.platform === 'win32') {
    const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: 'pipe' });
    const lines = result.split('\n').filter(line => line.includes('LISTENING'));
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && !isNaN(Number(pid))) {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' });
        console.log(`Killed process ${pid} on port ${port}`);
      }
    }
  } else {
    try {
      const pid = execSync(`lsof -ti :${port}`, { encoding: 'utf8', stdio: 'pipe' }).trim();
      if (pid) {
        execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
        console.log(`Killed process ${pid} on port ${port}`);
      }
    } catch (e) {
      // lsof exits with non-zero if no process found
    }
  }
} catch (e) {
  // No process found on this port, nothing to kill
}
