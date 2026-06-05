import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import './index.css'

const CATEGORIAS_DESP = ['Alimentação','Moradia','Transporte','Saúde','Educação','Lazer','Vestuário','Serviços','Investimento','Compras','Pet','Viagem','Outros']
const CATEGORIAS_REC  = ['Salário','Freelance / Autônomo','Aluguel recebido','Dividendos / Investimentos','Pensão / Benefício','Outros']
const TIPOS = ['receita','fixo','variavel','cartao','investimento']
const TIPO_LABELS = { receita:'Receita', fixo:'Conta fixa', variavel:'Variável', cartao:'Cartão', investimento:'Investimento' }
const TIPO_ICONS  = { receita:'💰', fixo:'🏠', variavel:'🛒', cartao:'💳', investimento:'📈' }
const TIPO_BG     = { receita:'#e8f5ee', fixo:'#edf3fb', variavel:'#f0f4f1', cartao:'#fef6e7', investimento:'#f0ecfb' }
const CAT_COLORS  = ['#1a6b3c','#1a4f8a','#b7650a','#c0392b','#5b3d9e','#2d6e6e','#7a4419','#6b4c1a','#2d5a8a','#4a7c1a','#8a1a4f','#1a5a5a']

const fmt = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtM = ym => { const [y,m] = ym.split('-'); return new Date(y, m-1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) }
const todayYM = () => new Date().toISOString().slice(0,7)
const todayDate = () => new Date().toISOString().slice(0,10)

function Toast({ msg, type, onHide }) {
  useEffect(() => { const t = setTimeout(onHide, 2800); return () => clearTimeout(t) }, [onHide])
  return <div className={`toast ${type}`}>{msg}</div>
}

// ── DASHBOARD ───────────────────────────────────────────────────────────────
function Dashboard({ mes, setMes }) {
  const [txns, setTxns] = useState([])
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: t }, { data: b }] = await Promise.all([
      supabase.from('transactions').select('*').eq('month_ref', mes).order('date', { ascending: false }),
      supabase.from('budgets').select('*')
    ])
    setTxns(t || [])
    setBudgets(b || [])
    setLoading(false)
  }, [mes])

  useEffect(() => { load() }, [load])

  const receitas = txns.filter(t => t.type === 'receita').reduce((s,t) => s + Number(t.amount), 0)
  const despesas = txns.filter(t => t.type !== 'receita').reduce((s,t) => s + Number(t.amount), 0)
  const saldo = receitas - despesas
  const cartao = txns.filter(t => t.type === 'cartao').reduce((s,t) => s + Number(t.amount), 0)

  const byCat = {}
  txns.filter(t => t.type !== 'receita').forEach(t => { byCat[t.category] = (byCat[t.category]||0) + Number(t.amount) })
  const catEntries = Object.entries(byCat).sort((a,b) => b[1]-a[1])
  const maxCat = catEntries[0]?.[1] || 1

  return (
    <div>
      <div className="page-header">
        <h1>Finanças Maciel</h1>
        <div className="subtitle">Controle financeiro familiar</div>
      </div>
      <div className="month-selector">
        <button className="month-btn" onClick={() => { const [y,m]=mes.split('-').map(Number); const d=new Date(y,m-2,1); setMes(d.toISOString().slice(0,7)) }}>‹</button>
        <div className="month-label">{fmtM(mes)}</div>
        <button className="month-btn" onClick={() => { const [y,m]=mes.split('-').map(Number); const d=new Date(y,m,1); setMes(d.toISOString().slice(0,7)) }}>›</button>
      </div>

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
          <div className="metric-card" style={{ background: saldo >= 0 ? 'var(--green-pale)' : 'var(--red-light)', border: `1px solid ${saldo >= 0 ? '#c0e8d0' : '#f5c6c2'}` }}>
            <div className="label" style={{ color: saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>Saldo</div>
            <div className="value" style={{ color: saldo >= 0 ? 'var(--green)' : 'var(--red)', fontSize: '20px' }}>{fmt(saldo)}</div>
          </div>
          <div className="metric-card amber">
            <div className="label">Cartão</div>
            <div className="value">{fmt(cartao)}</div>
            <div className="sub">{txns.filter(t=>t.type==='cartao').length} lançamentos</div>
          </div>
        </div>

        {catEntries.length > 0 && (
          <div className="section">
            <div className="section-title">Gastos por categoria</div>
            <div className="chart-card">
              {catEntries.slice(0,8).map(([cat,val],i) => (
                <div className="cat-bar-row" key={cat}>
                  <div className="cat-bar-name">{cat}</div>
                  <div className="cat-bar-bg">
                    <div className="cat-bar-fill" style={{ width: `${(val/maxCat*100).toFixed(1)}%`, background: CAT_COLORS[i%CAT_COLORS.length] }}/>
                  </div>
                  <div className="cat-bar-val">{fmt(val)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="section">
          <div className="section-title">Últimos lançamentos</div>
          {txns.length === 0
            ? <div className="empty-state"><div className="icon">📭</div><h3>Nenhum lançamento</h3><p>Use o botão + para adicionar receitas e despesas deste mês.</p></div>
            : <div className="txn-list">{txns.slice(0,8).map(t => (
              <div className="txn-item" key={t.id}>
                <div className="txn-icon" style={{ background: TIPO_BG[t.type] }}>{TIPO_ICONS[t.type]}</div>
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

// ── LANÇAMENTOS ─────────────────────────────────────────────────────────────
function Lancamentos({ mes, setMes, toast }) {
  const [txns, setTxns] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterTipo, setFilterTipo] = useState('todos')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('transactions').select('*').eq('month_ref', mes).order('date', { ascending: false })
    setTxns(data || [])
    setLoading(false)
  }, [mes])

  useEffect(() => { load() }, [load])

  const del = async (id) => {
    if (!window.confirm('Remover este lançamento?')) return
    await supabase.from('transactions').delete().eq('id', id)
    toast('Lançamento removido', 'success')
    load()
  }

  const filtered = filterTipo === 'todos' ? txns : txns.filter(t => t.type === filterTipo)
  const total = filtered.reduce((s,t) => t.type==='receita' ? s+Number(t.amount) : s-Number(t.amount), 0)

  return (
    <div>
      <div className="page-header">
        <h1>Lançamentos</h1>
      </div>
      <div className="month-selector">
        <button className="month-btn" onClick={() => { const [y,m]=mes.split('-').map(Number); setMes(new Date(y,m-2,1).toISOString().slice(0,7)) }}>‹</button>
        <div className="month-label">{fmtM(mes)}</div>
        <button className="month-btn" onClick={() => { const [y,m]=mes.split('-').map(Number); setMes(new Date(y,m,1).toISOString().slice(0,7)) }}>›</button>
      </div>

      <div style={{ padding: '12px 16px 4px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {['todos',...TIPOS].map(t => (
          <button key={t} onClick={() => setFilterTipo(t)}
            style={{ padding: '6px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)',
              background: filterTipo===t ? 'var(--gray-900)' : 'var(--white)',
              color: filterTipo===t ? 'var(--white)' : 'var(--gray-500)' }}>
            {t==='todos' ? 'Todos' : TIPO_LABELS[t]}
          </button>
        ))}
      </div>

      {loading ? <div className="loading"><div className="spinner"/></div> : (
        <div className="section" style={{ paddingTop: 12 }}>
          {filtered.length === 0
            ? <div className="empty-state"><div className="icon">📭</div><h3>Nenhum lançamento</h3><p>Nenhum lançamento encontrado para este filtro.</p></div>
            : <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{filtered.length} lançamentos</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: total>=0?'var(--green)':'var(--red)' }}>{total>=0?'+':''}{fmt(total)}</span>
              </div>
              <div className="txn-list">
                {filtered.map(t => (
                  <div className="txn-item" key={t.id} style={{ position: 'relative' }}>
                    <div className="txn-icon" style={{ background: TIPO_BG[t.type] }}>{TIPO_ICONS[t.type]}</div>
                    <div className="txn-info">
                      <div className="txn-desc">{t.description}</div>
                      <div className="txn-meta">
                        <span className={`badge badge-${t.type}`}>{TIPO_LABELS[t.type]}</span>
                        {' '}{t.category} · {t.member||'—'} · {t.date?.slice(5).replace('-','/')}
                        {t.card && t.card !== 'N/A' ? ` · ${t.card}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <div className={`txn-amount ${t.type==='receita'?'income':'expense'}`}>
                        {t.type==='receita'?'+':'-'}{fmt(t.amount)}
                      </div>
                      <button className="btn-danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => del(t.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          }
        </div>
      )}
    </div>
  )
}

// ── NOVO LANÇAMENTO ──────────────────────────────────────────────────────────
function NovoLancamento({ mes, toast, onSaved }) {
  const [tipo, setTipo] = useState('variavel')
  const [form, setForm] = useState({ date: todayDate(), description: '', amount: '', category: '', member: '', card: 'N/A', installments: 1, notes: '' })
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [monthRef, setMonthRef] = useState(mes)

  useEffect(() => {
    supabase.from('members').select('name').then(({ data }) => setMembers(data?.map(m=>m.name)||[]))
  }, [])

  const cats = tipo === 'receita' ? CATEGORIAS_REC : CATEGORIAS_DESP

  const save = async () => {
    if (!form.description || !form.amount || !form.category) { toast('Preencha descrição, valor e categoria', 'error'); return }
    setLoading(true)
    const { error } = await supabase.from('transactions').insert({
      date: form.date, description: form.description, type: tipo,
      category: form.category, member: form.member, card: form.card,
      installments: Number(form.installments)||1, amount: parseFloat(form.amount),
      notes: form.notes, month_ref: monthRef
    })
    setLoading(false)
    if (error) { toast('Erro ao salvar: ' + error.message, 'error'); return }
    toast('Lançamento salvo!', 'success')
    setForm({ date: todayDate(), description: '', amount: '', category: '', member: '', card: 'N/A', installments: 1, notes: '' })
    onSaved()
  }

  return (
    <div>
      <div className="page-header"><h1>Novo lançamento</h1></div>
      <div className="form-card">
        <div className="form-group">
          <div className="form-label">Tipo</div>
          <div className="type-chips">
            {TIPOS.map(t => (
              <button key={t} className={`type-chip ${tipo===t?`selected-${t}`:''}`} onClick={() => { setTipo(t); setForm(f=>({...f,category:''})) }}>
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
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Membro</label>
            <select className="form-select" value={form.member} onChange={e=>setForm(f=>({...f,member:e.target.value}))}>
              <option value="">—</option>
              {members.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {tipo === 'cartao' && (
            <div className="form-group">
              <label className="form-label">Cartão</label>
              <select className="form-select" value={form.card} onChange={e=>setForm(f=>({...f,card:e.target.value}))}>
                {['Sicredi 7146','Sicredi 7230','Sicredi 7229','Sicredi 7138','Sicredi 7914','N/A'].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Observação (opcional)</label>
          <input type="text" className="form-input" placeholder="Ex: parcela 2/12" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
        </div>

        <button className="btn-primary" onClick={save} disabled={loading}>
          {loading ? 'Salvando...' : '✓ Salvar lançamento'}
        </button>
      </div>
    </div>
  )
}

// ── IMPORTAR JSON (fatura PDF via Claude) ────────────────────────────────────
function ImportarJSON({ mes, toast }) {
  const [json, setJson] = useState('')
  const [parsed, setParsed] = useState(null)
  const [selected, setSelected] = useState({})
  const [loading, setLoading] = useState(false)
  const [monthRef, setMonthRef] = useState(mes)

  const processar = () => {
    try {
      const obj = JSON.parse(json)
      const arr = obj.transactions || obj
      if (!Array.isArray(arr) || !arr.length) throw new Error('Nenhuma transação encontrada')
      const valid = arr.filter(t => t.amount > 0 && t.description)
      if (!valid.length) throw new Error('Nenhum lançamento válido')
      setParsed(valid)
      const sel = {}
      valid.forEach((_,i) => sel[i] = true)
      setSelected(sel)
    } catch(e) { toast('Erro: ' + e.message, 'error') }
  }

  const importar = async () => {
    const toImport = parsed.filter((_,i) => selected[i])
    if (!toImport.length) { toast('Selecione pelo menos um lançamento', 'error'); return }
    setLoading(true)
    const rows = toImport.map(t => ({
      date: t.date, description: t.description, type: 'cartao',
      category: t.category || 'Outros', member: t.member || '',
      card: 'Sicredi 7146', installments: 1,
      amount: parseFloat(t.amount), notes: t.notes || '', month_ref: monthRef
    }))
    const { error } = await supabase.from('transactions').insert(rows)
    setLoading(false)
    if (error) { toast('Erro: ' + error.message, 'error'); return }
    toast(`${rows.length} lançamentos importados!`, 'success')
    setJson(''); setParsed(null); setSelected({})
  }

  const total = parsed ? parsed.filter((_,i)=>selected[i]).reduce((s,t)=>s+t.amount,0) : 0

  return (
    <div>
      <div className="page-header">
        <h1>Importar fatura</h1>
        <div className="subtitle">Cole o JSON extraído pelo Claude</div>
      </div>
      <div className="form-card">
        <div style={{ background: 'var(--blue-light)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: 16, fontSize: 13, color: 'var(--blue)', lineHeight: 1.5 }}>
          💡 Envie o PDF da fatura no chat com o Claude → ele extrai os dados → copie o JSON aqui.
        </div>
        <div className="form-group">
          <label className="form-label">Mês de referência</label>
          <input type="month" className="form-input" value={monthRef} onChange={e=>setMonthRef(e.target.value)}/>
        </div>
        <div className="form-group">
          <label className="form-label">JSON da fatura</label>
          <textarea className="json-textarea" value={json} onChange={e=>setJson(e.target.value)}
            placeholder={'{"transactions":[{"date":"2026-05-10","description":"Lopes Supermercados","amount":558.26,"category":"Alimentação"},...]}'}/>
        </div>
        <button className="btn-primary" style={{ marginBottom: 0 }} onClick={processar}>Visualizar lançamentos</button>
      </div>

      {parsed && (
        <div className="form-card" style={{ marginTop: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{parsed.filter((_,i)=>selected[i]).length}/{parsed.length} selecionados</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{fmt(total)}</span>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={Object.values(selected).every(Boolean)}
                onChange={e => { const s={}; parsed.forEach((_,i)=>s[i]=e.target.checked); setSelected(s) }}/>
              Selecionar todos
            </label>
          </div>
          <div className="preview-scroll">
            <table className="preview-table">
              <thead><tr><th></th><th>Descrição</th><th>Categoria</th><th style={{textAlign:'right'}}>Valor</th></tr></thead>
              <tbody>
                {parsed.map((t,i) => (
                  <tr key={i} style={{ opacity: selected[i] ? 1 : .4 }}>
                    <td><input type="checkbox" checked={!!selected[i]} onChange={e=>setSelected(s=>({...s,[i]:e.target.checked}))}/></td>
                    <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</td>
                    <td>
                      <select className="select-native" value={t.category||'Outros'}
                        onChange={e=>{ const p=[...parsed]; p[i]={...p[i],category:e.target.value}; setParsed(p) }}>
                        {CATEGORIAS_DESP.map(c=><option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn-primary" onClick={importar} disabled={loading}>
            {loading ? 'Importando...' : `✓ Importar ${parsed.filter((_,i)=>selected[i]).length} lançamentos`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── ORÇAMENTOS ───────────────────────────────────────────────────────────────
function Orcamentos({ mes, setMes }) {
  const [txns, setTxns] = useState([])
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [editVal, setEditVal] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: t }, { data: b }] = await Promise.all([
      supabase.from('transactions').select('category,amount,type').eq('month_ref', mes),
      supabase.from('budgets').select('*')
    ])
    setTxns(t||[]); setBudgets(b||[]); setLoading(false)
  }, [mes])

  useEffect(() => { load() }, [load])

  const spent = {}
  txns.filter(t=>t.type!=='receita').forEach(t=>{ spent[t.category]=(spent[t.category]||0)+Number(t.amount) })

  const saveBudget = async (cat, val) => {
    const existing = budgets.find(b=>b.category===cat)
    if (existing) await supabase.from('budgets').update({ amount: val }).eq('category', cat)
    else await supabase.from('budgets').insert({ category: cat, amount: val })
    setEditing(null); load()
  }

  return (
    <div>
      <div className="page-header"><h1>Orçamentos</h1></div>
      <div className="month-selector">
        <button className="month-btn" onClick={() => { const [y,m]=mes.split('-').map(Number); setMes(new Date(y,m-2,1).toISOString().slice(0,7)) }}>‹</button>
        <div className="month-label">{fmtM(mes)}</div>
        <button className="month-btn" onClick={() => { const [y,m]=mes.split('-').map(Number); setMes(new Date(y,m,1).toISOString().slice(0,7)) }}>›</button>
      </div>
      {loading ? <div className="loading"><div className="spinner"/></div> : (
        <div className="section" style={{ paddingTop: 12 }}>
          {CATEGORIAS_DESP.map(cat => {
            const bud = budgets.find(b=>b.category===cat)?.amount || 0
            const sp = spent[cat] || 0
            const pct = bud > 0 ? Math.min(sp/bud, 1.2) : 0
            const color = sp > bud && bud > 0 ? 'var(--red)' : pct > .8 ? 'var(--amber)' : 'var(--green)'
            return (
              <div className="budget-item" key={cat}>
                <div className="budget-header">
                  <div className="budget-cat">{cat}</div>
                  {editing === cat
                    ? <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <input type="number" style={{ width:90, padding:'4px 8px', border:'1.5px solid var(--green-mid)', borderRadius:8, fontSize:13, fontFamily:'var(--font-body)' }}
                          value={editVal} onChange={e=>setEditVal(e.target.value)} autoFocus/>
                        <button className="btn-secondary" style={{ padding:'4px 10px', fontSize:12 }} onClick={()=>saveBudget(cat,parseFloat(editVal)||0)}>✓</button>
                        <button className="btn-secondary" style={{ padding:'4px 10px', fontSize:12 }} onClick={()=>setEditing(null)}>✕</button>
                      </div>
                    : <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                        <div className="budget-vals">{fmt(sp)} {bud>0?`/ ${fmt(bud)}`:''}</div>
                        <button className="btn-secondary" style={{ padding:'4px 10px', fontSize:11 }} onClick={()=>{ setEditing(cat); setEditVal(bud||'') }}>Editar</button>
                      </div>
                  }
                </div>
                {bud > 0 && <>
                  <div className="budget-bar-bg">
                    <div className="budget-bar-fill" style={{ width:`${Math.min(pct*100,100)}%`, background: color }}/>
                  </div>
                  {sp > bud && <div style={{ fontSize:11, color:'var(--red)', marginTop:4 }}>Excedido em {fmt(sp-bud)}</div>}
                </>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── APP PRINCIPAL ─────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [mes, setMes] = useState(todayYM)
  const [toastData, setToastData] = useState(null)

  const toast = (msg, type='success') => setToastData({ msg, type })

  const tabs = [
    { id:'dashboard', label:'Início', icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg> },
    { id:'lancamentos', label:'Extrato', icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg> },
    { id:'novo', label:'Lançar', icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> },
    { id:'importar', label:'Fatura PDF', icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9,15 12,18 15,15"/></svg> },
    { id:'orcamentos', label:'Orçamento', icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  ]

  return (
    <div className="app-shell">
      <div className="page-content">
        {tab === 'dashboard'   && <Dashboard mes={mes} setMes={setMes}/>}
        {tab === 'lancamentos' && <Lancamentos mes={mes} setMes={setMes} toast={toast}/>}
        {tab === 'novo'        && <NovoLancamento mes={mes} toast={toast} onSaved={()=>setTab('lancamentos')}/>}
        {tab === 'importar'    && <ImportarJSON mes={mes} toast={toast}/>}
        {tab === 'orcamentos'  && <Orcamentos mes={mes} setMes={setMes}/>}
      </div>

      <nav className="bottom-nav">
        {tabs.map(t => (
          <button key={t.id} className={`nav-item ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
            {t.icon}{t.label}
          </button>
        ))}
      </nav>

      {toastData && <Toast msg={toastData.msg} type={toastData.type} onHide={()=>setToastData(null)}/>}
    </div>
  )
}
