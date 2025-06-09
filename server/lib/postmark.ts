export interface PostmarkWebhookData {
  MessageID: string;
  From: string;
  FromName?: string;
  To: string;
  Subject: string;
  TextBody?: string;
  HtmlBody?: string;
  Date: string;
  Cc?: string;
  Bcc?: string;
  OriginalRecipient?: string;
  ReplyTo?: string;
  Attachments?: Array<{
    Name: string;
    ContentType: string;
    ContentLength: number;
    Content?: string;
  }>;
  Headers?: Array<{
    Name: string;
    Value: string;
  }>;
}

export interface ForwardedEmailInfo {
  originalFrom?: string;
  originalFromName?: string;
  originalTo?: string;
  originalDate?: string;
  originalSubject?: string;
}

export interface ProcessedEmail {
  messageId: string;
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  subject: string;
  textContent?: string;
  htmlContent?: string;
  receivedAt: Date;
  attachments: string[];
  isForwarded?: boolean;
  forwardedInfo?: ForwardedEmailInfo;
  actualSenderEmail?: string;
  actualSenderName?: string;
}

export function parseForwardedEmailInfo(textBody?: string): ForwardedEmailInfo | null {
  if (!textBody) return null;

  // Look for forwarded message patterns
  const forwardedPatterns = [
    /============ Forwarded message ============\s*\n/i,
    /---------- Forwarded message ----------\s*\n/i,
    /-------- Original Message --------\s*\n/i,
    /Begin forwarded message:/i
  ];

  const hasForwardedPattern = forwardedPatterns.some(pattern => pattern.test(textBody));
  if (!hasForwardedPattern) return null;

  const info: ForwardedEmailInfo = {};

  // Extract From field - handle multiple formats
  const fromMatch = textBody.match(/From:\s*([^\n]+)\n/i);
  if (fromMatch) {
    const fromLine = fromMatch[1].trim();
    
    // Format: "Name <email@domain.com>"
    const angleMatch = fromLine.match(/^(.+?)\s*<([^>]+)>$/);
    if (angleMatch) {
      info.originalFromName = angleMatch[1].trim();
      info.originalFrom = angleMatch[2].trim();
    } else {
      // Format: "Name email@domain.com" (space separated)
      const emailPattern = /(\S+@\S+\.\S+)/;
      const emailMatch = fromLine.match(emailPattern);
      if (emailMatch) {
        info.originalFrom = emailMatch[1];
        // Extract name by removing the email from the line
        const nameOnly = fromLine.replace(emailMatch[1], '').trim();
        if (nameOnly) {
          info.originalFromName = nameOnly;
        }
      } else {
        // Just name, no email found
        info.originalFromName = fromLine;
      }
    }
  }

  // Extract To field
  const toMatch = textBody.match(/To:\s*([^<\n]+?)(?:\s*<([^>]+)>)?\s*\n/i);
  if (toMatch) {
    if (toMatch[2]) {
      info.originalTo = toMatch[2].trim();
    } else {
      info.originalTo = toMatch[1].trim().replace(/^["']|["']$/g, '');
    }
  }

  // Extract Date field
  const dateMatch = textBody.match(/Date:\s*([^\n]+)\n/i);
  if (dateMatch) {
    info.originalDate = dateMatch[1].trim();
  }

  // Extract Subject field
  const subjectMatch = textBody.match(/Subject:\s*([^\n]+)\n/i);
  if (subjectMatch) {
    info.originalSubject = subjectMatch[1].trim();
  }

  return Object.keys(info).length > 0 ? info : null;
}

export function processPostmarkWebhook(webhookData: PostmarkWebhookData): ProcessedEmail {
  const forwardedInfo = parseForwardedEmailInfo(webhookData.TextBody);
  const isForwarded = forwardedInfo !== null;

  // If it's a forwarded email and we have original sender info, use that as the primary display
  const displayFromEmail = isForwarded && forwardedInfo?.originalFrom ? forwardedInfo.originalFrom : webhookData.From;
  const displayFromName = isForwarded && forwardedInfo?.originalFromName ? forwardedInfo.originalFromName : webhookData.FromName;
  const displaySubject = isForwarded && forwardedInfo?.originalSubject ? forwardedInfo.originalSubject : webhookData.Subject;

  return {
    messageId: webhookData.MessageID,
    fromEmail: displayFromEmail,
    fromName: displayFromName,
    toEmail: webhookData.To,
    subject: displaySubject,
    textContent: webhookData.TextBody,
    htmlContent: webhookData.HtmlBody,
    receivedAt: new Date(webhookData.Date),
    attachments: webhookData.Attachments?.map(att => att.Name) || [],
    isForwarded,
    forwardedInfo: forwardedInfo || undefined,
    actualSenderEmail: isForwarded ? webhookData.From : undefined,
    actualSenderName: isForwarded ? webhookData.FromName : undefined,
  };
}

export function validatePostmarkWebhook(body: any): body is PostmarkWebhookData {
  return (
    body &&
    typeof body.MessageID === 'string' &&
    typeof body.From === 'string' &&
    typeof body.To === 'string' &&
    typeof body.Subject === 'string' &&
    typeof body.Date === 'string'
  );
}

export async function sendPostmarkEmail(
  to: string,
  subject: string,
  textBody: string,
  htmlBody?: string
): Promise<boolean> {
  const serverToken = process.env.POSTMARK_SERVER_TOKEN || process.env.POSTMARK_SERVER_TOKEN_ENV_VAR || "";
  
  if (!serverToken) {
    throw new Error("Postmark server token not configured");
  }

  try {
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": serverToken,
      },
      body: JSON.stringify({
        From: process.env.POSTMARK_FROM_EMAIL || "noreply@voicemail.app",
        To: to,
        Subject: subject,
        TextBody: textBody,
        HtmlBody: htmlBody,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Postmark API error: ${errorData.Message}`);
    }

    return true;
  } catch (error) {
    console.error("Postmark send error:", error);
    return false;
  }
}
