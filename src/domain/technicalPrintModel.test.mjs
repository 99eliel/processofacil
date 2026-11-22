import test from 'node:test'
import assert from 'node:assert/strict'
import { buildConsumptionPrintRows, buildMaterialPrintDetails, materialColorPrintValue } from './technicalPrintModel.ts'

test('impressão reflete todos os nomes novos dos Dados de consumo preservando valores legados', () => {
  const rows=buildConsumptionPrintRows({
    encaixe:'Corpo Polo 01',consumoTecido:'P/M/G',comprimentoRisco:'6 m',
    alturaEnfesto:'1,55 m/peça',numeroFolhas:'1,60 m',perdasPercentual:'92%',
  })
  assert.deepEqual(rows,[
    ['MODELO','Corpo Polo 01'],['GRADE ENCAIXADA','P/M/G'],
    ['COMPRIMENTO DO RISCO','6 m'],['CONSUMO','1,55 m/peça'],
    ['LARGURA DO TECIDO','1,60 m'],['APROVEITAMENTO','92%'],
  ])
})
test('impressão de materiais não omite perda, cor, observação e referência',()=>{
  const line={id:'b',materialId:'m',codigoSnapshot:'MAT-1',descricaoSnapshot:'Malha',
    corRegra:'fixa',corFixa:'Azul marinho',consumo:0.32,unidade:'kg',
    perdaPercentual:5,observacao:'Varia de acordo com o lote',
    referenciaFornecedorSnapshot:'REF-42'}
  assert.deepEqual(buildMaterialPrintDetails(line),[
    {label:'PERDA',value:'5%'},{label:'COR',value:'Azul marinho'},
    {label:'OBSERVAÇÃO',value:'Varia de acordo com o lote'},
    {label:'REF. FORNECEDOR',value:'REF-42'},
  ])
  assert.equal(materialColorPrintValue({...line,corRegra:'produto'}),'Segue produto')
  assert.equal(materialColorPrintValue({...line,corRegra:'nao_aplica'}),'Não se aplica')
})
test('linhas antigas sem observação ou consumo novo permanecem imprimíveis',()=>{
  const rows=buildConsumptionPrintRows({
    encaixe:'',consumoTecido:'',comprimentoRisco:'',alturaEnfesto:'',
    numeroFolhas:'',perdasPercentual:'8%',
  })
  assert.deepEqual(rows,[['APROVEITAMENTO','8%']])
  const meta=buildMaterialPrintDetails({corRegra:'nao_aplica',perdaPercentual:0})
  assert.equal(meta.find(x=>x.label==='PERDA')?.value,'0%')
})
