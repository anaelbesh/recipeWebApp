import { Message, User } from '../types/chat';
import apiClient from '../api/client';

export async function fetchUsers(): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('/users');
  return data;
}

export async function fetchChatHistory(
  partnerId: string,
  currentUserId: string
): Promise<Message[]> {
  const { data } = await apiClient.get<Message[]>(`/chat/history/${partnerId}`, {
    params: { userId: currentUserId },
  });
  return data;
}
