export interface User {
  _id: string;
  name: string;
  email: string;
  online?: boolean;
}

export interface Message {
  _id?: string;
  tempId?: string;
  senderId: string;
  receiverId: string;
  message: string;
  createdAt: string;
  isRead?: boolean;
  status?: 'sending' | 'delivered' | 'read';
}

export interface MessageAck {
  tempId: string;
  permanentId: string;
}

export interface ReadAck {
  messageId: string;
}

