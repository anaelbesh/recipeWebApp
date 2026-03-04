import { useState, useCallback, useEffect } from 'react';
import { User, Message, MessageAck, ReadAck } from '../../types/chat';
import { useSocket } from '../../hooks/useSocket';
import { fetchChatHistory } from '../../services/chatService';
import { UsersSidebar } from './UsersSidebar';
import { ChatWindow } from './ChatWindow';
import styles from './ChatPage.module.css';

// Mock users for development (will come from API with JWT in production)
const MOCK_USERS: User[] = [
  { _id: 'Doritos', name: 'Dor Mordechai', email: 'dor@example.com', online: true },
  { _id: 'Anaela', name: 'Anael Ben Shabat', email: 'anael@example.com', online: true },
  { _id: 'Ofir', name: 'Ofir Shviro', email: 'john@example.com', online: false },
  { _id: 'Jane', name: 'Jane Smith', email: 'jane@example.com', online: true },
  { _id: 'Alex', name: 'Alex Johnson', email: 'alex@example.com', online: false },
  { _id: 'Sarha', name: 'Sarah Wilson', email: 'sarah@example.com', online: true },
];

export function ChatPage() {
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USERS[0]);
  const [selectedPartner, setSelectedPartner] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [allUsers] = useState<User[]>(MOCK_USERS);

  const handleReceiveMessage = useCallback((message: Message) => {
    setMessages(prev => {
      if (selectedPartner && message.senderId === selectedPartner._id) {
        return [...prev, { ...message }];
      }
      return prev;
    });
  }, [selectedPartner]);

  const handleMessageAck = useCallback((ack: MessageAck) => {
    setMessages(prev => prev.map(msg =>
      msg.tempId === ack.tempId
        ? { ...msg, _id: ack.permanentId, status: 'delivered' as const }
        : msg
    ));
  }, []);

  const handleMessageRead = useCallback((ack: ReadAck) => {
    setMessages(prev => prev.map(msg =>
      msg._id === ack.messageId
        ? { ...msg, isRead: true }
        : msg
    ));
  }, []);

  const { connectionStatus, sendMessage, markAsRead, joinRoom } = useSocket(
    currentUser._id,
    handleReceiveMessage,
    handleMessageAck,
    handleMessageRead
  );

  useEffect(() => {
    if (!selectedPartner) return;

    const loadHistory = async () => {
      try {
        const history = await fetchChatHistory(selectedPartner._id, currentUser._id);
        setMessages(history);

        history.forEach(msg => {
          if (msg.receiverId === currentUser._id && !msg.isRead) {
            markAsRead(msg._id!, msg.senderId);
          }
        });
      } catch (err) {
        console.error('Failed to load history:', err);
      }
    };

    loadHistory();
  }, [selectedPartner, currentUser._id, markAsRead]);

  const handleSelectPartner = (user: User) => {
    setSelectedPartner(user);
    setMessages([]);
  };

  const handleChangeCurrentUser = (userId: string) => {
    const newUser = allUsers.find(u => u._id === userId);
    if (!newUser) return;

    setCurrentUser(newUser);
    joinRoom(newUser._id);

    if (selectedPartner && selectedPartner._id === newUser._id) {
      setSelectedPartner(null);
      setMessages([]);
    }
  };

  const handleSendMessage = (text: string) => {
    if (!selectedPartner) return;

    const tempId = Date.now().toString();
    const newMessage: Message = {
      tempId,
      senderId: currentUser._id,
      receiverId: selectedPartner._id,
      message: text,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };

    setMessages(prev => [...prev, newMessage]);
    sendMessage(newMessage);
  };

  return (
    <div className={styles.appContainer}>
      <UsersSidebar
        currentUser={currentUser}
        users={allUsers}
        selectedPartner={selectedPartner}
        onSelectPartner={handleSelectPartner}
        onChangeCurrentUser={handleChangeCurrentUser}
      />
      <ChatWindow
        currentUser={currentUser}
        partner={selectedPartner}
        messages={messages}
        connectionStatus={connectionStatus}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
}

