import { useEffect, useState } from 'react'
import { subscribeTenantCollection } from '../firebase/catalogRepository'

export function useTenantCollection<T extends { id: string }>(
  empresaId: string | undefined,
  collectionName: string,
  orderField = 'nome',
) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(Boolean(empresaId))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!empresaId) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    const unsubscribe = subscribeTenantCollection<T>(
      empresaId,
      collectionName,
      (next) => {
        setItems(next)
        setLoading(false)
      },
      (reason) => {
        console.error(reason)
        setError('Não foi possível carregar os dados desta seção.')
        setLoading(false)
      },
      orderField,
    )
    return unsubscribe
  }, [empresaId, collectionName, orderField])

  return { items, loading, error }
}
