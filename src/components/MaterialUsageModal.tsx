import { useEffect, useState } from 'react'
import { FileText, Link2, Loader2, X } from 'lucide-react'
import { useSystem } from '../system/SystemProvider'
import {
  listMaterialUsage,
  type MaterialUsage,
} from '../firebase/materialUsageRepository'
import type { Material } from '../domain/types'

export default function MaterialUsageModal({
  material,
  onClose,
}: {
  material: Material
  onClose: () => void
}) {
  const { activeCompany } = useSystem()
  const [items, setItems] = useState<MaterialUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!activeCompany?.id) return
    setLoading(true)
    listMaterialUsage(activeCompany.id, material.id)
      .then(setItems)
      .catch((reason) => {
        console.error(reason)
        setError('Não foi possível consultar o uso deste material.')
      })
      .finally(() => setLoading(false))
  }, [activeCompany?.id, material.id])

  return <div className="modal-backdrop">
    <section className="form-modal usage-modal">
      <div className="modal-head">
        <div>
          <span className="section-kicker">Impacto de alteração</span>
          <h2>Onde este material é usado?</h2>
        </div>
        <button className="icon-button" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="usage-body">
        <div className="info-banner">
          <Link2 size={19} />
          <div>
            <strong>{material.codigo} · {material.descricao}</strong>
            <span>
              A lista considera somente Fichas Técnicas padrão atualmente vigentes.
            </span>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        {loading ? (
          <div className="loading-panel compact-loading">
            <Loader2 className="spin" size={20} /> Consultando dependências...
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state small-empty">
            <Link2 size={28} />
            <strong>Sem uso em Ficha Técnica padrão</strong>
            <span>O material não aparece em nenhuma revisão vigente publicada.</span>
          </div>
        ) : (
          <div className="usage-list">
            {items.map((item) => (
              <div className="usage-row" key={item.id}>
                <span className="usage-icon"><FileText size={17} /></span>
                <div>
                  <strong>{item.produtoCodigo} · {item.produtoDescricao}</strong>
                  <small>Revisão padrão: REV {String(item.revisao).padStart(2, '0')}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="modal-actions">
        <button className="primary-button" onClick={onClose}>
          Fechar
        </button>
      </div>
    </section>
  </div>
}
