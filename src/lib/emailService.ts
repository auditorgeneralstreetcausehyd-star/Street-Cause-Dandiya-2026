import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { EVENT_CONFIGS, EventRecord } from './types';
import { getSettings } from './db';

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
  const eventIdKey = record.event_id === 'navratri_utsav' ? 'navratri_utsav' : 'garba_groove';
  const config = EVENT_CONFIGS[eventIdKey];
  const settings = getSettings();

  const eventName = config.name;
  const eventDate = config.date;
  const passBgUrl = (eventIdKey === 'navratri_utsav' && settings.navratriPassBgUrl && settings.navratriPassBgUrl.trim()) 
    ? settings.navratriPassBgUrl.trim() 
    : config.passBgUrl;

  const codeValue = record.order_id || record.code || '';
  const encodedCode = encodeURIComponent(codeValue);
  const verifyUrl = `https://sc-dandiya-2026.vercel.app/verify?code=${encodedCode}`;
  const qrCodeImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=235x235&data=${encodeURIComponent(verifyUrl)}`;

  const attendeeName = record.name || '';
  const mobile = record.phone || '';
  const email = record.email || '';
  const admits = record.item_quantity || 1;
  const amount = `${record.item_payment_amount || record.item_amount || 0}/-`;
  const l1Name = record.divisions || '';
  const l2Name = record.l2 || '';

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Street Cause Hyderabad - ${eventName} Pass</title>
  <style>
    html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #050a32; font-family: Arial, Helvetica, sans-serif; }
    table { border-collapse: collapse !important; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    td { padding: 0; }
    img { display: block; border: 0; outline: none; text-decoration: none; }
    .label-text { font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 700; color: #ffffff; line-height: 1.75; }
    .value-text { font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 400; color: #ffffff; line-height: 1.75; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #050a32;">
  <!-- Main Outer Container -->
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #050a32; width: 100%;">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        
        <!-- TOP INTRODUCTORY GREETING CARD -->
        <table role="presentation" width="1215" border="0" cellspacing="0" cellpadding="0" style="width: 100%; max-width: 1215px; margin-bottom: 25px; background-color: #0c1445; border: 1px solid #1e2966; border-radius: 16px; font-family: Arial, Helvetica, sans-serif; color: #ffffff;">
          <tr>
            <td style="padding: 25px 30px; line-height: 1.6; font-size: 15px; color: #e2e8f0;">
              <p style="margin-top: 0; font-size: 18px; font-weight: 700; color: #fbbf24;">Dear ${attendeeName || 'Valued Guest'},</p>

              <p style="margin-bottom: 12px;">
                Thank you for registering for <strong>${eventName}</strong>, presented by <strong>Street Cause Hyderabad</strong>! 💃🕺
              </p>

              <p style="margin-bottom: 0;">
                Your event pass is displayed below. Please keep this email safe and present the QR code at the venue for entry.
              </p>
            </td>
          </tr>
        </table>

        <!-- PASS CANVAS TABLE (1215 x 1519 aspect ratio) -->
        <table role="presentation" width="1215" border="0" cellspacing="0" cellpadding="0" 
               background="${passBgUrl}"
               style="width: 100%; max-width: 1215px; margin-bottom: 25px; background-image: url('${passBgUrl}'); background-repeat: no-repeat; background-position: center top; background-size: 100% 100%; border-collapse: collapse;">
          
          <!-- TOP ROW: QR CODE IN TOP RIGHT WHITE BOX -->
          <tr>
            <td width="70%" style="vertical-align: top; padding-top: 140px; padding-left: 45px;">
              &nbsp;
            </td>
            <td width="30%" style="vertical-align: top; padding-top: 140px; padding-right: 55px; text-align: right;">
              <img src="${qrCodeImgUrl}" 
                   width="235" height="235" alt="Pass QR Code" style="display: block; width: 235px; height: 235px; border: 0; margin-left: auto;" />
            </td>
          </tr>

          <!-- DYNAMIC FIELDS OVERLAY ROW -->
          <tr>
            <td colspan="2" style="vertical-align: top; padding-top: 0px; padding-left: 45px; padding-right: 45px; padding-bottom: 900px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: -65px;">
                <tr>
                  
                  <!-- LEFT COLUMN -->
                  <td width="48%" style="vertical-align: top; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #ffffff;">
                    <div><span class="label-text">Name:</span> <span class="value-text">${attendeeName}</span></div>
                    <div><span class="label-text">Code:</span> <span class="value-text">${codeValue}</span></div>
                    <div><span class="label-text">mobile:</span> <span class="value-text">${mobile}</span></div>
                    <div><span class="label-text">Email ID:</span> <span class="value-text">${email}</span></div>
                    <div><span class="label-text">Payment mode:</span> <span class="value-text">Online</span></div>
                    <div><span class="label-text">Type:</span> <span class="value-text">Event Pass</span></div>
                  </td>

                  <!-- SPACING COLUMN -->
                  <td width="4%">&nbsp;</td>

                  <!-- RIGHT COLUMN -->
                  <td width="48%" style="vertical-align: top; font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #ffffff;">
                    <div><span class="label-text">Admits:</span> <span class="value-text">${admits}</span></div>
                    <div><span class="label-text">Amount:</span> <span class="value-text">${amount}</span></div>
                    <div><span class="label-text">Date:</span> <span class="value-text">${eventDate}</span></div>
                    <div><span class="label-text">Venue:</span> <span class="value-text">Telangana Gardens,New Bowenpally</span></div>
                    <div><span class="label-text">L1's Name:</span> <span class="value-text">${l1Name}</span></div>
                    <div><span class="label-text">L2's Name:</span> <span class="value-text">${l2Name}</span></div>
                  </td>

                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- BOTTOM IMPORTANT GUIDELINES & CLOSING CARD -->
        <table role="presentation" width="1215" border="0" cellspacing="0" cellpadding="0" style="width: 100%; max-width: 1215px; background-color: #0c1445; border: 1px solid #1e2966; border-radius: 16px; font-family: Arial, Helvetica, sans-serif; color: #ffffff;">
          <tr>
            <td style="padding: 30px; line-height: 1.6; font-size: 15px; color: #e2e8f0;">

              <!-- IMPORTANT GUIDELINES BOX -->
              <div style="background-color: #162058; border-left: 4px solid #f59e0b; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px;">
                <div style="font-weight: 700; font-size: 16px; color: #fbbf24; margin-bottom: 10px;">
                  ⚠️ Important
                </div>
                <ul style="margin: 0; padding-left: 20px; color: #cbd5e1; line-height: 1.7;">
                  <li style="margin-bottom: 6px;">Please carry your valid Pass for entry.</li>
                  <li style="margin-bottom: 6px;">The QR code is for one-time verification and should not be shared with others.</li>
                  <li style="margin-bottom: 6px;">Guests with multiple admits should arrive together, as the QR code will be scanned for the group.</li>
                  <li style="margin-bottom: 0;">Please follow the Terms &amp; Conditions mentioned on your event pass.</li>
                </ul>
              </div>

              <p style="margin-bottom: 16px; font-weight: 500; color: #f1f5f9;">
                We look forward to celebrating an unforgettable evening of music, colours and Garba with you! ✨<br>
                <strong>See you on the dance floor! 💃🕺</strong>
              </p>

              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #1e2966; font-size: 13px; color: #94a3b8;">
                <strong style="color: #ffffff;">Warm regards,</strong><br>
                <strong style="color: #fbbf24; font-size: 14px;">Street Cause Hyderabad</strong><br>
                <em style="color: #cbd5e1;">“A life without a cause is a life without an effect.”</em><br>
                <span style="display: inline-block; margin-top: 6px;">
                  📧 <a href="mailto:streetcause@gmail.com" style="color: #38bdf8; text-decoration: none;">streetcause@gmail.com</a> &nbsp;|&nbsp; 📱 @streetcausehyderabad
                </span>
              </div>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
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

    const passCode = record.code || record.order_id || '';
    const subjectLine = passCode ? `Your ${eventName} Pass - ${passItemName} (${passCode})` : `Your ${eventName} Pass - ${passItemName}`;

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      replyTo: fromEmail,
      to: record.email.trim(),
      subject: subjectLine,
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
