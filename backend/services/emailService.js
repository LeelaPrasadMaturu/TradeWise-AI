const nodemailer = require('nodemailer');

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true', 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Verify SMTP connection configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error('SMTP connection error:', error);
  } else {
    console.log('SMTP server is ready to take our messages');
  }
});

// Send email function
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: `"FinSage Alerts" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Format price change for display
const formatPriceChange = (currentPrice, previousPrice) => {
  const change = currentPrice - previousPrice;
  const percentageChange = ((change / previousPrice) * 100).toFixed(2);
  const isPositive = change >= 0;
  return {
    value: Math.abs(change).toFixed(2),
    percentage: Math.abs(percentageChange),
    isPositive
  };
};

// Send trade alert email
const sendTradeAlertEmail = async (user, alert, currentPrice) => {
  const priceChange = formatPriceChange(currentPrice, alert.currentPrice);
  const subject = `Trade Alert: ${alert.symbol} ${alert.triggerType} ${alert.triggerValue}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2c3e50; padding: 20px; border-radius: 5px 5px 0 0;">
        <h2 style="color: white; margin: 0;">Trade Alert Triggered!</h2>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px;">
        <div style="margin-bottom: 20px;">
          <h3 style="color: #2c3e50; margin-top: 0;">Price Update</h3>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <p style="font-size: 24px; margin: 0;"><strong>${alert.symbol}</strong></p>
              <p style="color: #7f8c8d; margin: 0;">${alert.assetType.toUpperCase()}</p>
            </div>
            <div style="text-align: right;">
              <p style="font-size: 24px; margin: 0;">$${currentPrice.toFixed(2)}</p>
              <p style="color: ${priceChange.isPositive ? '#27ae60' : '#e74c3c'}; margin: 0;">
                ${priceChange.isPositive ? '↑' : '↓'} ${priceChange.value} (${priceChange.percentage}%)
              </p>
            </div>
          </div>
        </div>

        <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #2c3e50; margin-top: 0;">Alert Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Trigger Type:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${alert.triggerType.replace('_', ' ').toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Trigger Value:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;">$${alert.triggerValue.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Previous Price:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;">$${alert.currentPrice.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Price Change:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: ${priceChange.isPositive ? '#27ae60' : '#e74c3c'}">
                ${priceChange.isPositive ? '+' : '-'}$${priceChange.value} (${priceChange.percentage}%)
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Description:</strong></td>
              <td style="padding: 8px 0;">${alert.description || 'No description provided'}</td>
            </tr>
          </table>
        </div>

        <div style="background-color: #e8f4f8; padding: 15px; border-radius: 5px;">
          <p style="margin: 0;"><strong>Alert Time:</strong> ${new Date().toLocaleString()}</p>
          <p style="margin: 5px 0 0 0;"><strong>Last Checked:</strong> ${alert.lastChecked.toLocaleString()}</p>
        </div>

        <div style="margin-top: 20px; font-size: 12px; color: #7f8c8d;">
          <p>This is an automated message from FinSage. Please do not reply to this email.</p>
          <p>To manage your alerts, visit your FinSage dashboard.</p>
        </div>
      </div>
    </div>
  `;

  return sendEmail(user.email, subject, html);
};

module.exports = {
  sendEmail,
  sendTradeAlertEmail
}; 