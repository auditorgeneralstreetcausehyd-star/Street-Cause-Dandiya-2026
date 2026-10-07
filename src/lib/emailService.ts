import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { EVENT_CONFIGS, EventRecord } from './types';
import { getSettings } from './db';

export async function generateQRCodeDataURL(verifyUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(verifyUrl, {
      width: 250,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
  } catch (err) {
    console.warn('Local QRCode generation failed, falling back to data string:', err);
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(verifyUrl)}`;
  }
}

// Helper to get latest env variables even if server hasn't restarted
function getEnvConfig() {
  const env: Record<string, string> = {
    SMTP_HOST: '',
    SMTP_PORT: '587',
    SMTP_FROM_NAME: 'SC Dandiya 2026',
  };
  // Every SMTP_* variable, including rotation accounts SMTP_USER_2 / SMTP_PASS_2 / SMTP_DAILY_LIMIT_2 ...
  for (const [key, val] of Object.entries(process.env)) {
    if (key.startsWith('SMTP_') && val) env[key] = val;
  }

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

// Gmail personal accounts allow ~500 recipients per rolling 24h; stay under it for manual sends and safety
const DEFAULT_DAILY_LIMIT_PER_ACCOUNT = 450;
const MAX_SMTP_ACCOUNTS = 9;

export interface SmtpAccount {
  user: string;
  pass: string;
  dailyLimit: number;
}

/**
 * Sender accounts for rotation: SMTP_USER/SMTP_PASS (primary), then SMTP_USER_2/SMTP_PASS_2 ... SMTP_USER_9.
 * Optional per-account SMTP_DAILY_LIMIT_n overrides SMTP_DAILY_LIMIT (default 450).
 */
export function getSmtpAccounts(): SmtpAccount[] {
  const env = getEnvConfig();
  const defaultLimit = parseInt(env.SMTP_DAILY_LIMIT || '', 10) || DEFAULT_DAILY_LIMIT_PER_ACCOUNT;
  const accounts: SmtpAccount[] = [];
  const seen = new Set<string>();

  for (let n = 1; n <= MAX_SMTP_ACCOUNTS; n++) {
    const suffix = n === 1 ? '' : `_${n}`;
    const user = env[`SMTP_USER${suffix}`]?.trim();
    // Strip spaces from Gmail app password (e.g. "abcd efgh ijkl mnop" -> "abcdefghijklmnop")
    const pass = (env[`SMTP_PASS${suffix}`] || '').replace(/\s+/g, '');
    if (!user || !pass || seen.has(user.toLowerCase())) continue;
    seen.add(user.toLowerCase());
    accounts.push({
      user,
      pass,
      dailyLimit: parseInt(env[`SMTP_DAILY_LIMIT${suffix}`] || '', 10) || defaultLimit,
    });
  }
  return accounts;
}

/** Address replies should go to: SMTP_FROM_EMAIL, else the primary account */
export function getReplyToAddress(): string {
  const env = getEnvConfig();
  return (env.SMTP_FROM_EMAIL || env.SMTP_USER || '').trim();
}

// One pooled connection per account, reused across sends instead of a fresh SMTP login per email
const transporterCache = new Map<string, ReturnType<typeof nodemailer.createTransport>>();

function getTransporter(account: SmtpAccount) {
  const env = getEnvConfig();
  const host = (env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(env.SMTP_PORT || '587', 10);
  const cacheKey = `${host}:${port}:${account.user}:${account.pass}`;

  const cached = transporterCache.get(cacheKey);
  if (cached) return cached;

  const transporter = nodemailer.createTransport({
    pool: true,
    maxConnections: 2,
    host,
    port,
    secure: port === 465,
    auth: {
      user: account.user,
      pass: account.pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
  transporterCache.set(cacheKey, transporter);
  return transporter;
}



// 1. Template for Garba Groove 2026 (Golden / Amber Theme)
export function generateGarbaGroovePassHTML(record: EventRecord, qrCodeOverride?: string): string {
  const config = EVENT_CONFIGS.garba_groove;
  const settings = getSettings();
  const eventName = config.name; // 'Garba Groove 2026'
  const eventDate = config.date; // '10 Oct 2026'

  const passBgUrl = (settings.garbaPassBgUrl && settings.garbaPassBgUrl.trim()) 
    ? settings.garbaPassBgUrl.trim() 
    : 'https://res.cloudinary.com/ygf4cf8x/image/upload/v1791352492/Garba_Groove_Bg.png';

  const codeValue = record.order_id || record.code || '';
  const encodedCode = encodeURIComponent(codeValue);

  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'https://street-cause-dandiya-2026.vercel.app'
  ).replace(/\/+$/, '');

  const verifyUrl = `${baseUrl}/verify?code=${encodedCode}`;
  const qrCodeImgUrl = qrCodeOverride || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(verifyUrl)}`;

  const attendeeName = record.name || 'Valued Guest';
  const mobile = record.phone || 'N/A';
  const email = record.email || 'N/A';
  const admits = record.item_quantity || 1;
  const amount = `${record.total_payment_amount || record.item_payment_amount || record.item_amount || 0}/-`;
  const l1Name = record.divisions || 'Street Cause';
  const l2Name = record.l2 || 'Event Team';

  // Direct Cloudinary Asset URLs
  const visionLogoUrl = 'https://res.cloudinary.com/ygf4cf8x/image/upload/v1791270072/Vision_2030_Logo.png';
  const digitalNestLogoUrl = 'https://res.cloudinary.com/ygf4cf8x/image/upload/v1791270024/Digital_Nest_logo.png';
  const seventeenYrsLogoUrl = 'https://res.cloudinary.com/ygf4cf8x/image/upload/v1791270023/17_yrs_logo.png';
  const titleImageUrl = 'https://res.cloudinary.com/ygf4cf8x/image/upload/v1791270025/Garba_Groove_title.png';
  const giftVoucherFrontUrl = 'https://res.cloudinary.com/ygf4cf8x/image/upload/v1791270077/Gift_Voucher_Front.png';
  const giftVoucherBackUrl = 'https://res.cloudinary.com/ygf4cf8x/image/upload/v1791270104/Gift_Voucher_Back.png';

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Street Cause Hyderabad - ${eventName} Pass</title>
  <style type="text/css">
    html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; min-width: 100% !important; background-color: #03071e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse !important; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    td { padding: 0; }
    img { display: block; border: 0; outline: none; text-decoration: none; max-width: 100%; height: auto; }
    a { color: #38bdf8; text-decoration: none; }
    
    .pass-container { width: 100% !important; max-width: 600px !important; margin: 0 auto !important; background-color: #050a32; border-radius: 14px; overflow: hidden; border: 1px solid #1e2966; }
    .label-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #ffffff; line-height: 1.45; }
    .value-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 400; color: #f1f5f9; line-height: 1.45; word-break: break-word; }
    .terms-item { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; line-height: 1.45; color: #cbd5e1; margin-bottom: 5px; }

    @media only screen and (max-width: 600px) {
      .outer-td { padding: 8px 4px !important; }
      .pass-container { width: 100% !important; border-radius: 10px !important; }
      .header-padding { padding: 14px 12px 8px 12px !important; }
      .vision-logo { max-width: 60px !important; }
      .digital-nest-logo { max-width: 125px !important; }
      .seventeen-logo { max-width: 45px !important; }
      .title-img { max-width: 200px !important; }
      
      .details-padding { padding: 10px 10px 8px 10px !important; }
      .details-col-left { width: 100% !important; display: block !important; margin-bottom: 12px !important; }
      .details-col-right { width: 100% !important; display: block !important; text-align: center !important; }
      
      .inner-meta-table { width: 100% !important; }
      .inner-meta-left { width: 50% !important; }
      .inner-meta-right { width: 50% !important; }
      
      .qr-wrapper { margin: 0 auto !important; width: 105px !important; }
      .qr-img { width: 95px !important; height: 95px !important; }
      
      .label-text { font-size: 10.5px !important; line-height: 1.35 !important; }
      .value-text { font-size: 10.5px !important; line-height: 1.35 !important; }
      .email-value { font-size: 9px !important; word-break: break-all !important; }
      
      .terms-padding { padding: 12px 10px !important; }
      .terms-item { font-size: 10px !important; line-height: 1.38 !important; margin-bottom: 4px !important; }
      
      .voucher-padding { padding: 4px 10px 12px 10px !important; }
      .footer-padding { padding: 14px 12px 18px 12px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #03071e; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <!-- Outer Centering Table -->
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #03071e; width: 100%;">
    <tr>
      <td align="center" class="outer-td" style="padding: 16px 8px;">
        
        <!-- MAIN PASS CARD CONTAINER WITH CLOUDINARY BACKGROUND -->
        <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" class="pass-container" 
               background="${passBgUrl}"
               style="width: 100%; max-width: 600px; background-color: #050a32; background-image: url('${passBgUrl}'); background-repeat: no-repeat; background-position: center top; background-size: 100% 100%; border-radius: 14px; overflow: hidden; border: 1px solid #1e2966; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          
          <!-- ROW 1: HEADER LOGOS (Vision 2030, Digital Nest, 17 Years) -->
          <tr>
            <td class="header-padding" style="padding: 22px 20px 10px 20px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- Left: Vision 2030 Logo -->
                  <td width="25%" align="left" style="vertical-align: middle;">
                    <img src="${visionLogoUrl}" alt="Vision 2030 Street Cause" class="vision-logo" width="80" style="display: block; width: 100%; max-width: 80px; height: auto;" />
                  </td>
                  <!-- Center: Digital Nest Logo -->
                  <td width="50%" align="center" style="vertical-align: middle; padding: 0 6px;">
                    <img src="${digitalNestLogoUrl}" alt="Digital Nest School of Business" class="digital-nest-logo" width="165" style="display: block; width: 100%; max-width: 165px; height: auto; margin: 0 auto;" />
                  </td>
                  <!-- Right: 17 Years Logo -->
                  <td width="25%" align="right" style="vertical-align: middle;">
                    <img src="${seventeenYrsLogoUrl}" alt="17 Years Street Cause" class="seventeen-logo" width="65" style="display: block; width: 100%; max-width: 65px; height: auto; margin-left: auto;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ROW 2: ORGANIZATION NAME & TAGLINE -->
          <tr>
            <td align="center" style="padding: 6px 20px 4px 20px;">
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 800; color: #ffffff; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 2px;">
                STREET CAUSE HYDERABAD
              </div>
              <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 12px; font-style: italic; color: #cbd5e1; letter-spacing: 0.3px; margin-bottom: 4px;">
                &ldquo;A life without a cause is a life without an effect.&rdquo;
              </div>
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 600; color: #fbbf24; text-transform: uppercase; letter-spacing: 2px;">
                Presents
              </div>
            </td>
          </tr>

          <!-- ROW 3: EVENT TITLE & EVENT PASS BADGE -->
          <tr>
            <td align="center" style="padding: 8px 20px 14px 20px;">
              <img src="${titleImageUrl}" alt="${eventName}" class="title-img" width="240" style="display: block; width: 100%; max-width: 240px; height: auto; margin: 0 auto 8px auto;" />
              <div style="display: inline-block; background-color: #ec4899; background: linear-gradient(90deg, #f43f5e 0%, #ec4899 50%, #d946ef 100%); color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase; padding: 4px 18px; border-radius: 20px; box-shadow: 0 2px 10px rgba(236, 72, 153, 0.4);">
                EVENT PASS
              </div>
            </td>
          </tr>

          <!-- ROW 4: DYNAMIC DETAILS & QR CODE -->
          <tr>
            <td class="details-padding" style="padding: 6px 20px 14px 20px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  
                  <!-- Left Details Column (2 Sub-columns: Left & Right) -->
                  <td width="72%" class="details-col-left" style="vertical-align: top; padding-right: 10px;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="inner-meta-table">
                      <tr>
                        <!-- Sub-Column 1 -->
                        <td width="50%" class="inner-meta-left" style="vertical-align: top; padding-right: 6px;">
                          <div style="margin-bottom: 4px;"><span class="label-text">Name :</span> <span class="value-text">${attendeeName}</span></div>
                          <div style="margin-bottom: 4px;"><span class="label-text">Code :</span> <span class="value-text" style="color: #fbbf24; font-weight: 700;">${codeValue}</span></div>
                          <div style="margin-bottom: 4px;"><span class="label-text">mobile :</span> <span class="value-text">${mobile}</span></div>
                          <div style="margin-bottom: 4px;"><span class="label-text">Email ID:</span> <span class="value-text email-value" style="font-size: 10.5px;">${email}</span></div>
                          <div style="margin-bottom: 4px;"><span class="label-text">Payment mode:</span> <span class="value-text">Online</span></div>
                          <div style="margin-bottom: 4px;"><span class="label-text">Type:</span> <span class="value-text">Event Pass</span></div>
                        </td>

                        <!-- Sub-Column 2 -->
                        <td width="50%" class="inner-meta-right" style="vertical-align: top; padding-left: 6px;">
                          <div style="margin-bottom: 4px;"><span class="label-text">Admits:</span> <span class="value-text" style="color: #4ade80; font-weight: 700;">${admits}</span></div>
                          <div style="margin-bottom: 4px;"><span class="label-text">Amount:</span> <span class="value-text" style="color: #fbbf24; font-weight: 700;">${amount}</span></div>
                          <div style="margin-bottom: 4px;"><span class="label-text">Date:</span> <span class="value-text">${eventDate}</span></div>
                          <div style="margin-bottom: 4px;"><span class="label-text">Venue:</span> <span class="value-text" style="font-size: 10.5px;">Telangana Gardens, New Bowenpally</span></div>
                          <div style="margin-bottom: 4px;"><span class="label-text">L1's Name:</span> <span class="value-text">${l1Name}</span></div>
                          <div style="margin-bottom: 4px;"><span class="label-text">L2's Name:</span> <span class="value-text">${l2Name}</span></div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right QR Code Column -->
                  <td width="28%" class="details-col-right" align="right" style="vertical-align: middle;">
                    <div class="qr-wrapper" style="background-color: #ffffff; padding: 6px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 15px rgba(0,0,0,0.4); text-align: center;">
                      <img src="${qrCodeImgUrl}" class="qr-img" width="112" height="112" alt="Pass QR Code" style="display: block; width: 112px; height: 112px; border: 0;" />
                      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 8.5px; font-weight: 700; color: #0f172a; margin-top: 3px; letter-spacing: 0.5px;">
                        SCAN TO VERIFY
                      </div>
                    </div>
                  </td>

                </tr>
              </table>
            </td>
          </tr>

          <!-- ROW 5: DASHED DIVIDER -->
          <tr>
            <td style="padding: 0 20px;">
              <div style="border-top: 1px dashed rgba(255, 255, 255, 0.3); margin: 6px 0 14px 0;"></div>
            </td>
          </tr>

          <!-- ROW 6: TERMS & CONDITIONS (1 to 18) -->
          <tr>
            <td class="terms-padding" style="padding: 0 20px 14px 20px;">
              <div style="text-align: center; color: #f59e0b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13.5px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 10px;">
                Terms &amp; Conditions
              </div>
              <ol style="margin: 0; padding-left: 18px; color: #cbd5e1;">
                <li class="terms-item">Tickets once booked cannot be exchanged or refunded.</li>
                <li class="terms-item">An internet handling fee per ticket may apply; please check the final amount before payment.</li>
                <li class="terms-item">Entry to the event will be closed by 8:30 PM. No entry will be allowed after this time.</li>
                <li class="terms-item">A valid QR code is mandatory for entry and is valid for one-time use only. Sharing or tampering will result in a permanent ban.</li>
                <li class="terms-item">Guests with multiple passes must arrive together, as the QR code will be scanned once for the group.</li>
                <li class="terms-item">Outside food and beverages are not allowed.</li>
                <li class="terms-item">Only mobile phones are permitted inside. If guests choose to bring other electronic devices such as laptops, tablets, or cameras, the organization will not be responsible for any loss or damage of any electronics.</li>
                <li class="terms-item">Smoking, drinking, drug use, e-cigarettes, sharp objects, or any form of intoxication are strictly prohibited. Intoxicated guests will not be allowed entry.</li>
                <li class="terms-item">Unlawful resale (or attempted resale) of tickets will lead to cancellation without refund or compensation.</li>
                <li class="terms-item">Mandatory frisking and breathalyzer checks may be conducted by law enforcement.</li>
                <li class="terms-item">All vehicles entering the venue premises are subject to checking for restricted items such as alcohol, cigarettes, or prohibited substances.</li>
                <li class="terms-item">Guests must follow all health protocols, including mandatory mask usage and social distancing norms.</li>
                <li class="terms-item">Please do not purchase tickets if you are unwell.</li>
                <li class="terms-item">Street Cause is not responsible for health issues, or for lost or stolen belongings.</li>
                <li class="terms-item">The CEO's Office reserves the right to change the venue, artist, date, or timings. Updates will be posted on official social media handles.</li>
                <li class="terms-item">If an artist or celebrity cancels at the last moment, organizers will not be held responsible.</li>
                <li class="terms-item">Rights of admission are reserved by the organizers.</li>
                <li class="terms-item">All funds raised will support Street Cause initiatives, including projects, operational costs, executive salaries, and growth programs.</li>
              </ol>
            </td>
          </tr>

          <!-- ROW 7: GIFT VOUCHER & SPONSOR SHOWCASE (Gift Voucher Front & Back) -->
          <tr>
            <td class="voucher-padding" style="padding: 4px 16px 14px 16px;">
              <!-- Voucher Front (20% OFF) -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
                <tr>
                  <td align="center">
                    <img src="${giftVoucherFrontUrl}" alt="Digital Nest Gift Voucher - 20% OFF" width="568" style="display: block; width: 100%; max-width: 568px; height: auto; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.35);" />
                  </td>
                </tr>
              </table>
              
              <!-- Voucher Back (Programs & Highlights) -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <img src="${giftVoucherBackUrl}" alt="Digital Nest Our Programs & Highlights" width="568" style="display: block; width: 100%; max-width: 568px; height: auto; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.35);" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ROW 8: FOOTER & CLOSING -->
          <tr>
            <td class="footer-padding" style="padding: 16px 20px 22px 20px; background-color: rgba(3, 7, 34, 0.75); border-top: 1px solid #1e2966;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center;">
                    <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #f1f5f9;">
                      We look forward to celebrating an unforgettable evening of music, colours and Garba with you!
                    </p>
                    <p style="margin: 0 0 16px 0; font-size: 13.5px; font-weight: 700; color: #fbbf24;">
                      See you on the dance floor!
                    </p>
                    
                    <div style="border-top: 1px solid #162058; padding-top: 12px; margin-top: 6px;">
                      <div style="font-size: 11.5px; color: #94a3b8; margin-bottom: 2px;">Warm regards,</div>
                      <div style="font-size: 13px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">STREET CAUSE HYDERABAD</div>
                      <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 11px; font-style: italic; color: #94a3b8; margin-top: 2px; margin-bottom: 8px;">
                        &ldquo;A life without a cause is a life without an effect.&rdquo;
                      </div>
                      <div style="font-size: 11px; color: #64748b;">
                        <a href="mailto:streetcause@gmail.com" style="color: #38bdf8; text-decoration: none;">streetcause@gmail.com</a> &nbsp;|&nbsp; @streetcausehyderabad
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// 2. Template for Navratri Utsav 2026 (Royal Purple / Crimson Theme)
export function generateNavratriUtsavPassHTML(record: EventRecord, qrCodeOverride?: string): string {
  const config = EVENT_CONFIGS.navratri_utsav;
  const settings = getSettings();
  const eventName = config.name; // 'Navratri Utsav 2026'
  const eventDate = config.date; // '11 Oct 2026'

  const passBgUrl = (settings.navratriPassBgUrl && settings.navratriPassBgUrl.trim()) 
    ? settings.navratriPassBgUrl.trim() 
    : 'https://res.cloudinary.com/ygf4cf8x/image/upload/v1791352481/Navratri_utsav_BG.png';

  const codeValue = record.order_id || record.code || '';
  const encodedCode = encodeURIComponent(codeValue);

  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'https://street-cause-dandiya-2026.vercel.app'
  ).replace(/\/+$/, '');

  const verifyUrl = `${baseUrl}/verify?code=${encodedCode}`;
  const qrCodeImgUrl = qrCodeOverride || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(verifyUrl)}`;

  const attendeeName = record.name || 'Valued Guest';
  const mobile = record.phone || 'N/A';
  const email = record.email || 'N/A';
  const admits = record.item_quantity || 1;
  const amount = `${record.total_payment_amount || record.item_payment_amount || record.item_amount || 0}/-`;
  const l1Name = record.divisions || 'Street Cause';
  const l2Name = record.l2 || 'Event Team';

  // Direct Cloudinary Asset URLs
  const visionLogoUrl = 'https://res.cloudinary.com/ygf4cf8x/image/upload/v1791270072/Vision_2030_Logo.png';
  const digitalNestLogoUrl = 'https://res.cloudinary.com/ygf4cf8x/image/upload/v1791270024/Digital_Nest_logo.png';
  const seventeenYrsLogoUrl = 'https://res.cloudinary.com/ygf4cf8x/image/upload/v1791270023/17_yrs_logo.png';
  const titleImageUrl = 'https://res.cloudinary.com/ygf4cf8x/image/upload/v1791270028/Navratri_utsav_title.png';
  const giftVoucherFrontUrl = 'https://res.cloudinary.com/ygf4cf8x/image/upload/v1791270077/Gift_Voucher_Front.png';
  const giftVoucherBackUrl = 'https://res.cloudinary.com/ygf4cf8x/image/upload/v1791270104/Gift_Voucher_Back.png';

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Street Cause Hyderabad - ${eventName} Pass</title>
  <style type="text/css">
    html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; min-width: 100% !important; background-color: #120220; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse !important; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    td { padding: 0; }
    img { display: block; border: 0; outline: none; text-decoration: none; max-width: 100%; height: auto; }
    a { color: #c084fc; text-decoration: none; }
    
    .pass-container { width: 100% !important; max-width: 600px !important; margin: 0 auto !important; background-color: #1a052e; border-radius: 14px; overflow: hidden; border: 1px solid #4a156b; }
    .label-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; color: #ffffff; line-height: 1.45; }
    .value-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 400; color: #f3e8ff; line-height: 1.45; word-break: break-word; }
    .terms-item { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; line-height: 1.45; color: #e9d5ff; margin-bottom: 5px; }

    @media only screen and (max-width: 600px) {
      .outer-td { padding: 8px 4px !important; }
      .pass-container { width: 100% !important; border-radius: 10px !important; }
      .header-padding { padding: 14px 12px 8px 12px !important; }
      .vision-logo { max-width: 60px !important; }
      .digital-nest-logo { max-width: 125px !important; }
      .seventeen-logo { max-width: 45px !important; }
      .title-img { max-width: 200px !important; }
      
      .details-padding { padding: 10px 10px 8px 10px !important; }
      .details-col-left { width: 100% !important; display: block !important; margin-bottom: 12px !important; }
      .details-col-right { width: 100% !important; display: block !important; text-align: center !important; }
      
      .inner-meta-table { width: 100% !important; }
      .inner-meta-left { width: 50% !important; }
      .inner-meta-right { width: 50% !important; }
      
      .qr-wrapper { margin: 0 auto !important; width: 105px !important; }
      .qr-img { width: 95px !important; height: 95px !important; }
      
      .label-text { font-size: 10.5px !important; line-height: 1.35 !important; }
      .value-text { font-size: 10.5px !important; line-height: 1.35 !important; }
      .email-value { font-size: 9px !important; word-break: break-all !important; }
      
      .terms-padding { padding: 12px 10px !important; }
      .terms-item { font-size: 10px !important; line-height: 1.38 !important; margin-bottom: 4px !important; }
      
      .voucher-padding { padding: 4px 10px 12px 10px !important; }
      .footer-padding { padding: 14px 12px 18px 12px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #120220; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <!-- Outer Centering Table -->
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #120220; width: 100%;">
    <tr>
      <td align="center" class="outer-td" style="padding: 16px 8px;">
        
        <!-- MAIN PASS CARD CONTAINER WITH CLOUDINARY BACKGROUND -->
        <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" class="pass-container" 
               background="${passBgUrl}"
               style="width: 100%; max-width: 600px; background-color: #1a052e; background-image: url('${passBgUrl}'); background-repeat: no-repeat; background-position: center top; background-size: 100% 100%; border-radius: 14px; overflow: hidden; border: 1px solid #4a156b; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          
          <!-- ROW 1: HEADER LOGOS (Vision 2030, Digital Nest, 17 Years) -->
          <tr>
            <td class="header-padding" style="padding: 22px 20px 10px 20px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- Left: Vision 2030 Logo -->
                  <td width="25%" align="left" style="vertical-align: middle;">
                    <img src="${visionLogoUrl}" alt="Vision 2030 Street Cause" class="vision-logo" width="80" style="display: block; width: 100%; max-width: 80px; height: auto;" />
                  </td>
                  <!-- Center: Digital Nest Logo -->
                  <td width="50%" align="center" style="vertical-align: middle; padding: 0 6px;">
                    <img src="${digitalNestLogoUrl}" alt="Digital Nest School of Business" class="digital-nest-logo" width="165" style="display: block; width: 100%; max-width: 165px; height: auto; margin: 0 auto;" />
                  </td>
                  <!-- Right: 17 Years Logo -->
                  <td width="25%" align="right" style="vertical-align: middle;">
                    <img src="${seventeenYrsLogoUrl}" alt="17 Years Street Cause" class="seventeen-logo" width="65" style="display: block; width: 100%; max-width: 65px; height: auto; margin-left: auto;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ROW 2: ORGANIZATION NAME & TAGLINE -->
          <tr>
            <td align="center" style="padding: 6px 20px 4px 20px;">
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 800; color: #ffffff; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 2px;">
                STREET CAUSE HYDERABAD
              </div>
              <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 12px; font-style: italic; color: #e9d5ff; letter-spacing: 0.3px; margin-bottom: 4px;">
                &ldquo;A life without a cause is a life without an effect.&rdquo;
              </div>
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 600; color: #f472b6; text-transform: uppercase; letter-spacing: 2px;">
                Presents
              </div>
            </td>
          </tr>

          <!-- ROW 3: EVENT TITLE & EVENT PASS BADGE -->
          <tr>
            <td align="center" style="padding: 8px 20px 14px 20px;">
              <img src="${titleImageUrl}" alt="${eventName}" class="title-img" width="240" style="display: block; width: 100%; max-width: 240px; height: auto; margin: 0 auto 8px auto;" />
              <div style="display: inline-block; background-color: #ec4899; background: linear-gradient(90deg, #ec4899 0%, #d946ef 50%, #a855f7 100%); color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase; padding: 4px 18px; border-radius: 20px; box-shadow: 0 2px 10px rgba(217, 70, 239, 0.4);">
                EVENT PASS
              </div>
            </td>
          </tr>

          <!-- ROW 4: DYNAMIC DETAILS & QR CODE -->
          <tr>
            <td class="details-padding" style="padding: 6px 20px 14px 20px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  
                  <!-- Left Details Column (2 Sub-columns: Left & Right) -->
                  <td width="72%" class="details-col-left" style="vertical-align: top; padding-right: 10px;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="inner-meta-table">
                      <tr>
                        <!-- Sub-Column 1 -->
                        <td width="50%" class="inner-meta-left" style="vertical-align: top; padding-right: 6px;">
                          <div style="margin-bottom: 4px;"><span class="label-text">Name :</span> <span class="value-text">${attendeeName}</span></div>
                          <div style="margin-bottom: 4px;"><span class="label-text">Code :</span> <span class="value-text" style="color: #f472b6; font-weight: 700;">${codeValue}</span></div>
                          <div style="margin-bottom: 4px;"><span class="label-text">mobile :</span> <span class="value-text">${mobile}</span></div>
                          <div style="margin-bottom: 4px;"><span class="label-text">Email ID:</span> <span class="value-text email-value" style="font-size: 10.5px;">${email}</span></div>
                          <div style="margin-bottom: 4px;"><span class="label-text">Payment mode:</span> <span class="value-text">Online</span></div>
                          <div style="margin-bottom: 4px;"><span class="label-text">Type:</span> <span class="value-text">Event Pass</span></div>
                        </td>

                        <!-- Sub-Column 2 -->
                        <td width="50%" class="inner-meta-right" style="vertical-align: top; padding-left: 6px;">
                          <div style="margin-bottom: 4px;"><span class="label-text">Admits:</span> <span class="value-text" style="color: #4ade80; font-weight: 700;">${admits}</span></div>
                          <div style="margin-bottom: 4px;"><span class="label-text">Amount:</span> <span class="value-text" style="color: #f472b6; font-weight: 700;">${amount}</span></div>
                          <div style="margin-bottom: 4px;"><span class="label-text">Date:</span> <span class="value-text">${eventDate}</span></div>
                          <div style="margin-bottom: 4px;"><span class="label-text">Venue:</span> <span class="value-text" style="font-size: 10.5px;">Telangana Gardens, New Bowenpally</span></div>
                          <div style="margin-bottom: 4px;"><span class="label-text">L1's Name:</span> <span class="value-text">${l1Name}</span></div>
                          <div style="margin-bottom: 4px;"><span class="label-text">L2's Name:</span> <span class="value-text">${l2Name}</span></div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right QR Code Column -->
                  <td width="28%" class="details-col-right" align="right" style="vertical-align: middle;">
                    <div class="qr-wrapper" style="background-color: #ffffff; padding: 6px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 15px rgba(0,0,0,0.4); text-align: center;">
                      <img src="${qrCodeImgUrl}" class="qr-img" width="112" height="112" alt="Pass QR Code" style="display: block; width: 112px; height: 112px; border: 0;" />
                      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 8.5px; font-weight: 700; color: #0f172a; margin-top: 3px; letter-spacing: 0.5px;">
                        SCAN TO VERIFY
                      </div>
                    </div>
                  </td>

                </tr>
              </table>
            </td>
          </tr>

          <!-- ROW 5: DASHED DIVIDER -->
          <tr>
            <td style="padding: 0 20px;">
              <div style="border-top: 1px dashed rgba(255, 255, 255, 0.3); margin: 6px 0 14px 0;"></div>
            </td>
          </tr>

          <!-- ROW 6: TERMS & CONDITIONS (1 to 18) -->
          <tr>
            <td class="terms-padding" style="padding: 0 20px 14px 20px;">
              <div style="text-align: center; color: #f472b6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13.5px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 10px;">
                Terms &amp; Conditions
              </div>
              <ol style="margin: 0; padding-left: 18px; color: #e9d5ff;">
                <li class="terms-item">Tickets once booked cannot be exchanged or refunded.</li>
                <li class="terms-item">An internet handling fee per ticket may apply; please check the final amount before payment.</li>
                <li class="terms-item">Entry to the event will be closed by 8:30 PM. No entry will be allowed after this time.</li>
                <li class="terms-item">A valid QR code is mandatory for entry and is valid for one-time use only. Sharing or tampering will result in a permanent ban.</li>
                <li class="terms-item">Guests with multiple passes must arrive together, as the QR code will be scanned once for the group.</li>
                <li class="terms-item">Outside food and beverages are not allowed.</li>
                <li class="terms-item">Only mobile phones are permitted inside. If guests choose to bring other electronic devices such as laptops, tablets, or cameras, the organization will not be responsible for any loss or damage of any electronics.</li>
                <li class="terms-item">Smoking, drinking, drug use, e-cigarettes, sharp objects, or any form of intoxication are strictly prohibited. Intoxicated guests will not be allowed entry.</li>
                <li class="terms-item">Unlawful resale (or attempted resale) of tickets will lead to cancellation without refund or compensation.</li>
                <li class="terms-item">Mandatory frisking and breathalyzer checks may be conducted by law enforcement.</li>
                <li class="terms-item">All vehicles entering the venue premises are subject to checking for restricted items such as alcohol, cigarettes, or prohibited substances.</li>
                <li class="terms-item">Guests must follow all health protocols, including mandatory mask usage and social distancing norms.</li>
                <li class="terms-item">Please do not purchase tickets if you are unwell.</li>
                <li class="terms-item">Street Cause is not responsible for health issues, or for lost or stolen belongings.</li>
                <li class="terms-item">The CEO's Office reserves the right to change the venue, artist, date, or timings. Updates will be posted on official social media handles.</li>
                <li class="terms-item">If an artist or celebrity cancels at the last moment, organizers will not be held responsible.</li>
                <li class="terms-item">Rights of admission are reserved by the organizers.</li>
                <li class="terms-item">All funds raised will support Street Cause initiatives, including projects, operational costs, executive salaries, and growth programs.</li>
              </ol>
            </td>
          </tr>

          <!-- ROW 7: GIFT VOUCHER & SPONSOR SHOWCASE (Gift Voucher Front & Back) -->
          <tr>
            <td class="voucher-padding" style="padding: 4px 16px 14px 16px;">
              <!-- Voucher Front (20% OFF) -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
                <tr>
                  <td align="center">
                    <img src="${giftVoucherFrontUrl}" alt="Digital Nest Gift Voucher - 20% OFF" width="568" style="display: block; width: 100%; max-width: 568px; height: auto; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.35);" />
                  </td>
                </tr>
              </table>
              
              <!-- Voucher Back (Programs & Highlights) -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <img src="${giftVoucherBackUrl}" alt="Digital Nest Our Programs & Highlights" width="568" style="display: block; width: 100%; max-width: 568px; height: auto; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.35);" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ROW 8: FOOTER & CLOSING -->
          <tr>
            <td class="footer-padding" style="padding: 16px 20px 22px 20px; background-color: rgba(13, 1, 23, 0.75); border-top: 1px solid #4a156b;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center;">
                    <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #f3e8ff;">
                      We look forward to celebrating an unforgettable evening of music, colours and Garba with you!
                    </p>
                    <p style="margin: 0 0 16px 0; font-size: 13.5px; font-weight: 700; color: #f472b6;">
                      See you on the dance floor!
                    </p>
                    
                    <div style="border-top: 1px solid #3b0764; padding-top: 12px; margin-top: 6px;">
                      <div style="font-size: 11.5px; color: #c084fc; margin-bottom: 2px;">Warm regards,</div>
                      <div style="font-size: 13px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">STREET CAUSE HYDERABAD</div>
                      <div style="font-family: Georgia, 'Times New Roman', serif; font-size: 11px; font-style: italic; color: #c084fc; margin-top: 2px; margin-bottom: 8px;">
                        &ldquo;A life without a cause is a life without an effect.&rdquo;
                      </div>
                      <div style="font-size: 11px; color: #a855f7;">
                        <a href="mailto:streetcause@gmail.com" style="color: #c084fc; text-decoration: none;">streetcause@gmail.com</a> &nbsp;|&nbsp; @streetcausehyderabad
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Template registry mapping event_id to its pass generator function
export type PassTemplateFn = (record: EventRecord, qrCodeOverride?: string) => string;

export const PASS_TEMPLATES: Record<string, PassTemplateFn> = {
  garba_groove: generateGarbaGroovePassHTML,
  navratri_utsav: generateNavratriUtsavPassHTML,
};

// Unified Template Dispatcher
export function generatePassEmailHTML(record: EventRecord, qrCodeOverride?: string): string {
  const eventKey = record.event_id || 'garba_groove';
  const templateFn = PASS_TEMPLATES[eventKey] || generateGarbaGroovePassHTML;
  return templateFn(record, qrCodeOverride);
}

export interface SmtpSendResult {
  success: boolean;
  messageId?: string;
  smtpCode?: string | number;
  error?: string;
  isTemporary?: boolean;
  isQuotaExceeded?: boolean; // sender account hit its daily sending limit; try another account
  smtpAccount?: string;
}

/** Gmail: '550 5.4.5 Daily user sending limit exceeded' / '421 4.7.0 ... sending limit' */
export function isSmtpQuotaError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes('5.4.5') ||
    message.includes('sending limit') ||
    message.includes('sending quota') ||
    message.includes('daily user sending')
  );
}

// Error classifier: distinguishes 4xx (temporary/retryable) vs 5xx (permanent)
export function classifySmtpError(error: unknown): { isTemporary: boolean; code?: string | number; message: string } {
  if (!error) {
    return { isTemporary: false, message: 'Unknown SMTP error' };
  }
  const err = error as Record<string, unknown>;
  const message = typeof err.message === 'string' ? err.message : String(error);
  const code = (err.responseCode || err.code || err.statusCode) as string | number | undefined;

  const codeNum = typeof code === 'number' ? code : parseInt(String(code), 10);

  // 4xx SMTP codes (e.g. 421, 450, 451, 452) are temporary failures
  if (!isNaN(codeNum) && codeNum >= 400 && codeNum < 500) {
    return { isTemporary: true, code: codeNum, message };
  }

  // 5xx SMTP codes (e.g. 550 mailbox unavailable, 553 invalid recipient) are permanent
  if (!isNaN(codeNum) && codeNum >= 500 && codeNum < 600) {
    return { isTemporary: false, code: codeNum, message };
  }

  // Common transient socket / connection codes
  const transientCodeStrings = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENOTFOUND', 'ESOCKETTIMEDOUT'];
  if (typeof code === 'string' && transientCodeStrings.includes(code.toUpperCase())) {
    return { isTemporary: true, code, message };
  }

  // Text-based fallback detection for throttling
  const lowerMsg = message.toLowerCase();
  if (
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('quota exceeded') ||
    lowerMsg.includes('try again later') ||
    lowerMsg.includes('busy') ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('connection closed') ||
    lowerMsg.includes('too many connections')
  ) {
    return { isTemporary: true, code: code || 421, message };
  }

  return { isTemporary: false, code, message };
}

export async function sendPassEmail(
  record: EventRecord,
  qrCodeOverride?: string,
  account?: SmtpAccount
): Promise<SmtpSendResult> {
  const sender = account || getSmtpAccounts()[0];
  try {
    if (!record.email || record.email.trim() === '') {
      return { success: false, isTemporary: false, error: 'No email address provided for this attendee' };
    }

    const emailTrimmed = record.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      return { success: false, isTemporary: false, error: `Invalid email address format: ${emailTrimmed}` };
    }

    // Email clients block data: URIs and render inline CID images inconsistently, so the QR is a hosted HTTPS image
    let qrImgSrc = qrCodeOverride;
    if (!qrImgSrc) {
      const codeValue = record.order_id || record.code || '';
      const encodedCode = encodeURIComponent(codeValue);
      const baseUrl = (
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
        'https://street-cause-dandiya-2026.vercel.app'
      ).replace(/\/+$/, '');
      const verifyUrl = `${baseUrl}/verify?code=${encodedCode}`;
      qrImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&format=png&data=${encodeURIComponent(verifyUrl)}`;
    }

    if (!sender) {
      throw new Error('SMTP credentials not configured in .env.local (Make sure .env.local is saved with SMTP_USER and SMTP_PASS)');
    }
    const transporter = getTransporter(sender);
    const isNavratri = record.event_id === 'navratri_utsav';
    const eventName = isNavratri ? 'Navratri Utsav 2026' : 'Garba Groove 2026';
    const passItemName = record.item_name || 'Event Pass';
    // Sender display name is per event so attendees see which pass this is in their inbox
    const fromName = isNavratri ? 'Event pass Navratri Utsav' : 'Event pass Garba Groove';
    // Gmail rewrites From to the authenticated account, so send as that account; replies go to the main inbox
    const fromEmail = sender.user;
    const replyTo = getReplyToAddress() || sender.user;

    const passCode = record.code || record.order_id || '';
    const subjectLine = passCode ? `Your ${eventName} Pass - ${passItemName} (${passCode})` : `Your ${eventName} Pass - ${passItemName}`;

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      replyTo,
      to: emailTrimmed,
      subject: subjectLine,
      html: generatePassEmailHTML(record, qrImgSrc),
    });

    return {
      success: true,
      messageId: info.messageId,
      smtpCode: (info as { response?: string }).response || 250,
      smtpAccount: sender.user,
    };
  } catch (error: unknown) {
    const classified = classifySmtpError(error);
    // A rejected login (wrong/placeholder app password) is the account's fault, not the recipient's:
    // treat it like an exhausted account so the worker rotates instead of failing the pass
    const errObj = error as { code?: string; responseCode?: number };
    const isAuthError = errObj?.code === 'EAUTH' || errObj?.responseCode === 535 || errObj?.responseCode === 534;
    if (isAuthError) {
      console.error(`SMTP login rejected for ${sender?.user}; check SMTP_USER/SMTP_PASS for this account`);
    }
    const isQuotaExceeded = isSmtpQuotaError(error) || isAuthError;
    console.error(`Failed to send email to ${record.email} via ${sender?.user}:`, classified.message);
    return {
      success: false,
      isTemporary: classified.isTemporary || isQuotaExceeded,
      isQuotaExceeded,
      smtpAccount: sender?.user,
      smtpCode: classified.code,
      error: classified.message,
    };
  }
}

// Rate limiting helper
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function sendBulkPassEmails(
  records: EventRecord[]
): Promise<Array<{ orderId: string; status: 'Sent' | 'Failed'; error?: string }>> {
  const results: Array<{ orderId: string; status: 'Sent' | 'Failed'; error?: string }> = [];

  for (const record of records) {
    const result = await sendPassEmail(record);
    if (result.success) {
      results.push({ orderId: record.order_id, status: 'Sent' });
    } else {
      results.push({ orderId: record.order_id, status: 'Failed', error: result.error });
    }

    // Rate limit delay
    await delay(150);
  }

  return results;
}


