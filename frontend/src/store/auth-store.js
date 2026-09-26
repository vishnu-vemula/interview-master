import { firebaseMode } from '@/lib/firebase';
import { useAuthStore as useLegacyAuthStore } from './legacy-auth-store';
import { useFirebaseAuthStore } from './firebase-auth-store';

export const useAuthStore = firebaseMode ? useFirebaseAuthStore : useLegacyAuthStore;
