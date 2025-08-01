import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { dataService } from '../services/dataService';

interface RegisterData {
  name: string;
  email: string;
  rollNumber: string;
  mobile: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        
        // Update user as active in the system
        const systemUser = dataService.getUser(parsedUser.email);
        if (systemUser) {
          systemUser.isActive = true;
          dataService.updateUser(systemUser);
        }
      } catch (error) {
        console.error('Error loading saved user:', error);
        localStorage.removeItem('currentUser');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const authenticatedUser = dataService.authenticateUser(email, password);
    if (authenticatedUser) {
      setUser(authenticatedUser);
      localStorage.setItem('currentUser', JSON.stringify(authenticatedUser));
      return true;
    }
    return false;
  };

  const register = async (data: RegisterData): Promise<boolean> => {
    try {
      // Check if user already exists
      const existingUser = dataService.getUser(data.email);
      if (existingUser) {
        return false;
      }

      // Create new user
      const newUser: User = {
        id: `user-${Date.now()}`,
        name: data.name,
        email: data.email,
        rollNo: data.rollNumber,
        mobile: data.mobile,
        role: 'student',
        registeredAt: new Date().toISOString(),
        loginCount: 1,
        isActive: true,
        lastLoginAt: new Date().toISOString()
      };

      // Save user and create login session
      dataService.addUser(newUser);
      dataService.createLoginSession(newUser);
      
      // Store password (in production, this would be hashed)
      dataService.setUserPassword(data.email, data.password);

      // Set as current user
      setUser(newUser);
      localStorage.setItem('currentUser', JSON.stringify(newUser));

      // Add welcome notification
      dataService.addNotification({
        id: `notif-${Date.now()}`,
        userId: newUser.id,
        title: 'Welcome to Isaac Asimov Lab! 🎉',
        message: 'Your account has been created successfully. You can now request components for your robotics projects.',
        type: 'success',
        read: false,
        createdAt: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      console.error('Registration error:', error);
      return false;
    }
  };

  const logout = () => {
    if (user) {
      // End login session
      dataService.endLoginSession(user.id);
    }
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};