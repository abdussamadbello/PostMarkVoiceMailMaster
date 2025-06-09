import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import AiVoiceChat from "@/components/ai-voice-chat-fixed";
import { MessageCircle, Bot } from "lucide-react";

interface FloatingAiChatButtonProps {
  onPlayAudio?: (text: string, title: string) => void;
  onTabSwitch?: (tab: 'all' | 'unread' | 'read' | 'important' | 'archived') => void;
}

export default function FloatingAiChatButton({ 
  onPlayAudio, 
  onTabSwitch 
}: FloatingAiChatButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200 border-2 border-white dark:border-gray-800"
          size="icon"
          title="AI Chat Assistant"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </Button>
      </div>

      <AiVoiceChat
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onPlayAudio={onPlayAudio}
        onTabSwitch={onTabSwitch}
      />
    </>
  );
}