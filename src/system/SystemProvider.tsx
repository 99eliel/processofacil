import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config'
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

export type SystemUser = {
  uid: string
  displayName: string
  email: string | null
  isAnonymous: boolean
}

type SystemContextValue = {
  user: SystemUser
  loading: boolean
  error: string
  activeMembership: CompanyMembership
  activeCompany: Company | null
  settings: CompanySettings
  refreshActiveCompany: () => Promise<void>
  refreshSystem: () => Promise<void>
}

const SystemContext = createContext<SystemContextValue | null>(null)

const WORKSPACE_ID = 'principal'
const SYSTEM_USER: SystemUser = {
  uid: 'operador-local',
  displayName: 'Operador principal',
  email: null,
  isAnonymous: true,
}

const SYSTEM_MEMBERSHIP: CompanyMembership = {
  empresaId: WORKSPACE_ID,
  nomeFantasia: 'Ambiente Principal',
  perfis: ['admin'],
  ativo: true,
}

async function ensureWorkspace() {
  const companyRef = doc(db, 'empresas', WORKSPACE_ID)
  const settingsRef = doc(db, 'empresas', WORKSPACE_ID, 'configuracoes', 'geral')
  const [companySnap, settingsSnap] = await Promise.all([
    getDoc(companyRef),
    getDoc(settingsRef),
  ])

  if (companySnap.exists() && settingsSnap.exists()) return

  const batch = writeBatch(db)
  const now = serverTimestamp()

  if (!companySnap.exists()) {
    batch.set(companyRef, {
      nome: 'Processo Fácil — Ambiente Principal',
      nomeFantasia: 'Ambiente Principal',
      documento: '',
      ownerUid: SYSTEM_USER.uid,
      ativo: true,
      modulos: defaultModules,
      filiais: [{ id: 'matriz', nome: 'Matriz', ativo: true }],
      modoAcesso: 'sem_auth_temporario',
      criadoEm: now,
      criadoPor: SYSTEM_USER.uid,
      alteradoEm: now,
      alteradoPor: SYSTEM_USER.uid,
    })
  }

  if (!settingsSnap.exists()) {
    batch.set(settingsRef, {
      ...defaultSettings,
      criadoEm: now,
      criadoPor: SYSTEM_USER.uid,
      alteradoEm: now,
      alteradoPor: SYSTEM_USER.uid,
    })
  }

  await batch.commit()
}

export function SystemProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCompany, setActiveCompany] = useState<Company | null>(null)
  const [settings, setSettings] = useState<CompanySettings>(defaultSettings)

  const loadCompany = async () => {
    const [companySnap, settingsSnap] = await Promise.all([
      getDoc(doc(db, 'empresas', WORKSPACE_ID)),
      getDoc(doc(db, 'empresas', WORKSPACE_ID, 'configuracoes', 'geral')),
    ])

    if (!companySnap.exists()) {
      throw new Error('O ambiente principal não foi encontrado no Firestore.')
    }

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
  }

  const boot = async () => {
    setLoading(true)
    setError('')
    try {
      await ensureWorkspace()
      await loadCompany()
    } catch (reason) {
      console.error('Falha no bootstrap do Processo Fácil:', reason)
      const message = reason instanceof Error ? reason.message : 'Não foi possível iniciar o ambiente principal.'
      if (message.toLowerCase().includes('permission-denied') || message.toLowerCase().includes('missing or insufficient permissions')) {
        setError('O sistema já está sem autenticação, mas as regras do Firestore ainda bloqueiam o workspace principal. Publique o firestore.rules atualizado do repositório.')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void boot()
  }, [])

  const refreshActiveCompany = async () => {
    await loadCompany()
  }

  const refreshSystem = async () => {
    await boot()
  }

  const value = useMemo<SystemContextValue>(() => ({
    user: SYSTEM_USER,
    loading,
    error,
    activeMembership: SYSTEM_MEMBERSHIP,
    activeCompany,
    settings,
    refreshActiveCompany,
    refreshSystem,
  }), [loading, error, activeCompany, settings])

  return <SystemContext.Provider value={value}>{children}</SystemContext.Provider>
}

export function useSystem() {
  const context = useContext(SystemContext)
  if (!context) throw new Error('useSystem deve ser usado dentro de SystemProvider')
  return context
}
