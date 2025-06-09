import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { processVoiceCommand, generateEmailSummary, processEmailForAudio } from "./lib/openai";
import { generateSpeech } from "./lib/elevenlabs";
import { processPostmarkWebhook, validatePostmarkWebhook } from "./lib/postmark";
import { insertEmailSchema, insertVoiceCommandSchema } from "@shared/schema";
import { openai } from "@ai-sdk/openai";
import { streamText, generateText, tool } from "ai";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Postmark webhook endpoint for receiving emails
  app.post("/api/webhooks/postmark", async (req, res) => {
    try {
      console.log("Postmark webhook received, payload size:", JSON.stringify(req.body).length, "bytes");
      const webhookData = req.body;

      if (!validatePostmarkWebhook(webhookData)) {
        console.error("Invalid webhook data:", webhookData);
        return res.status(400).json({ error: "Invalid webhook data" });
      }

      const processedEmail = processPostmarkWebhook(webhookData);
      console.log("Processed email data:", processedEmail);
      
      // Check if email already exists
      const existingEmail = await storage.getEmailByMessageId(processedEmail.messageId);
      if (existingEmail) {
        console.log("Email already exists:", processedEmail.messageId);
        return res.status(200).json({ message: "Email already processed" });
      }

      // Create email record
      const emailData = insertEmailSchema.parse({
        messageId: processedEmail.messageId,
        fromEmail: processedEmail.fromEmail,
        fromName: processedEmail.fromName,
        toEmail: processedEmail.toEmail,
        subject: processedEmail.subject,
        textContent: processedEmail.textContent,
        htmlContent: processedEmail.htmlContent,
        attachments: processedEmail.attachments,
        isForwarded: processedEmail.isForwarded || false,
        originalFrom: processedEmail.forwardedInfo?.originalFrom,
        originalFromName: processedEmail.forwardedInfo?.originalFromName,
        originalTo: processedEmail.forwardedInfo?.originalTo,
        originalDate: processedEmail.forwardedInfo?.originalDate,
        originalSubject: processedEmail.forwardedInfo?.originalSubject,
      });

      const email = await storage.createEmail(emailData);
      console.log("Email saved to database:", email.id);
      
      res.status(200).json({ message: "Email processed successfully", emailId: email.id });
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(500).json({ error: "Failed to process webhook" });
    }
  });

  // Test endpoint for Postmark webhook
  app.get("/api/webhooks/postmark/test", (req, res) => {
    res.json({ 
      message: "Postmark webhook endpoint is active",
      url: `${req.protocol}://${req.get('host')}/api/webhooks/postmark`,
      timestamp: new Date().toISOString()
    });
  });

  // Test forwarded email parsing with sample data
  app.post("/api/webhooks/postmark/test-forwarded", async (req, res) => {
    try {
      // Sample forwarded email from the user's example
      const sampleForwardedTextBody = `============ Forwarded message ============
From: Crossbeam product_marketing@getcrossbeam.com
To: abdussamad.bello@zulaiy.com
Date: Tue, 06 May 2025 18:13:17 +0100
Subject: Reminder: Explorer account functionality is changing soon
============ Forwarded message ============

This is the main content of the forwarded email...`;

      const sampleWebhookData = {
        MessageID: "test-forwarded-" + Date.now(),
        FromName: "abdussamad bello",
        From: "abdussamad.bello@zulaiy.com",
        To: "inbox@yourdomain.com",
        Subject: "Fwd: Reminder: Explorer account functionality is changing soon",
        TextBody: sampleForwardedTextBody,
        Date: new Date().toISOString(),
        Attachments: []
      };

      const processedEmail = processPostmarkWebhook(sampleWebhookData);
      
      res.json({
        message: "Forwarded email parsing test",
        originalWebhook: sampleWebhookData,
        processedEmail: processedEmail,
        forwardedInfo: processedEmail.forwardedInfo,
        isForwarded: processedEmail.isForwarded
      });
    } catch (error) {
      console.error("Forwarded email test error:", error);
      res.status(500).json({ error: "Failed to test forwarded email parsing" });
    }
  });

  // Simulate receiving an email (for testing purposes)
  app.post("/api/webhooks/postmark/simulate", async (req, res) => {
    try {
      const { from, fromName, subject, textBody, htmlBody } = req.body;
      
      if (!from || !subject) {
        return res.status(400).json({ error: "From and subject are required" });
      }

      // Create a simulated Postmark webhook payload
      const simulatedWebhook = {
        MessageID: `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        From: from,
        FromName: fromName || from.split('@')[0],
        To: "inbox@yourdomain.com",
        Subject: subject,
        TextBody: textBody || `This is a simulated email from ${from}`,
        HtmlBody: htmlBody,
        Date: new Date().toISOString(),
        Attachments: [],
        Headers: [
          { Name: "X-Simulated", Value: "true" }
        ]
      };

      // Process the simulated webhook
      const processedEmail = processPostmarkWebhook(simulatedWebhook);
      
      // Check if email already exists
      const existingEmail = await storage.getEmailByMessageId(processedEmail.messageId);
      if (existingEmail) {
        return res.status(200).json({ message: "Email already processed" });
      }

      // Create email record
      const emailData = insertEmailSchema.parse({
        messageId: processedEmail.messageId,
        fromEmail: processedEmail.fromEmail,
        fromName: processedEmail.fromName,
        toEmail: processedEmail.toEmail,
        subject: processedEmail.subject,
        textContent: processedEmail.textContent,
        htmlContent: processedEmail.htmlContent,
        attachments: processedEmail.attachments,
        isForwarded: processedEmail.isForwarded || false,
        originalFrom: processedEmail.forwardedInfo?.originalFrom,
        originalFromName: processedEmail.forwardedInfo?.originalFromName,
        originalTo: processedEmail.forwardedInfo?.originalTo,
        originalDate: processedEmail.forwardedInfo?.originalDate,
        originalSubject: processedEmail.forwardedInfo?.originalSubject,
      });

      const email = await storage.createEmail(emailData);
      console.log("Simulated email saved:", email.id);
      
      res.status(200).json({ 
        message: "Simulated email processed successfully", 
        emailId: email.id,
        email: email
      });
    } catch (error) {
      console.error("Simulated email error:", error);
      res.status(500).json({ error: "Failed to process simulated email" });
    }
  });

  // Get emails with optional filters
  app.get("/api/emails", async (req, res) => {
    try {
      const {
        isRead,
        isImportant,
        isDeleted = "false",
        limit = "50",
        offset = "0"
      } = req.query;

      const filters = {
        isRead: isRead === "true" ? true : isRead === "false" ? false : undefined,
        isImportant: isImportant === "true" ? true : isImportant === "false" ? false : undefined,
        isDeleted: isDeleted === "true",
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      const emails = await storage.getEmails(filters);
      const unreadCount = await storage.getUnreadCount();

      res.json({ emails, unreadCount });
    } catch (error) {
      console.error("Get emails error:", error);
      res.status(500).json({ error: "Failed to fetch emails" });
    }
  });

  // Get specific email
  app.get("/api/emails/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const email = await storage.getEmailById(id);
      
      if (!email) {
        return res.status(404).json({ error: "Email not found" });
      }

      res.json(email);
    } catch (error) {
      console.error("Get email error:", error);
      res.status(500).json({ error: "Failed to fetch email" });
    }
  });

  // Update email (mark as read, important, etc.)
  app.put("/api/emails/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      const email = await storage.updateEmail(id, updates);
      
      if (!email) {
        return res.status(404).json({ error: "Email not found" });
      }

      res.json(email);
    } catch (error) {
      console.error("Update email error:", error);
      res.status(500).json({ error: "Failed to update email" });
    }
  });

  // Delete email
  app.delete("/api/emails/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteEmail(id);
      
      if (!success) {
        return res.status(404).json({ error: "Email not found" });
      }

      res.json({ message: "Email deleted successfully" });
    } catch (error) {
      console.error("Delete email error:", error);
      res.status(500).json({ error: "Failed to delete email" });
    }
  });

  // Search emails
  app.get("/api/emails/search/:query", async (req, res) => {
    try {
      const query = req.params.query;
      const emails = await storage.searchEmails(query);
      
      res.json({ emails, count: emails.length });
    } catch (error) {
      console.error("Search emails error:", error);
      res.status(500).json({ error: "Failed to search emails" });
    }
  });

  // Process voice command
  app.post("/api/voice/command", async (req, res) => {
    try {
      const { transcript } = req.body;
      
      if (!transcript || typeof transcript !== 'string') {
        return res.status(400).json({ error: "Transcript is required" });
      }

      // Process with OpenAI
      console.log('Voice transcript received:', transcript);
      const intent = await processVoiceCommand(transcript);
      console.log('Processed intent:', intent);
      
      // Log the command
      const commandData = insertVoiceCommandSchema.parse({
        transcript,
        intent: intent.action,
        confidence: Math.round(intent.confidence * 100),
        success: intent.action !== 'unknown',
      });
      
      await storage.createVoiceCommand(commandData);

      // Execute the command based on intent
      let result: any = { intent };
      
      console.log('Processing voice command with action:', intent.action);

      switch (intent.action) {
        case 'read_emails':
        case 'get_unread':
        case 'get_read':
          const emails = await storage.getEmails({
            isRead: intent.action === 'get_unread' ? false : intent.action === 'get_read' ? true : undefined,
            isDeleted: false,
            limit: 5
          });
          
          if (emails.length > 0) {
            const summary = await generateEmailSummary(emails);
            result.emails = emails;
            result.summary = summary;
          } else {
            result.summary = intent.action === 'get_unread' 
              ? "Great news! You're all caught up - no unread emails in your inbox."
              : intent.action === 'get_read'
                ? "You don't have any read emails in your inbox."
                : "Your inbox is empty right now.";
          }
          break;
          
        case 'search_emails':
          if (intent.parameters?.sender) {
            const searchResults = await storage.searchEmails(intent.parameters.sender);
            result.emails = searchResults;
            if (searchResults.length > 0) {
              const summary = await generateEmailSummary(searchResults);
              result.summary = `I found ${searchResults.length} email${searchResults.length > 1 ? 's' : ''} from ${intent.parameters.sender}. ${summary}`;
            } else {
              result.summary = `I couldn't find any emails from ${intent.parameters.sender}. Double-check the name or try searching for something else.`;
            }
          } else if (intent.parameters?.query) {
            const searchResults = await storage.searchEmails(intent.parameters.query);
            result.emails = searchResults;
            if (searchResults.length > 0) {
              const summary = await generateEmailSummary(searchResults);
              result.summary = `I found ${searchResults.length} email${searchResults.length > 1 ? 's' : ''} matching "${intent.parameters.query}". ${summary}`;
            } else {
              result.summary = `No emails found for "${intent.parameters.query}". Try different keywords or check the spelling.`;
            }
          } else {
            result.summary = "What would you like me to search for? You can say something like 'find emails from Sarah' or 'search for meeting emails'.";
          }
          break;
          
        case 'mark_as_read':
          if (intent.parameters?.all) {
            const unreadEmails = await storage.getEmails({ isRead: false, isDeleted: false });
            for (const email of unreadEmails) {
              await storage.updateEmail(email.id, { isRead: true });
            }
            result.summary = unreadEmails.length > 0 
              ? `Perfect! I've marked all ${unreadEmails.length} unread emails as read. Your inbox is now clean.`
              : "You're already all caught up - no unread emails to mark!";
          } else if (intent.parameters?.emailId) {
            await storage.updateEmail(intent.parameters.emailId, { isRead: true });
            result.summary = "Done! Marked that email as read.";
          } else {
            result.summary = "I'd be happy to mark emails as read. Just let me know which ones - you can say 'mark all as read' or specify particular emails.";
          }
          break;
          
        case 'delete_emails':
          if (intent.parameters?.all) {
            const allEmails = await storage.getEmails({ isDeleted: false });
            for (const email of allEmails) {
              await storage.updateEmail(email.id, { isDeleted: true });
            }
            result.summary = allEmails.length > 0
              ? `I've deleted all ${allEmails.length} emails from your inbox. Your inbox is now completely clean.`
              : "Your inbox is already empty - nothing to delete.";
          } else if (intent.parameters?.emailId) {
            await storage.updateEmail(intent.parameters.emailId, { isDeleted: true });
            result.summary = "Email deleted successfully.";
          } else {
            result.summary = "I can help you delete emails. Just specify which ones - you can say 'delete all emails' or mention specific emails.";
          }
          break;
          
        case 'mark_important':
          if (intent.parameters?.all) {
            const emails = await storage.getEmails({ isDeleted: false });
            for (const email of emails) {
              await storage.updateEmail(email.id, { isImportant: true });
            }
            result.summary = `Marked all ${emails.length} emails as important.`;
          } else if (intent.parameters?.emailId && typeof intent.parameters.emailId === 'number') {
            await storage.updateEmail(intent.parameters.emailId, { isImportant: true });
            result.summary = "Email marked as important.";
          } else {
            const recentEmails = await storage.getEmails({ isDeleted: false, limit: 1 });
            if (recentEmails.length > 0) {
              await storage.updateEmail(recentEmails[0].id, { isImportant: true });
              result.summary = "Most recent email marked as important.";
            } else {
              result.summary = "No emails found to mark as important.";
            }
          }
          break;

        case 'get_important':
          const importantEmails = await storage.getEmails({ isImportant: true, isDeleted: false });
          result.emails = importantEmails;
          if (importantEmails.length > 0) {
            const summary = await generateEmailSummary(importantEmails);
            result.summary = `You have ${importantEmails.length} important email${importantEmails.length > 1 ? 's' : ''}. ${summary}`;
          } else {
            result.summary = "You don't have any emails marked as important right now.";
          }
          break;

        case 'get_recent':
          const timeframe = intent.parameters?.timeframe || 'recent';
          const recentEmails = await storage.getEmails({ isDeleted: false, limit: 10 });
          result.emails = recentEmails;
          if (recentEmails.length > 0) {
            const summary = await generateEmailSummary(recentEmails);
            result.summary = `Here are your ${timeframe} emails. ${summary}`;
          } else {
            result.summary = "No recent emails found.";
          }
          break;

        case 'archive_emails':
          if (intent.parameters?.all) {
            const emails = await storage.getEmails({ isDeleted: false });
            for (const email of emails) {
              await storage.updateEmail(email.id, { isDeleted: true });
            }
            result.summary = `Archived all ${emails.length} emails. Your inbox is now clean.`;
          } else if (intent.parameters?.query) {
            const searchResults = await storage.searchEmails(intent.parameters.query);
            for (const email of searchResults) {
              await storage.updateEmail(email.id, { isDeleted: true });
            }
            result.summary = `Archived ${searchResults.length} emails matching "${intent.parameters.query}".`;
          } else {
            result.summary = "Which emails would you like to archive? You can say 'archive all emails' or 'archive emails from Sarah'.";
          }
          break;

        case 'compose_email':
          const recipient = intent.parameters?.recipient || 'someone';
          const message = intent.parameters?.message || '';
          result.summary = `I'd love to help you compose an email to ${recipient}. Email composition features are coming soon. For now, you can manage your existing emails.`;
          break;

        case 'reply_email':
          result.summary = "Email reply features are coming soon. I can help you read, search, and organize your current emails.";
          break;

        case 'forward_email':
          const forwardRecipient = intent.parameters?.recipient || 'someone';
          result.summary = `Email forwarding to ${forwardRecipient} will be available soon. I can help you manage your current inbox.`;
          break;

        case 'restore_emails':
        case 'unarchive_emails':
          if (intent.parameters?.all) {
            const archivedEmails = await storage.getEmails({ isDeleted: true });
            for (const email of archivedEmails) {
              await storage.updateEmail(email.id, { isDeleted: false });
            }
            result.summary = `Restored ${archivedEmails.length} emails from archive back to your inbox.`;
          } else if (intent.parameters?.sender) {
            const archivedEmails = await storage.getEmails({ isDeleted: true });
            const senderName = intent.parameters.sender;
            const senderEmails = archivedEmails.filter(email => 
              email.fromEmail.toLowerCase().includes(senderName.toLowerCase()) ||
              (email.fromName && email.fromName.toLowerCase().includes(senderName.toLowerCase()))
            );
            for (const email of senderEmails) {
              await storage.updateEmail(email.id, { isDeleted: false });
            }
            result.summary = `Restored ${senderEmails.length} archived emails from ${senderName} back to your inbox.`;
          } else if (intent.parameters?.query) {
            const searchResults = await storage.searchEmails(intent.parameters.query);
            const archivedResults = searchResults.filter(email => email.isDeleted);
            for (const email of archivedResults) {
              await storage.updateEmail(email.id, { isDeleted: false });
            }
            result.summary = `Restored ${archivedResults.length} archived emails matching "${intent.parameters.query}" back to your inbox.`;
          } else {
            result.summary = "Which archived emails would you like to restore? You can say 'restore all archived emails' or 'restore emails from Sarah'.";
          }
          break;

        case 'mark_unread':
          if (intent.parameters?.all) {
            const emails = await storage.getEmails({ isDeleted: false });
            for (const email of emails) {
              await storage.updateEmail(email.id, { isRead: false });
            }
            result.summary = `Marked all ${emails.length} emails as unread.`;
          } else if (intent.parameters?.emailId && typeof intent.parameters.emailId === 'number') {
            await storage.updateEmail(intent.parameters.emailId, { isRead: false });
            result.summary = "Email marked as unread.";
          } else {
            const recentEmails = await storage.getEmails({ isDeleted: false, limit: 1 });
            if (recentEmails.length > 0) {
              await storage.updateEmail(recentEmails[0].id, { isRead: false });
              result.summary = "Most recent email marked as unread.";
            } else {
              result.summary = "No emails found to mark as unread.";
            }
          }
          break;

        case 'remove_important':
          if (intent.parameters?.all) {
            const importantEmails = await storage.getEmails({ isImportant: true, isDeleted: false });
            for (const email of importantEmails) {
              await storage.updateEmail(email.id, { isImportant: false });
            }
            result.summary = `Removed important flag from ${importantEmails.length} emails.`;
          } else if (intent.parameters?.emailId && typeof intent.parameters.emailId === 'number') {
            await storage.updateEmail(intent.parameters.emailId, { isImportant: false });
            result.summary = "Removed important flag from email.";
          } else {
            const importantEmails = await storage.getEmails({ isImportant: true, isDeleted: false, limit: 1 });
            if (importantEmails.length > 0) {
              await storage.updateEmail(importantEmails[0].id, { isImportant: false });
              result.summary = "Removed important flag from most recent important email.";
            } else {
              result.summary = "No important emails found to modify.";
            }
          }
          break;

        case 'get_archived':
          const archivedEmails = await storage.getEmails({ isDeleted: true });
          result.emails = archivedEmails;
          if (archivedEmails.length > 0) {
            const summary = await generateEmailSummary(archivedEmails);
            result.summary = `You have ${archivedEmails.length} archived email${archivedEmails.length > 1 ? 's' : ''}. ${summary}`;
          } else {
            result.summary = "You don't have any archived emails.";
          }
          break;

        case 'permanently_delete':
          if (intent.parameters?.all) {
            const archivedEmails = await storage.getEmails({ isDeleted: true });
            for (const email of archivedEmails) {
              await storage.deleteEmail(email.id);
            }
            result.summary = `Permanently deleted ${archivedEmails.length} archived emails. This action cannot be undone.`;
          } else if (intent.parameters?.query) {
            const archivedEmails = await storage.getEmails({ isDeleted: true });
            const queryTerm = intent.parameters.query;
            const matchingEmails = archivedEmails.filter(email => 
              email.subject.toLowerCase().includes(queryTerm.toLowerCase()) ||
              (email.textContent && email.textContent.toLowerCase().includes(queryTerm.toLowerCase()))
            );
            for (const email of matchingEmails) {
              await storage.deleteEmail(email.id);
            }
            result.summary = `Permanently deleted ${matchingEmails.length} emails matching "${queryTerm}". This action cannot be undone.`;
          } else {
            result.summary = "Which emails would you like to permanently delete? You can say 'permanently delete all archived emails' or specify a search term.";
          }
          break;

        case 'switch_tab':
          const tabName = intent.parameters?.tab || 'all';
          result.summary = `Switched to ${tabName} tab. You can now see your ${tabName} emails.`;
          result.switchTab = tabName;
          break;

        default:
          result.summary = "I can help you read emails, search, mark as read/unread/important, archive/restore emails, switch tabs, or permanently delete them. What would you like me to do?";
      }

      res.json(result);
    } catch (error) {
      console.error("Voice command error:", error);
      res.status(500).json({ error: "Failed to process voice command" });
    }
  });

  // Generate speech from text
  app.post("/api/voice/speak", async (req, res) => {
    try {
      console.log('Speech request received:', { body: req.body, textType: typeof req.body.text, textLength: req.body.text?.length });
      let { text, voiceSettings } = req.body;
      
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        console.log('Invalid text parameter:', { text, type: typeof text });
        return res.status(400).json({ error: "Text is required and must be a non-empty string" });
      }

      // Truncate text if it exceeds ElevenLabs limit (10,000 characters)
      const MAX_LENGTH = 9500; // Leave buffer for safety
      if (text.length > MAX_LENGTH) {
        text = text.substring(0, MAX_LENGTH) + '... Content truncated for audio playback.';
        console.log('Text truncated from', req.body.text.length, 'to', text.length, 'characters');
      }

      console.log('Generating speech for text:', text.substring(0, 100) + '...');
      
      // Use voice manager for intelligent fallback
      const { voiceManager } = await import('./lib/voice-manager');
      const result = await voiceManager.generateSpeechWithFallback(text, voiceSettings);
      
      if (result.audioBuffer) {
        // ElevenLabs success
        res.set({
          'Content-Type': 'audio/mpeg',
          'Content-Length': result.audioBuffer.length.toString(),
        });
        res.send(result.audioBuffer);
      } else if (result.useWebSpeech) {
        // Web Speech API fallback
        res.json({ 
          useWebSpeech: true, 
          text: text,
          message: result.message || "Using browser speech synthesis due to service limitations"
        });
      } else {
        throw new Error('Failed to generate speech with any method');
      }
    } catch (error) {
      console.error("Text-to-speech error:", error);
      res.status(500).json({ error: "Failed to generate speech" });
    }
  });

  // Get voice quota status
  app.get("/api/voice/quota", async (req, res) => {
    try {
      const { voiceManager } = await import('./lib/voice-manager');
      const quotaInfo = await voiceManager.checkQuotaStatus();
      
      if (quotaInfo) {
        res.json({
          ...quotaInfo,
          percentageUsed: Math.round((quotaInfo.charactersUsed / quotaInfo.charactersLimit) * 100),
          status: quotaInfo.charactersRemaining > 1000 ? 'available' : 
                  quotaInfo.charactersRemaining > 0 ? 'low' : 'exceeded'
        });
      } else {
        res.json({ 
          status: 'unavailable',
          message: 'ElevenLabs quota information not available'
        });
      }
    } catch (error) {
      console.error("Get voice quota error:", error);
      res.status(500).json({ error: "Failed to fetch voice quota" });
    }
  });

  // Get voice command history
  app.get("/api/voice/history", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const commands = await storage.getVoiceCommands(limit);
      
      res.json(commands);
    } catch (error) {
      console.error("Get voice history error:", error);
      res.status(500).json({ error: "Failed to fetch voice history" });
    }
  });

  // Summarize email content for audio playback
  app.post("/api/emails/summarize", async (req, res) => {
    try {
      const { emailId, content, subject, sender } = req.body;
      
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: "Email content is required" });
      }

      console.log('Summarizing email:', { emailId, subject, contentLength: content.length });

      // Use OpenAI to create a clean, readable summary
      const summary = await processEmailForAudio({
        content,
        subject: subject || 'Untitled',
        sender: sender || 'Unknown sender'
      });

      res.json({ summary });
    } catch (error) {
      console.error("Email summarization error:", error);
      res.status(500).json({ error: "Failed to summarize email" });
    }
  });

  // Define tools for AI chat with email operations
  const emailTools = {
    getEmails: tool({
      description: "Get emails with optional filters",
      parameters: z.object({
        isRead: z.boolean().optional().describe("Filter by read status"),
        isImportant: z.boolean().optional().describe("Filter by importance"),
        isDeleted: z.boolean().optional().describe("Filter by deleted status"),
        limit: z.number().optional().describe("Limit number of results"),
      }),
      execute: async (params) => {
        const emails = await storage.getEmails({ ...params, limit: Math.min(params.limit || 5, 5) });
        // Return only essential fields to reduce token usage
        const summarizedEmails = emails.map(email => ({
          id: email.id,
          fromEmail: email.fromEmail,
          fromName: email.fromName,
          subject: email.subject,
          isRead: email.isRead,
          isImportant: email.isImportant,
          receivedAt: email.receivedAt,
          // Truncate content to avoid token limits
          textContent: email.textContent ? email.textContent.substring(0, 200) + (email.textContent.length > 200 ? '...' : '') : null
        }));
        return { emails: summarizedEmails, count: emails.length };
      },
    }),

    markAsRead: tool({
      description: "Mark emails as read",
      parameters: z.object({
        emailIds: z.array(z.number()).describe("Array of email IDs to mark as read"),
      }),
      execute: async ({ emailIds }) => {
        const results = [];
        for (const id of emailIds) {
          const updated = await storage.updateEmail(id, { isRead: true });
          if (updated) results.push({ id: updated.id, isRead: updated.isRead });
        }
        return { success: true, updatedCount: results.length };
      },
    }),

    searchEmails: tool({
      description: "Search emails by query string",
      parameters: z.object({
        query: z.string().describe("Search query for email content, subject, or sender"),
      }),
      execute: async ({ query }) => {
        const emails = await storage.searchEmails(query);
        // Limit results and truncate content
        const limitedEmails = emails.slice(0, 5).map(email => ({
          id: email.id,
          fromEmail: email.fromEmail,
          fromName: email.fromName,
          subject: email.subject,
          isRead: email.isRead,
          isImportant: email.isImportant,
          receivedAt: email.receivedAt,
          textContent: email.textContent ? email.textContent.substring(0, 150) + (email.textContent.length > 150 ? '...' : '') : null
        }));
        return { emails: limitedEmails, count: emails.length };
      },
    }),
  };

  // Enhanced AI chat endpoint with streaming using AI SDK
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { messages } = req.body;
      console.log('AI chat request received:', { messageCount: messages?.length, lastMessage: messages?.[messages.length - 1] });

      // Use streamText with proper AI SDK streaming format
      const result = await streamText({
        model: openai("gpt-4o"),
        messages,
        tools: emailTools,
        maxSteps: 5,
        system: `You are a helpful voice assistant for an email application. 

IMPORTANT: Your responses will be converted to speech, so format them for spoken conversation:
- Use plain text only, no markdown formatting (*,**,#)
- Use natural spoken language
- Keep responses concise but informative
- Use "and" instead of bullet points
- Say numbers naturally (5 emails, not "five emails")

When users ask about emails, use the appropriate tools to get real data and provide conversational summaries.

Examples:
- "unread messages" → Use getEmails({isRead: false}), then summarize naturally
- "archived emails" → Use getEmails({isDeleted: true}), then summarize naturally  
- "important emails" → Use getEmails({isImportant: true}), then summarize naturally

Always provide specific counts and key details in a natural, spoken conversation style.`,
      });

      // Use the AI SDK's built-in streaming response handler
      result.pipeDataStreamToResponse(res);
    } catch (error) {
      console.error("AI chat error:", error);
      res.status(500).json({ error: "Failed to process chat request" });
    }
  });

  // Quick AI response endpoint
  app.post("/api/ai/generate", async (req, res) => {
    try {
      const { prompt } = req.body;

      const result = await generateText({
        model: openai("gpt-4o"), // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        prompt,
        tools: emailTools,
        system: `You are a helpful voice assistant for an email application. 

IMPORTANT: Your responses will be converted to speech, so use natural spoken language:
- Use plain text only, no markdown formatting
- Keep responses conversational and brief
- Use natural speech patterns
- When users ask about emails, use the tools to get real data
- Provide specific counts and details in spoken format`,
      });

      res.json({
        text: result.text,
        toolResults: result.toolResults,
        usage: result.usage,
      });
    } catch (error) {
      console.error("AI generate error:", error);
      res.status(500).json({ error: "Failed to generate response" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
