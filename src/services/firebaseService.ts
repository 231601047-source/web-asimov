import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { User, Component, BorrowRequest, Notification, LoginSession, SystemData } from '../types';

class FirebaseService {
  private static instance: FirebaseService;

  static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  // Authentication methods
  async registerUser(email: string, password: string, userData: Partial<User>): Promise<User | null> {
    try {
      if (!auth || !db) {
        console.error('Firebase not initialized. Cannot register user.');
        return null;
      }
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      const newUser: User = {
        id: firebaseUser.uid,
        name: userData.name || '',
        email: firebaseUser.email || '',
        role: userData.role || 'student',
        rollNo: userData.rollNo,
        mobile: userData.mobile,
        registeredAt: new Date().toISOString(),
        loginCount: 1,
        isActive: true,
        lastLoginAt: new Date().toISOString()
      };

      // Save user data to Firestore
      await this.addUser(newUser);
      
      // Create login session
      await this.createLoginSession(newUser);

      return newUser;
    } catch (error) {
      console.error('Registration error:', error);
      return null;
    }
  }

  async loginUser(email: string, password: string): Promise<User | null> {
    try {
      if (!auth || !db) {
        console.error('Firebase not initialized. Cannot login user.');
        return null;
      }
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Get user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        
        // Update login statistics
        const updatedUser = {
          ...userData,
          lastLoginAt: new Date().toISOString(),
          loginCount: (userData.loginCount || 0) + 1,
          isActive: true
        };

        await this.updateUser(updatedUser);
        await this.createLoginSession(updatedUser);

        return updatedUser;
      }

      return null;
    } catch (error) {
      console.error('Login error:', error);
      return null;
    }
  }

  async logoutUser(): Promise<void> {
    try {
      if (!auth || !db) {
        console.error('Firebase not initialized. Cannot logout user.');
        return;
      }
      const currentUser = auth.currentUser;
      if (currentUser) {
        // End login session
        await this.endLoginSession(currentUser.uid);
        
        // Update user active status
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          isActive: false
        });
      }
      
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  onAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
    if (!auth) {
      console.warn('Firebase auth not initialized. Returning no-op unsubscribe function.');
      return () => {}; // Return no-op unsubscribe function
    }
    return onAuthStateChanged(auth, callback);
  }

  // User operations
  async addUser(user: User): Promise<void> {
    try {
      if (!db) {
        console.error('Firebase Firestore not initialized. Cannot add user.');
        return;
      }
      await doc(db, 'users', user.id);
      await updateDoc(doc(db, 'users', user.id), {
        ...user,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error adding user:', error);
    }
  }

  async updateUser(user: User): Promise<void> {
    try {
      if (!db) {
        console.error('Firebase Firestore not initialized. Cannot update user.');
        return;
      }
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        ...user,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating user:', error);
    }
  }

  async getUser(userId: string): Promise<User | null> {
    try {
      if (!db) {
        console.error('Firebase Firestore not initialized. Cannot get user.');
        return null;
      }
      const userDoc = await getDoc(doc(db, 'users', userId));
      return userDoc.exists() ? userDoc.data() as User : null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      if (!db) {
        console.error('Firebase Firestore not initialized. Cannot get users.');
        return [];
      }
      const usersSnapshot = await getDocs(collection(db, 'users'));
      return usersSnapshot.docs.map(doc => doc.data() as User);
    } catch (error) {
      console.error('Error getting users:', error);
      return [];
    }
  }

  // Component operations
  async addComponent(component: Component): Promise<void> {
    try {
      if (!db) {
        console.error('Firebase Firestore not initialized. Cannot add component.');
        return;
      }
      await addDoc(collection(db, 'components'), {
        ...component,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error adding component:', error);
    }
  }

  async updateComponent(component: Component): Promise<void> {
    try {
      if (!db) {
        console.error('Firebase Firestore not initialized. Cannot update component.');
        return;
      }
      const componentRef = doc(db, 'components', component.id);
      await updateDoc(componentRef, {
        ...component,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating component:', error);
    }
  }

  async deleteComponent(componentId: string): Promise<void> {
    try {
      if (!db) {
        console.error('Firebase Firestore not initialized. Cannot delete component.');
        return;
      }
      await deleteDoc(doc(db, 'components', componentId));
    } catch (error) {
      console.error('Error deleting component:', error);
    }
  }

  async getComponents(): Promise<Component[]> {
    try {
      if (!db) {
        console.error('Firebase Firestore not initialized. Cannot get components.');
        return [];
      }
      const componentsSnapshot = await getDocs(collection(db, 'components'));
      return componentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Component));
    } catch (error) {
      console.error('Error getting components:', error);
      return [];
    }
  }

  // Request operations
  async addRequest(request: BorrowRequest): Promise<void> {
    try {
      if (!db) {
        console.error('Firebase Firestore not initialized. Cannot add request.');
        return;
      }
      await addDoc(collection(db, 'requests'), {
        ...request,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error adding request:', error);
    }
  }

  async updateRequest(request: BorrowRequest): Promise<void> {
    try {
      if (!db) {
        console.error('Firebase Firestore not initialized. Cannot update request.');
        return;
      }
      const requestRef = doc(db, 'requests', request.id);
      await updateDoc(requestRef, {
        ...request,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating request:', error);
    }
  }

  async getRequests(): Promise<BorrowRequest[]> {
    try {
      if (!db) {
        console.error('Firebase Firestore not initialized. Cannot get requests.');
        return [];
      }
      const requestsSnapshot = await getDocs(
        query(collection(db, 'requests'), orderBy('createdAt', 'desc'))
      );
      return requestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as BorrowRequest));
    } catch (error) {
      console.error('Error getting requests:', error);
      return [];
    }
  }

  async getUserRequests(userId: string): Promise<BorrowRequest[]> {
    try {
      if (!db) {
        console.error('Firebase Firestore not initialized. Cannot get user requests.');
        return [];
      }
      const requestsSnapshot = await getDocs(
        query(
          collection(db, 'requests'),
          where('studentId', '==', userId),
          orderBy('createdAt', 'desc')
        )
      );
      return requestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as BorrowRequest));
    } catch (error) {
      console.error('Error getting user requests:', error);
      return [];
    }
  }

  // Notification operations
  async addNotification(notification: Notification): Promise<void> {
    try {
      if (!db) {
        console.error('Firebase Firestore not initialized. Cannot add notification.');
        return;
      }
      await addDoc(collection(db, 'notifications'), {
        ...notification,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error adding notification:', error);
    }
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    try {
      if (!db) {
        console.error('Firebase Firestore not initialized. Cannot get notifications.');
        return [];
      }
      const notificationsSnapshot = await getDocs(
        query(
          collection(db, 'notifications'),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc')
        )
      );
      return notificationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Notification));
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      if (!db) {
        console.error('Firebase Firestore not initialized. Cannot mark notification as read.');
        return;
      }
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        read: true,
        readAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  // Login session operations
  async createLoginSession(user: User): Promise<LoginSession> {
    try {
      if (!db) {
        console.error('Firebase Firestore not initialized. Cannot create login session.');
        throw new Error('Firebase not initialized');
      }
      const session: LoginSession = {
        id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        loginTime: new Date().toISOString(),
        ipAddress: 'Unknown', // Would be set by backend in production
        userAgent: navigator.userAgent,
        deviceInfo: this.getDeviceInfo(),
        isActive: true
      };

      await addDoc(collection(db, 'loginSessions'), {
        ...session,
        createdAt: serverTimestamp()
      });

      return session;
    } catch (error) {
      console.error('Error creating login session:', error);
      throw error;
    }
  }

  async endLoginSession(userId: string): Promise<void> {
    try {
      if (!db) {
        console.error('Firebase Firestore not initialized. Cannot end login session.');
        return;
      }
      const sessionsSnapshot = await getDocs(
        query(
          collection(db, 'loginSessions'),
          where('userId', '==', userId),
          where('isActive', '==', true)
        )
      );

      const batch = [];
      sessionsSnapshot.docs.forEach(doc => {
        const sessionRef = doc.ref;
        batch.push(
          updateDoc(sessionRef, {
            logoutTime: new Date().toISOString(),
            isActive: false,
            sessionDuration: new Date().getTime() - new Date(doc.data().loginTime).getTime(),
            updatedAt: serverTimestamp()
          })
        );
      });

      await Promise.all(batch);
    } catch (error) {
      console.error('Error ending login session:', error);
    }
  }

  async getLoginSessions(): Promise<LoginSession[]> {
    try {
      if (!db) {
        console.error('Firebase Firestore not initialized. Cannot get login sessions.');
        return [];
      }
      const sessionsSnapshot = await getDocs(
        query(collection(db, 'loginSessions'), orderBy('createdAt', 'desc'))
      );
      return sessionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LoginSession));
    } catch (error) {
      console.error('Error getting login sessions:', error);
      return [];
    }
  }

  // Real-time listeners
  onComponentsChange(callback: (components: Component[]) => void) {
    if (!db) {
      console.warn('Firebase Firestore not initialized. Returning no-op unsubscribe function.');
      return () => {}; // Return no-op unsubscribe function
    }
    return onSnapshot(collection(db, 'components'), (snapshot) => {
      const components = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Component));
      callback(components);
    });
  }

  onRequestsChange(callback: (requests: BorrowRequest[]) => void) {
    if (!db) {
      console.warn('Firebase Firestore not initialized. Returning no-op unsubscribe function.');
      return () => {}; // Return no-op unsubscribe function
    }
    return onSnapshot(
      query(collection(db, 'requests'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const requests = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as BorrowRequest));
        callback(requests);
      }
    );
  }

  onUserNotificationsChange(userId: string, callback: (notifications: Notification[]) => void) {
    if (!db) {
      console.warn('Firebase Firestore not initialized. Returning no-op unsubscribe function.');
      return () => {}; // Return no-op unsubscribe function
    }
    return onSnapshot(
      query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      ),
      (snapshot) => {
        const notifications = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Notification));
        callback(notifications);
      }
    );
  }

  // Utility methods
  private getDeviceInfo(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Mobile')) return 'Mobile Device';
    if (ua.includes('Tablet')) return 'Tablet';
    return 'Desktop';
  }

  // Migration method to move existing localStorage data to Firebase
  async migrateLocalDataToFirebase(): Promise<void> {
    try {
      if (!db) {
        console.error('Firebase Firestore not initialized. Cannot migrate data.');
        return;
      }
      const localData = localStorage.getItem('isaacLabData');
      if (!localData) return;

      const data: SystemData = JSON.parse(localData);
      
      // Migrate users (skip admin as it will be created separately)
      for (const user of data.users.filter(u => u.role !== 'admin')) {
        await this.addUser(user);
      }

      // Migrate components
      for (const component of data.components) {
        await this.addComponent(component);
      }

      // Migrate requests
      for (const request of data.requests) {
        await this.addRequest(request);
      }

      // Migrate notifications
      for (const notification of data.notifications) {
        await this.addNotification(notification);
      }

      console.log('Data migration completed successfully');
    } catch (error) {
      console.error('Error migrating data:', error);
    }
  }
}

export const firebaseService = FirebaseService.getInstance();