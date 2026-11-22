import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import type { Material } from '../domain/types'
import { filterMaterialOptions, uniqueActiveMaterials } from '../domain/materialPicker'

type Props = {
  materials: Material[]
  selectedId: string
  onChange: (id: string) => void
  disabled?: boolean
}

export default function BomMaterialPicker({ materials, selectedId, onChange, disabled = false }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = 'bom-material-options'
  const options = useMemo(() => uniqueActiveMaterials(materials).sort((a,b) =>
    a.descricao.localeCompare(b.descricao, 'pt-BR') || a.codigo.localeCompare(b.codigo, 'pt-BR')), [materials])
  const matches = useMemo(() => filterMaterialOptions(options, query).slice(0, 60), [options, query])
  const selected = materials.find((material) => material.id === selectedId)
  const duplicates = materials.filter((material) => material.ativo).length - options.length

  useEffect(() => {
    if (!selectedId) setQuery('')
  }, [selectedId])

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [])

  const choose = (material: Material) => {
    onChange(material.id)
    setQuery(material.codigo + ' — ' + material.descricao)
    setOpen(false)
    setActiveIndex(0)
  }

  return <div className="ft-bom-picker" ref={root}>
    <div className={'ft-bom-search-field' + (open ? ' is-open' : '')}>
      <Search size={17} aria-hidden="true"/>
      <input
        ref={inputRef}
        type="search"
        autoComplete="off"
        aria-label="Buscar material por código, descrição, categoria ou unidade"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        role="combobox"
        disabled={disabled}
        placeholder="Buscar material por código ou nome..."
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setActiveIndex(0)
          if (selectedId) onChange('')
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { setOpen(false); return }
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (!open) setOpen(true)
            else setActiveIndex((index) => Math.min(matches.length - 1, index + 1))
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex((index) => Math.max(0, index - 1))
          }
          if (event.key === 'Enter' && open && matches.length > 0) {
            event.preventDefault()
            choose(matches[Math.max(0, Math.min(activeIndex, matches.length - 1))])
          }
        }}
      />
      {query && <button type="button" className="ft-bom-search-clear"
        aria-label="Limpar seleção e busca" title="Limpar" onClick={() => {
          setQuery(''); onChange(''); setOpen(true); setActiveIndex(0); inputRef.current?.focus()
        }}><X size={16}/></button>}
      <button type="button" className="ft-bom-search-trigger" aria-label={open ? 'Fechar opções' : 'Abrir materiais'}
        onClick={() => { setOpen((value) => !value); inputRef.current?.focus() }}><ChevronDown size={17}/></button>
    </div>
    {selected && <span className="ft-bom-selected"><Check size={12}/> Selecionado: {selected.codigo} · {selected.unidade}</span>}
    {open && !disabled && <div className="ft-bom-search-dropdown" id={listId} role="listbox" aria-label="Materiais encontrados">
      <div className="ft-bom-search-heading">
        <span>{matches.length > 0 ? 'Selecione um material' : 'Nenhum material encontrado'}</span>
        <small>{query ? 'Resultado da pesquisa' : options.length + ' materiais disponíveis'}</small>
      </div>
      {matches.length > 0 ? matches.map((material, index) =>
        <button type="button" role="option" aria-selected={selectedId === material.id}
          className={'ft-bom-search-option' + (index === activeIndex ? ' is-active' : '')}
          key={material.id}
          onMouseEnter={() => setActiveIndex(index)}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => choose(material)}>
          <span><strong>{material.codigo}</strong><span>{material.descricao}</span></span>
          <small>{material.categoria || 'Sem categoria'} · {material.unidade}</small>
          {selectedId === material.id && <Check size={16}/>}
        </button>) : <p className="ft-bom-search-empty">
          {options.length ? 'Tente outro código ou descrição. Você também pode cadastrar um material novo ao lado.' :
            'Nenhum material ativo. Cadastre seu primeiro material ao lado.'}
        </p>}
      {filterMaterialOptions(options, query).length > 60 && <p className="ft-bom-search-foot">Exibindo os primeiros 60 resultados. Refine a pesquisa para encontrar o material.</p>}
      {duplicates > 0 && <p className="ft-bom-search-foot">
        {duplicates} cadastro(s) com código repetido foram agrupados nesta lista, sem alterar os dados existentes.
      </p>}
    </div>}
  </div>
}
