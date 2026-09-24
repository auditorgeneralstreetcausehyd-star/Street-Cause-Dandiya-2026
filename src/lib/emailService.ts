import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { EventRecord } from './types';

// Helper to get latest env variables even if server hasn't restarted
function getEnvConfig() {
  const env: Record<string, string> = {
    SMTP_HOST: process.env.SMTP_HOST || '',
    SMTP_PORT: process.env.SMTP_PORT || '587',
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
    SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || 'SC Dandiya 2026',
    SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || '',
  };

  // Fallback: Read directly from .env.local file on disk
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            // Strip surrounding quotes
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (val) {
              env[key] = val;
            }
          }
        }
      });
    }
  } catch (err) {
    console.warn('Could not read .env.local from disk:', err);
  }

  return env;
}

// Get dynamic SMTP Transporter
function getTransporter() {
  const env = getEnvConfig();
  const host = (env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(env.SMTP_PORT || '587', 10);
  const user = env.SMTP_USER?.trim();
  // Strip spaces from Gmail app password (e.g. "abcd efgh ijkl mnop" -> "abcdefghijklmnop")
  const rawPass = env.SMTP_PASS?.trim() || '';
  const pass = rawPass.replace(/\s+/g, '');

  if (!user || !pass) {
    throw new Error('SMTP credentials not configured in .env.local (Make sure .env.local is saved with SMTP_USER and SMTP_PASS)');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

export function generatePassEmailHTML(record: EventRecord): string {
  const isGarbaGroove = record.event_id === 'garba_groove';
  
  // Theme colors based on event
  const themeColor = isGarbaGroove ? '#f59e0b' : '#9333ea'; // amber-500 vs purple-600
  const gradientStart = isGarbaGroove ? '#f59e0b' : '#9333ea';
  const gradientEnd = isGarbaGroove ? '#e11d48' : '#f59e0b'; // rose-600 vs amber-500
  const eventName = isGarbaGroove ? 'Garba Groove 2026' : 'Navratri Utsav 2026';
  const eventSubname = isGarbaGroove ? 'Youth & Family Dandiya Night' : 'Grand Divine Mahotsav';

  const attendeeName = record.name || 'Valued Guest';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Your ${eventName} Pass</title>
      <style>
        body {
          font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #f8fafc;
          margin: 0;
          padding: 0;
          color: #0f172a;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 25px rgba(0,0,0,0.05);
          border: 1px solid #e2e8f0;
        }
        .header {
          background: linear-gradient(135deg, ${gradientStart}, ${gradientEnd});
          padding: 40px 30px;
          text-align: center;
          color: white;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }
        .header p {
          margin: 8px 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 24px;
        }
        .pass-details {
          background: #f1f5f9;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 32px;
        }
        .pass-details h2 {
          margin: 0 0 16px;
          font-size: 18px;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 700;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .detail-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .detail-label {
          color: #64748b;
          font-weight: 500;
        }
        .detail-value {
          font-weight: 600;
          color: #0f172a;
          text-align: right;
        }
        .order-id {
          font-family: monospace;
          background: #e2e8f0;
          padding: 4px 8px;
          border-radius: 6px;
          color: ${themeColor};
          font-weight: 700;
          font-size: 16px;
        }
        .qr-placeholder {
          text-align: center;
          margin: 32px 0;
        }
        .footer {
          background: #f8fafc;
          padding: 24px 30px;
          text-align: center;
          font-size: 14px;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${eventName}</h1>
          <p>${eventSubname}</p>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hello ${attendeeName},
          </div>
          <p style="line-height: 1.6; color: #475569; margin-bottom: 32px;">
            Thank you for booking your pass for <strong>${eventName}</strong>. Your payment was successful, and your pass details are confirmed below. Please present this email (or the Order ID) at the entry gate.
          </p>
          
          <div class="pass-details">
            <h2>Pass Information</h2>
            
            <div class="detail-row">
              <span class="detail-label">Order ID</span>
              <span class="detail-value order-id">${record.order_id}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Pass Type</span>
              <span class="detail-value">${record.item_name}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Quantity</span>
              <span class="detail-value" style="font-size: 18px;">${record.item_quantity}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Payment Date</span>
              <span class="detail-value">${record.payment_date || record.created_at?.split('T')[0] || '-'}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Amount Paid</span>
              <span class="detail-value">₹${record.item_payment_amount || 0}</span>
            </div>
          </div>
          
          <div class="qr-placeholder">
            <p style="margin-bottom: 12px; font-weight: 600; color: #475569;">Present this Order ID for entry:</p>
            <div style="font-size: 32px; font-family: monospace; font-weight: 800; color: ${themeColor}; letter-spacing: 2px;">
              ${record.order_id}
            </div>
          </div>
          
        </div>
        
        <div class="footer">
          <p style="margin: 0 0 8px;"><strong>SC Dandiya 2026</strong> • Organized by SC Community</p>
          <p style="margin: 0; font-size: 12px;">This is an automated email. Please do not reply directly to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendPassEmail(record: EventRecord): Promise<{ success: boolean; error?: string }> {
  try {
    if (!record.email || record.email.trim() === '') {
      return { success: false, error: 'No email address provided for this attendee' };
    }

    const env = getEnvConfig();
    const transporter = getTransporter();
    const eventName = record.event_id === 'garba_groove' ? 'Garba Groove 2026' : 'Navratri Utsav 2026';
    const passItemName = record.item_name || 'Event Pass';
    const fromName = env.SMTP_FROM_NAME || 'SC Dandiya 2026';
    const fromEmail = env.SMTP_FROM_EMAIL || env.SMTP_USER;

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      replyTo: fromEmail,
      to: record.email.trim(),
      subject: `Your ${eventName} Pass - ${passItemName}`,
      html: generatePassEmailHTML(record),
    });

    return { success: true };
  } catch (error: any) {
    console.error(`Failed to send email to ${record.email}:`, error);
    return { success: false, error: error.message || 'Unknown SMTP error' };
  }
}

// Rate limiting helper
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function sendBulkPassEmails(records: EventRecord[]): Promise<Array<{ orderId: string; status: 'Sent' | 'Failed'; error?: string }>> {
  const results: Array<{ orderId: string; status: 'Sent' | 'Failed'; error?: string }> = [];
  
  for (const record of records) {
    const result = await sendPassEmail(record);
    if (result.success) {
      results.push({ orderId: record.order_id, status: 'Sent' });
    } else {
      results.push({ orderId: record.order_id, status: 'Failed', error: result.error });
    }
    
    // Rate limit to avoid SMTP throttling
    await delay(150);
  }
  
  return results;
}
