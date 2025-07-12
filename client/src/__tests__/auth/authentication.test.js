import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import App from '../../App';
import { auth } from '../../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

// Mock Firebase auth functions
jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  onAuthStateChanged: jest.fn(),
  signOut: jest.fn(),
}));

// Mock api module
jest.mock('../../api', () => ({
  generateTaleStream: jest.fn(),
  generateImageWithImagen: jest.fn(),
}));

// Mock components that aren't under test
jest.mock('../../components/CheckoutButton', () => {
  return function MockCheckoutButton() {
    return <div data-testid="checkout-button">Checkout Button</div>;
  };
});

// Mock stateManager
jest.mock('../../stateManager', () => ({
  default: {
    saveState: jest.fn(() => true),
    restoreState: jest.fn(() => null),
    clearState: jest.fn(),
  }
}));

// Mock toast
jest.mock('react-toastify', () => ({
  ToastContainer: () => <div data-testid="toast-container"></div>,
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }
}));

const renderApp = () => {
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
};

describe('Authentication Flow', () => {
  let authStateCallback;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Capture the auth state callback
    onAuthStateChanged.mockImplementation((authInstance, callback) => {
      authStateCallback = callback;
      // Initially not logged in
      callback(null);
      return jest.fn(); // unsubscribe function
    });
  });

  describe('Login Functionality', () => {
    it('should display login form when not authenticated', async () => {
      renderApp();

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Email/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Login/i })).toBeInTheDocument();
      });
    });

    it('should successfully login with valid credentials', async () => {
      const mockUser = { 
        email: 'test@example.com', 
        uid: '123',
        getIdToken: jest.fn(() => Promise.resolve('mock-token'))
      };
      signInWithEmailAndPassword.mockResolvedValue({ user: mockUser });

      renderApp();

      const emailInput = await screen.findByPlaceholderText(/Email/i);
      const passwordInput = screen.getByPlaceholderText(/Password/i);
      const loginButton = screen.getByRole('button', { name: /Login/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'password123');
      await userEvent.click(loginButton);

      await waitFor(() => {
        expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
          auth,
          'test@example.com',
          'password123'
        );
      });

      // Simulate auth state change
      await waitFor(() => {
        authStateCallback(mockUser);
      });

      // Should show the main app interface
      await waitFor(() => {
        expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Enter your story here/i)).toBeInTheDocument();
      });
    });

    it('should handle login errors gracefully', async () => {
      const errorMessage = 'Invalid credentials';
      signInWithEmailAndPassword.mockRejectedValue(new Error(errorMessage));

      renderApp();

      const emailInput = await screen.findByPlaceholderText(/Email/i);
      const passwordInput = screen.getByPlaceholderText(/Password/i);
      const loginButton = screen.getByRole('button', { name: /Login/i });

      await userEvent.type(emailInput, 'wrong@example.com');
      await userEvent.type(passwordInput, 'wrongpassword');
      await userEvent.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText(new RegExp(errorMessage, 'i'))).toBeInTheDocument();
      });
    });

    it('should validate email format', async () => {
      renderApp();

      const emailInput = await screen.findByPlaceholderText(/Email/i);
      const passwordInput = screen.getByPlaceholderText(/Password/i);
      const loginButton = screen.getByRole('button', { name: /Login/i });

      await userEvent.type(emailInput, 'invalid-email');
      await userEvent.type(passwordInput, 'password123');
      await userEvent.click(loginButton);

      // Should not call signIn with invalid email
      expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    });
  });

  describe('Signup Functionality', () => {
    it('should toggle between login and signup modes', async () => {
      renderApp();

      // Initially in login mode
      expect(await screen.findByRole('button', { name: /Login/i })).toBeInTheDocument();
      
      const signupToggle = screen.getByText(/Don't have an account\? Sign up/i);
      await userEvent.click(signupToggle);

      // Should switch to signup mode
      expect(screen.getByRole('button', { name: /Sign Up/i })).toBeInTheDocument();
      
      const loginToggle = screen.getByText(/Already have an account\? Login/i);
      await userEvent.click(loginToggle);

      // Should switch back to login mode
      expect(screen.getByRole('button', { name: /Login/i })).toBeInTheDocument();
    });

    it('should successfully create a new account', async () => {
      const mockUser = { 
        email: 'newuser@example.com', 
        uid: '456',
        getIdToken: jest.fn(() => Promise.resolve('mock-token'))
      };
      createUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });

      renderApp();

      // Switch to signup mode
      const signupToggle = await screen.findByText(/Don't have an account\? Sign up/i);
      await userEvent.click(signupToggle);

      const emailInput = screen.getByPlaceholderText(/Email/i);
      const passwordInput = screen.getByPlaceholderText(/Password/i);
      const signupButton = screen.getByRole('button', { name: /Sign Up/i });

      await userEvent.type(emailInput, 'newuser@example.com');
      await userEvent.type(passwordInput, 'newpassword123');
      await userEvent.click(signupButton);

      await waitFor(() => {
        expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
          auth,
          'newuser@example.com',
          'newpassword123'
        );
      });

      // Simulate auth state change
      authStateCallback(mockUser);

      // Should show the main app interface
      await waitFor(() => {
        expect(screen.getByText(/newuser@example.com/)).toBeInTheDocument();
      });
    });

    it('should handle signup errors', async () => {
      const errorMessage = 'Email already in use';
      createUserWithEmailAndPassword.mockRejectedValue(new Error(errorMessage));

      renderApp();

      // Switch to signup mode
      const signupToggle = await screen.findByText(/Don't have an account\? Sign up/i);
      await userEvent.click(signupToggle);

      const emailInput = screen.getByPlaceholderText(/Email/i);
      const passwordInput = screen.getByPlaceholderText(/Password/i);
      const signupButton = screen.getByRole('button', { name: /Sign Up/i });

      await userEvent.type(emailInput, 'existing@example.com');
      await userEvent.type(passwordInput, 'password123');
      await userEvent.click(signupButton);

      await waitFor(() => {
        expect(screen.getByText(new RegExp(errorMessage, 'i'))).toBeInTheDocument();
      });
    });

    it('should validate password strength', async () => {
      renderApp();

      // Switch to signup mode
      const signupToggle = await screen.findByText(/Don't have an account\? Sign up/i);
      await userEvent.click(signupToggle);

      const emailInput = screen.getByPlaceholderText(/Email/i);
      const passwordInput = screen.getByPlaceholderText(/Password/i);
      const signupButton = screen.getByRole('button', { name: /Sign Up/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, '123'); // Too short
      await userEvent.click(signupButton);

      // Should not call createUser with weak password
      expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
    });
  });

  describe('Logout Functionality', () => {
    it('should successfully logout', async () => {
      const mockUser = { 
        email: 'test@example.com', 
        uid: '123',
        getIdToken: jest.fn(() => Promise.resolve('mock-token'))
      };
      
      renderApp();

      // Simulate logged in state
      authStateCallback(mockUser);

      await waitFor(() => {
        expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
      });

      const logoutButton = screen.getByRole('button', { name: /Logout/i });
      await userEvent.click(logoutButton);

      await waitFor(() => {
        expect(signOut).toHaveBeenCalledWith(auth);
      });

      // Simulate auth state change to logged out
      authStateCallback(null);

      // Should show login form again
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Email/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Login/i })).toBeInTheDocument();
      });
    });
  });

  describe('Authentication State Persistence', () => {
    it('should maintain auth state across component remounts', async () => {
      const mockUser = { 
        email: 'persistent@example.com', 
        uid: '789',
        getIdToken: jest.fn(() => Promise.resolve('mock-token'))
      };

      // First render - simulate already logged in
      onAuthStateChanged.mockImplementation((authInstance, callback) => {
        callback(mockUser);
        return jest.fn();
      });

      const { unmount } = renderApp();

      await waitFor(() => {
        expect(screen.getByText(/persistent@example.com/)).toBeInTheDocument();
      });

      // Unmount and remount
      unmount();
      renderApp();

      // Should still be logged in
      await waitFor(() => {
        expect(screen.getByText(/persistent@example.com/)).toBeInTheDocument();
      });
    });

    it('should handle auth loading state', async () => {
      let resolveAuth;
      const authPromise = new Promise(resolve => { resolveAuth = resolve; });

      onAuthStateChanged.mockImplementation((authInstance, callback) => {
        authPromise.then(() => callback(null));
        return jest.fn();
      });

      renderApp();

      // Should show loading state initially
      expect(screen.getByText(/Loading.../i)).toBeInTheDocument();

      // Resolve auth
      resolveAuth();

      // Should show login form after loading
      await waitFor(() => {
        expect(screen.queryByText(/Loading.../i)).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Email/i)).toBeInTheDocument();
      });
    });
  });

  describe('Authentication Error Messages', () => {
    const errorCases = [
      { code: 'auth/user-not-found', message: 'No user found with this email' },
      { code: 'auth/wrong-password', message: 'Incorrect password' },
      { code: 'auth/invalid-email', message: 'Invalid email format' },
      { code: 'auth/email-already-in-use', message: 'Email is already registered' },
      { code: 'auth/weak-password', message: 'Password should be at least 6 characters' },
      { code: 'auth/network-request-failed', message: 'Network error. Please check your connection' },
    ];

    errorCases.forEach(({ code, message }) => {
      it(`should display appropriate error for ${code}`, async () => {
        const error = new Error();
        error.code = code;
        signInWithEmailAndPassword.mockRejectedValue(error);

        renderApp();

        const emailInput = await screen.findByPlaceholderText(/Email/i);
        const passwordInput = screen.getByPlaceholderText(/Password/i);
        const loginButton = screen.getByRole('button', { name: /Login/i });

        await userEvent.type(emailInput, 'test@example.com');
        await userEvent.type(passwordInput, 'password');
        await userEvent.click(loginButton);

        await waitFor(() => {
          expect(screen.getByText(new RegExp(message, 'i'))).toBeInTheDocument();
        });
      });
    });
  });

  describe('Authentication UI States', () => {
    it('should disable form during authentication process', async () => {
      signInWithEmailAndPassword.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      renderApp();

      const emailInput = await screen.findByPlaceholderText(/Email/i);
      const passwordInput = screen.getByPlaceholderText(/Password/i);
      const loginButton = screen.getByRole('button', { name: /Login/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'password123');
      await userEvent.click(loginButton);

      // Should disable inputs and button during auth
      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(loginButton).toBeDisabled();
      expect(loginButton).toHaveTextContent(/Logging in.../i);
    });

    it('should clear error messages when switching auth modes', async () => {
      signInWithEmailAndPassword.mockRejectedValue(new Error('Login error'));

      renderApp();

      // Trigger login error
      const emailInput = await screen.findByPlaceholderText(/Email/i);
      const passwordInput = screen.getByPlaceholderText(/Password/i);
      const loginButton = screen.getByRole('button', { name: /Login/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'wrong');
      await userEvent.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText(/Login error/i)).toBeInTheDocument();
      });

      // Switch to signup mode
      const signupToggle = screen.getByText(/Don't have an account\? Sign up/i);
      await userEvent.click(signupToggle);

      // Error should be cleared
      expect(screen.queryByText(/Login error/i)).not.toBeInTheDocument();
    });
  });
});