import { useState } from 'react';
import { useChat } from 'ai/react';
import { useToast } from '@/hooks/use-toast';

interface UseAiChatProps {
  onPlayAudio?: (text: string, title: string) => void;
}

export function useAiChat({ onPlayAudio }: UseAiChatProps = {}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    reload,
    stop,
  } = useChat({
    api: '/api/ai/chat',
    onError: (error) => {
      console.error('AI Chat error:', error);
      toast({
        title: "Chat Error",
        description: "Failed to process your request. Please try again.",
        variant: "destructive",
      });
    },
    onFinish: (message) => {
      // Play audio response if available
      if (message.content && onPlayAudio) {
        onPlayAudio(message.content, "AI Response");
      }
    },
  });

  const processVoiceCommand = async (command: string) => {
    setIsProcessing(true);
    
    try {
      // Use the quick generate endpoint for voice commands
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: command }),
      });

      if (!response.ok) {
        throw new Error('Failed to process voice command');
      }

      const data = await response.json();
      
      // Play audio response
      if (data.text && onPlayAudio) {
        onPlayAudio(data.text, "Voice Assistant");
      }

      toast({
        title: "Command Processed",
        description: data.text,
      });

      return data;
    } catch (error) {
      console.error('Voice command error:', error);
      toast({
        title: "Command Failed",
        description: "Failed to process voice command. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const sendMessage = async (message: string) => {
    // Add user message and get AI response
    handleSubmit(new Event('submit') as any, {
      data: { content: message },
    });
  };

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading: isLoading || isProcessing,
    error,
    reload,
    stop,
    processVoiceCommand,
    sendMessage,
    isProcessing,
  };
}