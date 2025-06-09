import { users, emails, voiceCommands, type User, type InsertUser, type Email, type InsertEmail, type VoiceCommand, type InsertVoiceCommand } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, ilike } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Email operations
  getEmails(filters?: {
    isRead?: boolean;
    isImportant?: boolean;
    isDeleted?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Email[]>;
  getEmailById(id: number): Promise<Email | undefined>;
  getEmailByMessageId(messageId: string): Promise<Email | undefined>;
  createEmail(email: InsertEmail): Promise<Email>;
  updateEmail(id: number, updates: Partial<Email>): Promise<Email | undefined>;
  deleteEmail(id: number): Promise<boolean>;
  searchEmails(query: string): Promise<Email[]>;
  getUnreadCount(): Promise<number>;

  // Voice command operations
  createVoiceCommand(command: InsertVoiceCommand): Promise<VoiceCommand>;
  getVoiceCommands(limit?: number): Promise<VoiceCommand[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getEmails(filters?: {
    isRead?: boolean;
    isImportant?: boolean;
    isDeleted?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Email[]> {
    const conditions = [];
    
    if (filters) {
      if (filters.isRead !== undefined) {
        conditions.push(eq(emails.isRead, filters.isRead));
      }
      if (filters.isImportant !== undefined) {
        conditions.push(eq(emails.isImportant, filters.isImportant));
      }
      if (filters.isDeleted !== undefined) {
        conditions.push(eq(emails.isDeleted, filters.isDeleted));
      }
    }
    
    let query = db.select().from(emails);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(emails.receivedAt));
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    return await query;
  }

  async getEmailById(id: number): Promise<Email | undefined> {
    const [email] = await db.select().from(emails).where(eq(emails.id, id));
    return email || undefined;
  }

  async getEmailByMessageId(messageId: string): Promise<Email | undefined> {
    const [email] = await db.select().from(emails).where(eq(emails.messageId, messageId));
    return email || undefined;
  }

  async createEmail(insertEmail: InsertEmail): Promise<Email> {
    const [email] = await db
      .insert(emails)
      .values(insertEmail)
      .returning();
    return email;
  }

  async updateEmail(id: number, updates: Partial<Email>): Promise<Email | undefined> {
    const [email] = await db
      .update(emails)
      .set(updates)
      .where(eq(emails.id, id))
      .returning();
    return email || undefined;
  }

  async deleteEmail(id: number): Promise<boolean> {
    const result = await db.delete(emails).where(eq(emails.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async searchEmails(query: string): Promise<Email[]> {
    const searchTerm = `%${query.toLowerCase()}%`;
    
    return await db
      .select()
      .from(emails)
      .where(
        and(
          eq(emails.isDeleted, false),
          or(
            ilike(emails.subject, searchTerm),
            ilike(emails.fromEmail, searchTerm),
            ilike(emails.fromName, searchTerm),
            ilike(emails.textContent, searchTerm)
          )
        )
      )
      .orderBy(desc(emails.receivedAt));
  }

  async getUnreadCount(): Promise<number> {
    const result = await db
      .select({ count: emails.id })
      .from(emails)
      .where(and(eq(emails.isRead, false), eq(emails.isDeleted, false)));
    
    return result.length;
  }

  async createVoiceCommand(insertVoiceCommand: InsertVoiceCommand): Promise<VoiceCommand> {
    const [voiceCommand] = await db
      .insert(voiceCommands)
      .values(insertVoiceCommand)
      .returning();
    return voiceCommand;
  }

  async getVoiceCommands(limit = 50): Promise<VoiceCommand[]> {
    return await db
      .select()
      .from(voiceCommands)
      .orderBy(desc(voiceCommands.executedAt))
      .limit(limit);
  }
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private emails: Map<number, Email>;
  private voiceCommands: Map<number, VoiceCommand>;
  private currentUserId: number;
  private currentEmailId: number;
  private currentVoiceCommandId: number;

  constructor() {
    this.users = new Map();
    this.emails = new Map();
    this.voiceCommands = new Map();
    this.currentUserId = 1;
    this.currentEmailId = 1;
    this.currentVoiceCommandId = 1;
    
    // Add sample emails for demonstration
    this.initializeSampleEmails();
  }

  private initializeSampleEmails() {
    const sampleEmails = [
      {
        messageId: "sample-1",
        fromEmail: "john.smith@company.com",
        fromName: "John Smith",
        toEmail: "user@voicemail.app",
        subject: "Quarterly Sales Report - Action Required",
        textContent: "Hi there, I've attached the quarterly sales report that we discussed in yesterday's meeting. Please review the numbers in section 3 and let me know your thoughts on the projected growth for Q4. The deadline for feedback is Friday. Thanks!",
        htmlContent: "<p>Hi there,</p><p>I've attached the quarterly sales report that we discussed in yesterday's meeting. Please review the numbers in section 3 and let me know your thoughts on the projected growth for Q4.</p><p>The deadline for feedback is Friday.</p><p>Thanks!</p>",
        attachments: ["Q3_Sales_Report.pdf"],
        isRead: false,
        isImportant: true,
        isDeleted: false,
      },
      {
        messageId: "sample-2",
        fromEmail: "sarah.johnson@techcorp.com",
        fromName: "Sarah Johnson",
        toEmail: "user@voicemail.app",
        subject: "Meeting Reminder: Project Kickoff Tomorrow",
        textContent: "Just a quick reminder about our project kickoff meeting tomorrow at 2 PM. We'll be discussing the new AI initiative and your role in the development phase. Please bring any questions you might have about the technical requirements.",
        htmlContent: "<p>Just a quick reminder about our project kickoff meeting tomorrow at 2 PM.</p><p>We'll be discussing the new AI initiative and your role in the development phase. Please bring any questions you might have about the technical requirements.</p>",
        attachments: [],
        isRead: false,
        isImportant: false,
        isDeleted: false,
      },
      {
        messageId: "sample-3",
        fromEmail: "marketing@newsletter.com",
        fromName: "Tech Weekly",
        toEmail: "user@voicemail.app",
        subject: "This Week in AI: Voice Technology Breakthroughs",
        textContent: "Welcome to this week's edition of Tech Weekly! This week we're covering the latest breakthroughs in voice technology, including new AI models that can understand context better than ever before. We also have an exclusive interview with the team behind the latest speech synthesis improvements.",
        htmlContent: "<h2>Welcome to this week's edition of Tech Weekly!</h2><p>This week we're covering the latest breakthroughs in voice technology, including new AI models that can understand context better than ever before.</p><p>We also have an exclusive interview with the team behind the latest speech synthesis improvements.</p>",
        attachments: [],
        isRead: true,
        isImportant: false,
        isDeleted: false,
      },
      {
        messageId: "sample-4",
        fromEmail: "support@cloudservice.com",
        fromName: "Cloud Service Support",
        toEmail: "user@voicemail.app",
        subject: "Your Monthly Usage Report",
        textContent: "Your monthly usage report for November is ready. You've used 45% of your allocated storage and 32% of your compute resources. All systems are running optimally. If you need to upgrade your plan, please contact our sales team.",
        htmlContent: "<p>Your monthly usage report for November is ready.</p><ul><li>Storage: 45% used</li><li>Compute: 32% used</li></ul><p>All systems are running optimally. If you need to upgrade your plan, please contact our sales team.</p>",
        attachments: ["November_Usage_Report.pdf"],
        isRead: true,
        isImportant: false,
        isDeleted: false,
      },
      {
        messageId: "sample-5",
        fromEmail: "team@startup.io",
        fromName: "Innovation Team",
        toEmail: "user@voicemail.app",
        subject: "Urgent: API Key Rotation Required",
        textContent: "URGENT: We need to rotate all API keys by end of day due to a security audit requirement. Please update your applications with the new keys that will be provided in a separate secure email. Contact IT if you need assistance with the rotation process.",
        htmlContent: "<p><strong>URGENT:</strong> We need to rotate all API keys by end of day due to a security audit requirement.</p><p>Please update your applications with the new keys that will be provided in a separate secure email.</p><p>Contact IT if you need assistance with the rotation process.</p>",
        attachments: [],
        isRead: false,
        isImportant: true,
        isDeleted: false,
      }
    ];

    sampleEmails.forEach((emailData, index) => {
      const id = this.currentEmailId++;
      const email = {
        ...emailData,
        id,
        receivedAt: new Date(Date.now() - (index * 3600000)), // Stagger emails by hours
      };
      this.emails.set(id, email);
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getEmails(filters?: {
    isRead?: boolean;
    isImportant?: boolean;
    isDeleted?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Email[]> {
    let emailsArray = Array.from(this.emails.values());

    if (filters) {
      if (filters.isRead !== undefined) {
        emailsArray = emailsArray.filter(email => email.isRead === filters.isRead);
      }
      if (filters.isImportant !== undefined) {
        emailsArray = emailsArray.filter(email => email.isImportant === filters.isImportant);
      }
      if (filters.isDeleted !== undefined) {
        emailsArray = emailsArray.filter(email => email.isDeleted === filters.isDeleted);
      }
    }

    // Sort by received date (newest first)
    emailsArray.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

    const offset = filters?.offset || 0;
    const limit = filters?.limit || 50;
    
    return emailsArray.slice(offset, offset + limit);
  }

  async getEmailById(id: number): Promise<Email | undefined> {
    return this.emails.get(id);
  }

  async getEmailByMessageId(messageId: string): Promise<Email | undefined> {
    return Array.from(this.emails.values()).find(
      (email) => email.messageId === messageId,
    );
  }

  async createEmail(insertEmail: InsertEmail): Promise<Email> {
    const id = this.currentEmailId++;
    const email: Email = {
      ...insertEmail,
      id,
      receivedAt: new Date(),
    };
    this.emails.set(id, email);
    return email;
  }

  async updateEmail(id: number, updates: Partial<Email>): Promise<Email | undefined> {
    const email = this.emails.get(id);
    if (!email) return undefined;

    const updatedEmail = { ...email, ...updates };
    this.emails.set(id, updatedEmail);
    return updatedEmail;
  }

  async deleteEmail(id: number): Promise<boolean> {
    return this.emails.delete(id);
  }

  async searchEmails(query: string): Promise<Email[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.emails.values()).filter(email =>
      !email.isDeleted && (
        email.subject.toLowerCase().includes(lowerQuery) ||
        email.fromEmail.toLowerCase().includes(lowerQuery) ||
        email.fromName?.toLowerCase().includes(lowerQuery) ||
        email.textContent?.toLowerCase().includes(lowerQuery)
      )
    );
  }

  async getUnreadCount(): Promise<number> {
    return Array.from(this.emails.values()).filter(
      email => !email.isRead && !email.isDeleted
    ).length;
  }

  async createVoiceCommand(insertVoiceCommand: InsertVoiceCommand): Promise<VoiceCommand> {
    const id = this.currentVoiceCommandId++;
    const voiceCommand: VoiceCommand = {
      ...insertVoiceCommand,
      id,
      executedAt: new Date(),
    };
    this.voiceCommands.set(id, voiceCommand);
    return voiceCommand;
  }

  async getVoiceCommands(limit = 50): Promise<VoiceCommand[]> {
    return Array.from(this.voiceCommands.values())
      .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
      .slice(0, limit);
  }
}

export const storage = new DatabaseStorage();
