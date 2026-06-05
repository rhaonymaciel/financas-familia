import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import './index.css'

const TIPO_LABELS = { receita:'Receita', fixo:'Conta fixa', variavel:'Variável', cartao:'Cartão', investimento:'Investimento' }
const TIPO_ICONS  = { receita:'💰', fixo:'🏠', variavel:'🛒', cartao:'💳', investimento:'📈' }
const TIPO_BG     = { receita:'#e8f5ee', fixo:'#edf3fb', variavel:'#f0f4f1', cartao:'#fef6e7', investimento:'#f0ecfb' }
const TIPOS       = ['receita','fixo','variavel','cartao','investimento']
const CAT_COLORS  = ['#1a6b3c','#1a4f8a','#b7650a','#c0392b','#5b3d9e','#2d6e6e','#7a4419','#6b4c1a','#2d5a8a','#4a7c1a','#8a1a4f','#1a5a5a']
const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const fmt = n => Number(n).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
const fmtM = ym => { const [y,m] = ym.split('-'); return new Date(y,m-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}) }
const todayYM   = () => new Date().toISOString().slice(0,7)
const todayDate = () => new Date().toISOString().slice(0,10)

// ── Componentes utilitários ──────────────────────────────────────────────────
function Toast({ msg, type, onHide }) {
  useEffect(() => { const t = setTimeout(onHide, 2800); return () => clearTimeout(t) }, [onHide])
  return <div className={`toast ${type}`}>{msg}</div>
}

function MonthNav({ mes, setMes }) {
  const prev = () => { const [y,m]=mes.split('-').map(Number); setMes(new Date(y,m-2,1).toISOString().slice(0,7)) }
  const next = () => { const [y,m]=mes.split('-').map(Number); setMes(new Date(y,m,1).toISOString().slice(0,7)) }
  return (
    <div className="month-selector">
      <button className="month-btn" onClick={prev}>‹</button>
      <div className="month-label">{fmtM(mes)}</div>
      <button className="month-btn" onClick={next}>›</button>
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'var(--white)', borderRadius:'24px 24px 0 0', width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', padding:'20px 20px 40px' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:400 }}>{title}</h2>
          <button onClick={onClose} style={{ background:'var(--gray-100)', border:'none', borderRadius:'50%', width:32, height:32, fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── HOOK: dados globais ──────────────────────────────────────────────────────
function useAppData() {
  const [categories, setCategories] = useState([])
  const [cards, setCards]           = useState([])
  const [members, setMembers]       = useState([])

  const loadGlobal = useCallback(async () => {
    const [{ data: cats }, { data: cds }, { data: mbrs }] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('cards').select('*').order('name'),
      supabase.from('members').select('*').order('name'),
    ])
    setCategories(cats || [])
    setCards(cds || [])
    setMembers(mbrs || [])
  }, [])

  useEffect(() => { loadGlobal() }, [loadGlobal])

  return { categories, cards, members, loadGlobal }
}

// ── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ mes, setMes }) {
  const [txns, setTxns]     = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('transactions').select('*').eq('month_ref', mes).order('date',{ascending:false})
    setTxns(data || [])
    setLoading(false)
  }, [mes])

  useEffect(() => { load() }, [load])

  const receitas = txns.filter(t=>t.type==='receita').reduce((s,t)=>s+Number(t.amount),0)
  const despesas = txns.filter(t=>t.type!=='receita').reduce((s,t)=>s+Number(t.amount),0)
  const saldo    = receitas - despesas
  const cartao   = txns.filter(t=>t.type==='cartao').reduce((s,t)=>s+Number(t.amount),0)

  const byCat = {}
  txns.filter(t=>t.type!=='receita').forEach(t=>{ byCat[t.category]=(byCat[t.category]||0)+Number(t.amount) })
  const catEntries = Object.entries(byCat).sort((a,b)=>b[1]-a[1])
  const maxCat = catEntries[0]?.[1] || 1

  const byMember = {}
  txns.filter(t=>t.type!=='receita').forEach(t=>{ const k=t.member||'Família'; byMember[k]=(byMember[k]||0)+Number(t.amount) })

  return (
    <div>
      <div className="page-header">
        <h1>Finanças Maciel</h1>
        <div className="subtitle">Controle financeiro familiar</div>
      </div>
      <MonthNav mes={mes} setMes={setMes}/>

      {loading ? <div className="loading"><div className="spinner"/></div> : <>
        <div className="metrics-grid">
          <div className="metric-card green">
            <div className="label">Receitas</div>
            <div className="value">{fmt(receitas)}</div>
          </div>
          <div className="metric-card red">
            <div className="label">Despesas</div>
            <div className="value">{fmt(despesas)}</div>
          </div>
          <div className="metric-card" style={{ background: saldo>=0?'var(--green-pale)':'var(--red-light)', border:`1px solid ${saldo>=0?'#c0e8d0':'#f5c6c2'}` }}>
            <div className="label" style={{ color: saldo>=0?'var(--green)':'var(--red)' }}>Saldo</div>
            <div className="value" style={{ color: saldo>=0?'var(--green)':'var(--red)', fontSize:20 }}>{fmt(saldo)}</div>
          </div>
          <div className="metric-card amber">
            <div className="label">Cartão</div>
            <div className="value">{fmt(cartao)}</div>
            <div className="sub">{txns.filter(t=>t.type==='cartao').length} lançamentos</div>
          </div>
        </div>

        {catEntries.length > 0 && (
          <div className="section">
            <div className="section-title">Por categoria</div>
            <div className="chart-card">
              {catEntries.slice(0,8).map(([cat,val],i) => (
                <div className="cat-bar-row" key={cat}>
                  <div className="cat-bar-name">{cat}</div>
                  <div className="cat-bar-bg"><div className="cat-bar-fill" style={{ width:`${(val/maxCat*100).toFixed(1)}%`, background:CAT_COLORS[i%CAT_COLORS.length] }}/></div>
                  <div className="cat-bar-val">{fmt(val)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {Object.keys(byMember).length > 0 && (
          <div className="section">
            <div className="section-title">Por membro</div>
            <div className="chart-card">
              {Object.entries(byMember).sort((a,b)=>b[1]-a[1]).map(([mbr,val],i) => (
                <div className="cat-bar-row" key={mbr}>
                  <div className="cat-bar-name">{mbr}</div>
                  <div className="cat-bar-bg"><div className="cat-bar-fill" style={{ width:`${(val/despesas*100).toFixed(1)}%`, background:CAT_COLORS[(i+4)%CAT_COLORS.length] }}/></div>
                  <div className="cat-bar-val">{fmt(val)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="section">
          <div className="section-title">Últimos lançamentos</div>
          {txns.length === 0
            ? <div className="empty-state"><div className="icon">📭</div><h3>Nenhum lançamento</h3><p>Use o botão + para adicionar.</p></div>
            : <div className="txn-list">{txns.slice(0,6).map(t=>(
              <div className="txn-item" key={t.id}>
                <div className="txn-icon" style={{ background:TIPO_BG[t.type] }}>{TIPO_ICONS[t.type]}</div>
                <div className="txn-info">
                  <div className="txn-desc">{t.description}</div>
                  <div className="txn-meta">{t.category} · {t.date?.slice(5).replace('-','/')}</div>
                </div>
                <div className={`txn-amount ${t.type==='receita'?'income':'expense'}`}>
                  {t.type==='receita'?'+':'-'}{fmt(t.amount)}
                </div>
              </div>
            ))}</div>
          }
        </div>
      </>}
    </div>
  )
}

// ── EXTRATO ───────────────────────────────────────────────────────────────────
function Lancamentos({ mes, setMes, toast }) {
  const [txns, setTxns]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [filterTipo, setFilter] = useState('todos')
  const [editTxn, setEditTxn]   = useState(null)
  const { categories, cards, members } = useAppData()

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('transactions').select('*').eq('month_ref',mes).order('date',{ascending:false})
    setTxns(data||[])
    setLoading(false)
  }, [mes])

  useEffect(() => { load() }, [load])

  const del = async id => {
    if (!window.confirm('Remover este lançamento?')) return
    await supabase.from('transactions').delete().eq('id',id)
    toast('Removido','success'); load()
  }

  const saveEdit = async () => {
    const { id, ...rest } = editTxn
    await supabase.from('transactions').update({ description:rest.description, amount:parseFloat(rest.amount), category:rest.category, member:rest.member, type:rest.type, date:rest.date, notes:rest.notes }).eq('id',id)
    toast('Lançamento atualizado!','success'); setEditTxn(null); load()
  }

  const filtered = filterTipo==='todos' ? txns : txns.filter(t=>t.type===filterTipo)
  const total    = filtered.reduce((s,t)=>t.type==='receita'?s+Number(t.amount):s-Number(t.amount),0)
  const catsByType = tipo => categories.filter(c => tipo==='receita' ? c.type==='receita' : c.type==='despesa').map(c=>c.name)

  return (
    <div>
      <div className="page-header"><h1>Extrato</h1></div>
      <MonthNav mes={mes} setMes={setMes}/>
      <div style={{ padding:'10px 16px 4px', display:'flex', gap:6, overflowX:'auto' }}>
        {['todos',...TIPOS].map(t=>(
          <button key={t} onClick={()=>setFilter(t)} style={{ padding:'6px 12px', borderRadius:20, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', fontFamily:'var(--font-body)', background:filterTipo===t?'var(--gray-900)':'var(--white)', color:filterTipo===t?'var(--white)':'var(--gray-500)' }}>
            {t==='todos'?'Todos':TIPO_LABELS[t]}
          </button>
        ))}
      </div>

      {loading ? <div className="loading"><div className="spinner"/></div> : (
        <div className="section" style={{ paddingTop:12 }}>
          {filtered.length===0
            ? <div className="empty-state"><div className="icon">📭</div><h3>Sem lançamentos</h3></div>
            : <>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ fontSize:12, color:'var(--gray-500)' }}>{filtered.length} lançamentos</span>
                <span style={{ fontSize:13, fontWeight:700, color:total>=0?'var(--green)':'var(--red)' }}>{total>=0?'+':''}{fmt(total)}</span>
              </div>
              <div className="txn-list">
                {filtered.map(t=>(
                  <div className="txn-item" key={t.id}>
                    <div className="txn-icon" style={{ background:TIPO_BG[t.type] }}>{TIPO_ICONS[t.type]}</div>
                    <div className="txn-info" onClick={()=>setEditTxn({...t})} style={{ cursor:'pointer' }}>
                      <div className="txn-desc">{t.description}</div>
                      <div className="txn-meta"><span className={`badge badge-${t.type}`}>{TIPO_LABELS[t.type]}</span> {t.category} · {t.member||'—'} · {t.date?.slice(5).replace('-','/')}</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                      <div className={`txn-amount ${t.type==='receita'?'income':'expense'}`}>{t.type==='receita'?'+':'-'}{fmt(t.amount)}</div>
                      <div style={{ display:'flex', gap:4 }}>
                        <button style={{ padding:'3px 8px', fontSize:11, background:'var(--blue-light)', color:'var(--blue)', border:'none', borderRadius:6, cursor:'pointer' }} onClick={()=>setEditTxn({...t})}>✏️</button>
                        <button className="btn-danger" style={{ padding:'3px 8px', fontSize:11 }} onClick={()=>del(t.id)}>✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          }
        </div>
      )}

      {editTxn && (
        <Modal title="Editar lançamento" onClose={()=>setEditTxn(null)}>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <input className="form-input" value={editTxn.description} onChange={e=>setEditTxn(v=>({...v,description:e.target.value}))}/>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Valor</label>
              <input type="number" className="form-input" value={editTxn.amount} onChange={e=>setEditTxn(v=>({...v,amount:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label className="form-label">Data</label>
              <input type="date" className="form-input" value={editTxn.date} onChange={e=>setEditTxn(v=>({...v,date:e.target.value}))}/>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={editTxn.type} onChange={e=>setEditTxn(v=>({...v,type:e.target.value}))}>
                {TIPOS.map(t=><option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select className="form-select" value={editTxn.category} onChange={e=>setEditTxn(v=>({...v,category:e.target.value}))}>
                {catsByType(editTxn.type).map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Membro</label>
            <select className="form-select" value={editTxn.member||''} onChange={e=>setEditTxn(v=>({...v,member:e.target.value}))}>
              <option value="">—</option>
              {members.map(m=><option key={m.name} value={m.name}>{m.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Observação</label>
            <input className="form-input" value={editTxn.notes||''} onChange={e=>setEditTxn(v=>({...v,notes:e.target.value}))}/>
          </div>
          <button className="btn-primary" onClick={saveEdit}>✓ Salvar alterações</button>
        </Modal>
      )}
    </div>
  )
}

// ── NOVO LANÇAMENTO ──────────────────────────────────────────────────────────
function NovoLancamento({ mes, toast, onSaved }) {
  const [tipo, setTipo]     = useState('variavel')
  const [loading, setLoading] = useState(false)
  const [monthRef, setMonthRef] = useState(mes)
  const [form, setForm]     = useState({ date:todayDate(), description:'', amount:'', category:'', member:'', card:'N/A', notes:'' })
  const { categories, cards, members } = useAppData()

  const cats = categories.filter(c => tipo==='receita' ? c.type==='receita' : c.type==='despesa')

  const save = async () => {
    if (!form.description || !form.amount || !form.category) { toast('Preencha descrição, valor e categoria','error'); return }
    setLoading(true)
    const { error } = await supabase.from('transactions').insert({
      date:form.date, description:form.description, type:tipo,
      category:form.category, member:form.member, card:form.card,
      installments:1, amount:parseFloat(form.amount),
      notes:form.notes, month_ref:monthRef
    })
    setLoading(false)
    if (error) { toast('Erro: '+error.message,'error'); return }
    toast('Lançamento salvo!','success')
    setForm({ date:todayDate(), description:'', amount:'', category:'', member:'', card:'N/A', notes:'' })
    onSaved()
  }

  return (
    <div>
      <div className="page-header"><h1>Novo lançamento</h1></div>
      <div className="form-card">
        <div className="form-group">
          <div className="form-label">Tipo</div>
          <div className="type-chips">
            {TIPOS.map(t=>(
              <button key={t} className={`type-chip ${tipo===t?`selected-${t}`:''}`} onClick={()=>{ setTipo(t); setForm(f=>({...f,category:''})) }}>
                {TIPO_ICONS[t]} {TIPO_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Data</label>
            <input type="date" className="form-input" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
          </div>
          <div className="form-group">
            <label className="form-label">Mês ref.</label>
            <input type="month" className="form-input" value={monthRef} onChange={e=>setMonthRef(e.target.value)}/>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Descrição</label>
          <input type="text" className="form-input" placeholder="Ex: Lopes Supermercados" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Valor (R$)</label>
            <input type="number" className="form-input" placeholder="0,00" step="0.01" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>
          </div>
          <div className="form-group">
            <label className="form-label">Categoria</label>
            <select className="form-select" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
              <option value="">Selecione</option>
              {cats.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Membro</label>
            <select className="form-select" value={form.member} onChange={e=>setForm(f=>({...f,member:e.target.value}))}>
              <option value="">—</option>
              {members.map(m=><option key={m.name} value={m.name}>{m.name}</option>)}
            </select>
          </div>
          {tipo==='cartao' && (
            <div className="form-group">
              <label className="form-label">Cartão</label>
              <select className="form-select" value={form.card} onChange={e=>setForm(f=>({...f,card:e.target.value}))}>
                {cards.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Observação</label>
          <input type="text" className="form-input" placeholder="Opcional" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
        </div>
        <button className="btn-primary" onClick={save} disabled={loading}>{loading?'Salvando...':'✓ Salvar lançamento'}</button>
      </div>
    </div>
  )
}

// ── IMPORTAR JSON ─────────────────────────────────────────────────────────────
function ImportarJSON({ mes, toast }) {
  const [json, setJson]       = useState('')
  const [parsed, setParsed]   = useState(null)
  const [selected, setSelected] = useState({})
  const [loading, setLoading]   = useState(false)
  const [monthRef, setMonthRef] = useState(mes)
  const { categories } = useAppData()
  const catNames = categories.filter(c=>c.type==='despesa').map(c=>c.name)

  const processar = () => {
    try {
      const obj = JSON.parse(json)
      const arr = obj.transactions || obj
      if (!Array.isArray(arr)||!arr.length) throw new Error('Nenhuma transação encontrada')
      const valid = arr.filter(t=>t.amount>0&&t.description)
      if (!valid.length) throw new Error('Nenhum lançamento válido')
      setParsed(valid)
      const sel={}; valid.forEach((_,i)=>sel[i]=true); setSelected(sel)
    } catch(e) { toast('Erro: '+e.message,'error') }
  }

  const importar = async () => {
    const toImport = parsed.filter((_,i)=>selected[i])
    if (!toImport.length) { toast('Selecione pelo menos um','error'); return }
    setLoading(true)
    const rows = toImport.map(t=>({ date:t.date, description:t.description, type:'cartao', category:t.category||'Outros', member:t.member||'', card:'Sicredi 7146', installments:1, amount:parseFloat(t.amount), notes:t.notes||'', month_ref:monthRef }))
    const { error } = await supabase.from('transactions').insert(rows)
    setLoading(false)
    if (error) { toast('Erro: '+error.message,'error'); return }
    toast(`${rows.length} lançamentos importados!`,'success')
    setJson(''); setParsed(null); setSelected({})
  }

  const total = parsed ? parsed.filter((_,i)=>selected[i]).reduce((s,t)=>s+t.amount,0) : 0

  return (
    <div>
      <div className="page-header"><h1>Importar fatura</h1><div className="subtitle">Cole o JSON extraído pelo Claude</div></div>
      <div className="form-card">
        <div style={{ background:'var(--blue-light)', borderRadius:'var(--radius-md)', padding:'12px 14px', marginBottom:16, fontSize:13, color:'var(--blue)', lineHeight:1.5 }}>
          💡 Envie o PDF da fatura aqui no chat → Claude extrai → copie o JSON e cole abaixo.
        </div>
        <div className="form-group">
          <label className="form-label">Mês de referência</label>
          <input type="month" className="form-input" value={monthRef} onChange={e=>setMonthRef(e.target.value)}/>
        </div>
        <div className="form-group">
          <label className="form-label">JSON da fatura</label>
          <textarea className="json-textarea" value={json} onChange={e=>setJson(e.target.value)} placeholder='{"transactions":[{"date":"2026-05-10","description":"Supermercado","amount":150.00,"category":"Alimentação"},...]}' rows={5}/>
        </div>
        <button className="btn-primary" style={{ marginBottom:0 }} onClick={processar}>Visualizar lançamentos</button>
      </div>

      {parsed && (
        <div className="form-card" style={{ marginTop:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <span style={{ fontSize:14, fontWeight:600 }}>{parsed.filter((_,i)=>selected[i]).length}/{parsed.length} selecionados</span>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--green)' }}>{fmt(total)}</span>
          </div>
          <label style={{ fontSize:13, display:'flex', alignItems:'center', gap:6, cursor:'pointer', marginBottom:10 }}>
            <input type="checkbox" checked={Object.values(selected).every(Boolean)} onChange={e=>{ const s={}; parsed.forEach((_,i)=>s[i]=e.target.checked); setSelected(s) }}/>
            Selecionar todos
          </label>
          <div className="preview-scroll">
            <table className="preview-table">
              <thead><tr><th></th><th>Descrição</th><th>Categoria</th><th style={{textAlign:'right'}}>Valor</th></tr></thead>
              <tbody>
                {parsed.map((t,i)=>(
                  <tr key={i} style={{ opacity:selected[i]?1:.4 }}>
                    <td><input type="checkbox" checked={!!selected[i]} onChange={e=>setSelected(s=>({...s,[i]:e.target.checked}))}/></td>
                    <td style={{ maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.description}</td>
                    <td>
                      <select className="select-native" value={t.category||'Outros'} onChange={e=>{ const p=[...parsed]; p[i]={...p[i],category:e.target.value}; setParsed(p) }}>
                        {catNames.map(c=><option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ textAlign:'right', fontWeight:600 }}>{fmt(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn-primary" onClick={importar} disabled={loading}>
            {loading?'Importando...':`✓ Importar ${parsed.filter((_,i)=>selected[i]).length} lançamentos`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── ORÇAMENTOS ────────────────────────────────────────────────────────────────
function Orcamentos({ mes, setMes }) {
  const [txns, setTxns]       = useState([])
  const [budgets, setBudgets]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(null)
  const [editVal, setEditVal]   = useState('')
  const { categories } = useAppData()

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: t },{ data: b }] = await Promise.all([
      supabase.from('transactions').select('category,amount,type').eq('month_ref',mes),
      supabase.from('budgets').select('*')
    ])
    setTxns(t||[]); setBudgets(b||[]); setLoading(false)
  }, [mes])

  useEffect(() => { load() }, [load])

  const spent = {}
  txns.filter(t=>t.type!=='receita').forEach(t=>{ spent[t.category]=(spent[t.category]||0)+Number(t.amount) })

  const saveBudget = async (cat, val) => {
    const existing = budgets.find(b=>b.category===cat)
    if (existing) await supabase.from('budgets').update({ amount:val }).eq('category',cat)
    else await supabase.from('budgets').insert({ category:cat, amount:val })
    setEditing(null); load()
  }

  const despCats = categories.filter(c=>c.type==='despesa').map(c=>c.name)

  return (
    <div>
      <div className="page-header"><h1>Orçamentos</h1></div>
      <MonthNav mes={mes} setMes={setMes}/>
      {loading ? <div className="loading"><div className="spinner"/></div> : (
        <div className="section" style={{ paddingTop:12 }}>
          {despCats.map(cat=>{
            const bud = budgets.find(b=>b.category===cat)?.amount || 0
            const sp  = spent[cat] || 0
            const pct = bud>0 ? Math.min(sp/bud,1.2) : 0
            const color = sp>bud&&bud>0 ? 'var(--red)' : pct>.8 ? 'var(--amber)' : 'var(--green)'
            const status = sp>bud&&bud>0 ? '🔴' : pct>.8 ? '⚠️' : bud>0 ? '✅' : ''
            return (
              <div className="budget-item" key={cat}>
                <div className="budget-header">
                  <div className="budget-cat">{status} {cat}</div>
                  {editing===cat
                    ? <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <input type="number" style={{ width:90, padding:'4px 8px', border:'1.5px solid var(--green-mid)', borderRadius:8, fontSize:13, fontFamily:'var(--font-body)' }} value={editVal} onChange={e=>setEditVal(e.target.value)} autoFocus/>
                        <button className="btn-secondary" style={{ padding:'4px 10px', fontSize:12 }} onClick={()=>saveBudget(cat,parseFloat(editVal)||0)}>✓</button>
                        <button className="btn-secondary" style={{ padding:'4px 10px', fontSize:12 }} onClick={()=>setEditing(null)}>✕</button>
                      </div>
                    : <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <div className="budget-vals">{fmt(sp)}{bud>0?` / ${fmt(bud)}`:''}</div>
                        <button className="btn-secondary" style={{ padding:'4px 10px', fontSize:11 }} onClick={()=>{ setEditing(cat); setEditVal(bud||'') }}>Editar</button>
                      </div>
                  }
                </div>
                {bud>0 && <>
                  <div className="budget-bar-bg"><div className="budget-bar-fill" style={{ width:`${Math.min(pct*100,100)}%`, background:color }}/></div>
                  {sp>bud && <div style={{ fontSize:11, color:'var(--red)', marginTop:4 }}>Excedido em {fmt(sp-bud)}</div>}
                </>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── RELATÓRIOS ────────────────────────────────────────────────────────────────
function Relatorios() {
  const [data, setData]     = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca]   = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const ano = new Date().getFullYear()

  useEffect(() => {
    const load = async () => {
      const meses = Array.from({length:12},(_,i)=>`${ano}-${String(i+1).padStart(2,'0')}`)
      const { data: txns } = await supabase.from('transactions').select('month_ref,type,amount,category').in('month_ref',meses)
      const byMes = {}
      meses.forEach(m => { byMes[m] = { receitas:0, despesas:0 } })
      ;(txns||[]).forEach(t => {
        if (!byMes[t.month_ref]) return
        if (t.type==='receita') byMes[t.month_ref].receitas += Number(t.amount)
        else byMes[t.month_ref].despesas += Number(t.amount)
      })
      setData(meses.map(m => ({ mes:m, ...byMes[m] })))
      setLoading(false)
    }
    load()
  }, [ano])

  const search = async () => {
    if (!busca.trim()) return
    setSearching(true)
    const { data } = await supabase.from('transactions').select('*').ilike('description',`%${busca}%`).order('date',{ascending:false}).limit(50)
    setResults(data||[]); setSearching(false)
  }

  const maxVal = Math.max(...data.map(d=>Math.max(d.receitas,d.despesas)),1)

  return (
    <div>
      <div className="page-header"><h1>Relatórios</h1><div className="subtitle">Visão anual {ano}</div></div>

      <div className="section" style={{ paddingTop:16 }}>
        <div className="section-title">Fluxo de caixa {ano}</div>
        {loading ? <div className="loading"><div className="spinner"/></div> : (
          <div className="chart-card" style={{ overflowX:'auto' }}>
            <div style={{ display:'flex', gap:12, marginBottom:10, fontSize:11 }}>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:10, height:10, borderRadius:2, background:'var(--green)', display:'inline-block' }}></span>Receitas</span>
              <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:10, height:10, borderRadius:2, background:'var(--red)', display:'inline-block' }}></span>Despesas</span>
            </div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:120, minWidth:300 }}>
              {data.map((d,i)=>(
                <div key={d.mes} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                  <div style={{ display:'flex', alignItems:'flex-end', gap:1, height:100 }}>
                    <div style={{ width:8, background:'var(--green)', height:`${(d.receitas/maxVal*100).toFixed(1)}%`, borderRadius:'3px 3px 0 0', minHeight:d.receitas>0?3:0 }}/>
                    <div style={{ width:8, background:'var(--red)', height:`${(d.despesas/maxVal*100).toFixed(1)}%`, borderRadius:'3px 3px 0 0', minHeight:d.despesas>0?3:0 }}/>
                  </div>
                  <div style={{ fontSize:9, color:'var(--gray-500)', textAlign:'center' }}>{MESES_NOMES[i].slice(0,3)}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:12 }}>
              {data.filter(d=>d.receitas>0||d.despesas>0).map(d=>{
                const saldo = d.receitas - d.despesas
                return (
                  <div key={d.mes} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--gray-100)', fontSize:13 }}>
                    <span style={{ color:'var(--gray-700)', fontWeight:500 }}>{fmtM(d.mes)}</span>
                    <span style={{ color:'var(--green)' }}>{fmt(d.receitas)}</span>
                    <span style={{ color:'var(--red)' }}>{fmt(d.despesas)}</span>
                    <span style={{ color:saldo>=0?'var(--green)':'var(--red)', fontWeight:700 }}>{saldo>=0?'+':''}{fmt(saldo)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-title">Busca global</div>
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          <input className="form-input" style={{ flex:1, margin:0 }} placeholder="Buscar em todos os lançamentos..." value={busca} onChange={e=>setBusca(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()}/>
          <button className="btn-secondary" onClick={search} disabled={searching}>{searching?'...':'🔍'}</button>
        </div>
        {results.length>0 && (
          <div className="txn-list">
            {results.map(t=>(
              <div className="txn-item" key={t.id}>
                <div className="txn-icon" style={{ background:TIPO_BG[t.type] }}>{TIPO_ICONS[t.type]}</div>
                <div className="txn-info">
                  <div className="txn-desc">{t.description}</div>
                  <div className="txn-meta">{t.category} · {t.month_ref} · {t.date?.slice(5).replace('-','/')}</div>
                </div>
                <div className={`txn-amount ${t.type==='receita'?'income':'expense'}`}>{t.type==='receita'?'+':'-'}{fmt(t.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── RECORRENTES ───────────────────────────────────────────────────────────────
function Recorrentes({ mes, toast }) {
  const [recurrings, setRecurrings] = useState([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState({ description:'', type:'fixo', category:'', member:'', card:'N/A', amount:'' })
  const { categories, cards, members } = useAppData()

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('recurring').select('*').order('description')
    setRecurrings(data||[]); setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const addRecurring = async () => {
    if (!form.description||!form.amount||!form.category) { toast('Preencha todos os campos','error'); return }
    await supabase.from('recurring').insert({ ...form, amount:parseFloat(form.amount), active:true })
    toast('Recorrente cadastrado!','success')
    setForm({ description:'', type:'fixo', category:'', member:'', card:'N/A', amount:'' })
    setShowForm(false); load()
  }

  const lancarMes = async (rec) => {
    const { error } = await supabase.from('transactions').insert({
      date:`${mes}-01`, description:rec.description, type:rec.type,
      category:rec.category, member:rec.member||'', card:rec.card||'N/A',
      installments:1, amount:rec.amount, notes:'Recorrente automático', month_ref:mes
    })
    if (error) toast('Erro: '+error.message,'error')
    else toast(`"${rec.description}" lançado em ${fmtM(mes)}!`,'success')
  }

  const lancarTodos = async () => {
    const ativos = recurrings.filter(r=>r.active)
    for (const r of ativos) await lancarMes(r)
    toast(`${ativos.length} lançamentos criados!`,'success')
  }

  const toggleActive = async (id, active) => {
    await supabase.from('recurring').update({ active:!active }).eq('id',id); load()
  }

  const del = async id => {
    if (!window.confirm('Remover este recorrente?')) return
    await supabase.from('recurring').delete().eq('id',id); load()
  }

  const cats = categories.filter(c => form.type==='receita' ? c.type==='receita' : c.type==='despesa')

  return (
    <div>
      <div className="page-header"><h1>Recorrentes</h1><div className="subtitle">Lançamentos automáticos mensais</div></div>
      <div style={{ padding:'12px 16px', display:'flex', gap:8, flexWrap:'wrap' }}>
        <button className="btn-primary" style={{ flex:1, margin:0, padding:'10px' }} onClick={lancarTodos}>⚡ Lançar todos em {fmtM(mes)}</button>
        <button className="btn-secondary" onClick={()=>setShowForm(v=>!v)}>+ Novo</button>
      </div>

      {showForm && (
        <div className="form-card" style={{ margin:'0 16px 16px' }}>
          <div className="form-title" style={{ fontSize:16, marginBottom:14 }}>Novo recorrente</div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <input className="form-input" placeholder="Ex: Conta Vivo" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value,category:''}))}>
                {TIPOS.map(t=><option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Valor</label>
              <input type="number" className="form-input" placeholder="0,00" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select className="form-select" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                <option value="">Selecione</option>
                {cats.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Membro</label>
              <select className="form-select" value={form.member} onChange={e=>setForm(f=>({...f,member:e.target.value}))}>
                <option value="">—</option>
                {members.map(m=><option key={m.name} value={m.name}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <button className="btn-primary" onClick={addRecurring}>✓ Salvar recorrente</button>
        </div>
      )}

      {loading ? <div className="loading"><div className="spinner"/></div> : (
        <div className="section">
          {recurrings.length===0
            ? <div className="empty-state"><div className="icon">🔁</div><h3>Nenhum recorrente</h3><p>Cadastre salários, contas fixas e assinaturas para lançar com um toque.</p></div>
            : <div className="txn-list">
                {recurrings.map(r=>(
                  <div className="txn-item" key={r.id} style={{ opacity:r.active?1:.5 }}>
                    <div className="txn-icon" style={{ background:TIPO_BG[r.type] }}>{TIPO_ICONS[r.type]}</div>
                    <div className="txn-info">
                      <div className="txn-desc">{r.description}</div>
                      <div className="txn-meta">{r.category} · {fmt(r.amount)} · {r.active?'Ativo':'Inativo'}</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
                      <button style={{ padding:'4px 10px', fontSize:11, background:'var(--green-light)', color:'var(--green)', border:'none', borderRadius:6, cursor:'pointer', whiteSpace:'nowrap' }} onClick={()=>lancarMes(r)}>Lançar</button>
                      <div style={{ display:'flex', gap:4 }}>
                        <button className="btn-secondary" style={{ padding:'3px 8px', fontSize:10 }} onClick={()=>toggleActive(r.id,r.active)}>{r.active?'Pausar':'Ativar'}</button>
                        <button className="btn-danger" style={{ padding:'3px 8px', fontSize:11 }} onClick={()=>del(r.id)}>✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      )}
    </div>
  )
}

// ── CONFIGURAÇÕES ─────────────────────────────────────────────────────────────
function Configuracoes({ toast }) {
  const { categories, cards, members, loadGlobal } = useAppData()
  const [newCat, setNewCat]   = useState({ name:'', type:'despesa' })
  const [newCard, setNewCard] = useState('')
  const [newMbr, setNewMbr]  = useState('')

  const addCat = async () => {
    if (!newCat.name.trim()) return
    const { error } = await supabase.from('categories').insert({ name:newCat.name.trim(), type:newCat.type })
    if (error) toast('Já existe esta categoria','error')
    else { toast('Categoria adicionada!','success'); setNewCat({ name:'', type:'despesa' }); loadGlobal() }
  }

  const delCat = async id => {
    await supabase.from('categories').delete().eq('id',id); loadGlobal()
  }

  const addCard = async () => {
    if (!newCard.trim()) return
    await supabase.from('cards').insert({ name:newCard.trim() })
    toast('Cartão adicionado!','success'); setNewCard(''); loadGlobal()
  }

  const delCard = async id => {
    await supabase.from('cards').delete().eq('id',id); loadGlobal()
  }

  const addMbr = async () => {
    if (!newMbr.trim()) return
    await supabase.from('members').insert({ name:newMbr.trim() })
    toast('Membro adicionado!','success'); setNewMbr(''); loadGlobal()
  }

  const delMbr = async id => {
    await supabase.from('members').delete().eq('id',id); loadGlobal()
  }

  const Section = ({ title, children }) => (
    <div className="form-card" style={{ marginBottom:12 }}>
      <div style={{ fontFamily:'var(--font-display)', fontSize:17, marginBottom:14, fontWeight:400 }}>{title}</div>
      {children}
    </div>
  )

  const ItemRow = ({ name, onDel, badge }) => (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'1px solid var(--gray-100)' }}>
      {badge && <span className={`badge badge-${badge}`}>{badge==='despesa'?'Despesa':'Receita'}</span>}
      <span style={{ flex:1, fontSize:14 }}>{name}</span>
      <button className="btn-danger" style={{ padding:'3px 10px', fontSize:12 }} onClick={onDel}>Remover</button>
    </div>
  )

  return (
    <div>
      <div className="page-header"><h1>Configurações</h1></div>
      <div style={{ padding:'16px 0' }}>

        <Section title="👨‍👩‍👧 Membros da família">
          {members.map(m=><ItemRow key={m.id} name={m.name} onDel={()=>delMbr(m.id)}/>)}
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <input className="form-input" style={{ flex:1, margin:0 }} placeholder="Nome do membro" value={newMbr} onChange={e=>setNewMbr(e.target.value)}/>
            <button className="btn-secondary" onClick={addMbr}>+ Adicionar</button>
          </div>
        </Section>

        <Section title="🏷️ Categorias">
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', marginBottom:6, textTransform:'uppercase', letterSpacing:'.05em' }}>Despesas</div>
            {categories.filter(c=>c.type==='despesa').map(c=><ItemRow key={c.id} name={c.name} onDel={()=>delCat(c.id)}/>)}
            <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', margin:'12px 0 6px', textTransform:'uppercase', letterSpacing:'.05em' }}>Receitas</div>
            {categories.filter(c=>c.type==='receita').map(c=><ItemRow key={c.id} name={c.name} onDel={()=>delCat(c.id)}/>)}
          </div>
          <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
            <input className="form-input" style={{ flex:2, margin:0, minWidth:120 }} placeholder="Nova categoria" value={newCat.name} onChange={e=>setNewCat(v=>({...v,name:e.target.value}))}/>
            <select className="form-select" style={{ flex:1, margin:0, minWidth:100 }} value={newCat.type} onChange={e=>setNewCat(v=>({...v,type:e.target.value}))}>
              <option value="despesa">Despesa</option>
              <option value="receita">Receita</option>
            </select>
            <button className="btn-secondary" onClick={addCat}>+ Add</button>
          </div>
        </Section>

        <Section title="💳 Cartões">
          {cards.map(c=><ItemRow key={c.id} name={c.name} onDel={()=>delCard(c.id)}/>)}
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <input className="form-input" style={{ flex:1, margin:0 }} placeholder="Ex: Nubank 1234" value={newCard} onChange={e=>setNewCard(e.target.value)}/>
            <button className="btn-secondary" onClick={addCard}>+ Adicionar</button>
          </div>
        </Section>

        <div style={{ padding:'0 16px' }}>
          <div style={{ background:'var(--gray-100)', borderRadius:'var(--radius-md)', padding:'12px 14px', fontSize:12, color:'var(--gray-500)', lineHeight:1.6 }}>
            💡 <strong>Dica:</strong> Para adicionar o app na tela inicial do celular, abra no Safari/Chrome, toque em "Compartilhar" e selecione "Adicionar à Tela de Início".
          </div>
        </div>

      </div>
    </div>
  )
}

// ── APP PRINCIPAL ─────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]       = useState('dashboard')
  const [mes, setMes]       = useState(todayYM)
  const [toastData, setToastData] = useState(null)

  const toast = (msg, type='success') => setToastData({ msg, type })

  const tabs = [
    { id:'dashboard',  label:'Início',     icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg> },
    { id:'lancamentos',label:'Extrato',    icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg> },
    { id:'novo',       label:'Lançar',     icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> },
    { id:'importar',   label:'Fatura',     icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9,15 12,18 15,15"/></svg> },
    { id:'mais',       label:'Mais',       icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg> },
  ]

  const [showMais, setShowMais] = useState(false)

  const goTo = (t) => { setTab(t); setShowMais(false) }

  return (
    <div className="app-shell">
      <div className="page-content">
        {tab==='dashboard'   && <Dashboard mes={mes} setMes={setMes}/>}
        {tab==='lancamentos' && <Lancamentos mes={mes} setMes={setMes} toast={toast}/>}
        {tab==='novo'        && <NovoLancamento mes={mes} toast={toast} onSaved={()=>setTab('lancamentos')}/>}
        {tab==='importar'    && <ImportarJSON mes={mes} toast={toast}/>}
        {tab==='orcamentos'  && <Orcamentos mes={mes} setMes={setMes}/>}
        {tab==='relatorios'  && <Relatorios/>}
        {tab==='recorrentes' && <Recorrentes mes={mes} toast={toast}/>}
        {tab==='config'      && <Configuracoes toast={toast}/>}
      </div>

      {showMais && (
        <div style={{ position:'fixed', bottom:70, left:0, right:0, maxWidth:480, margin:'0 auto', background:'var(--white)', borderTop:'1px solid var(--gray-100)', padding:'12px 16px', zIndex:99, boxShadow:'0 -4px 20px rgba(0,0,0,0.08)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[
              { id:'orcamentos',  label:'Orçamentos',  icon:'🎯' },
              { id:'relatorios',  label:'Relatórios',  icon:'📊' },
              { id:'recorrentes', label:'Recorrentes', icon:'🔁' },
              { id:'config',      label:'Config.',     icon:'⚙️' },
            ].map(t=>(
              <button key={t.id} onClick={()=>goTo(t.id)} style={{ padding:'14px', background:tab===t.id?'var(--green-pale)':'var(--gray-50)', border:`1px solid ${tab===t.id?'var(--green)':'var(--gray-100)'}`, borderRadius:'var(--radius-md)', cursor:'pointer', display:'flex', alignItems:'center', gap:10, fontFamily:'var(--font-body)', fontSize:14, fontWeight:500, color:tab===t.id?'var(--green)':'var(--gray-700)' }}>
                <span style={{ fontSize:20 }}>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        {tabs.map(t=>(
          <button key={t.id} className={`nav-item ${(tab===t.id||(t.id==='mais'&&showMais))?'active':''}`}
            onClick={()=>{ if(t.id==='mais'){ setShowMais(v=>!v) } else { setTab(t.id); setShowMais(false) } }}>
            {t.icon}{t.label}
          </button>
        ))}
      </nav>

      {toastData && <Toast msg={toastData.msg} type={toastData.type} onHide={()=>setToastData(null)}/>}
    </div>
  )
}
