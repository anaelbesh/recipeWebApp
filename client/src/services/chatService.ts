import { Message } from '../types/chat';

const SERVER_URL = window.location.origin;

export async function fetchChatHistory(
  partnerId: string,
  currentUserId: string
): Promise<Message[]> {
  const response = await fetch(
    `${SERVER_URL}/api/chat/history/${partnerId}?userId=${currentUserId}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch chat history');
  }

  return response.json();
}

