import { useState, useCallback, useEffect } from 'react';
import { User, Message, MessageAck, ReadAck } from '../../types/chat';
import { useSocket } from '../../hooks/useSocket';
import { fetchChatHistory, fetchUsers } from '../../services/chatService';
import { useAuth } from '../../context/AuthContext';
import { UsersSidebar } from './UsersSidebar';
import { ChatWindow } from './ChatWindow';
import styles from './ChatPage.module.css';

export function ChatPage() {
    const { user: authUser } = useAuth();

    // Map the auth user to the chat User shape
    const currentUser: User = {
        _id: authUser!.id,
        name: authUser!.username,
        email: authUser!.email,
    };

    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [selectedPartner, setSelectedPartner] = useState<User | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);

    // Load all users from the DB on mount
    useEffect(() => {
        fetchUsers()
            .then(setAllUsers)
            .catch((err) => console.error('Failed to load users:', err));
    }, []);

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

    const { connectionStatus, sendMessage, markAsRead } = useSocket(
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