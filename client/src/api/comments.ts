// import apiClient from './client'; // uncomment when backend endpoint exists

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const USE_MOCK = true;

export interface Comment {
  id: string;
  postId: string;
  content: string;
  sender: string;       // userId — matches backend field name "sender"
  createdAt: string;
}

export const commentsApi = {
  getByPost: async (_postId: string): Promise<Comment[]> => {
    if (USE_MOCK) {
      await delay(400);
      return [];
    }
    // const { data } = await apiClient.get<Comment[]>(`/posts/${_postId}/comments`);
    // return data;
    throw new Error('Not implemented');
  },

  create: async (_postId: string, _content: string): Promise<Comment> => {
    if (USE_MOCK) {
      await delay(300);
      return {
        id: Date.now().toString(),
        postId: _postId,
        content: _content,
        sender: 'mock',
        createdAt: new Date().toISOString(),
      };
    }
    // const { data } = await apiClient.post<Comment>(`/posts/${_postId}/comments`, { content: _content });
    // return data;
    throw new Error('Not implemented');
  },
};
