/**
 * Scheduler Service
 * Manages scheduled tasks like pre-market briefings
 */

const cron = require('node-cron');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const { generatePreMarketBriefing, formatBriefingAsEmail } = require('./tradingCoachService');

let scheduledTasks = {};
let emailTransporter = null;

/**
 * Initialize email transporter
 */
function initEmailTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    console.log('Email transporter initialized for scheduler');
  } else {
    console.warn('SMTP not configured - email briefings will be logged only');
  }
}

/**
 * Send pre-market briefing email to a user
 */
async function sendBriefingEmail(user, briefing) {
  const htmlContent = formatBriefingAsEmail(briefing, user.name);
  
  if (!emailTransporter) {
    console.log(`[Scheduler] Briefing for ${user.email}:`, {
      greeting: briefing.greeting,
      yesterday: briefing.yesterdaySummary.message,
      focusAreas: briefing.focusAreas
    });
    return { success: true, method: 'logged' };
  }
  
  try {
    await emailTransporter.sendMail({
      from: process.env.SMTP_FROM || '"TradeWise AI" <coach@tradewise.ai>',
      to: user.email,
      subject: `${briefing.greeting}! Your Pre-Market Briefing - ${new Date().toLocaleDateString('en-IN', { weekday: 'long' })}`,
      html: htmlContent
    });
    
    console.log(`[Scheduler] Briefing sent to ${user.email}`);
    return { success: true, method: 'email' };
  } catch (error) {
    console.error(`[Scheduler] Failed to send briefing to ${user.email}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send pre-market briefings to all eligible users
 */
async function sendPreMarketBriefings() {
  console.log('[Scheduler] Starting pre-market briefing job...');
  
  try {
    // Find users with briefings enabled
    const users = await User.find({
      'coachingPreferences.enablePreMarketBriefing': { $ne: false },
      'alertPreferences.email': { $ne: false }
    });
    
    console.log(`[Scheduler] Found ${users.length} users for briefings`);
    
    let sent = 0;
    let failed = 0;
    
    for (const user of users) {
      try {
        const briefing = await generatePreMarketBriefing(user._id);
        const result = await sendBriefingEmail(user, briefing);
        
        if (result.success) {
          sent++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`[Scheduler] Error generating briefing for ${user.email}:`, error.message);
        failed++;
      }
    }
    
    console.log(`[Scheduler] Briefing job complete. Sent: ${sent}, Failed: ${failed}`);
  } catch (error) {
    console.error('[Scheduler] Briefing job failed:', error);
  }
}

/**
 * Initialize all scheduled tasks
 */
function initScheduler() {
  initEmailTransporter();
  
  // Pre-market briefing at 8:30 AM IST on weekdays (Mon-Fri)
  // Cron: minute hour day month weekday
  scheduledTasks.preMarketBriefing = cron.schedule('30 8 * * 1-5', sendPreMarketBriefings, {
    timezone: 'Asia/Kolkata',
    scheduled: true
  });
  
  console.log('[Scheduler] Pre-market briefing scheduled for 8:30 AM IST (Mon-Fri)');
  
  // Optional: End-of-day summary at 4:00 PM IST on weekdays
  scheduledTasks.endOfDaySummary = cron.schedule('0 16 * * 1-5', async () => {
    console.log('[Scheduler] End-of-day summary job triggered (placeholder)');
    // Future: Implement end-of-day summary
  }, {
    timezone: 'Asia/Kolkata',
    scheduled: true
  });
  
  console.log('[Scheduler] End-of-day summary scheduled for 4:00 PM IST (Mon-Fri)');
  
  return scheduledTasks;
}

/**
 * Stop all scheduled tasks
 */
function stopScheduler() {
  Object.values(scheduledTasks).forEach(task => {
    if (task && typeof task.stop === 'function') {
      task.stop();
    }
  });
  
  scheduledTasks = {};
  console.log('[Scheduler] All scheduled tasks stopped');
}

/**
 * Get scheduler status
 */
function getSchedulerStatus() {
  return {
    running: Object.keys(scheduledTasks).length > 0,
    tasks: Object.keys(scheduledTasks).map(name => ({
      name,
      running: scheduledTasks[name]?.running || false
    })),
    emailConfigured: !!emailTransporter
  };
}

/**
 * Manually trigger a briefing for testing
 */
async function triggerBriefingManually(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  const briefing = await generatePreMarketBriefing(userId);
  const result = await sendBriefingEmail(user, briefing);
  
  return {
    briefing,
    deliveryResult: result
  };
}

module.exports = {
  initScheduler,
  stopScheduler,
  getSchedulerStatus,
  sendPreMarketBriefings,
  triggerBriefingManually
};
