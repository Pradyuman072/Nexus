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
    localStorage.clear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders login form when not authenticated', () => {
    render(<Home />);
    expect(screen.getByText('NexusFlow Login')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
  });

  it('renders dashboard when authenticated via localStorage', () => {
    localStorage.setItem('nexus_token', 'fake-token');
    localStorage.setItem('nexus_refresh_token', 'fake-refresh-token');
    localStorage.setItem('nexus_user', 'testuser');
    
    render(<Home />);
    expect(screen.getByText('NexusFlow')).toBeInTheDocument();
    expect(screen.getByTestId('task-form')).toBeInTheDocument();
    expect(screen.getByTestId('task-monitor')).toBeInTheDocument();
  });

  it('handles login successfully', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 't1', refreshToken: 'r1', userId: 'user1' })
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
