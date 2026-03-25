import { getChatHistory } from '../src/controllers/chatController';
import ChatMessage from '../src/models/ChatMessage';

jest.mock('../src/models/ChatMessage', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
  },
}));

function createRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('chatController.getChatHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when req.user is missing', async () => {
    const req: any = { params: { partnerId: 'partner-1' } };
    const res = createRes();

    await getChatHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not authenticated' });
  });

  test('returns sorted chat history for authenticated user', async () => {
    const req: any = {
      params: { partnerId: 'partner-1' },
      user: { id: 'user-1' },
    };
    const res = createRes();

    const messages = [
      { message: 'hello', senderId: 'user-1', receiverId: 'partner-1' },
      { message: 'hi', senderId: 'partner-1', receiverId: 'user-1' },
    ];
    const sortMock = jest.fn().mockResolvedValue(messages);
    (ChatMessage.find as jest.Mock).mockReturnValue({ sort: sortMock });

    await getChatHistory(req, res);

    expect(ChatMessage.find).toHaveBeenCalledWith({
      $or: [
        { senderId: 'user-1', receiverId: 'partner-1' },
        { senderId: 'partner-1', receiverId: 'user-1' },
      ],
    });
    expect(sortMock).toHaveBeenCalledWith({ createdAt: 1 });
    expect(res.json).toHaveBeenCalledWith(messages);
  });

  test('returns 500 when model query throws', async () => {
    const req: any = {
      params: { partnerId: 'partner-1' },
      user: { id: 'user-1' },
    };
    const res = createRes();

    (ChatMessage.find as jest.Mock).mockImplementation(() => {
      throw new Error('db failure');
    });

    await getChatHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Error fetching history' });
  });
});
