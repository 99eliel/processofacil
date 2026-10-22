import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
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
import type {
  Company,
  CompanyMembership,
  CompanySettings,
  ModuleKey,
} from '../domain/types'

const defaultModules: Record<ModuleKey, boolean> = {
  materiais: true,
  produtos: true,
  fichas: true,
  workflow: true,
  ordens: true,
  qualidade: true,
}

export const defaultSettings: CompanySettings = {
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

type SystemContextValue = {
  user: User | null
  loading: boolean
  error: string
  activeMembership: CompanyMembership | null
  activeCompany: Company | null
  settings: CompanySettings
  refreshActiveCompany: () => Promise<void>
  refreshSystem: () => Promise<void>
}

const SystemContext = createContext<SystemContextValue | null>(null)
const ACTIVE_WORKSPACE_KEY = 'processofacil:workspaceAtivo'

async function createWorkspace(user: User) {
  const companyRef = doc(collection(db, 'empresas'))
  const memberRef = doc(db, 'empresas', companyRef.id, 'membros', user.uid)
  const pointerRef = doc(db, 'usuarios', user.uid, 'empresas', companyRef.id)
  const userRef = doc(db, 'usuarios', user.uid)
  const settingsRef = doc(db, 'empresas', companyRef.id, 'configuracoes', 'geral')
  const batch = writeBatch(db)
  const now = serverTimestamp()

  batch.set(userRef, {
    uid: user.uid,
    nome: 'Operador principal',
    email: null,
    tipoSessao: user.isAnonymous ? 'tecnica' : 'usuario',
    ativo: true,
    criadoEm: now,
    alteradoEm: now,
  }, { merge: true })

  batch.set(companyRef, {
    nome: 'Processo Fácil — Ambiente Principal',
    nomeFantasia: 'Ambiente Principal',
    documento: '',
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
    nome: 'Operador principal',
    email: null,
    perfis: ['admin'],
    ativo: true,
    criadoEm: now,
    criadoPor: user.uid,
    alteradoEm: now,
    alteradoPor: user.uid,
  })

  batch.set(pointerRef, {
    empresaId: companyRef.id,
    nomeFantasia: 'Ambiente Principal',
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
  localStorage.setItem(ACTIVE_WORKSPACE_KEY, companyRef.id)

  return {
    empresaId: companyRef.id,
    nomeFantasia: 'Ambiente Principal',
    perfis: ['admin'],
    ativo: true,
  } satisfies CompanyMembership
}

export function SystemProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeMembership, setActiveMembership] = useState<CompanyMembership | null>(null)
  const [activeCompany, setActiveCompany] = useState<Company | null>(null)
  const [settings, setSettings] = useState<CompanySettings>(defaultSettings)

  const loadCompany = async (membership: CompanyMembership) => {
    const [companySnap, settingsSnap] = await Promise.all([
      getDoc(doc(db, 'empresas', membership.empresaId)),
      getDoc(doc(db, 'empresas', membership.empresaId, 'configuracoes', 'geral')),
    ])

    if (!companySnap.exists()) {
      throw new Error('O workspace ativo não existe mais.')
    }

    setActiveMembership(membership)
    setActiveCompany({ id: companySnap.id, ...companySnap.data() } as Company)

    if (settingsSnap.exists()) {
      const raw = settingsSnap.data() as Partial<CompanySettings>
      setSettings({
        ...defaultSettings,
        ...raw,
        modulos: { ...defaultModules, ...(raw.modulos ?? {}) },
        unidades: Array.isArray(raw.unidades) ? raw.unidades : defaultSettings.unidades,
      })
    } else {
      setSettings(defaultSettings)
    }

    localStorage.setItem(ACTIVE_WORKSPACE_KEY, membership.empresaId)
  }

  const ensureWorkspace = async (currentUser: User) => {
    const userRef = doc(db, 'usuarios', currentUser.uid)
    const userSnap = await getDoc(userRef)
    if (!userSnap.exists()) {
      const batch = writeBatch(db)
      batch.set(userRef, {
        uid: currentUser.uid,
        nome: 'Operador principal',
        email: currentUser.email ?? null,
        tipoSessao: currentUser.isAnonymous ? 'tecnica' : 'usuario',
        ativo: true,
        criadoEm: serverTimestamp(),
        alteradoEm: serverTimestamp(),
      })
      await batch.commit()
    }

    const membershipsSnap = await getDocs(collection(db, 'usuarios', currentUser.uid, 'empresas'))
    let memberships = membershipsSnap.docs
      .map((item) => ({ empresaId: item.id, ...item.data() } as CompanyMembership))
      .filter((item) => item.ativo !== false)

    if (memberships.length === 0) {
      memberships = [await createWorkspace(currentUser)]
    }

    const saved = localStorage.getItem(ACTIVE_WORKSPACE_KEY)
    const selected = memberships.find((item) => item.empresaId === saved) ?? memberships[0]
    await loadCompany(selected)
  }

  useEffect(() => {
    let cancelled = false

    const waitForInitialUser = () => new Promise<User | null>((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(
        auth,
        (currentUser) => {
          unsubscribe()
          resolve(currentUser)
        },
        (reason) => {
          unsubscribe()
          reject(reason)
        },
      )
    })

    const withTimeout = <T,>(promise: Promise<T>, milliseconds: number) =>
      Promise.race<T>([
        promise,
        new Promise<T>((_, reject) => {
          window.setTimeout(
            () => reject(new Error('O Firebase demorou demais para responder. Verifique a conexão e a configuração do projeto.')),
            milliseconds,
          )
        }),
      ])

    const boot = async () => {
      setLoading(true)
      setError('')

      try {
        await setPersistence(auth, browserLocalPersistence)

        let currentUser = await withTimeout(waitForInitialUser(), 8000)

        if (!currentUser) {
          const credential = await withTimeout(signInAnonymously(auth), 8000)
          currentUser = credential.user
        }

        if (cancelled) return

        setUser(currentUser)
        await withTimeout(ensureWorkspace(currentUser), 12000)

        if (cancelled) return
      } catch (reason) {
        console.error('Falha no bootstrap do Processo Fácil:', reason)
        if (cancelled) return

        const message = reason instanceof Error ? reason.message : 'Não foi possível preparar o ambiente principal.'
        const anonymousDisabled =
          message.includes('auth/operation-not-allowed')
          || message.toLowerCase().includes('operation-not-allowed')

        setError(
          anonymousDisabled
            ? 'O login visual está desativado, mas o Firebase precisa do provedor Anonymous habilitado para a sessão técnica. Ative Authentication > Sign-in method > Anonymous no projeto processofacil-3f688.'
            : message,
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void boot()

    return () => {
      cancelled = true
    }
  }, [])

  const refreshActiveCompany = async () => {
    if (activeMembership) await loadCompany(activeMembership)
  }

  const refreshSystem = async () => {
    if (user) await ensureWorkspace(user)
  }

  const value = useMemo<SystemContextValue>(() => ({
    user,
    loading,
    error,
    activeMembership,
    activeCompany,
    settings,
    refreshActiveCompany,
    refreshSystem,
  }), [user, loading, error, activeMembership, activeCompany, settings])

  return <SystemContext.Provider value={value}>{children}</SystemContext.Provider>
}

export function useSystem() {
  const context = useContext(SystemContext)
  if (!context) throw new Error('useSystem deve ser usado dentro de SystemProvider')
  return context
}
