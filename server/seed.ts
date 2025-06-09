import { db } from "./db";
import { emails } from "@shared/schema";

export async function seedDatabase() {
  // Check if emails already exist
  const existingEmails = await db.select().from(emails).limit(1);
  if (existingEmails.length > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  console.log("Seeding database with sample emails...");

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

  try {
    await db.insert(emails).values(sampleEmails);
    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}