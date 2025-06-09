import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, Send, Globe, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export default function EmailReceiver() {
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [subject, setSubject] = useState("");
  const [textBody, setTextBody] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const testWebhookMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/webhooks/postmark/test");
      return response.json();
    },
    onSuccess: (data) => {
      setWebhookUrl(data.url);
      toast({
        title: "Webhook Status",
        description: "Postmark webhook endpoint is active and ready to receive emails.",
      });
    },
    onError: () => {
      toast({
        title: "Webhook Test Failed",
        description: "Unable to test webhook endpoint.",
        variant: "destructive",
      });
    },
  });

  const simulateEmailMutation = useMutation({
    mutationFn: async (emailData: {
      from: string;
      fromName?: string;
      subject: string;
      textBody?: string;
      htmlBody?: string;
    }) => {
      const response = await apiRequest("POST", "/api/webhooks/postmark/simulate", emailData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Email Received",
        description: `Successfully processed email with ID: ${data.emailId}`,
      });
      
      // Clear form
      setFromEmail("");
      setFromName("");
      setSubject("");
      setTextBody("");
      setHtmlBody("");
      
      // Refresh emails list
      queryClient.invalidateQueries({ queryKey: ["/api/emails"] });
    },
    onError: (error: any) => {
      toast({
        title: "Email Processing Failed",
        description: error.message || "Failed to process email.",
        variant: "destructive",
      });
    },
  });

  const handleTestWebhook = () => {
    testWebhookMutation.mutate();
  };

  const handleSimulateEmail = () => {
    if (!fromEmail || !subject) {
      toast({
        title: "Validation Error",
        description: "From email and subject are required.",
        variant: "destructive",
      });
      return;
    }

    simulateEmailMutation.mutate({
      from: fromEmail,
      fromName: fromName || undefined,
      subject,
      textBody: textBody || undefined,
      htmlBody: htmlBody || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Postmark Webhook Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button 
              onClick={handleTestWebhook}
              disabled={testWebhookMutation.isPending}
              variant="outline"
            >
              {testWebhookMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Test Webhook
            </Button>
            {webhookUrl && (
              <Badge variant="secondary" className="text-xs">
                Active: {webhookUrl}
              </Badge>
            )}
          </div>
          
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2">Postmark Inbound Webhook Setup:</h4>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Log into your Postmark account and select your server</li>
              <li>Go to "Settings" → "Webhooks"</li>
              <li>Click "Add webhook" and select "Inbound"</li>
              <li>Enter this webhook URL:
                <div className="font-mono bg-background p-2 rounded mt-1 text-foreground">
                  {window.location.origin}/api/webhooks/postmark
                </div>
              </li>
              <li>Set up your inbound domain (e.g., mail.yourdomain.com)</li>
              <li>Configure DNS MX record to point to: <code>inbound.postmarkapp.com</code></li>
              <li>Test the webhook with a real email or use the simulator below</li>
            </ol>
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> All emails sent to addresses at your configured inbound domain will be forwarded to this webhook and appear in your voice-controlled email interface.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Simulate Incoming Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">From Email *</label>
              <Input
                type="email"
                placeholder="sender@example.com"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">From Name</label>
              <Input
                placeholder="John Doe"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Subject *</label>
            <Input
              placeholder="Email subject line"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Text Content</label>
            <Textarea
              placeholder="Plain text email content..."
              value={textBody}
              onChange={(e) => setTextBody(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">HTML Content</label>
            <Textarea
              placeholder="<p>HTML email content...</p>"
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleSimulateEmail}
              disabled={simulateEmailMutation.isPending || !fromEmail || !subject}
            >
              {simulateEmailMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Simulate Email
            </Button>
            
            {(fromEmail || subject || textBody) && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setFromEmail("");
                  setFromName("");
                  setSubject("");
                  setTextBody("");
                  setHtmlBody("");
                }}
              >
                Clear Form
              </Button>
            )}
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Testing Note:</p>
                <p>This simulates receiving an email through the Postmark webhook. Use this to test the email processing functionality without setting up actual email forwarding.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}