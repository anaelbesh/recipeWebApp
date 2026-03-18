import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { User, Message } from '../../types/chat';
import { MessageBubble } from './MessageBubble';
import styles from './ChatWindow.module.css';

interface ChatWindowProps {
  currentUser: User;
  partner: User | null;
  messages: Message[];
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  onSendMessage: (text: string) => void;
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
  </svg>
);

export function ChatWindow({
  currentUser,
  partner,
  messages,
  connectionStatus,
  onSendMessage,
}: ChatWindowProps) {
  const [inputText, setInputText] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !partner) return;
    onSendMessage(text);
    setInputText('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connecting':
        return '🔄 Connecting...';
      case 'disconnected':
        return '❌ Disconnected - Trying to reconnect...';
      default:
        return '';
    }
  };

  if (!partner) {
    return (
      <div className={styles.container}>
        <div className={`${styles.connectionStatus} ${styles[connectionStatus]}`}>
          {getConnectionStatusText()}
        </div>
        <div className={styles.noChatSelected}>
          <ChatIcon />
          <h3>Select a conversation</h3>
          <p>Choose a user from the list to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={`${styles.connectionStatus} ${styles[connectionStatus]}`}>
        {getConnectionStatusText()}
      </div>

      <div className={styles.header}>
        <div className={styles.avatar}>{getInitials(partner.name)}</div>
        <div className={styles.headerInfo}>
          <h2>{partner.name}</h2>
        </div>
      </div>

      <div className={styles.messagesContainer} ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <ChatIcon />
            <h3>No messages yet</h3>
            <p>Start the conversation by sending a message!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <MessageBubble
              key={msg._id || msg.tempId || index}
              message={msg}
              isOwn={msg.senderId === currentUser._id}
            />
          ))
        )}
      </div>

      <div className={styles.inputContainer}>
        <input
          type="text"
          className={styles.messageInput}
          placeholder="Type a message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className={styles.sendButton} onClick={handleSend}>
          <SendIcon />
        </button>
      </div>
    </div>
  );
}

