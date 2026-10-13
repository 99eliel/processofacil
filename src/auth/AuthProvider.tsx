import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import type { Company, CompanyMembership, CompanySettings, ModuleKey } from '../domain/types'

const defaultModules: Record<ModuleKey, boolean> = {
  materiais: true,
  produtos: true,
  fichas: true,
  workflow: true,
  ordens: true,
  qualidade: true,
}

const defaultSettings: CompanySettings = {
  modulos: defaultModules,
  estrategiaCodigo: { tipo: 'manual' },
  unidades: [
    { id: 'un', simbolo: 'un', nome: 'Unidade', ativo: true },
    { id: 'pc', simbolo: 'pç', nome: 'Peça', ativo: true },
    { id: 'kg', simbolo: 'kg', nome: 'Quilograma', ativo: true },
    { id: 'g', simbolo: 'g', nome: 'Grama', ativo: true },
    { id: 'm', simbolo: 'm', nome: 'Metro', ativo: true },
    { id: 'cm', simbolo: 'cm', nome: 'Centímetro', ativo: true },
    { id: 'mm', simbolo: 'mm', nome: 'Milímetro', ativo: true },
    { id: 'l', simbolo: 'L', nome: 'Litro', ativo: true },
    { id: 'ml', simbolo: 'mL', nome: 'Mililitro', ativo: true },
    { id: 'm2', simbolo: 'm²', nome: 'Metro quadrado', ativo: true },
    { id: 'm3', simbolo: 'm³', nome: 'Metro cúbico', ativo: true },
    { id: 'cx', simbolo: 'caixa', nome: 'Caixa', ativo: true },
    { id: 'rolo', simbolo: 'rolo', nome: 'Rolo', ativo: true },
  ],
}

type CreateCompanyInput = {
  nome: string
  nomeFantasia: string
  documento: string
}

type AuthContextValue = {
  user: User | null
  loading: boolean
  error: string
  memberships: CompanyMembership[]
  activeMembership: CompanyMembership | null
  activeCompany: Company | null
  settings: CompanySettings
  login: (email: string, password: string) => Promise<void>
  register: (nome: string, email: string, password: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  logout: () => Promise<void>
  createCompany: (input: CreateCompanyInput) => Promise<void>
  selectCompany: (empresaId: string) => Promise<void>
  refreshCompanies: () => Promise<void>
  refreshActiveCompany: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function humanizeAuthError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : ''
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'Usuário não encontrado.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/email-already-in-use': 'Este e-mail já possui uma conta.',
    'auth/weak-password': 'Use uma senha com pelo menos 6 caracteres.',
    'auth/invalid-email': 'Informe um e-mail válido.',
    'auth/operation-not-allowed': 'O login por e-mail e senha ainda não foi habilitado no Firebase Authentication.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
  }
  return messages[code] ?? 'Não foi possível concluir a operação. Confira a conexão e tente novamente.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [memberships, setMemberships] = useState<CompanyMembership[]>([])
  const [activeMembership, setActiveMembership] = useState<CompanyMembership | null>(null)
  const [activeCompany, setActiveCompany] = useState<Company | null>(null)
  const [settings, setSettings] = useState<CompanySettings>(defaultSettings)

  const loadCompany = async (membership: CompanyMembership | null) => {
    setActiveMembership(membership)
    setActiveCompany(null)
    setSettings(defaultSettings)
    if (!membership) return

    const [companySnap, settingsSnap] = await Promise.all([
      getDoc(doc(db, 'empresas', membership.empresaId)),
      getDoc(doc(db, 'empresas', membership.empresaId, 'configuracoes', 'geral')),
    ])

    if (companySnap.exists()) {
      setActiveCompany({ id: companySnap.id, ...companySnap.data() } as Company)
    }

    if (settingsSnap.exists()) {
      const raw = settingsSnap.data() as Partial<CompanySettings>
      setSettings({
        ...defaultSettings,
        ...raw,
        modulos: { ...defaultModules, ...(raw.modulos ?? {}) },
        unidades: Array.isArray(raw.unidades) ? raw.unidades : defaultSettings.unidades,
      })
    }

    localStorage.setItem('processofacil:empresaAtiva', membership.empresaId)
  }

  const loadMemberships = async (currentUser: User) => {
    const snap = await getDocs(collection(db, 'usuarios', currentUser.uid, 'empresas'))
    const list = snap.docs
      .map((item) => ({ empresaId: item.id, ...item.data() } as CompanyMembership))
      .filter((item) => item.ativo !== false)

    setMemberships(list)

    const saved = localStorage.getItem('processofacil:empresaAtiva')
    const preferred = list.find((item) => item.empresaId === saved) ?? list[0] ?? null
    await loadCompany(preferred)
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true)
      setError('')
      setUser(currentUser)
      try {
        if (currentUser) {
          await loadMemberships(currentUser)
        } else {
          setMemberships([])
          setActiveMembership(null)
          setActiveCompany(null)
          setSettings(defaultSettings)
        }
      } catch (authError) {
        console.error(authError)
        setError('Sua sessão abriu, mas não foi possível carregar as empresas vinculadas.')
      } finally {
        setLoading(false)
      }
    })
    return unsubscribe
  }, [])

  const login = async (email: string, password: string) => {
    setError('')
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (authError) {
      const message = humanizeAuthError(authError)
      setError(message)
      throw new Error(message)
    }
  }

  const register = async (nome: string, email: string, password: string) => {
    setError('')
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
      await updateProfile(credential.user, { displayName: nome.trim() })
      const userRef = doc(db, 'usuarios', credential.user.uid)
      const batch = writeBatch(db)
      batch.set(userRef, {
        uid: credential.user.uid,
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        ativo: true,
        criadoEm: serverTimestamp(),
        alteradoEm: serverTimestamp(),
      }, { merge: true })
      await batch.commit()
    } catch (authError) {
      const message = humanizeAuthError(authError)
      setError(message)
      throw new Error(message)
    }
  }

  const resetPassword = async (email: string) => {
    setError('')
    try {
      await sendPasswordResetEmail(auth, email.trim())
    } catch (authError) {
      const message = humanizeAuthError(authError)
      setError(message)
      throw new Error(message)
    }
  }

  const logout = async () => {
    localStorage.removeItem('processofacil:empresaAtiva')
    await signOut(auth)
  }

  const createCompany = async (input: CreateCompanyInput) => {
    if (!user) throw new Error('Faça login para criar uma empresa.')

    const companyRef = doc(collection(db, 'empresas'))
    const memberRef = doc(db, 'empresas', companyRef.id, 'membros', user.uid)
    const pointerRef = doc(db, 'usuarios', user.uid, 'empresas', companyRef.id)
    const settingsRef = doc(db, 'empresas', companyRef.id, 'configuracoes', 'geral')
    const batch = writeBatch(db)
    const now = serverTimestamp()

    batch.set(companyRef, {
      nome: input.nome.trim(),
      nomeFantasia: input.nomeFantasia.trim() || input.nome.trim(),
      documento: input.documento.trim(),
      ownerUid: user.uid,
      ativo: true,
      modulos: defaultModules,
      filiais: [{ id: 'matriz', nome: 'Matriz', ativo: true }],
      criadoEm: now,
      criadoPor: user.uid,
      alteradoEm: now,
      alteradoPor: user.uid,
    })

    batch.set(memberRef, {
      uid: user.uid,
      nome: user.displayName || user.email || 'Administrador',
      email: user.email,
      perfis: ['admin'],
      ativo: true,
      criadoEm: now,
      criadoPor: user.uid,
      alteradoEm: now,
      alteradoPor: user.uid,
    })

    batch.set(pointerRef, {
      empresaId: companyRef.id,
      nomeFantasia: input.nomeFantasia.trim() || input.nome.trim(),
      perfis: ['admin'],
      ativo: true,
      criadoEm: now,
    })

    batch.set(settingsRef, {
      ...defaultSettings,
      criadoEm: now,
      criadoPor: user.uid,
      alteradoEm: now,
      alteradoPor: user.uid,
    })

    await batch.commit()
    await loadMemberships(user)
    await selectCompany(companyRef.id)
  }

  const selectCompany = async (empresaId: string) => {
    const membership = memberships.find((item) => item.empresaId === empresaId)
      ?? (user ? (await getDoc(doc(db, 'usuarios', user.uid, 'empresas', empresaId))).data() as CompanyMembership | undefined : undefined)
    if (!membership) throw new Error('Empresa não encontrada para este usuário.')
    await loadCompany({ ...membership, empresaId })
  }

  const refreshCompanies = async () => {
    if (user) await loadMemberships(user)
  }

  const refreshActiveCompany = async () => {
    if (activeMembership) await loadCompany(activeMembership)
  }

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    error,
    memberships,
    activeMembership,
    activeCompany,
    settings,
    login,
    register,
    resetPassword,
    logout,
    createCompany,
    selectCompany,
    refreshCompanies,
    refreshActiveCompany,
  }), [user, loading, error, memberships, activeMembership, activeCompany, settings])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
