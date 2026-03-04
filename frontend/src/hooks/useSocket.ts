import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Message, MessageAck, ReadAck } from '../types/chat';

const SERVER_URL = window.location.origin;

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface UseSocketReturn {
  socket: Socket | null;
  connectionStatus: ConnectionStatus;
  sendMessage: (message: Message) => void;
  markAsRead: (messageId: string, senderId: string) => void;
  joinRoom: (userId: string) => void;
}

export function useSocket(
  currentUserId: string,
  onReceiveMessage: (message: Message) => void,
  onMessageAck: (ack: MessageAck) => void,
  onMessageRead: (ack: ReadAck) => void
): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to server');
      setConnectionStatus('connected');
      socket.emit('join', currentUserId);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('receive_message', (data: Message) => {
      console.log('Received message:', data);
      onReceiveMessage(data);
    });

    socket.on('message_received_ack', (ack: MessageAck) => {
      console.log('Message acknowledged:', ack);
      onMessageAck(ack);
    });

    socket.on('message_read_update', (ack: ReadAck) => {
      console.log('Message read:', ack);
      onMessageRead(ack);
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUserId, onReceiveMessage, onMessageAck, onMessageRead]);

  const sendMessage = useCallback((message: Message) => {
    socketRef.current?.emit('send_message', message);
  }, []);

  const markAsRead = useCallback((messageId: string, senderId: string) => {
    socketRef.current?.emit('mark_as_read', { messageId, senderId });
  }, []);

  const joinRoom = useCallback((userId: string) => {
    socketRef.current?.emit('join', userId);
  }, []);

  return {
    socket: socketRef.current,
    connectionStatus,
    sendMessage,
    markAsRead,
    joinRoom,
  };
}

