#!/usr/bin/env node

const { exec } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  // Disk usage threshold (percentage)
  WARNING_THRESHOLD: 80,
  CRITICAL_THRESHOLD: 90,
  
  // Telegram settings (will be loaded from config)
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  
  // File to store last alert time to prevent spam
  LAST_ALERT_FILE: '/tmp/disk-monitor-last-alert.txt',
  
  // Minimum time between alerts (in minutes)
  MIN_ALERT_INTERVAL: 30,
};

// Load config from your payment service config if available
function loadConfigFromPaymentService() {
  try {
    const configPath = path.join(__dirname, '..', 'config', 'config.yml');
    if (fs.existsSync(configPath)) {
      const yaml = require('js-yaml');
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(configContent);
      
      if (config.bots && config.bots[0] && config.bots[0].token) {
        CONFIG.TELEGRAM_BOT_TOKEN = config.bots[0].token;
        CONFIG.TELEGRAM_CHAT_ID = config.bots[0].chat_chanel_id;
      }
    }
  } catch (error) {
    console.log('Could not load payment service config, using environment variables');
  }
}

// Get disk usage information
function getDiskUsage() {
  return new Promise((resolve, reject) => {
    exec('df -h /', (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      
      const lines = stdout.split('\n');
      const diskInfo = lines[1].split(/\s+/);
      
      const result = {
        filesystem: diskInfo[0],
        size: diskInfo[1],
        used: diskInfo[2],
        available: diskInfo[3],
        usePercent: parseInt(diskInfo[4].replace('%', '')),
        mountPoint: diskInfo[5]
      };
      
      resolve(result);
    });
  });
}

// Get Docker disk usage
function getDockerDiskUsage() {
  return new Promise((resolve, reject) => {
    exec('docker system df --format "table {{.Type}}\\t{{.TotalCount}}\\t{{.Size}}\\t{{.Reclaimable}}"', (error, stdout, stderr) => {
      if (error) {
        resolve(null); // Docker might not be available
        return;
      }
      
      const lines = stdout.split('\n');
      const dockerInfo = {
        images: null,
        containers: null,
        volumes: null,
        buildCache: null
      };
      
      lines.forEach(line => {
        if (line.includes('Images')) {
          const parts = line.split('\t');
          dockerInfo.images = { total: parts[1], size: parts[2], reclaimable: parts[3] };
        } else if (line.includes('Containers')) {
          const parts = line.split('\t');
          dockerInfo.containers = { total: parts[1], size: parts[2], reclaimable: parts[3] };
        } else if (line.includes('Local Volumes')) {
          const parts = line.split('\t');
          dockerInfo.volumes = { total: parts[1], size: parts[2], reclaimable: parts[3] };
        } else if (line.includes('Build Cache')) {
          const parts = line.split('\t');
          dockerInfo.buildCache = { size: parts[2], reclaimable: parts[3] };
        }
      });
      
      resolve(dockerInfo);
    });
  });
}

// Send Telegram message
async function sendTelegramMessage(message) {
  if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) {
    console.log('Telegram not configured. Message would be:', message);
    return;
  }
  
  const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = JSON.stringify({
    chat_id: CONFIG.TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'HTML'
  });
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload.length
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`Telegram API error: ${res.statusCode} ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Check if we should send an alert (prevent spam)
function shouldSendAlert() {
  try {
    if (!fs.existsSync(CONFIG.LAST_ALERT_FILE)) {
      return true;
    }
    
    const lastAlertTime = parseInt(fs.readFileSync(CONFIG.LAST_ALERT_FILE, 'utf8'));
    const now = Date.now();
    const timeDiff = (now - lastAlertTime) / (1000 * 60); // Convert to minutes
    
    return timeDiff >= CONFIG.MIN_ALERT_INTERVAL;
  } catch (error) {
    return true;
  }
}

// Update last alert time
function updateLastAlertTime() {
  try {
    fs.writeFileSync(CONFIG.LAST_ALERT_FILE, Date.now().toString());
  } catch (error) {
    console.error('Could not update last alert time:', error.message);
  }
}

// Format alert message
function formatAlertMessage(diskInfo, dockerInfo, alertLevel) {
  const emoji = alertLevel === 'CRITICAL' ? '🚨' : '⚠️';
  const hostname = require('os').hostname();
  
  let message = `${emoji} <b>${alertLevel} DISK SPACE ALERT</b>\n\n`;
  message += `🖥 <b>Server:</b> ${hostname}\n`;
  message += `💾 <b>Disk Usage:</b> ${diskInfo.usePercent}% (${diskInfo.used}/${diskInfo.size})\n`;
  message += `📁 <b>Available:</b> ${diskInfo.available}\n`;
  message += `📍 <b>Mount Point:</b> ${diskInfo.mountPoint}\n\n`;
  
  if (dockerInfo && dockerInfo.images) {
    message += `🐳 <b>Docker Info:</b>\n`;
    if (dockerInfo.images.reclaimable !== '0B') {
      message += `   • Images: ${dockerInfo.images.reclaimable} reclaimable\n`;
    }
    if (dockerInfo.buildCache && dockerInfo.buildCache.reclaimable !== '0B') {
      message += `   • Build Cache: ${dockerInfo.buildCache.reclaimable} reclaimable\n`;
    }
    message += '\n';
  }
  
  if (alertLevel === 'CRITICAL') {
    message += `🔧 <b>Immediate Action Required:</b>\n`;
    message += `   • Run: <code>docker system prune -a</code>\n`;
    message += `   • Clean logs: <code>journalctl --vacuum-time=3d</code>\n`;
    message += `   • Check large files: <code>du -h --max-depth=2 / | sort -hr | head -10</code>\n`;
  } else {
    message += `💡 <b>Suggested Actions:</b>\n`;
    message += `   • Monitor disk usage closely\n`;
    message += `   • Consider cleaning Docker images\n`;
    message += `   • Plan for disk space expansion\n`;
  }
  
  message += `\n⏰ <i>Alert sent at ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</i>`;
  
  return message;
}

// Main monitoring function
async function checkDiskSpace() {
  try {
    // Load config from payment service if available
    loadConfigFromPaymentService();
    
    const diskInfo = await getDiskUsage();
    const dockerInfo = await getDockerDiskUsage();
    
    console.log(`Disk usage: ${diskInfo.usePercent}% (${diskInfo.used}/${diskInfo.size})`);
    
    let alertLevel = null;
    
    if (diskInfo.usePercent >= CONFIG.CRITICAL_THRESHOLD) {
      alertLevel = 'CRITICAL';
    } else if (diskInfo.usePercent >= CONFIG.WARNING_THRESHOLD) {
      alertLevel = 'WARNING';
    }
    
    if (alertLevel && shouldSendAlert()) {
      const message = formatAlertMessage(diskInfo, dockerInfo, alertLevel);
      
      try {
        await sendTelegramMessage(message);
        console.log(`${alertLevel} alert sent to Telegram`);
        updateLastAlertTime();
      } catch (error) {
        console.error('Failed to send Telegram message:', error.message);
      }
    } else if (alertLevel) {
      console.log(`${alertLevel} condition met but alert suppressed (too frequent)`);
    } else {
      console.log('Disk usage is within normal limits');
    }
    
  } catch (error) {
    console.error('Error checking disk space:', error.message);
  }
}

// If run directly, execute the check
if (require.main === module) {
  checkDiskSpace();
}

module.exports = { checkDiskSpace };
