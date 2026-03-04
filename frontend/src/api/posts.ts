// import apiClient from './client'; // uncomment when backend endpoint exists

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const USE_MOCK = true;

export interface Post {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  sender: string;        // userId
  createdAt: string;
}

const MOCK_POSTS: Post[] = [
  {
    id: '1',
    title: 'Spaghetti Carbonara',
    content: 'Classic Italian pasta with eggs, cheese, pancetta.',
    sender: 'mock',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Caesar Salad',
    content: 'Fresh romaine, croutons, parmesan, and caesar dressing.',
    sender: 'mock',
    createdAt: new Date().toISOString(),
  },
];

export const postsApi = {
  getByUser: async (_userId: string): Promise<Post[]> => {
    if (USE_MOCK) {
      await delay(700);
      return MOCK_POSTS;
    }
    // const { data } = await apiClient.get<Post[]>(`/posts?sender=${_userId}`);
    // return data;
    throw new Error('Not implemented');
  },

  create: async (payload: Omit<Post, 'id' | 'createdAt'>): Promise<Post> => {
    if (USE_MOCK) {
      await delay(500);
      return {
        ...payload,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      };
    }
    // const { data } = await apiClient.post<Post>('/posts', payload);
    // return data;
    throw new Error('Not implemented');
  },
};
