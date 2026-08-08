import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from '../app/page';

// Mock the child components to simplify testing Home
jest.mock('../components/TaskForm', () => {
  return function MockTaskForm() {
    return <div data-testid="task-form">Task Form</div>;
  };
});
jest.mock('../components/TaskMonitor', () => {
  return function MockTaskMonitor() {
    return <div data-testid="task-monitor">Task Monitor</div>;
  };
});

describe('Dashboard (Home Component)', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Not authenticated' })
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders login form when not authenticated', () => {
    render(<Home />);
    expect(screen.getByText('NexusFlow Login')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
  });

  it('renders dashboard when silent refresh succeeds on mount', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'fake-token', userId: 'testuser' })
    });
    
    render(<Home />);
    
    await waitFor(() => {
      expect(screen.getByText('NexusFlow')).toBeInTheDocument();
      expect(screen.getByTestId('task-form')).toBeInTheDocument();
      expect(screen.getByTestId('task-monitor')).toBeInTheDocument();
    });
  });

  it('handles login successfully', async () => {
    // First fetch is the silent refresh on mount (fail it so we stay on login page)
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'No token' })
    });
    
    // Second fetch is the actual login request
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 't1', userId: 'user1' })
    });

    render(<Home />);
    
    await userEvent.type(screen.getByPlaceholderText('Username'), 'user1');
    await userEvent.type(screen.getByPlaceholderText('Password'), 'pass123');
    await userEvent.click(screen.getByRole('button', { name: /Enter Workspace/i }));

    await waitFor(() => {
      expect(screen.getByTestId('task-form')).toBeInTheDocument();
    });
  });
});
