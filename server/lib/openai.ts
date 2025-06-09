import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "",
});

export interface VoiceCommandIntent {
  action: 'read_emails' | 'search_emails' | 'mark_as_read' | 'delete_emails' | 'get_unread' | 'get_read' | 'mark_important' | 'archive_emails' | 'compose_email' | 'get_recent' | 'get_important' | 'reply_email' | 'forward_email' | 'restore_emails' | 'unarchive_emails' | 'mark_unread' | 'remove_important' | 'permanently_delete' | 'get_archived' | 'switch_tab' | 'unknown';
  parameters?: {
    query?: string;
    emailId?: number;
    sender?: string;
    subject?: string;
    all?: boolean;
    recipient?: string;
    message?: string;
    timeframe?: string;
    tab?: 'all' | 'unread' | 'read' | 'important' | 'archived';
  };
  confidence: number;
}

export async function processVoiceCommand(transcript: string): Promise<VoiceCommandIntent> {
  try {
    const prompt = `
    You are a helpful AI assistant for an email management system. Parse natural conversational voice commands and determine the user's intent.

    The user speaks to you naturally, like they would to a human assistant. Examples:
    - "What emails haven't I read yet?" → get_unread
    - "Show me my read emails" → get_read
    - "Tell me about all my read emails" → get_read
    - "Can you find emails from Sarah?" → search_emails with sender: "Sarah"
    - "Please mark everything as read" → mark_as_read with all: true
    - "Read me the important emails" → get_important
    - "Mark this email as important" → mark_important
    - "Archive all old emails" → archive_emails with all: true
    - "Show me recent emails" → get_recent
    - "Restore archived emails" → restore_emails or unarchive_emails
    - "Mark email as unread" → mark_unread
    - "Remove important flag" → remove_important
    - "Show me archived emails" → get_archived
    - "Permanently delete emails" → permanently_delete
    - "Delete spam emails" → delete_emails with query: "spam"
    - "Unarchive emails from John" → restore_emails with sender: "John"
    - "Mark all emails as unread" → mark_unread with all: true
    - "Switch to unread tab" → switch_tab with tab: "unread"
    - "Switch to read emails" → switch_tab with tab: "read"
    - "Show important emails" → switch_tab with tab: "important"
    - "Go to archived emails" → switch_tab with tab: "archived"

    Voice command: "${transcript}"
    
    Available actions:
    - read_emails: User wants to hear/see their emails
    - search_emails: User wants to find specific emails
    - mark_as_read: User wants to mark emails as read
    - delete_emails: User wants to delete emails  
    - get_unread: User wants to see only unread emails
    - get_read: User wants to see only read emails
    - mark_important: User wants to mark emails as important
    - archive_emails: User wants to archive emails
    - compose_email: User wants to create a new email
    - get_recent: User wants to see recent emails
    - get_important: User wants to see important emails
    - reply_email: User wants to reply to an email
    - forward_email: User wants to forward an email
    - restore_emails: User wants to restore archived emails back to inbox
    - unarchive_emails: User wants to unarchive emails (same as restore)
    - mark_unread: User wants to mark emails as unread
    - remove_important: User wants to remove important flag from emails
    - permanently_delete: User wants to permanently delete emails
    - get_archived: User wants to see archived emails
    - switch_tab: User wants to navigate to a specific email tab/view
    - unknown: Command doesn't match any available action

    Extract parameters from natural speech:
    - query: search terms, keywords like "important", "urgent", subject keywords
    - emailId: specific email ID if mentioned
    - sender: sender's name (first name is enough)
    - subject: subject keywords
    - recipient: email recipient for compose/reply/forward actions
    - message: email content for compose actions
    - timeframe: time period like "today", "week", "month"
    - all: true for phrases like "all emails", "everything", "all of them"

    Be flexible with natural language - users say things like "what do I have", "show me", "can you", "please", etc.
    
    Return JSON in this format:
    {
      "action": "action_name",
      "parameters": {
        "query": "search term if applicable",
        "emailId": number if specific email,
        "sender": "sender name if specified", 
        "subject": "subject keywords if specified",
        "all": boolean if applying to all emails
      },
      "confidence": 0.0-1.0
    }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a helpful AI assistant that interprets natural conversational voice commands for email management. Be flexible with natural language patterns and respond only with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      action: result.action || 'unknown',
      parameters: result.parameters || {},
      confidence: Math.max(0, Math.min(1, result.confidence || 0.5))
    };
  } catch (error) {
    console.error('OpenAI API error:', error);
    return {
      action: 'unknown',
      confidence: 0,
    };
  }
}

export async function generateEmailSummary(emails: any[]): Promise<string> {
  try {
    if (emails.length === 0) {
      return "You don't have any emails to show you right now.";
    }

    const emailData = emails.map(email => ({
      from: email.fromName || email.fromEmail,
      subject: email.subject,
      preview: email.textContent?.substring(0, 150),
      isImportant: email.isImportant,
      isRead: email.isRead
    }));

    const prompt = `
    You are a helpful AI email assistant speaking to the user. Create a natural, conversational summary of these emails as if you're personally telling them about their messages.

    Emails to summarize:
    ${JSON.stringify(emailData, null, 2)}

    Guidelines:
    - Sound like a helpful personal assistant
    - Use conversational language ("You have...", "There's an email from...", "Sarah sent you...")
    - Mention important details: sender names, key subjects, urgency
    - Highlight important or unread emails
    - Keep it flowing and natural for voice playback
    - Be concise but informative
    - If there are many emails, focus on the most important ones first

    Example style: "You have 3 emails. First, Sarah Johnson sent you a meeting reminder about tomorrow's project kickoff at 2 PM. Then there's an important quarterly sales report from John Smith that needs your review by Friday. And you got a tech newsletter about AI voice technology breakthroughs."
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a helpful AI assistant that creates natural, conversational email summaries for voice playback. Sound like a personal assistant speaking directly to the user."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
    });

    return response.choices[0].message.content || "I couldn't create a summary of your emails right now.";
  } catch (error) {
    console.error('OpenAI summary error:', error);
    return "I'm having trouble summarizing your emails at the moment.";
  }
}

export async function processEmailForAudio(email: {
  content: string;
  subject: string;
  sender: string;
}): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are an AI assistant that converts email content into clean, natural speech text for audio playback. 

Guidelines:
- Remove all URLs, links, and HTML markup
- Convert the content into clear, conversational language
- Focus on the main message and key points
- Ignore promotional footers, unsubscribe links, and tracking elements
- Keep it concise but include all important information
- Use natural speech patterns (e.g., "The sender mentions..." instead of raw text)
- For newsletters or promotional emails, summarize the key offers or information
- Make it sound like a person is telling you about the email content`
        },
        {
          role: "user",
          content: `Please convert this email into natural speech text for audio playback:

From: ${email.sender}
Subject: ${email.subject}

Content:
${email.content}`
        }
      ],
      max_tokens: 800
    });

    const cleanedContent = response.choices[0].message.content || "";
    
    // Add a natural introduction
    const audioText = `Email from ${email.sender} about ${email.subject}. ${cleanedContent}`;
    
    return audioText;
  } catch (error) {
    console.error("Error processing email for audio:", error);
    
    // Fallback to basic cleaning if OpenAI fails
    let fallbackContent = email.content
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
      .replace(/[=]{3,}/g, '') // Remove separator lines
      .replace(/\n{3,}/g, '\n\n') // Reduce line breaks
      .replace(/[^\w\s.,!?;:'"()-]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    return `Email from ${email.sender} about ${email.subject}. ${fallbackContent.substring(0, 1000)}`;
  }
}
