import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Volume2, Check, Trash2, Paperclip, Star } from "lucide-react";
import type { Email } from "@shared/schema";

interface EmailListProps {
  emails: Email[];
  isLoading: boolean;
  onPlayAudio: (text: string, title: string) => void;
  searchQuery?: string;
}

export default function EmailList({ emails, isLoading, onPlayAudio, searchQuery }: EmailListProps) {
  const [expandedEmails, setExpandedEmails] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateEmailMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Email> }) => {
      await apiRequest("PUT", `/api/emails/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emails"] });
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/emails/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/emails"] });
      toast({
        title: "Email deleted",
        description: "Email moved to trash successfully",
      });
    },
  });

  const handleMarkAsRead = (email: Email) => {
    updateEmailMutation.mutate({
      id: email.id,
      updates: { isRead: true }
    });
    toast({
      title: "Email marked as read",
      description: `"${email.subject}" has been marked as read`,
    });
  };

  const handleToggleImportant = (email: Email) => {
    updateEmailMutation.mutate({
      id: email.id,
      updates: { isImportant: !email.isImportant }
    });
    toast({
      title: email.isImportant ? "Removed from important" : "Marked as important",
      description: `"${email.subject}" has been ${email.isImportant ? 'unmarked' : 'marked'} as important`,
    });
  };

  const handleDelete = (email: Email) => {
    deleteEmailMutation.mutate(email.id);
  };

  const handleReadAloud = (email: Email) => {
    const text = email.textContent || email.subject;
    onPlayAudio(text, email.subject);
  };

  const toggleExpanded = (emailId: number) => {
    const newExpanded = new Set(expandedEmails);
    if (newExpanded.has(emailId)) {
      newExpanded.delete(emailId);
    } else {
      newExpanded.add(emailId);
    }
    setExpandedEmails(newExpanded);
  };

  const formatTimeAgo = (date: Date | string) => {
    const now = new Date();
    const emailDate = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - emailDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hour${Math.floor(diffInMinutes / 60) !== 1 ? 's' : ''} ago`;
    return `${Math.floor(diffInMinutes / 1440)} day${Math.floor(diffInMinutes / 1440) !== 1 ? 's' : ''} ago`;
  };

  const getInitials = (name: string, email: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      return parts.length > 1 
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : parts[0].slice(0, 2).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 sm:p-12 text-center">
          <h3 className="text-lg font-medium text-foreground mb-2">No emails found</h3>
          <p className="text-muted-foreground text-sm sm:text-base">
            {searchQuery 
              ? `No emails match your search for "${searchQuery}"`
              : "Your inbox is empty. New emails will appear here automatically."
            }
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {emails.map((email) => {
        const isExpanded = expandedEmails.has(email.id);
        const isUnread = !email.isRead;
        
        return (
          <Card 
            key={email.id} 
            className={`transition-all duration-200 hover:shadow-md cursor-pointer ${
              isUnread ? 'border-l-4 border-l-primary bg-primary/5' : ''
            } ${email.isImportant ? 'border-l-4 border-l-orange-400' : ''}`}
            onClick={() => toggleExpanded(email.id)}
          >
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 sm:space-x-4 flex-1 min-w-0">
                  {/* Avatar */}
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-medium text-xs sm:text-sm flex-shrink-0 ${
                    isUnread ? 'bg-primary' : 'bg-muted-foreground'
                  }`}>
                    {getInitials(email.fromName || '', email.fromEmail)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
                      <h3 className={`font-medium truncate ${isUnread ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                        {email.fromName || email.fromEmail}
                      </h3>
                      
                      {/* Badges - Only show if there are any badges to display */}
                      {(isUnread || email.isImportant || email.isForwarded || (email.attachments && email.attachments.length > 0)) && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {isUnread && (
                            <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                              Unread
                            </Badge>
                          )}
                          {email.isImportant && (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
                              Important
                            </Badge>
                          )}
                          {email.isForwarded && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                              Forwarded
                            </Badge>
                          )}
                          {email.attachments && email.attachments.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Paperclip className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{email.attachments.length}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-1 hidden sm:block">{email.fromEmail}</p>
                    <h4 className={`font-medium mb-2 text-sm sm:text-base ${isUnread ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {email.subject}
                    </h4>
                    
                    {/* Email preview */}
                    <p className={`text-sm text-muted-foreground leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                      {email.textContent || 'No content available'}
                    </p>
                    
                    {/* Attachments - More compact on mobile */}
                    {email.attachments && email.attachments.length > 0 && (
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {email.attachments.map((attachment, index) => (
                          <div key={index} className="flex items-center space-x-1 text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md">
                            <Paperclip className="h-3 w-3" />
                            <span className="truncate max-w-[100px] sm:max-w-none">{attachment}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col items-end space-y-2 ml-2 sm:ml-4">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTimeAgo(email.receivedAt)}
                  </span>
                  
                  {/* Action buttons - Responsive */}
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 sm:h-8 sm:w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReadAloud(email);
                      }}
                      title="Read aloud"
                    >
                      <Volume2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 sm:h-8 sm:w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleImportant(email);
                      }}
                      title={email.isImportant ? "Remove from important" : "Mark as important"}
                    >
                      <Star className={`h-3 w-3 sm:h-4 sm:w-4 ${email.isImportant ? 'fill-current text-orange-500' : ''}`} />
                    </Button>
                    
                    {isUnread && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 sm:h-8 sm:w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(email);
                        }}
                        title="Mark as read"
                      >
                        <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive/90"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(email);
                      }}
                      title="Delete email"
                    >
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
