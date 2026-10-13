import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

export const firebaseConfig = {
  apiKey: 'AIzaSyCY1EYlCVBkBpDQRFeZsYKe91O_ig8pGgE',
  authDomain: 'processofacil-3f688.firebaseapp.com',
  projectId: 'processofacil-3f688',
  storageBucket: 'processofacil-3f688.firebasestorage.app',
  messagingSenderId: '962964512582',
  appId: '1:962964512582:web:5e80c04efb71318a340f47',
  measurementId: 'G-94CJEKD2KB',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) getAnalytics(app)
    })
    .catch(() => {
      // Analytics é opcional e nunca deve impedir o carregamento do sistema.
    })
}
