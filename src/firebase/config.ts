import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCkx2ZVsgLXUovuVDpIpHcs6Sm7lt4IYFw',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'cotacao-78d9f.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'cotacao-78d9f',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'cotacao-78d9f.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '338296297774',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:338296297774:web:6eea8d574e79ded6ac42bf',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-PF9RQ4XWJT',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
export const storage = getStorage(app)

if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) getAnalytics(app)
  })
}
