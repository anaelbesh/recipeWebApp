import { Message } from '../types/chat';
import { User } from '../types/chat';
import { tokenStorage } from '../api/client';

const SERVER_URL = window.location.origin;

export async function fetchUsers(): Promise<User[]> {
  const token = tokenStorage.getAccess();
  const response = await fetch(`${SERVER_URL}/api/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }

  return response.json();
}

export async function fetchChatHistory(
  partnerId: string,
  currentUserId: string
): Promise<Message[]> {
  const token = tokenStorage.getAccess();
  const response = await fetch(
    `${SERVER_URL}/api/chat/history/${partnerId}?userId=${currentUserId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch chat history');
  }

  return response.json();
}

