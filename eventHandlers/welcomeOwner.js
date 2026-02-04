/**
 * Welcome Owner Event Handler
 * Sends a detailed welcome message to the bot owner when the bot comes online
 */

const os = require('os');

function formatUptime(uptime) {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  
  return parts.join(' ') || '0s';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function welcomeOwner(api, session, log) {
  const ownerId = session.ownerId;
  
  if (!ownerId) {
    log('warn', 'No owner ID set for session, skipping welcome message', session.id);
    return;
  }

  try {
    // Get bot user info
    let botInfo = { name: 'Unknown' };
    try {
      const userInfo = await new Promise((resolve, reject) => {
        api.getUserInfo(api.getCurrentUserID(), (err, info) => {
          if (err) reject(err);
          else resolve(info);
        });
      });
      botInfo = userInfo[api.getCurrentUserID()] || botInfo;
    } catch (e) {
      log('warn', 'Could not fetch bot user info', session.id);
    }

    // System information
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemory: formatBytes(os.totalmem()),
      freeMemory: formatBytes(os.freemem()),
      uptime: formatUptime(os.uptime()),
      nodeVersion: process.version
    };

    // Build welcome message
    const welcomeMessage = `
━━━━━━━━━━━━━━━━━━━━━━
   🤖 AUTONAMO-HUB ONLINE
━━━━━━━━━━━━━━━━━━━━━━

✅ Bot Status: ONLINE

📋 Bot Information:
├─ Name: ${botInfo.name || session.name}
├─ Session ID: ${session.id}
├─ User ID: ${api.getCurrentUserID()}
└─ Started: ${new Date().toLocaleString()}

💻 System Information:
├─ Platform: ${systemInfo.platform} (${systemInfo.arch})
├─ Hostname: ${systemInfo.hostname}
├─ CPU Cores: ${systemInfo.cpus}
├─ Memory: ${systemInfo.freeMemory} / ${systemInfo.totalMemory}
├─ System Uptime: ${systemInfo.uptime}
└─ Node.js: ${systemInfo.nodeVersion}

⚙️ Configuration:
├─ Proxy: ${session.proxy || 'None'}
└─ Owner ID: ${ownerId}

━━━━━━━━━━━━━━━━━━━━━━
  Ready to receive commands!
━━━━━━━━━━━━━━━━━━━━━━
`.trim();

    // Send message to owner
    api.sendMessage(welcomeMessage, ownerId, (err) => {
      if (err) {
        log('error', `Failed to send welcome message: ${err.message}`, session.id);
      } else {
        log('success', `Welcome message sent to owner: ${ownerId}`, session.id);
      }
    });

  } catch (error) {
    log('error', `Welcome owner error: ${error.message}`, session.id);
  }
}

module.exports = welcomeOwner;
