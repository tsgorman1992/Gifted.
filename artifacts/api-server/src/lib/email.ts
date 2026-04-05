import { Resend } from "resend";

const FROM = "gifted. <hello@gifted.page>";
const REPLY_TO = "help@gifted.page";
const BASE_URL = "https://gifted.page";

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY not set — skipping email");
    return null;
  }
  return new Resend(key);
}

// ─── Shared layout ────────────────────────────────────────────────────────────

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

      <!-- Logo -->
      <tr><td style="padding-bottom:32px;text-align:center;">
        <a href="${BASE_URL}" style="text-decoration:none;">
          <span style="font-size:28px;font-weight:500;color:#7c4a1e;letter-spacing:-0.5px;font-family:Georgia,serif;">gifted.</span>
        </a>
      </td></tr>

      <!-- Card -->
      <tr><td style="background:#ffffff;border-radius:20px;padding:40px 36px;border:1px solid #ede8e1;">
        ${body}
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:24px 0;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9e9087;line-height:1.6;">
          gifted. &middot; Premium digital gifting<br/>
          <a href="${BASE_URL}/privacy" style="color:#9e9087;text-decoration:underline;">Privacy</a>
          &nbsp;&middot;&nbsp;
          <a href="mailto:${REPLY_TO}" style="color:#9e9087;text-decoration:underline;">Help</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function btn(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:#7c4a1e;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:100px;margin-top:8px;">${text}</a>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:26px;font-weight:600;color:#1a1310;font-family:Georgia,serif;line-height:1.25;">${text}</h1>`;
}

function p(text: string, muted = false): string {
  const color = muted ? "#6b6059" : "#2c2520";
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${color};">${text}</p>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #ede8e1;margin:28px 0;" />`;
}

function detail(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;font-size:13px;color:#6b6059;vertical-align:top;width:40%;">${label}</td>
    <td style="padding:6px 0;font-size:13px;color:#1a1310;font-weight:600;vertical-align:top;">${value}</td>
  </tr>`;
}

// ─── 1. Sender payment confirmation ───────────────────────────────────────────

interface SenderReceiptParams {
  to: string;
  senderName: string;
  recipientName: string;
  giftId: string;
  amount: string | null;
  occasion: string;
  giftTitle: string;
}

export async function sendSenderReceipt(params: SenderReceiptParams): Promise<void> {
  const client = getClient();
  if (!client) return;

  const { to, senderName, recipientName, giftId, amount, occasion, giftTitle } = params;
  const giftUrl = `${BASE_URL}/open/${giftId}?preview=true`;
  const amtStr = amount && parseFloat(amount) > 0
    ? `$${parseFloat(amount).toFixed(2)}`
    : null;

  const body = `
    ${h1(`Your moment is ready, ${senderName.split(" ")[0]}!`)}
    ${p(`Everything is set. Your moment for <strong>${recipientName}</strong> has been created and funded. All that's left is to share the link.`)}
    ${divider()}
    <table cellpadding="0" cellspacing="0" width="100%">
      ${detail("For", recipientName)}
      ${detail("Occasion", occasion.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()))}
      ${detail("Title", giftTitle)}
      ${amtStr ? detail("Gift balance", amtStr) : ""}
    </table>
    ${divider()}
    <div style="text-align:center;padding:8px 0 4px;">
      ${btn("View your moment", giftUrl)}
      <p style="margin:16px 0 0;font-size:13px;color:#6b6059;">Copy the link and share it however feels right — text, iMessage, WhatsApp, email.</p>
    </div>
  `;

  try {
    const { error } = await client.emails.send({
      from: FROM,
      to,
      replyTo: REPLY_TO,
      subject: `Your moment for ${recipientName} is ready ✨`,
      html: layout(`Moment ready — gifted.`, body),
    });
    if (error) console.error("[email] sendSenderReceipt error:", error);
    else console.log(`[email] Sender receipt sent to ${to}`);
  } catch (err) {
    console.error("[email] sendSenderReceipt exception:", err);
  }
}

// ─── 2. Sender redemption notification ────────────────────────────────────────

interface SenderRedemptionParams {
  to: string;
  senderName: string;
  recipientName: string;
  giftId: string;
  amount: string | null;
  payoutMethod: string | null;
}

export async function sendSenderRedemptionNotice(params: SenderRedemptionParams): Promise<void> {
  const client = getClient();
  if (!client) return;

  const { to, senderName, recipientName, giftId, amount, payoutMethod } = params;
  const dashboardUrl = `${BASE_URL}/my-gifts`;
  const amtStr = amount && parseFloat(amount) > 0
    ? `$${parseFloat(amount).toFixed(2)}`
    : "their gift";

  const methodLabel = payoutMethod
    ? payoutMethod.charAt(0).toUpperCase() + payoutMethod.slice(1)
    : null;

  const body = `
    ${h1(`${recipientName} claimed their balance!`)}
    ${p(`Great news — ${recipientName} just claimed the ${amtStr} balance from your moment.${methodLabel ? ` They've requested their payout via <strong>${methodLabel}</strong>.` : ""}`)}
    ${p(`Your generosity landed. That's what gifted. is all about.`, true)}
    ${divider()}
    <div style="text-align:center;padding:8px 0 4px;">
      ${btn("See their reaction", dashboardUrl)}
    </div>
  `;

  try {
    const { error } = await client.emails.send({
      from: FROM,
      to,
      replyTo: REPLY_TO,
      subject: `${recipientName} claimed their balance 🎉`,
      html: layout(`Balance claimed — gifted.`, body),
    });
    if (error) console.error("[email] sendSenderRedemptionNotice error:", error);
    else console.log(`[email] Redemption notice sent to ${to}`);
  } catch (err) {
    console.error("[email] sendSenderRedemptionNotice exception:", err);
  }
}

// ─── 3. Operator cashout alert ─────────────────────────────────────────────────

interface OperatorCashoutParams {
  recipientName: string;
  senderName: string;
  giftId: string;
  amount: string | null;
  payoutMethod: string;
  payoutHandle: string;
  payoutName: string | null;
}

export async function sendOperatorCashoutAlert(params: OperatorCashoutParams): Promise<void> {
  const client = getClient();
  if (!client) return;

  const operatorEmail = process.env.OPERATOR_EMAIL ?? "help@gifted.page";

  const { recipientName, senderName, giftId, amount, payoutMethod, payoutHandle, payoutName } = params;
  const amtStr = amount && parseFloat(amount) > 0
    ? `$${parseFloat(amount).toFixed(2)}`
    : "unknown";
  const methodLabel = payoutMethod.charAt(0).toUpperCase() + payoutMethod.slice(1);
  const adminUrl = `${BASE_URL}/admin`;

  const body = `
    ${h1(`New cashout request`)}
    ${p(`A recipient has requested their gift balance. Send this payout now.`)}
    ${divider()}
    <table cellpadding="0" cellspacing="0" width="100%">
      ${detail("Recipient", recipientName)}
      ${detail("From sender", senderName)}
      ${detail("Amount", amtStr)}
      ${detail("Method", methodLabel)}
      ${detail("Handle", payoutHandle)}
      ${payoutName ? detail("Name on account", payoutName) : ""}
    </table>
    ${divider()}
    <div style="text-align:center;padding:8px 0 4px;">
      ${btn("Open admin dashboard", adminUrl)}
    </div>
    ${p(`Reply to this email once you've sent the payout.`, true)}
  `;

  try {
    const { error } = await client.emails.send({
      from: FROM,
      to: operatorEmail,
      replyTo: REPLY_TO,
      subject: `Cashout request: ${amtStr} → ${methodLabel} ${payoutHandle}`,
      html: layout(`Cashout request — gifted.`, body),
    });
    if (error) console.error("[email] sendOperatorCashoutAlert error:", error);
    else console.log(`[email] Cashout alert sent to operator`);
  } catch (err) {
    console.error("[email] sendOperatorCashoutAlert exception:", err);
  }
}

// ─── 4. Gift opened notification (email fallback when no SMS) ─────────────────

interface GiftOpenedParams {
  to: string;
  senderName: string;
  recipientName: string;
  giftId: string;
}

export async function sendGiftOpenedNotice(params: GiftOpenedParams): Promise<void> {
  const client = getClient();
  if (!client) return;

  const { to, senderName, recipientName, giftId } = params;
  const dashboardUrl = `${BASE_URL}/my-gifts`;

  const body = `
    ${h1(`${recipientName} just opened your moment! ✨`)}
    ${p(`Your moment for <strong>${recipientName}</strong> has been opened. Head to your dashboard to see their reaction.`)}
    ${divider()}
    <div style="text-align:center;padding:8px 0 4px;">
      ${btn("See their reaction", dashboardUrl)}
    </div>
  `;

  try {
    const { error } = await client.emails.send({
      from: FROM,
      to,
      replyTo: REPLY_TO,
      subject: `${recipientName} opened your moment ✨`,
      html: layout(`Moment opened — gifted.`, body),
    });
    if (error) console.error("[email] sendGiftOpenedNotice error:", error);
    else console.log(`[email] Gift opened notice sent to ${to}`);
  } catch (err) {
    console.error("[email] sendGiftOpenedNotice exception:", err);
  }
}

// ─── 5. Stale gift nudge (email fallback when no SMS) ─────────────────────────

interface SenderNudgeParams {
  to: string;
  senderName: string;
  recipientName: string;
  giftId: string;
}

export async function sendSenderNudgeEmail(params: SenderNudgeParams): Promise<void> {
  const client = getClient();
  if (!client) return;

  const { to, senderName, recipientName, giftId } = params;
  const giftUrl = `${BASE_URL}/open/${giftId}?preview=true`;

  const body = `
    ${h1(`Your moment for ${recipientName} hasn't been opened yet`)}
    ${p(`Just a heads up — your moment for <strong>${recipientName}</strong> is still waiting. If you haven't shared the link yet, here it is ready to forward.`)}
    ${divider()}
    <div style="text-align:center;padding:8px 0 4px;">
      ${btn("View moment link", giftUrl)}
      <p style="margin:16px 0 0;font-size:13px;color:#6b6059;">Copy the link and send it however feels right — text, iMessage, WhatsApp, or email.</p>
    </div>
  `;

  try {
    const { error } = await client.emails.send({
      from: FROM,
      to,
      replyTo: REPLY_TO,
      subject: `Your moment for ${recipientName} is still waiting to be opened`,
      html: layout(`Moment not opened yet — gifted.`, body),
    });
    if (error) console.error("[email] sendSenderNudgeEmail error:", error);
    else console.log(`[email] Nudge email sent to ${to}`);
  } catch (err) {
    console.error("[email] sendSenderNudgeEmail exception:", err);
  }
}

// ─── 6. Scheduled gift ready (email fallback when no SMS) ─────────────────────

interface ScheduledReadyParams {
  to: string;
  senderName: string;
  recipientName: string;
  giftId: string;
}

export async function sendScheduledGiftReadyEmail(params: ScheduledReadyParams): Promise<void> {
  const client = getClient();
  if (!client) return;

  const { to, senderName, recipientName, giftId } = params;
  const giftUrl = `${BASE_URL}/open/${giftId}?preview=true`;

  const body = `
    ${h1(`Your moment for ${recipientName} is live!`)}
    ${p(`The moment you scheduled has arrived. It's ready — copy the link below and share it whenever you're ready.`)}
    ${divider()}
    <div style="text-align:center;padding:8px 0 4px;">
      ${btn("View moment link", giftUrl)}
      <p style="margin:16px 0 0;font-size:13px;color:#6b6059;">Copy the link and share it however feels right — when it comes from you, it lands differently.</p>
    </div>
  `;

  try {
    const { error } = await client.emails.send({
      from: FROM,
      to,
      replyTo: REPLY_TO,
      subject: `Your moment for ${recipientName} is ready to share ✨`,
      html: layout(`Moment ready — gifted.`, body),
    });
    if (error) console.error("[email] sendScheduledGiftReadyEmail error:", error);
    else console.log(`[email] Scheduled ready email sent to ${to}`);
  } catch (err) {
    console.error("[email] sendScheduledGiftReadyEmail exception:", err);
  }
}

// ─── 7. Package delivered notification (email fallback when no SMS) ────────────

interface PackageDeliveredParams {
  to: string;
  senderName: string;
  recipientName: string;
}

export async function sendPackageDeliveredEmail(params: PackageDeliveredParams): Promise<void> {
  const client = getClient();
  if (!client) return;

  const { to, senderName, recipientName } = params;
  const dashboardUrl = `${BASE_URL}/my-gifts`;

  const body = `
    ${h1(`Your package for ${recipientName} has arrived! 📦`)}
    ${p(`Great news — the package you sent to <strong>${recipientName}</strong> has been delivered.`)}
    ${divider()}
    <div style="text-align:center;padding:8px 0 4px;">
      ${btn("View dashboard", dashboardUrl)}
    </div>
  `;

  try {
    const { error } = await client.emails.send({
      from: FROM,
      to,
      replyTo: REPLY_TO,
      subject: `Your package for ${recipientName} was delivered 📦`,
      html: layout(`Package delivered — gifted.`, body),
    });
    if (error) console.error("[email] sendPackageDeliveredEmail error:", error);
    else console.log(`[email] Package delivered email sent to ${to}`);
  } catch (err) {
    console.error("[email] sendPackageDeliveredEmail exception:", err);
  }
}

// ─── 8. Second sender nudge (7 days) ──────────────────────────────────────────

interface SenderSecondNudgeParams {
  to: string;
  senderName: string;
  recipientName: string;
  giftId: string;
}

export async function sendSenderSecondNudgeEmail(params: SenderSecondNudgeParams): Promise<void> {
  const client = getClient();
  if (!client) return;

  const { to, senderName, recipientName, giftId } = params;
  const giftUrl = `${BASE_URL}/open/${giftId}?preview=true`;

  const body = `
    ${h1(`Still waiting — ${recipientName} hasn't seen their moment yet`)}
    ${p(`It's been a week since you built something for <strong>${recipientName}</strong>. The moment is still here, ready to go — all it needs is you to pass along the link.`)}
    ${divider()}
    <div style="text-align:center;padding:8px 0 4px;">
      ${btn("Get the link", giftUrl)}
      <p style="margin:16px 0 0;font-size:13px;color:#6b6059;">Forward it however feels right — iMessage, WhatsApp, email. When it comes from you, it lands differently.</p>
    </div>
    <p style="margin:24px 0 0;font-size:12px;color:#9e9087;line-height:1.6;">
      If this was a mistake or you no longer want to send this moment, just reply to this email and we'll take care of it.
    </p>
  `;

  try {
    const { error } = await client.emails.send({
      from: FROM,
      to,
      replyTo: REPLY_TO,
      subject: `${recipientName} still hasn't seen their moment`,
      html: layout(`Moment still waiting — gifted.`, body),
    });
    if (error) console.error("[email] sendSenderSecondNudgeEmail error:", error);
    else console.log(`[email] Second nudge sent to ${to}`);
  } catch (err) {
    console.error("[email] sendSenderSecondNudgeEmail exception:", err);
  }
}

// ─── 9. Unredeemed gift — sender final notice (60 days) ───────────────────────

interface UnredeemedSenderParams {
  to: string;
  senderName: string;
  recipientName: string;
  amount: string;
}

export async function sendUnredeemedSenderEmail(params: UnredeemedSenderParams): Promise<void> {
  const client = getClient();
  if (!client) return;

  const { to, senderName, recipientName, amount } = params;

  const body = `
    ${h1(`${recipientName}'s gift balance hasn't been claimed`)}
    ${p(`Your gift of <strong>$${parseFloat(amount).toFixed(2)}</strong> for ${recipientName} has been sitting unclaimed for 60 days. We want to make sure that money doesn't go to waste.`)}
    ${divider()}
    ${p(`If you'd like a refund or have any questions, reply to this email or reach us at <a href="mailto:help@gifted.page" style="color:#7c4a1e;text-decoration:underline;">help@gifted.page</a> — we'll take care of it.`)}
    <p style="margin:16px 0 0;font-size:13px;color:#6b6059;line-height:1.6;">
      If you're still hoping ${recipientName} redeems it, no action is needed — the link stays active.
    </p>
  `;

  try {
    const { error } = await client.emails.send({
      from: FROM,
      to,
      replyTo: REPLY_TO,
      subject: `${recipientName}'s gift balance is unclaimed — need a refund?`,
      html: layout(`Unclaimed gift balance — gifted.`, body),
    });
    if (error) console.error("[email] sendUnredeemedSenderEmail error:", error);
    else console.log(`[email] Unredeemed final notice sent to ${to}`);
  } catch (err) {
    console.error("[email] sendUnredeemedSenderEmail exception:", err);
  }
}

// ─── 10. Gift link recovery email ─────────────────────────────────────────────

interface GiftLinkEmailParams {
  to: string;
  recipientName: string;
  giftId: string;
}

export async function sendGiftLinkEmail(params: GiftLinkEmailParams): Promise<void> {
  const client = getClient();
  if (!client) return;

  const { to, recipientName, giftId } = params;
  const previewUrl = `${BASE_URL}/preview?gift_id=${giftId}`;

  const body = `
    ${h1("Here's your moment link")}
    ${p(`You asked us to email your link for <strong>${recipientName}</strong>. Open it below to get back to your moment — then copy and forward it when you're ready.`)}
    ${divider()}
    <div style="text-align:center;padding:8px 0 4px;">
      ${btn("Get my moment link", previewUrl)}
      <p style="margin:16px 0 0;font-size:13px;color:#6b6059;">Open this on the same browser where you built the moment for the best experience.</p>
    </div>
  `;

  try {
    const { error } = await client.emails.send({
      from: FROM,
      to,
      replyTo: REPLY_TO,
      subject: `Your moment for ${recipientName} — link inside ✨`,
      html: layout("Moment link — gifted.", body),
    });
    if (error) console.error("[email] sendGiftLinkEmail error:", error);
    else console.log(`[email] Gift link email sent to ${to}`);
  } catch (err) {
    console.error("[email] sendGiftLinkEmail exception:", err);
  }
}

// ─── 11. Recipient payout confirmation ────────────────────────────────────────

interface RecipientPayoutParams {
  to: string;
  recipientName: string;
  senderName: string;
  amount: string;
  payoutMethod: string;
  payoutHandle: string;
}

export async function sendRecipientPayoutConfirmation(params: RecipientPayoutParams): Promise<void> {
  const client = getClient();
  if (!client) return;

  const { to, recipientName, senderName, amount, payoutMethod, payoutHandle } = params;
  const amtStr = `$${parseFloat(amount).toFixed(2)}`;
  const methodLabel = payoutMethod.charAt(0).toUpperCase() + payoutMethod.slice(1);
  const firstName = recipientName.split(" ")[0];

  const body = `
    ${h1(`Your payout is on its way, ${firstName}!`)}
    ${p(`We've received your redemption request and the gifted. team is processing your payout now.`)}
    ${divider()}
    <table cellpadding="0" cellspacing="0" width="100%">
      ${detail("Amount", amtStr)}
      ${detail("Sending via", methodLabel)}
      ${detail("To", payoutHandle)}
      ${detail("From", senderName)}
    </table>
    ${divider()}
    ${p(`Payouts are typically sent same day. If you haven't received your ${amtStr} within 24 hours, reach out and we'll sort it out right away.`)}
    <div style="text-align:center;padding:8px 0 4px;">
      <a href="mailto:help@gifted.page" style="display:inline-block;background:#f5f0ea;color:#7c4a1e;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:100px;margin-top:8px;">Contact support</a>
    </div>
  `;

  try {
    const { error } = await client.emails.send({
      from: FROM,
      to,
      replyTo: REPLY_TO,
      subject: `Your ${amtStr} payout is on its way`,
      html: layout(`Payout confirmed — gifted.`, body),
    });
    if (error) console.error("[email] sendRecipientPayoutConfirmation error:", error);
    else console.log(`[email] Recipient payout confirmation sent to ${to}`);
  } catch (err) {
    console.error("[email] sendRecipientPayoutConfirmation exception:", err);
  }
}

// ─── 12. Happy birthday email ─────────────────────────────────────────────────

interface HappyBirthdayParams {
  to: string;
  firstName: string;
}

export async function sendHappyBirthdayEmail(params: HappyBirthdayParams): Promise<void> {
  const client = getClient();
  if (!client) return;

  const { to, firstName } = params;
  const name = firstName || "you";

  const body = `
    ${h1(`Happy birthday, ${name}! 🎂`)}
    ${p(`Today is your day — and we just wanted to take a moment to celebrate you.`)}
    ${p(`You've been a part of the gifted. community, and that means something. The people who use gifted. are the ones who believe a thoughtful gesture is worth more than a gift card — and we think that says a lot about you.`)}
    ${divider()}
    ${p(`If someone special is building you a moment today, it should be arriving soon. And if you want to treat yourself or someone else, you know where to find us.`)}
    <div style="text-align:center;padding:8px 0 4px;">
      ${btn("Build a moment", `${BASE_URL}/create`)}
    </div>
    <p style="margin:24px 0 0;font-size:13px;color:#9e9087;text-align:center;">
      Have a wonderful day. You deserve it.
    </p>
  `;

  try {
    const { error } = await client.emails.send({
      from: FROM,
      to,
      replyTo: REPLY_TO,
      subject: `Happy birthday, ${name}! 🎂`,
      html: layout(`Happy birthday — gifted.`, body),
    });
    if (error) console.error("[email] sendHappyBirthdayEmail error:", error);
    else console.log(`[email] Birthday email sent to ${to}`);
  } catch (err) {
    console.error("[email] sendHappyBirthdayEmail exception:", err);
  }
}

// ─── Occasion reminder ────────────────────────────────────────────────────────

export async function sendOccasionReminderEmail({
  to,
  userName,
  contactName,
  occasionLabel,
  daysAway,
}: {
  to: string;
  userName: string;
  contactName: string;
  occasionLabel: string;
  daysAway: number;
}): Promise<void> {
  const client = getClient();
  if (!client) return;

  const greeting = userName ? `Hi ${userName},` : "Hi there,";
  const urgency = daysAway === 0 ? "is today" : `is in ${daysAway} day${daysAway !== 1 ? "s" : ""}`;

  const body = `
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:500;color:#1a1108;font-family:Georgia,serif;">
      ${contactName}'s ${occasionLabel} ${urgency} 🎁
    </h2>
    <p style="margin:0 0 24px;font-size:15px;color:#6b5744;line-height:1.6;">
      ${greeting} Just a heads-up — ${contactName}'s ${occasionLabel} ${urgency}. It only takes a minute to build something they'll remember.
    </p>
    ${btn("Build a moment", `${BASE_URL}/create`)}
    <p style="margin:20px 0 0;font-size:13px;color:#9e9087;line-height:1.6;">
      You're receiving this because you saved this occasion in your gifted. contacts. 
      <a href="${BASE_URL}/my-gifts?tab=people" style="color:#7c4a1e;text-decoration:underline;">Manage reminders</a>
    </p>
  `;

  try {
    const { error } = await client.emails.send({
      from: FROM,
      to,
      replyTo: REPLY_TO,
      subject: `${contactName}'s ${occasionLabel} is ${daysAway === 0 ? "today" : `in ${daysAway} day${daysAway !== 1 ? "s" : ""}`} 🎁`,
      html: layout(`Occasion reminder — gifted.`, body),
    });
    if (error) console.error("[email] sendOccasionReminderEmail error:", error);
    else console.log(`[email] Occasion reminder sent to ${to} for ${contactName}'s ${occasionLabel}`);
  } catch (err) {
    console.error("[email] sendOccasionReminderEmail exception:", err);
  }
}
