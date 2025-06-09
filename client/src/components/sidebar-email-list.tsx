import type { Email } from "@/../../shared/schema";

interface SidebarEmailListProps {
  emails: Email[];
  isLoading: boolean;
  searchQuery?: string;
  onEmailSelect?: (email: Email) => void;
}

export default function SidebarEmailList({ 
  emails, 
  isLoading, 
  searchQuery,
  onEmailSelect 
}: SidebarEmailListProps) {
  if (isLoading) {
    return (
      <div className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
              <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="p-4">
        <div className="text-center text-sm text-muted-foreground">
          No emails found
        </div>
      </div>
    );
  }

  const formatDate = (date: string | Date) => {
    const emailDate = new Date(date);
    const now = new Date();
    const diffInHours = (now.getTime() - emailDate.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return emailDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)} days ago`;
    } else {
      return `${Math.floor(diffInHours / 168)} week${Math.floor(diffInHours / 168) > 1 ? 's' : ''} ago`;
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
  };

  return (
    <div className="w-full h-full">
      {emails.map((email) => (
        <button
          key={email.id}
          onClick={() => onEmailSelect?.(email)}
          className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex flex-col items-start gap-2 border-b p-4 text-sm leading-tight w-full text-left last:border-b-0 transition-colors block"
        >
          <div className="flex w-full items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {!email.isRead && (
                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
              )}
              <span className="truncate font-medium">
                {email.fromName || email.fromEmail}
              </span>
            </div>
            <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">
              {formatDate(email.receivedAt)}
            </span>
          </div>
          
          <div className="w-full">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium truncate flex-1">
                {email.subject}
              </span>
              {email.isImportant && (
                <div className="w-2 h-2 bg-yellow-500 rounded-full flex-shrink-0" />
              )}
            </div>
            
            <span className="line-clamp-2 w-full text-xs text-muted-foreground whitespace-normal">
              {truncateText(
                email.textContent || email.htmlContent?.replace(/<[^>]*>/g, '') || 'No content',
                120
              )}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}