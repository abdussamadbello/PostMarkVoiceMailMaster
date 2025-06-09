import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppSidebar } from "@/components/app-sidebar";
import EmailList from "@/components/email-list";
import SidebarEmailList from "@/components/sidebar-email-list";
import EmailDetail from "@/components/email-detail";
import AudioPlayer from "@/components/audio-player";
import SettingsModal from "@/components/settings-modal";
import FloatingAiChatButton from "@/components/floating-ai-chat-button";
import ConnectionStatus from "@/components/connection-status";
import VoiceStatusIndicator from "@/components/voice-status-indicator";
import { usePerformanceMonitor } from "@/hooks/use-performance-monitor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Search,
  RefreshCw,
  Mail,
  Inbox,
  Star,
  Archive,
  Check,
  Volume2,
  Bot,
  Wifi,
  WifiOff,
  Signal,
  SignalHigh,
  SignalMedium,
  SignalLow,
} from "lucide-react";

export default function Home() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAudioPlayerOpen, setIsAudioPlayerOpen] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<{
    text: string;
    title: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<
    "all" | "unread" | "read" | "important" | "archived"
  >("all");
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const { toast } = useToast();

  const performanceMonitor = usePerformanceMonitor();

  // Set up global performance tracker
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).performanceTracker = performanceMonitor;
    }
  }, [performanceMonitor]);

  // Adaptive refresh interval based on connection quality
  const getRefreshInterval = () => {
    const connectionQuality = performanceMonitor.getConnectionQuality();
    switch (connectionQuality) {
      case "offline":
        return false; // No auto-refresh when offline
      case "poor":
        return 60000; // 1 minute for poor connection
      case "good":
        return 45000; // 45 seconds for good connection
      case "excellent":
        return 30000; // 30 seconds for excellent connection
      default:
        return 30000;
    }
  };

  const {
    data: emailData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/emails"],
    refetchInterval: getRefreshInterval(),
  });

  // Filter emails based on active tab and search query
  const filteredEmails =
    (emailData as any)?.emails?.filter((email: any) => {
      // First filter by tab
      let matchesTab = false;
      switch (activeTab) {
        case "unread":
          matchesTab = !email.isRead && !email.isDeleted;
          break;
        case "read":
          matchesTab = email.isRead && !email.isDeleted;
          break;
        case "important":
          matchesTab = email.isImportant && !email.isDeleted;
          break;
        case "archived":
          matchesTab = email.isDeleted;
          break;
        case "all":
        default:
          matchesTab = !email.isDeleted;
      }

      if (!matchesTab) return false;

      // Then filter by search query if present
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          email.subject?.toLowerCase().includes(query) ||
          email.fromEmail?.toLowerCase().includes(query) ||
          email.fromName?.toLowerCase().includes(query) ||
          email.textContent?.toLowerCase().includes(query) ||
          email.htmlContent?.toLowerCase().includes(query)
        );
      }

      return true;
    }) || [];

  const unreadCount =
    (emailData as any)?.emails?.filter(
      (email: any) => !email.isRead && !email.isDeleted,
    ).length || 0;
  const readCount =
    (emailData as any)?.emails?.filter(
      (email: any) => email.isRead && !email.isDeleted,
    ).length || 0;
  const importantCount =
    (emailData as any)?.emails?.filter(
      (email: any) => email.isImportant && !email.isDeleted,
    ).length || 0;
  const archivedCount =
    (emailData as any)?.emails?.filter((email: any) => email.isDeleted)
      .length || 0;

  const handleVoiceCommand = (command: string) => {
    // Voice commands are now handled directly in VoiceControlPanel
  };

  const handlePlayAudio = (text: string, title: string) => {
    setCurrentAudio({ text, title });
    setIsAudioPlayerOpen(true);
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshed",
      description: "Email list updated successfully",
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is handled automatically by filteredEmails
    if (searchQuery.trim()) {
      const resultCount = filteredEmails.length;
      toast({
        title: "Search Results",
        description: `Found ${resultCount} email${resultCount !== 1 ? "s" : ""} matching "${searchQuery}"`,
      });
    }
  };

  const getTabDisplayName = () => {
    switch (activeTab) {
      case "unread":
        return "Unread";
      case "read":
        return "Read";
      case "important":
        return "Important";
      case "archived":
        return "Archived";
      default:
        return "All Emails";
    }
  };

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "380px",
          "--sidebar-width-mobile": "320px",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        onTabSwitch={setActiveTab}
        activeTab={activeTab}
        emailCounts={{
          unread: unreadCount,
          read: readCount,
          important: importantCount,
          archived: archivedCount,
        }}
        onSettingsOpen={() => setIsSettingsOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        emailListComponent={
          <SidebarEmailList
            emails={filteredEmails}
            isLoading={isLoading}
            searchQuery={searchQuery}
            onEmailSelect={(email) => {
              setSelectedEmail(email);
            }}
          />
        }
      />
      <SidebarInset>
        <header className="bg-background sticky top-0 z-40 flex shrink-0 items-center gap-2 border-b p-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">All Inboxes</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Inbox</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="ml-auto flex items-center gap-2">
            {/* Voice Status */}
            <VoiceStatusIndicator showDetails />
            
            {/* Connection Status */}
            <ConnectionStatus />

            <Button variant="ghost" size="icon" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
          {selectedEmail ? (
            <EmailDetail
              email={selectedEmail}
              onBack={() => setSelectedEmail(null)}
              onPlayAudio={handlePlayAudio}
              onMarkAsRead={(email) => {
                // TODO: Implement mark as read
                console.log("Mark as read:", email.id);
              }}
              onToggleImportant={(email) => {
                // TODO: Implement toggle important
                console.log("Toggle important:", email.id);
              }}
              onArchive={(email) => {
                // TODO: Implement archive
                console.log("Archive:", email.id);
                setSelectedEmail(null);
              }}
              onDelete={(email) => {
                // TODO: Implement delete
                console.log("Delete:", email.id);
                setSelectedEmail(null);
              }}
            />
          ) : (
            <div className="w-full h-full overflow-y-auto p-6">
              <div className="rounded-lg border bg-card text-card-foreground">
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-6">
                    Email Dashboard
                  </h3>

                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-sm text-blue-700">
                            Total Emails
                          </h4>
                          <p className="text-3xl font-bold text-blue-900 mt-2">
                            {filteredEmails.length}
                          </p>
                        </div>
                        <div className="p-3 bg-blue-200 rounded-lg">
                          <Mail className="h-6 w-6 text-blue-700" />
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-sm text-green-700">
                            Unread
                          </h4>
                          <p className="text-3xl font-bold text-green-900 mt-2">
                            {unreadCount}
                          </p>
                        </div>
                        <div className="p-3 bg-green-200 rounded-lg">
                          <Inbox className="h-6 w-6 text-green-700" />
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-sm text-yellow-700">
                            Important
                          </h4>
                          <p className="text-3xl font-bold text-yellow-900 mt-2">
                            {importantCount}
                          </p>
                        </div>
                        <div className="p-3 bg-yellow-200 rounded-lg">
                          <Star className="h-6 w-6 text-yellow-700" />
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-sm text-purple-700">
                            Archived
                          </h4>
                          <p className="text-3xl font-bold text-purple-900 mt-2">
                            {archivedCount}
                          </p>
                        </div>
                        <div className="p-3 bg-purple-200 rounded-lg">
                          <Archive className="h-6 w-6 text-purple-700" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Email Activity Chart Area */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="p-6 border rounded-xl bg-muted/30">
                      <h4 className="font-semibold mb-4">Today's Activity</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                          <span className="text-sm">Emails Received</span>
                          <span className="font-bold text-blue-600">
                            {
                              filteredEmails.filter(
                                (e: any) =>
                                  new Date(e.receivedAt).toDateString() ===
                                  new Date().toDateString(),
                              ).length
                            }
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                          <span className="text-sm">Emails Read</span>
                          <span className="font-bold text-green-600">
                            {filteredEmails.filter((e: any) => e.isRead).length}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                          <span className="text-sm">Voice Commands Used</span>
                          <span className="font-bold text-purple-600">12</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 border rounded-xl bg-muted/30">
                      <h4 className="font-semibold mb-4">Quick Actions</h4>
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Mark All as Read
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          Archive Read Emails
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                        >
                          <Volume2 className="h-4 w-4 mr-2" />
                          Read Latest Email
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-lg">Recent Activity</h4>
                    <div className="grid grid-cols-1 gap-3">
                      {filteredEmails.slice(0, 6).map((email: any) => (
                        <button
                          key={email.id}
                          onClick={() => setSelectedEmail(email)}
                          className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left w-full"
                        >
                          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                            {(email.fromName || email.fromEmail)
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-sm truncate">
                                {email.fromName || email.fromEmail}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {new Date(
                                  email.receivedAt,
                                ).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {email.subject}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {!email.isRead && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                            {email.isImportant && (
                              <Star className="h-4 w-4 text-yellow-500" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </SidebarInset>

      {/* Modals */}
      <AudioPlayer
        isOpen={isAudioPlayerOpen}
        onClose={() => setIsAudioPlayerOpen(false)}
        audio={currentAudio}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Floating AI Chat Button */}
      <FloatingAiChatButton
        onPlayAudio={handlePlayAudio}
        onTabSwitch={setActiveTab}
      />
    </SidebarProvider>
  );
}
