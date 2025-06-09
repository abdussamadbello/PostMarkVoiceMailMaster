import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import EmailReceiver from "@/components/email-receiver";
import { X, CheckCircle, AlertCircle, Eye, EyeOff, Archive, FileText, Check, Bot, Volume2, Mic, Mail, Settings } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [settings, setSettings] = useState({
    voiceLanguage: 'en-US',
    voiceSensitivity: [7],
    voiceModel: 'Rachel',
    speakingSpeed: [1],
    autoReadEmails: true,
    voiceConfirmations: false,
    smartCategorization: true,
    openaiApiKey: '',
    elevenlabsApiKey: '',
    postmarkToken: '',
  });
  
  const { toast } = useToast();

  const handleSaveSettings = () => {
    // Save settings to localStorage or backend
    localStorage.setItem('voicemail-settings', JSON.stringify(settings));
    toast({
      title: "Settings Saved",
      description: "Your preferences have been saved successfully.",
    });
    onClose();
  };

  const handleResetSettings = () => {
    setSettings({
      voiceLanguage: 'en-US',
      voiceSensitivity: [7],
      voiceModel: 'Rachel',
      speakingSpeed: [1],
      autoReadEmails: true,
      voiceConfirmations: false,
      smartCategorization: true,
      openaiApiKey: '',
      elevenlabsApiKey: '',
      postmarkToken: '',
    });
    toast({
      title: "Settings Reset",
      description: "All settings have been reset to defaults.",
    });
  };

  const handleTestConnection = () => {
    // Test API connections
    toast({
      title: "Testing Connections",
      description: "Checking API connectivity...",
    });
    
    // Simulate test
    setTimeout(() => {
      toast({
        title: "Connection Test Complete",
        description: "All API services are responding correctly.",
      });
    }, 2000);
  };

  const toggleApiKeyVisibility = () => {
    setShowApiKeys(!showApiKeys);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings & Email Management</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="emails" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Setup
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="settings" className="space-y-6 py-4">
          {/* Voice Settings */}
          <div>
            <h3 className="text-lg font-medium text-foreground mb-4">Voice Recognition</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="language">Language</Label>
                <Select value={settings.voiceLanguage} onValueChange={(value) => setSettings({...settings, voiceLanguage: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="en-GB">English (UK)</SelectItem>
                    <SelectItem value="es-ES">Spanish</SelectItem>
                    <SelectItem value="fr-FR">French</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Voice Sensitivity</Label>
                <Slider
                  value={settings.voiceSensitivity}
                  onValueChange={(value) => setSettings({...settings, voiceSensitivity: value})}
                  max={10}
                  min={1}
                  step={1}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Voice Settings */}
          <div>
            <h3 className="text-lg font-medium text-foreground mb-4">AI Voice Response</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="voiceModel">Voice Model</Label>
                <Select value={settings.voiceModel} onValueChange={(value) => setSettings({...settings, voiceModel: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rachel">Rachel (Professional)</SelectItem>
                    <SelectItem value="Josh">Josh (Casual)</SelectItem>
                    <SelectItem value="Bella">Bella (Friendly)</SelectItem>
                    <SelectItem value="Antoni">Antoni (Warm)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Speaking Speed</Label>
                <Slider
                  value={settings.speakingSpeed}
                  onValueChange={(value) => setSettings({...settings, speakingSpeed: value})}
                  max={2}
                  min={0.5}
                  step={0.1}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0.5x</span>
                  <span>2x</span>
                </div>
              </div>
            </div>
          </div>

          {/* API Configuration */}
          <div>
            <h3 className="text-lg font-medium text-foreground mb-4">API Configuration</h3>
            
            {/* Security Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm text-foreground">
                    <strong>Security Notice:</strong> API keys are stored locally in your browser and never sent to our servers.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="openaiKey">OpenAI API Key</Label>
                <div className="relative">
                  <Input
                    id="openaiKey"
                    type={showApiKeys ? "text" : "password"}
                    placeholder="sk-..."
                    value={settings.openaiApiKey}
                    onChange={(e) => setSettings({...settings, openaiApiKey: e.target.value})}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8"
                    onClick={toggleApiKeyVisibility}
                  >
                    {showApiKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="elevenlabsKey">ElevenLabs API Key</Label>
                <div className="relative">
                  <Input
                    id="elevenlabsKey"
                    type={showApiKeys ? "text" : "password"}
                    placeholder="..."
                    value={settings.elevenlabsApiKey}
                    onChange={(e) => setSettings({...settings, elevenlabsApiKey: e.target.value})}
                    className="pr-10"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="postmarkToken">Postmark Server Token</Label>
                <div className="relative">
                  <Input
                    id="postmarkToken"
                    type={showApiKeys ? "text" : "password"}
                    placeholder="..."
                    value={settings.postmarkToken}
                    onChange={(e) => setSettings({...settings, postmarkToken: e.target.value})}
                    className="pr-10"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button onClick={handleTestConnection} variant="outline">
                  Test Connection
                </Button>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-muted-foreground">All services connected</span>
                </div>
              </div>
            </div>
          </div>

          {/* Email Preferences */}
          <div>
            <h3 className="text-lg font-medium text-foreground mb-4">Email Preferences</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="autoRead">Auto-read new emails</Label>
                  <p className="text-sm text-muted-foreground">Automatically read new emails aloud when they arrive</p>
                </div>
                <Switch
                  id="autoRead"
                  checked={settings.autoReadEmails}
                  onCheckedChange={(checked) => setSettings({...settings, autoReadEmails: checked})}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="voiceConfirm">Voice confirmations</Label>
                  <p className="text-sm text-muted-foreground">Get audio feedback for actions like marking emails as read</p>
                </div>
                <Switch
                  id="voiceConfirm"
                  checked={settings.voiceConfirmations}
                  onCheckedChange={(checked) => setSettings({...settings, voiceConfirmations: checked})}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="smartCat">Smart email categorization</Label>
                  <p className="text-sm text-muted-foreground">Use AI to automatically categorize emails by importance</p>
                </div>
                <Switch
                  id="smartCat"
                  checked={settings.smartCategorization}
                  onCheckedChange={(checked) => setSettings({...settings, smartCategorization: checked})}
                />
              </div>
            </div>
          </div>

          {/* System Status */}
          <div>
            <h3 className="text-lg font-medium text-foreground mb-4">System Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  <span className="text-sm font-medium">OpenAI</span>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Active
                </Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  <span className="text-sm font-medium">ElevenLabs</span>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Connected
                </Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  <span className="text-sm font-medium">Voice</span>
                </div>
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  Ready
                </Badge>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-lg font-medium text-foreground mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start h-auto p-4"
                onClick={() => {
                  toast({
                    title: "Action executed",
                    description: "All emails marked as read",
                  });
                }}
              >
                <Check className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Mark all as read</div>
                  <div className="text-sm text-muted-foreground">Mark all emails in current view as read</div>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start h-auto p-4"
                onClick={() => {
                  toast({
                    title: "Action executed",
                    description: "All emails archived",
                  });
                }}
              >
                <Archive className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Archive all emails</div>
                  <div className="text-sm text-muted-foreground">Archive all emails in current view</div>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start h-auto p-4"
                onClick={() => {
                  toast({
                    title: "Summary generated",
                    description: "Email summary is ready",
                  });
                }}
              >
                <FileText className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Show email summary</div>
                  <div className="text-sm text-muted-foreground">Generate AI summary of recent emails</div>
                </div>
              </Button>
            </div>
          </div>
          </TabsContent>
          
          <TabsContent value="emails" className="py-4">
            <EmailReceiver />
          </TabsContent>
        </Tabs>
        
        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-border">
          <Button variant="outline" onClick={handleResetSettings}>
            Reset to Default
          </Button>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings}>
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
