import React, { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { supabase } from './supabase'
import './index.css'

const TIPO_LABELS = { receita:'Receita', fixo:'Conta fixa', variavel:'Variável', cartao:'Cartão', investimento:'Investimento' }
const TIPO_ICONS  = { receita:'💰', fixo:'🏠', variavel:'🛒', cartao:'💳', investimento:'📈' }
const TIPO_BG     = { receita:'#e8f5ee', fixo:'#edf3fb', variavel:'#f0f4f1', cartao:'#fef6e7', investimento:'#f0ecfb' }
const TIPOS       = ['receita','fixo','variavel','cartao','investimento']
const CAT_COLORS  = ['#1a6b3c','#1a4f8a','#b7650a','#c0392b','#5b3d9e','#2d6e6e','#7a4419','#4a7c1a','#8a1a4f','#1a5a5a','#6b4c1a','#2d5a8a']
const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const fmt = n => Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const fmtM = ym => { const [y,m]=ym.split('-'); return new Date(y,m-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}) }
const todayYM   = () => new Date().toISOString().slice(0,7)
const todayDate = () => new Date().toISOString().slice(0,10)
const useDesktop = () => {
  const [d,setD]=useState(window.innerWidth>=768)
  useEffect(()=>{ const h=()=>setD(window.innerWidth>=768); window.addEventListener('resize',h); return()=>window.removeEventListener('resize',h) },[])
  return d
}

// Calcula mês ref baseado na data da compra e fechamento do cartão
function calcMonthRef(purchaseDate, closingDay, manualMonthRef) {
  if (manualMonthRef) return manualMonthRef
  if (!purchaseDate || !closingDay) return todayYM()
  const d = new Date(purchaseDate)
  const day = d.getDate()
  // Se a compra foi APÓS o fechamento, cai na próxima fatura
  if (day > closingDay) {
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    return next.toISOString().slice(0,7)
  }
  return d.toISOString().slice(0,7)
}

// Extrai info de parcela do texto (ex: "01/12", "02/10")
function parseInstallment(description) {
  const match = description.match(/(\d{1,2})\/(\d{1,2})/)
  if (!match) return null
  const current = parseInt(match[1])
  const total = parseInt(match[2])
  if (current >= 1 && total > 1 && current <= total) {
    return { current, total }
  }
  return null
}

const AppCtx = createContext({})
const useApp = () => useContext(AppCtx)

function Toast({ msg, type, onHide }) {
  useEffect(()=>{ const t=setTimeout(onHide,2800); return()=>clearTimeout(t) },[onHide])
  return <div className={`toast ${type}`}>{msg}</div>
}

function MonthNav({ mes, setMes }) {
  const prev=()=>{ const [y,m]=mes.split('-').map(Number); setMes(new Date(y,m-2,1).toISOString().slice(0,7)) }
  const next=()=>{ const [y,m]=mes.split('-').map(Number); setMes(new Date(y,m,1).toISOString().slice(0,7)) }
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
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={onClose}>
      <div style={{background:'var(--white)',borderRadius:'24px 24px 0 0',width:'100%',maxWidth:560,maxHeight:'92vh',overflowY:'auto',padding:'20px 20px 40px'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <h2 style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:400}}>{title}</h2>
          <button onClick={onClose} style={{background:'var(--gray-100)',border:'none',borderRadius:'50%',width:32,height:32,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ConfigSection({ title, children }) {
  return (
    <div className="form-card" style={{marginBottom:12}}>
      <div style={{fontFamily:'var(--font-display)',fontSize:17,marginBottom:14,fontWeight:400}}>{title}</div>
      {children}
    </div>
  )
}

function ConfigRow({ name, onDel, extra }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--gray-100)'}}>
      <span style={{flex:1,fontSize:14}}>{name}</span>
      {extra}
      <button className="btn-danger" style={{padding:'3px 10px',fontSize:12}} onClick={onDel}>Remover</button>
    </div>
  )
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({ mes, setMes }) {
  const [txns,setTxns]=useState([])
  const [loading,setLoading]=useState(true)
  const [parcelas,setParcelas]=useState([])
  const desktop=useDesktop()

  const load=useCallback(async()=>{
    setLoading(true)
    const [{data:t},{data:p}]=await Promise.all([
      supabase.from('transactions').select('*').eq('month_ref',mes).order('date',{ascending:false}),
      supabase.from('installments').select('*').eq('month_ref',mes).order('current_installment')
    ])
    setTxns(t||[]); setParcelas(p||[]); setLoading(false)
  },[mes])
  useEffect(()=>{ load() },[load])

  const receitas=txns.filter(t=>t.type==='receita').reduce((s,t)=>s+Number(t.amount),0)
  const despesas=txns.filter(t=>t.type!=='receita').reduce((s,t)=>s+Number(t.amount),0)
  const saldo=receitas-despesas
  const cartao=txns.filter(t=>t.type==='cartao').reduce((s,t)=>s+Number(t.amount),0)
  const byCat={};txns.filter(t=>t.type!=='receita').forEach(t=>{byCat[t.category]=(byCat[t.category]||0)+Number(t.amount)})
  const catEntries=Object.entries(byCat).sort((a,b)=>b[1]-a[1])
  const maxCat=catEntries[0]?.[1]||1
  const byMember={};txns.filter(t=>t.type!=='receita').forEach(t=>{const k=t.member||'Família';byMember[k]=(byMember[k]||0)+Number(t.amount)})

  // Parcelas dos próximos 3 meses
  const [futureParcelas,setFutureParcelas]=useState([])
  useEffect(()=>{
    const loadFuture=async()=>{
      const meses=[]
      const [y,m]=mes.split('-').map(Number)
      for(let i=1;i<=3;i++){
        const d=new Date(y,m-1+i,1)
        meses.push(d.toISOString().slice(0,7))
      }
      const {data}=await supabase.from('installments').select('*').in('month_ref',meses).order('month_ref').order('description')
      setFutureParcelas(data||[])
    }
    loadFuture()
  },[mes])

  return (
    <div>
      <div className="page-header"><h1>Finanças Maciel</h1><div className="subtitle">Controle financeiro familiar</div></div>
      <MonthNav mes={mes} setMes={setMes}/>
      {loading?<div className="loading"><div className="spinner"/></div>:<>
        <div className="metrics-grid">
          <div className="metric-card green"><div className="label">Receitas</div><div className="value">{fmt(receitas)}</div></div>
          <div className="metric-card red"><div className="label">Despesas</div><div className="value">{fmt(despesas)}</div></div>
          <div className="metric-card" style={{background:saldo>=0?'var(--green-pale)':'var(--red-light)',border:`1px solid ${saldo>=0?'#c0e8d0':'#f5c6c2'}`}}>
            <div className="label" style={{color:saldo>=0?'var(--green)':'var(--red)'}}>Saldo</div>
            <div className="value" style={{color:saldo>=0?'var(--green)':'var(--red)',fontSize:20}}>{fmt(saldo)}</div>
          </div>
          <div className="metric-card amber"><div className="label">Cartão</div><div className="value">{fmt(cartao)}</div><div className="sub">{txns.filter(t=>t.type==='cartao').length} lançamentos</div></div>
        </div>

        {/* Parcelas futuras */}
        {futureParcelas.length>0&&(
          <div className="section">
            <div className="section-title">⏳ Parcelas nos próximos meses</div>
            <div className="chart-card" style={{padding:'12px 14px'}}>
              {['1','2','3'].map(offset=>{
                const [y,m]=mes.split('-').map(Number)
                const futMes=new Date(y,m-1+parseInt(offset),1).toISOString().slice(0,7)
                const items=futureParcelas.filter(p=>p.month_ref===futMes)
                if(!items.length) return null
                const total=items.reduce((s,p)=>s+Number(p.installment_amount),0)
                return(
                  <div key={futMes} style={{marginBottom:12}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                      <span style={{fontSize:12,fontWeight:600,color:'var(--gray-500)',textTransform:'uppercase',letterSpacing:'.05em'}}>{fmtM(futMes)}</span>
                      <span style={{fontSize:13,fontWeight:700,color:'var(--amber)'}}>{fmt(total)}</span>
                    </div>
                    {items.map(p=>(
                      <div key={p.id} style={{display:'flex',justifyContent:'space-between',fontSize:13,padding:'4px 0',borderBottom:'1px solid var(--gray-100)'}}>
                        <span style={{color:'var(--gray-700)',flex:1}}>{p.description}</span>
                        <span style={{color:'var(--gray-500)',marginRight:12,fontSize:11}}>{p.current_installment}/{p.total_installments}x</span>
                        <span style={{fontWeight:500}}>{fmt(p.installment_amount)}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className={desktop?'desktop-grid':'section'} style={!desktop?{paddingTop:0}:{}}>
          {catEntries.length>0&&(
            <div>
              <div className="section-title" style={desktop?{paddingTop:0}:{}}>Por categoria</div>
              <div className="chart-card">
                {catEntries.slice(0,8).map(([cat,val],i)=>(
                  <div className="cat-bar-row" key={cat}>
                    <div className="cat-bar-name">{cat}</div>
                    <div className="cat-bar-bg"><div className="cat-bar-fill" style={{width:`${(val/maxCat*100).toFixed(1)}%`,background:CAT_COLORS[i%CAT_COLORS.length]}}/></div>
                    <div className="cat-bar-val">{fmt(val)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Object.keys(byMember).length>0&&(
            <div>
              <div className="section-title" style={desktop?{paddingTop:0}:{}}>Por membro</div>
              <div className="chart-card">
                {Object.entries(byMember).sort((a,b)=>b[1]-a[1]).map(([mbr,val],i)=>(
                  <div className="cat-bar-row" key={mbr}>
                    <div className="cat-bar-name">{mbr}</div>
                    <div className="cat-bar-bg"><div className="cat-bar-fill" style={{width:`${(val/despesas*100).toFixed(1)}%`,background:CAT_COLORS[(i+4)%CAT_COLORS.length]}}/></div>
                    <div className="cat-bar-val">{fmt(val)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="section">
          <div className="section-title">Últimos lançamentos</div>
          {txns.length===0
            ?<div className="empty-state"><div className="icon">📭</div><h3>Nenhum lançamento</h3><p>Use "Lançar" para adicionar.</p></div>
            :<div className="txn-list">{txns.slice(0,desktop?10:6).map(t=>(
              <div className="txn-item" key={t.id}>
                <div className="txn-icon" style={{background:TIPO_BG[t.type]}}>{TIPO_ICONS[t.type]}</div>
                <div className="txn-info">
                  <div className="txn-desc">{t.description}</div>
                  <div className="txn-meta">{t.category} · {t.date?.slice(5).replace('-','/')}</div>
                </div>
                <div className={`txn-amount ${t.type==='receita'?'income':'expense'}`}>{t.type==='receita'?'+':'-'}{fmt(t.amount)}</div>
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
  const {categories,members}=useApp()
  const [txns,setTxns]=useState([])
  const [loading,setLoading]=useState(true)
  const [filterTipo,setFilter]=useState('todos')
  const [editTxn,setEditTxn]=useState(null)

  const load=useCallback(async()=>{
    setLoading(true)
    const {data}=await supabase.from('transactions').select('*').eq('month_ref',mes).order('date',{ascending:false})
    setTxns(data||[]); setLoading(false)
  },[mes])
  useEffect(()=>{ load() },[load])

  const del=async id=>{
    if(!window.confirm('Remover?'))return
    await supabase.from('transactions').delete().eq('id',id)
    toast('Removido','success'); load()
  }
  const saveEdit=async()=>{
    const {id,...rest}=editTxn
    await supabase.from('transactions').update({description:rest.description,amount:parseFloat(rest.amount),category:rest.category,member:rest.member,type:rest.type,date:rest.date,notes:rest.notes}).eq('id',id)
    toast('Atualizado!','success'); setEditTxn(null); load()
  }

  const filtered=filterTipo==='todos'?txns:txns.filter(t=>t.type===filterTipo)
  const total=filtered.reduce((s,t)=>t.type==='receita'?s+Number(t.amount):s-Number(t.amount),0)
  const catsByType=tipo=>categories.filter(c=>tipo==='receita'?c.type==='receita':c.type==='despesa').map(c=>c.name)

  return (
    <div>
      <div className="page-header"><h1>Extrato</h1></div>
      <MonthNav mes={mes} setMes={setMes}/>
      <div style={{padding:'10px 16px 4px',display:'flex',gap:6,overflowX:'auto'}}>
        {['todos',...TIPOS].map(t=>(
          <button key={t} onClick={()=>setFilter(t)} style={{padding:'6px 12px',borderRadius:20,border:'none',fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'var(--font-body)',background:filterTipo===t?'var(--gray-900)':'var(--white)',color:filterTipo===t?'var(--white)':'var(--gray-500)'}}>
            {t==='todos'?'Todos':TIPO_LABELS[t]}
          </button>
        ))}
      </div>
      {loading?<div className="loading"><div className="spinner"/></div>:(
        <div className="section" style={{paddingTop:12}}>
          {filtered.length===0
            ?<div className="empty-state"><div className="icon">📭</div><h3>Sem lançamentos</h3></div>
            :<>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontSize:12,color:'var(--gray-500)'}}>{filtered.length} lançamentos</span>
                <span style={{fontSize:13,fontWeight:700,color:total>=0?'var(--green)':'var(--red)'}}>{total>=0?'+':''}{fmt(total)}</span>
              </div>
              <div className="txn-list">{filtered.map(t=>(
                <div className="txn-item" key={t.id}>
                  <div className="txn-icon" style={{background:TIPO_BG[t.type]}}>{TIPO_ICONS[t.type]}</div>
                  <div className="txn-info" onClick={()=>setEditTxn({...t})} style={{cursor:'pointer'}}>
                    <div className="txn-desc">{t.description}</div>
                    <div className="txn-meta">
                      <span className={`badge badge-${t.type}`}>{TIPO_LABELS[t.type]}</span>
                      {' '}{t.category} · {t.member||'—'} · {t.date?.slice(5).replace('-','/')}
                      {t.installments>1&&<span style={{background:'var(--purple-light)',color:'var(--purple)',fontSize:10,fontWeight:600,padding:'2px 6px',borderRadius:20,marginLeft:4}}>{t.installments}x</span>}
                    </div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                    <div className={`txn-amount ${t.type==='receita'?'income':'expense'}`}>{t.type==='receita'?'+':'-'}{fmt(t.amount)}</div>
                    <div style={{display:'flex',gap:4}}>
                      <button style={{padding:'3px 8px',fontSize:11,background:'var(--blue-light)',color:'var(--blue)',border:'none',borderRadius:6,cursor:'pointer'}} onClick={()=>setEditTxn({...t})}>✏️</button>
                      <button className="btn-danger" style={{padding:'3px 8px',fontSize:11}} onClick={()=>del(t.id)}>✕</button>
                    </div>
                  </div>
                </div>
              ))}</div>
            </>
          }
        </div>
      )}
      {editTxn&&(
        <Modal title="Editar lançamento" onClose={()=>setEditTxn(null)}>
          <div className="form-group"><label className="form-label">Descrição</label><input className="form-input" value={editTxn.description} onChange={e=>setEditTxn(v=>({...v,description:e.target.value}))}/></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Valor</label><input type="number" className="form-input" value={editTxn.amount} onChange={e=>setEditTxn(v=>({...v,amount:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Data</label><input type="date" className="form-input" value={editTxn.date} onChange={e=>setEditTxn(v=>({...v,date:e.target.value}))}/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Tipo</label><select className="form-select" value={editTxn.type} onChange={e=>setEditTxn(v=>({...v,type:e.target.value}))}>{TIPOS.map(t=><option key={t} value={t}>{TIPO_LABELS[t]}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Categoria</label><select className="form-select" value={editTxn.category} onChange={e=>setEditTxn(v=>({...v,category:e.target.value}))}>{catsByType(editTxn.type).map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div className="form-group"><label className="form-label">Membro</label><select className="form-select" value={editTxn.member||''} onChange={e=>setEditTxn(v=>({...v,member:e.target.value}))}><option value="">—</option>{members.map(m=><option key={m.name} value={m.name}>{m.name}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Observação</label><input className="form-input" value={editTxn.notes||''} onChange={e=>setEditTxn(v=>({...v,notes:e.target.value}))}/></div>
          <button className="btn-primary" onClick={saveEdit}>✓ Salvar alterações</button>
        </Modal>
      )}
    </div>
  )
}

// ── NOVO LANÇAMENTO ──────────────────────────────────────────────────────────
function NovoLancamento({ mes, toast, onSaved }) {
  const {categories,cards,members}=useApp()
  const [tipo,setTipo]=useState('variavel')
  const [loading,setLoading]=useState(false)
  const [manualMonth,setManualMonth]=useState('')
  const [desc,setDesc]=useState('')
  const [amount,setAmount]=useState('')
  const [totalInstall,setTotalInstall]=useState(1)
  const [category,setCategory]=useState('')
  const [member,setMember]=useState('')
  const [selectedCard,setSelectedCard]=useState('')
  const [notes,setNotes]=useState('')
  const [date,setDate]=useState(todayDate())

  const cats=categories.filter(c=>tipo==='receita'?c.type==='receita':c.type==='despesa')

  // Calcular mês ref automático
  const cardInfo=cards.find(c=>c.name===selectedCard)
  const autoMonth=tipo==='cartao'&&cardInfo?.closing_day
    ? calcMonthRef(date, cardInfo.closing_day, null)
    : mes
  const effectiveMonth=manualMonth||autoMonth

  const save=async()=>{
    if(!desc||!amount||!category){toast('Preencha descrição, valor e categoria','error');return}
    setLoading(true)
    const totalAmt=parseFloat(amount)
    const installAmt=totalInstall>1?totalAmt/totalInstall:totalAmt
    const groupId=crypto.randomUUID()

    // Inserir todos os lançamentos parcelados
    const rows=[]
    const installRows=[]
    for(let i=0;i<(totalInstall||1);i++){
      const [y,m]=effectiveMonth.split('-').map(Number)
      const futMes=new Date(y,m-1+i,1).toISOString().slice(0,7)
      const parcDesc=totalInstall>1?`${desc} (${i+1}/${totalInstall})`:desc
      rows.push({date,description:parcDesc,type:tipo,category,member,card:selectedCard,installments:totalInstall,amount:installAmt,notes,month_ref:futMes})
    }

    const {data:inserted,error}=await supabase.from('transactions').insert(rows).select()
    if(error){toast('Erro: '+error.message,'error');setLoading(false);return}

    // Registrar na tabela installments se parcelado
    if(totalInstall>1&&inserted){
      for(let i=0;i<inserted.length;i++){
        const [y,m]=effectiveMonth.split('-').map(Number)
        const futMes=new Date(y,m-1+i,1).toISOString().slice(0,7)
        installRows.push({
          group_id:groupId, description:desc,
          total_amount:totalAmt, installment_amount:installAmt,
          total_installments:totalInstall, current_installment:i+1,
          card:selectedCard, category, member,
          month_ref:futMes, transaction_id:inserted[i].id
        })
      }
      await supabase.from('installments').insert(installRows)
    }

    setLoading(false)
    toast(totalInstall>1?`${totalInstall} parcelas criadas de ${fmtM(effectiveMonth)} a ${fmtM((() => { const [y,m]=effectiveMonth.split('-').map(Number); return new Date(y,m-1+totalInstall-1,1).toISOString().slice(0,7) })())}!`:'Lançamento salvo!','success')
    setDesc(''); setAmount(''); setCategory(''); setMember(''); setNotes(''); setTotalInstall(1); setManualMonth('')
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
              <button key={t} className={`type-chip ${tipo===t?`selected-${t}`:''}`} onClick={()=>{setTipo(t);setCategory('')}}>
                {TIPO_ICONS[t]} {TIPO_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Data da compra</label><input type="date" className="form-input" value={date} onChange={e=>setDate(e.target.value)}/></div>
          <div className="form-group">
            <label className="form-label">
              Mês ref. {tipo==='cartao'&&cardInfo?.closing_day&&!manualMonth&&<span style={{color:'var(--green)',fontSize:10}}>(automático)</span>}
            </label>
            <input type="month" className="form-input" value={effectiveMonth} onChange={e=>setManualMonth(e.target.value)} placeholder="Auto"/>
          </div>
        </div>
        {tipo==='cartao'&&cardInfo?.closing_day&&(
          <div style={{background:'var(--green-pale)',borderRadius:'var(--border-radius-md,8px)',padding:'8px 12px',fontSize:12,color:'var(--green)',marginBottom:12}}>
            📅 Fechamento dia {cardInfo.closing_day} · Vencimento dia {cardInfo.due_day} · Lançando em <strong>{fmtM(effectiveMonth)}</strong>
            {!manualMonth&&<button onClick={()=>setManualMonth(effectiveMonth)} style={{marginLeft:8,fontSize:11,background:'none',border:'none',color:'var(--green)',cursor:'pointer',textDecoration:'underline'}}>Mudar mês</button>}
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Descrição</label>
          <input type="text" className="form-input" placeholder="Ex: Lopes Supermercados" value={desc} onChange={e=>setDesc(e.target.value)}/>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Valor total (R$)</label>
            <input type="number" className="form-input" placeholder="0,00" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/>
          </div>
          <div className="form-group">
            <label className="form-label">Parcelas</label>
            <input type="number" className="form-input" min="1" max="48" value={totalInstall} onChange={e=>setTotalInstall(parseInt(e.target.value)||1)}/>
          </div>
        </div>
        {totalInstall>1&&amount&&(
          <div style={{background:'var(--purple-light)',borderRadius:8,padding:'8px 12px',fontSize:12,color:'var(--purple)',marginBottom:12}}>
            💳 {totalInstall}x de {fmt(parseFloat(amount)/totalInstall)} · Total: {fmt(parseFloat(amount))} · Lançamentos criados de <strong>{fmtM(effectiveMonth)}</strong> até <strong>{fmtM((()=>{ const [y,m]=effectiveMonth.split('-').map(Number); return new Date(y,m-1+totalInstall-1,1).toISOString().slice(0,7) })())}</strong>
          </div>
        )}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Categoria</label>
            <select className="form-select" value={category} onChange={e=>setCategory(e.target.value)}>
              <option value="">Selecione</option>
              {cats.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Membro</label>
            <select className="form-select" value={member} onChange={e=>setMember(e.target.value)}>
              <option value="">—</option>
              {members.map(m=><option key={m.name} value={m.name}>{m.name}</option>)}
            </select>
          </div>
        </div>
        {tipo==='cartao'&&(
          <div className="form-group">
            <label className="form-label">Cartão</label>
            <select className="form-select" value={selectedCard} onChange={e=>setSelectedCard(e.target.value)}>
              <option value="">Selecione</option>
              {cards.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Observação</label>
          <input type="text" className="form-input" placeholder="Opcional" value={notes} onChange={e=>setNotes(e.target.value)}/>
        </div>
        <button className="btn-primary" onClick={save} disabled={loading}>
          {loading?'Salvando...':totalInstall>1?`✓ Criar ${totalInstall} parcelas`:'✓ Salvar lançamento'}
        </button>
      </div>
    </div>
  )
}

// ── IMPORTAR JSON — com detecção de parcelas e fechamento ────────────────────
function ImportarJSON({ mes, toast }) {
  const {categories,cards}=useApp()
  const [json,setJson]=useState('')
  const [parsed,setParsed]=useState(null)
  const [selected,setSelected]=useState({})
  const [loading,setLoading]=useState(false)
  const [selectedCardName,setSelectedCardName]=useState('Sicredi 7146')
  const [useAutoMonth,setUseAutoMonth]=useState(true)
  const [manualMonth,setManualMonth]=useState(mes)
  const catNames=categories.filter(c=>c.type==='despesa').map(c=>c.name)

  const cardInfo=cards.find(c=>c.name===selectedCardName)

  const processar=()=>{
    try{
      const obj=JSON.parse(json); const arr=obj.transactions||obj
      if(!Array.isArray(arr)||!arr.length) throw new Error('Nenhuma transação encontrada')
      const valid=arr.filter(t=>t.amount>0&&t.description)
      if(!valid.length) throw new Error('Nenhum lançamento válido')

      // Detectar parcelas e calcular mês ref
      const enriched=valid.map(t=>{
        const installInfo=parseInstallment(t.description)
        const autoMes=cardInfo?.closing_day
          ? calcMonthRef(t.date, cardInfo.closing_day, null)
          : (t.date?.slice(0,7)||mes)

        // Ajustar mês baseado na parcela atual
        let targetMes=useAutoMonth?autoMes:manualMonth
        if(installInfo){
          // Já é a parcela atual — o mês base é calculado como se fosse a parcela 1
          // targetMes permanece como calculado
        }

        return {
          ...t,
          installInfo,
          targetMes,
          isInstallment: !!installInfo
        }
      })

      setParsed(enriched)
      const sel={}; enriched.forEach((_,i)=>sel[i]=true); setSelected(sel)
    }catch(e){toast('Erro: '+e.message,'error')}
  }

  const importar=async()=>{
    const toImport=parsed.filter((_,i)=>selected[i])
    if(!toImport.length){toast('Selecione pelo menos um','error');return}
    setLoading(true)

    const txnRows=toImport.map(t=>({
      date:t.date,
      description:t.description,
      type:'cartao',
      category:t.category||'Outros',
      member:t.member||'',
      card:selectedCardName,
      installments:t.installInfo?t.installInfo.total:1,
      amount:t.amount,
      notes:t.notes||'',
      month_ref:t.targetMes
    }))

    const {data:inserted,error}=await supabase.from('transactions').insert(txnRows).select()
    if(error){toast('Erro: '+error.message,'error');setLoading(false);return}

    // Registrar parcelas na tabela installments
    const installRows=[]
    toImport.forEach((t,i)=>{
      if(t.installInfo&&inserted[i]){
        installRows.push({
          group_id:crypto.randomUUID(),
          description:t.description.replace(/\s*\d{1,2}\/\d{1,2}\s*$/,'').trim(),
          total_amount:t.amount*t.installInfo.total,
          installment_amount:t.amount,
          total_installments:t.installInfo.total,
          current_installment:t.installInfo.current,
          card:selectedCardName,
          category:t.category||'Outros',
          member:t.member||'',
          month_ref:t.targetMes,
          transaction_id:inserted[i].id
        })
      }
    })
    if(installRows.length>0){
      await supabase.from('installments').insert(installRows)
    }

    setLoading(false)
    toast(`${toImport.length} lançamentos importados! (${installRows.length} parcelados detectados)`,'success')
    setJson(''); setParsed(null); setSelected({})
  }

  const total=parsed?parsed.filter((_,i)=>selected[i]).reduce((s,t)=>s+t.amount,0):0
  const nParcelados=parsed?parsed.filter((_,i)=>selected[i]&&parsed[i].isInstallment).length:0

  return (
    <div>
      <div className="page-header"><h1>Importar fatura</h1><div className="subtitle">Cole o JSON extraído pelo Claude</div></div>
      <div className="form-card">
        <div style={{background:'var(--blue-light)',borderRadius:8,padding:'12px 14px',marginBottom:16,fontSize:13,color:'var(--blue)',lineHeight:1.5}}>
          💡 Envie o PDF da fatura no chat → Claude extrai → copie o JSON e cole abaixo.
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Cartão da fatura</label>
            <select className="form-select" value={selectedCardName} onChange={e=>setSelectedCardName(e.target.value)}>
              {cards.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Mês de referência</label>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <label style={{fontSize:12,display:'flex',alignItems:'center',gap:4,whiteSpace:'nowrap',cursor:'pointer'}}>
                <input type="checkbox" checked={useAutoMonth} onChange={e=>setUseAutoMonth(e.target.checked)}/>
                Auto
              </label>
              {!useAutoMonth&&<input type="month" className="form-input" style={{margin:0}} value={manualMonth} onChange={e=>setManualMonth(e.target.value)}/>}
            </div>
          </div>
        </div>

        {cardInfo?.closing_day&&(
          <div style={{background:'var(--green-pale)',borderRadius:8,padding:'8px 12px',fontSize:12,color:'var(--green)',marginBottom:12}}>
            📅 Fechamento dia <strong>{cardInfo.closing_day}</strong> · Vencimento dia <strong>{cardInfo.due_day}</strong> · O mês será calculado automaticamente por data de compra
          </div>
        )}

        <div className="form-group">
          <label className="form-label">JSON da fatura</label>
          <textarea className="json-textarea" value={json} onChange={e=>setJson(e.target.value)} placeholder='{"transactions":[...]}' rows={5}/>
        </div>
        <button className="btn-primary" style={{marginBottom:0}} onClick={processar}>Visualizar lançamentos</button>
      </div>

      {parsed&&(
        <div className="form-card" style={{marginTop:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <span style={{fontSize:14,fontWeight:600}}>{parsed.filter((_,i)=>selected[i]).length}/{parsed.length} selecionados</span>
            <span style={{fontSize:13,fontWeight:700,color:'var(--green)'}}>{fmt(total)}</span>
          </div>
          {nParcelados>0&&(
            <div style={{background:'var(--purple-light)',borderRadius:8,padding:'8px 12px',fontSize:12,color:'var(--purple)',marginBottom:10}}>
              💳 {nParcelados} lançamento(s) parcelado(s) detectado(s) — serão registrados no painel de parcelas futuras.
            </div>
          )}
          <label style={{fontSize:13,display:'flex',alignItems:'center',gap:6,cursor:'pointer',marginBottom:10}}>
            <input type="checkbox" checked={Object.values(selected).every(Boolean)} onChange={e=>{const s={};parsed.forEach((_,i)=>s[i]=e.target.checked);setSelected(s)}}/>
            Selecionar todos
          </label>
          <div className="preview-scroll">
            <table className="preview-table">
              <thead><tr><th></th><th>Descrição</th><th>Cat.</th><th>Mês</th><th style={{textAlign:'right'}}>Valor</th></tr></thead>
              <tbody>{parsed.map((t,i)=>(
                <tr key={i} style={{opacity:selected[i]?1:.4,background:t.isInstallment?'#f8f5ff':''}}>
                  <td><input type="checkbox" checked={!!selected[i]} onChange={e=>setSelected(s=>({...s,[i]:e.target.checked}))}/></td>
                  <td style={{maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {t.description}
                    {t.isInstallment&&<span style={{marginLeft:4,fontSize:10,background:'var(--purple-light)',color:'var(--purple)',padding:'1px 5px',borderRadius:10}}>{t.installInfo.current}/{t.installInfo.total}x</span>}
                  </td>
                  <td><select className="select-native" value={t.category||'Outros'} onChange={e=>{const p=[...parsed];p[i]={...p[i],category:e.target.value};setParsed(p)}}>{catNames.map(c=><option key={c} value={c}>{c}</option>)}</select></td>
                  <td style={{fontSize:11,color:'var(--gray-500)',whiteSpace:'nowrap'}}>{t.targetMes}</td>
                  <td style={{textAlign:'right',fontWeight:600}}>{fmt(t.amount)}</td>
                </tr>
              ))}</tbody>
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

// ── PARCELAS ──────────────────────────────────────────────────────────────────
function Parcelas({ mes, setMes }) {
  const [parcelas,setParcelas]=useState([])
  const [loading,setLoading]=useState(true)

  const load=useCallback(async()=>{
    setLoading(true)
    // Carregar parcelas dos próximos 12 meses a partir do mês atual
    const meses=[]
    const [y,m]=mes.split('-').map(Number)
    for(let i=0;i<12;i++){
      const d=new Date(y,m-1+i,1)
      meses.push(d.toISOString().slice(0,7))
    }
    const {data}=await supabase.from('installments').select('*').in('month_ref',meses).order('month_ref').order('description')
    setParcelas(data||[]); setLoading(false)
  },[mes])
  useEffect(()=>{ load() },[load])

  // Agrupar por mês
  const byMes={}
  parcelas.forEach(p=>{
    if(!byMes[p.month_ref]) byMes[p.month_ref]=[]
    byMes[p.month_ref].push(p)
  })

  // Agrupar por group_id para ver o total de cada compra
  const groups={}
  parcelas.forEach(p=>{
    if(!groups[p.group_id]) groups[p.group_id]={desc:p.description,total:p.total_amount,installAmt:p.installment_amount,totalInst:p.total_installments,cat:p.category,card:p.card,meses:[]}
    groups[p.group_id].meses.push(p.month_ref)
  })

  return (
    <div>
      <div className="page-header"><h1>Parcelas</h1><div className="subtitle">Compromissos futuros dos cartões</div></div>
      <MonthNav mes={mes} setMes={setMes}/>
      {loading?<div className="loading"><div className="spinner"/></div>:(
        parcelas.length===0
          ?<div className="empty-state"><div className="icon">✅</div><h3>Nenhuma parcela futura</h3><p>Suas compras parceladas aparecerão aqui.</p></div>
          :<div>
            {/* Resumo geral */}
            <div className="section" style={{paddingTop:16}}>
              <div className="section-title">Resumo de compromissos</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
                {[1,2,3,4,5,6].map(offset=>{
                  const [y,m]=mes.split('-').map(Number)
                  const futMes=new Date(y,m-1+offset,1).toISOString().slice(0,7)
                  const items=byMes[futMes]||[]
                  if(!items.length) return null
                  const total=items.reduce((s,p)=>s+Number(p.installment_amount),0)
                  return(
                    <div key={futMes} style={{background:'var(--white)',borderRadius:12,padding:'12px 14px',boxShadow:'var(--shadow-sm)',border:'1px solid rgba(15,26,18,.05)'}}>
                      <div style={{fontSize:11,fontWeight:600,color:'var(--gray-500)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:4}}>{fmtM(futMes)}</div>
                      <div style={{fontSize:18,fontWeight:500,color:'var(--amber)',fontFamily:'var(--font-display)'}}>{fmt(total)}</div>
                      <div style={{fontSize:11,color:'var(--gray-500)',marginTop:2}}>{items.length} parcela(s)</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Detalhe por mês */}
            <div className="section">
              <div className="section-title">Detalhe por mês</div>
              {Object.entries(byMes).sort(([a],[b])=>a.localeCompare(b)).map(([mesRef,items])=>{
                const total=items.reduce((s,p)=>s+Number(p.installment_amount),0)
                return(
                  <div key={mesRef} style={{marginBottom:16}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,padding:'8px 0',borderBottom:'2px solid var(--gray-100)'}}>
                      <span style={{fontFamily:'var(--font-display)',fontSize:15,fontWeight:400}}>{fmtM(mesRef)}</span>
                      <span style={{fontSize:14,fontWeight:700,color:'var(--amber)'}}>{fmt(total)}</span>
                    </div>
                    {items.map(p=>(
                      <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid var(--gray-100)'}}>
                        <div style={{width:32,height:32,borderRadius:8,background:'var(--purple-light)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>💳</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:14,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.description}</div>
                          <div style={{fontSize:11,color:'var(--gray-500)'}}>{p.category} · {p.card} · <span style={{color:'var(--purple)',fontWeight:600}}>{p.current_installment}/{p.total_installments}x</span></div>
                        </div>
                        <div style={{textAlign:'right',flexShrink:0}}>
                          <div style={{fontSize:14,fontWeight:600}}>{fmt(p.installment_amount)}</div>
                          <div style={{fontSize:10,color:'var(--gray-500)'}}>de {fmt(p.total_amount)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
      )}
    </div>
  )
}

// ── ORÇAMENTOS ────────────────────────────────────────────────────────────────
function Orcamentos({ mes, setMes }) {
  const {categories}=useApp()
  const [txns,setTxns]=useState([])
  const [budgets,setBudgets]=useState([])
  const [loading,setLoading]=useState(true)
  const [editing,setEditing]=useState(null)
  const [editVal,setEditVal]=useState('')

  const load=useCallback(async()=>{
    setLoading(true)
    const [{data:t},{data:b}]=await Promise.all([
      supabase.from('transactions').select('category,amount,type').eq('month_ref',mes),
      supabase.from('budgets').select('*')
    ])
    setTxns(t||[]); setBudgets(b||[]); setLoading(false)
  },[mes])
  useEffect(()=>{ load() },[load])

  const spent={};txns.filter(t=>t.type!=='receita').forEach(t=>{spent[t.category]=(spent[t.category]||0)+Number(t.amount)})
  const saveBudget=async(cat,val)=>{
    const ex=budgets.find(b=>b.category===cat)
    if(ex) await supabase.from('budgets').update({amount:val}).eq('category',cat)
    else await supabase.from('budgets').insert({category:cat,amount:val})
    setEditing(null); load()
  }
  const despCats=categories.filter(c=>c.type==='despesa').map(c=>c.name)

  return (
    <div>
      <div className="page-header"><h1>Orçamentos</h1></div>
      <MonthNav mes={mes} setMes={setMes}/>
      {loading?<div className="loading"><div className="spinner"/></div>:(
        <div className="section" style={{paddingTop:12}}>
          {despCats.map(cat=>{
            const bud=budgets.find(b=>b.category===cat)?.amount||0
            const sp=spent[cat]||0
            const pct=bud>0?Math.min(sp/bud,1.2):0
            const color=sp>bud&&bud>0?'var(--red)':pct>.8?'var(--amber)':'var(--green)'
            const status=sp>bud&&bud>0?'🔴':pct>.8?'⚠️':bud>0?'✅':''
            return (
              <div className="budget-item" key={cat}>
                <div className="budget-header">
                  <div className="budget-cat">{status} {cat}</div>
                  {editing===cat
                    ?<div style={{display:'flex',gap:6,alignItems:'center'}}>
                      <input type="number" style={{width:90,padding:'4px 8px',border:'1.5px solid var(--green-mid)',borderRadius:8,fontSize:16,fontFamily:'var(--font-body)'}} value={editVal} onChange={e=>setEditVal(e.target.value)} autoFocus/>
                      <button className="btn-secondary" style={{padding:'4px 10px',fontSize:12}} onClick={()=>saveBudget(cat,parseFloat(editVal)||0)}>✓</button>
                      <button className="btn-secondary" style={{padding:'4px 10px',fontSize:12}} onClick={()=>setEditing(null)}>✕</button>
                    </div>
                    :<div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <div className="budget-vals">{fmt(sp)}{bud>0?` / ${fmt(bud)}`:''}</div>
                      <button className="btn-secondary" style={{padding:'4px 10px',fontSize:11}} onClick={()=>{setEditing(cat);setEditVal(bud||'')}}>Editar</button>
                    </div>
                  }
                </div>
                {bud>0&&<>
                  <div className="budget-bar-bg"><div className="budget-bar-fill" style={{width:`${Math.min(pct*100,100)}%`,background:color}}/></div>
                  {sp>bud&&<div style={{fontSize:11,color:'var(--red)',marginTop:4}}>Excedido em {fmt(sp-bud)}</div>}
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
  const [data,setData]=useState([])
  const [loading,setLoading]=useState(true)
  const [busca,setBusca]=useState('')
  const [results,setResults]=useState([])
  const [searching,setSearching]=useState(false)
  const ano=new Date().getFullYear()
  const desktop=useDesktop()

  useEffect(()=>{
    const load=async()=>{
      const meses=Array.from({length:12},(_,i)=>`${ano}-${String(i+1).padStart(2,'0')}`)
      const {data:txns}=await supabase.from('transactions').select('month_ref,type,amount').in('month_ref',meses)
      const byMes={};meses.forEach(m=>{byMes[m]={receitas:0,despesas:0}})
      ;(txns||[]).forEach(t=>{if(!byMes[t.month_ref])return;if(t.type==='receita')byMes[t.month_ref].receitas+=Number(t.amount);else byMes[t.month_ref].despesas+=Number(t.amount)})
      setData(meses.map(m=>({mes:m,...byMes[m]}))); setLoading(false)
    }
    load()
  },[ano])

  const search=async()=>{
    if(!busca.trim())return
    setSearching(true)
    const {data}=await supabase.from('transactions').select('*').ilike('description',`%${busca}%`).order('date',{ascending:false}).limit(50)
    setResults(data||[]); setSearching(false)
  }
  const maxVal=Math.max(...data.map(d=>Math.max(d.receitas,d.despesas)),1)

  return (
    <div>
      <div className="page-header"><h1>Relatórios</h1><div className="subtitle">Visão anual {ano}</div></div>
      <div className="section" style={{paddingTop:16}}>
        <div className="section-title">Fluxo de caixa {ano}</div>
        {loading?<div className="loading"><div className="spinner"/></div>:(
          <div className="chart-card">
            <div style={{display:'flex',gap:12,marginBottom:12,fontSize:11}}>
              <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:2,background:'var(--green)',display:'inline-block'}}></span>Receitas</span>
              <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:2,background:'var(--red)',display:'inline-block'}}></span>Despesas</span>
            </div>
            <div style={{display:'flex',alignItems:'flex-end',gap:desktop?8:4,height:140}}>
              {data.map((d,i)=>(
                <div key={d.mes} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                  <div style={{display:'flex',alignItems:'flex-end',gap:2,height:120}}>
                    <div style={{width:desktop?14:8,background:'var(--green)',height:`${(d.receitas/maxVal*100).toFixed(1)}%`,borderRadius:'3px 3px 0 0',minHeight:d.receitas>0?3:0}}/>
                    <div style={{width:desktop?14:8,background:'var(--red)',height:`${(d.despesas/maxVal*100).toFixed(1)}%`,borderRadius:'3px 3px 0 0',minHeight:d.despesas>0?3:0}}/>
                  </div>
                  <div style={{fontSize:desktop?10:9,color:'var(--gray-500)',textAlign:'center'}}>{MESES_NOMES[i].slice(0,3)}</div>
                </div>
              ))}
            </div>
            <div style={{marginTop:16,borderTop:'1px solid var(--gray-100)',paddingTop:12}}>
              {data.filter(d=>d.receitas>0||d.despesas>0).map(d=>{
                const saldo=d.receitas-d.despesas
                return(
                  <div key={d.mes} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--gray-100)',fontSize:13}}>
                    <span style={{color:'var(--gray-700)',fontWeight:500,minWidth:100}}>{fmtM(d.mes)}</span>
                    <span style={{color:'var(--green)'}}>{fmt(d.receitas)}</span>
                    <span style={{color:'var(--red)'}}>{fmt(d.despesas)}</span>
                    <span style={{color:saldo>=0?'var(--green)':'var(--red)',fontWeight:700}}>{saldo>=0?'+':''}{fmt(saldo)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      <div className="section">
        <div className="section-title">Busca global</div>
        <div style={{display:'flex',gap:8,marginBottom:12}}>
          <input className="form-input" style={{flex:1,margin:0}} placeholder="Buscar em todos os meses..." value={busca} onChange={e=>setBusca(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()}/>
          <button className="btn-secondary" onClick={search} disabled={searching}>{searching?'...':'🔍'}</button>
        </div>
        {results.length>0&&(
          <div className="txn-list">{results.map(t=>(
            <div className="txn-item" key={t.id}>
              <div className="txn-icon" style={{background:TIPO_BG[t.type]}}>{TIPO_ICONS[t.type]}</div>
              <div className="txn-info"><div className="txn-desc">{t.description}</div><div className="txn-meta">{t.category} · {t.month_ref} · {t.date?.slice(5).replace('-','/')}</div></div>
              <div className={`txn-amount ${t.type==='receita'?'income':'expense'}`}>{t.type==='receita'?'+':'-'}{fmt(t.amount)}</div>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  )
}

// ── RECORRENTES ───────────────────────────────────────────────────────────────
function Recorrentes({ mes, toast }) {
  const {categories,cards,members}=useApp()
  const [recurrings,setRecurrings]=useState([])
  const [loading,setLoading]=useState(true)
  const [showForm,setShowForm]=useState(false)
  const [rDesc,setRDesc]=useState('')
  const [rType,setRType]=useState('fixo')
  const [rCat,setRCat]=useState('')
  const [rMember,setRMember]=useState('')
  const [rCard,setRCard]=useState('N/A')
  const [rAmount,setRAmount]=useState('')

  const load=useCallback(async()=>{
    setLoading(true)
    const {data}=await supabase.from('recurring').select('*').order('description')
    setRecurrings(data||[]); setLoading(false)
  },[])
  useEffect(()=>{ load() },[load])

  const addRecurring=async()=>{
    if(!rDesc||!rAmount||!rCat){toast('Preencha todos os campos','error');return}
    await supabase.from('recurring').insert({description:rDesc,type:rType,category:rCat,member:rMember,card:rCard,amount:parseFloat(rAmount),active:true})
    toast('Recorrente cadastrado!','success')
    setRDesc(''); setRAmount(''); setRCat(''); setRMember(''); setShowForm(false); load()
  }
  const lancarMes=async(rec)=>{
    const {error}=await supabase.from('transactions').insert({date:`${mes}-01`,description:rec.description,type:rec.type,category:rec.category,member:rec.member||'',card:rec.card||'N/A',installments:1,amount:rec.amount,notes:'Recorrente automático',month_ref:mes})
    if(error)toast('Erro: '+error.message,'error'); else toast(`"${rec.description}" lançado!`,'success')
  }
  const lancarTodos=async()=>{
    const ativos=recurrings.filter(r=>r.active)
    for(const r of ativos) await lancarMes(r)
    toast(`${ativos.length} lançamentos criados!`,'success')
  }
  const toggleActive=async(id,active)=>{ await supabase.from('recurring').update({active:!active}).eq('id',id); load() }
  const del=async id=>{ if(!window.confirm('Remover?'))return; await supabase.from('recurring').delete().eq('id',id); load() }
  const cats=categories.filter(c=>rType==='receita'?c.type==='receita':c.type==='despesa')

  return (
    <div>
      <div className="page-header"><h1>Recorrentes</h1><div className="subtitle">Lançamentos automáticos mensais</div></div>
      <div style={{padding:'12px 16px',display:'flex',gap:8,flexWrap:'wrap'}}>
        <button className="btn-primary" style={{flex:1,margin:0,padding:'10px'}} onClick={lancarTodos}>⚡ Lançar todos em {fmtM(mes)}</button>
        <button className="btn-secondary" onClick={()=>setShowForm(v=>!v)}>+ Novo</button>
      </div>
      {showForm&&(
        <div className="form-card" style={{margin:'0 16px 16px'}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:16,marginBottom:14}}>Novo recorrente</div>
          <div className="form-group"><label className="form-label">Descrição</label><input className="form-input" placeholder="Ex: Conta Vivo" value={rDesc} onChange={e=>setRDesc(e.target.value)}/></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Tipo</label><select className="form-select" value={rType} onChange={e=>{setRType(e.target.value);setRCat('')}}>{TIPOS.map(t=><option key={t} value={t}>{TIPO_LABELS[t]}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Valor</label><input type="number" className="form-input" placeholder="0,00" value={rAmount} onChange={e=>setRAmount(e.target.value)}/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Categoria</label><select className="form-select" value={rCat} onChange={e=>setRCat(e.target.value)}><option value="">Selecione</option>{cats.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Membro</label><select className="form-select" value={rMember} onChange={e=>setRMember(e.target.value)}><option value="">—</option>{members.map(m=><option key={m.name} value={m.name}>{m.name}</option>)}</select></div>
          </div>
          <button className="btn-primary" onClick={addRecurring}>✓ Salvar recorrente</button>
        </div>
      )}
      {loading?<div className="loading"><div className="spinner"/></div>:(
        <div className="section">
          {recurrings.length===0
            ?<div className="empty-state"><div className="icon">🔁</div><h3>Nenhum recorrente</h3><p>Cadastre salários, contas fixas e assinaturas.</p></div>
            :<div className="txn-list">{recurrings.map(r=>(
              <div className="txn-item" key={r.id} style={{opacity:r.active?1:.5}}>
                <div className="txn-icon" style={{background:TIPO_BG[r.type]}}>{TIPO_ICONS[r.type]}</div>
                <div className="txn-info"><div className="txn-desc">{r.description}</div><div className="txn-meta">{r.category} · {fmt(r.amount)} · {r.active?'Ativo':'Inativo'}</div></div>
                <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end'}}>
                  <button style={{padding:'4px 10px',fontSize:11,background:'var(--green-light)',color:'var(--green)',border:'none',borderRadius:6,cursor:'pointer'}} onClick={()=>lancarMes(r)}>Lançar</button>
                  <div style={{display:'flex',gap:4}}>
                    <button className="btn-secondary" style={{padding:'3px 8px',fontSize:10}} onClick={()=>toggleActive(r.id,r.active)}>{r.active?'Pausar':'Ativar'}</button>
                    <button className="btn-danger" style={{padding:'3px 8px',fontSize:11}} onClick={()=>del(r.id)}>✕</button>
                  </div>
                </div>
              </div>
            ))}</div>
          }
        </div>
      )}
    </div>
  )
}

// ── CONFIGURAÇÕES ─────────────────────────────────────────────────────────────
function Configuracoes({ toast }) {
  const {categories,cards,members,reloadGlobal}=useApp()
  const [newCatName,setNewCatName]=useState('')
  const [newCatType,setNewCatType]=useState('despesa')
  const [newCard,setNewCard]=useState('')
  const [newMbr,setNewMbr]=useState('')
  const [editCardId,setEditCardId]=useState(null)
  const [editClosing,setEditClosing]=useState('')
  const [editDue,setEditDue]=useState('')

  const addCat=async()=>{ if(!newCatName.trim())return; const {error}=await supabase.from('categories').insert({name:newCatName.trim(),type:newCatType}); if(error)toast('Já existe','error'); else{toast('Adicionado!','success');setNewCatName('');reloadGlobal()} }
  const delCat=async id=>{ await supabase.from('categories').delete().eq('id',id); reloadGlobal() }
  const addCard=async()=>{ if(!newCard.trim())return; await supabase.from('cards').insert({name:newCard.trim(),closing_day:11,due_day:25}); toast('Cartão adicionado!','success'); setNewCard(''); reloadGlobal() }
  const delCard=async id=>{ await supabase.from('cards').delete().eq('id',id); reloadGlobal() }
  const addMbr=async()=>{ if(!newMbr.trim())return; await supabase.from('members').insert({name:newMbr.trim()}); toast('Membro adicionado!','success'); setNewMbr(''); reloadGlobal() }
  const delMbr=async id=>{ await supabase.from('members').delete().eq('id',id); reloadGlobal() }
  const saveCardDates=async(id)=>{ await supabase.from('cards').update({closing_day:parseInt(editClosing)||11,due_day:parseInt(editDue)||25}).eq('id',id); toast('Datas salvas!','success'); setEditCardId(null); reloadGlobal() }

  return (
    <div>
      <div className="page-header"><h1>Configurações</h1></div>
      <div style={{padding:'16px 0'}}>

        <ConfigSection title="👨‍👩‍👧 Membros da família">
          {members.map(m=><ConfigRow key={m.id} name={m.name} onDel={()=>delMbr(m.id)}/>)}
          <div style={{display:'flex',gap:8,marginTop:12}}>
            <input className="form-input" style={{flex:1,margin:0}} placeholder="Nome do membro" value={newMbr} onChange={e=>setNewMbr(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addMbr()}/>
            <button className="btn-secondary" onClick={addMbr}>+ Adicionar</button>
          </div>
        </ConfigSection>

        <ConfigSection title="💳 Cartões e datas de fechamento">
          {cards.map(c=>(
            <div key={c.id}>
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--gray-100)'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:500}}>{c.name}</div>
                  {c.closing_day&&<div style={{fontSize:11,color:'var(--gray-500)'}}>Fechamento dia {c.closing_day} · Vencimento dia {c.due_day||'—'}</div>}
                </div>
                <button className="btn-secondary" style={{padding:'3px 10px',fontSize:11}} onClick={()=>{ setEditCardId(c.id); setEditClosing(c.closing_day||''); setEditDue(c.due_day||'') }}>✏️ Datas</button>
                <button className="btn-danger" style={{padding:'3px 10px',fontSize:12}} onClick={()=>delCard(c.id)}>Remover</button>
              </div>
              {editCardId===c.id&&(
                <div style={{background:'var(--gray-50)',borderRadius:8,padding:'10px 12px',marginBottom:8,display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:'var(--gray-500)',display:'block',marginBottom:4,textTransform:'uppercase'}}>Dia fechamento</label>
                    <input type="number" min="1" max="31" style={{width:70,padding:'6px 8px',border:'1.5px solid var(--gray-100)',borderRadius:8,fontSize:15,fontFamily:'var(--font-body)'}} value={editClosing} onChange={e=>setEditClosing(e.target.value)}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:'var(--gray-500)',display:'block',marginBottom:4,textTransform:'uppercase'}}>Dia vencimento</label>
                    <input type="number" min="1" max="31" style={{width:70,padding:'6px 8px',border:'1.5px solid var(--gray-100)',borderRadius:8,fontSize:15,fontFamily:'var(--font-body)'}} value={editDue} onChange={e=>setEditDue(e.target.value)}/>
                  </div>
                  <button className="btn-primary" style={{margin:0,padding:'8px 16px',fontSize:13}} onClick={()=>saveCardDates(c.id)}>✓ Salvar</button>
                  <button className="btn-secondary" style={{padding:'8px 12px',fontSize:13}} onClick={()=>setEditCardId(null)}>✕</button>
                </div>
              )}
            </div>
          ))}
          <div style={{display:'flex',gap:8,marginTop:12}}>
            <input className="form-input" style={{flex:1,margin:0}} placeholder="Ex: Nubank 1234" value={newCard} onChange={e=>setNewCard(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCard()}/>
            <button className="btn-secondary" onClick={addCard}>+ Adicionar</button>
          </div>
        </ConfigSection>

        <ConfigSection title="🏷️ Categorias">
          <div style={{fontSize:11,fontWeight:600,color:'var(--gray-500)',marginBottom:6,textTransform:'uppercase',letterSpacing:'.05em'}}>Despesas</div>
          {categories.filter(c=>c.type==='despesa').map(c=><ConfigRow key={c.id} name={c.name} onDel={()=>delCat(c.id)}/>)}
          <div style={{fontSize:11,fontWeight:600,color:'var(--gray-500)',margin:'12px 0 6px',textTransform:'uppercase',letterSpacing:'.05em'}}>Receitas</div>
          {categories.filter(c=>c.type==='receita').map(c=><ConfigRow key={c.id} name={c.name} onDel={()=>delCat(c.id)}/>)}
          <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
            <input className="form-input" style={{flex:2,margin:0,minWidth:120}} placeholder="Nova categoria" value={newCatName} onChange={e=>setNewCatName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCat()}/>
            <select className="form-select" style={{flex:1,margin:0,minWidth:100}} value={newCatType} onChange={e=>setNewCatType(e.target.value)}><option value="despesa">Despesa</option><option value="receita">Receita</option></select>
            <button className="btn-secondary" onClick={addCat}>+ Add</button>
          </div>
        </ConfigSection>

        <div style={{padding:'0 16px'}}><div style={{background:'var(--gray-100)',borderRadius:8,padding:'12px 14px',fontSize:12,color:'var(--gray-500)',lineHeight:1.6}}>💡 <strong>Dica mobile:</strong> Abra no Safari/Chrome → "Compartilhar" → "Adicionar à Tela de Início".</div></div>
      </div>
    </div>
  )
}

// ── SIDEBAR DESKTOP ─────────────────────────────────────────────────────────
function Sidebar({ tab, setTab }) {
  const navItems=[
    {id:'dashboard',label:'Início',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>},
    {id:'lancamentos',label:'Extrato',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/></svg>},
    {id:'novo',label:'Lançar',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>},
    {id:'importar',label:'Fatura PDF',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>},
  ]
  const moreItems=[
    {id:'parcelas',label:'Parcelas',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>},
    {id:'orcamentos',label:'Orçamentos',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>},
    {id:'relatorios',label:'Relatórios',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>},
    {id:'recorrentes',label:'Recorrentes',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/></svg>},
    {id:'config',label:'Config.',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/></svg>},
  ]
  return (
    <aside className="sidebar">
      <div className="sidebar-logo"><h2>Finanças Maciel</h2><p>Controle financeiro familiar</p></div>
      <nav className="sidebar-nav">
        {navItems.map(t=><button key={t.id} className={`sidebar-item ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>{t.icon}{t.label}</button>)}
        <div className="sidebar-section-label">Mais</div>
        {moreItems.map(t=><button key={t.id} className={`sidebar-item ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>{t.icon}{t.label}</button>)}
      </nav>
      <div style={{padding:'12px 16px',borderTop:'1px solid var(--gray-100)'}}>
        <button onClick={sair} style={{width:'100%',padding:'8px',background:'none',border:'none',cursor:'pointer',fontSize:13,color:'var(--gray-500)',textAlign:'left',fontFamily:'var(--font-body)'}}>🚪 Sair</button>
      </div>
    </aside>
  )
}
  )
}

// ── APP PRINCIPAL ─────────────────────────────────────────────────────────────
const SENHA_APP = 'maciel2026'

function Login({ onLogin }) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(false)
  const tentar = () => {
    if (senha === SENHA_APP) { localStorage.setItem('fm_auth','1'); onLogin() }
    else { setErro(true); setTimeout(() => setErro(false), 2000) }
  }
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--gray-100)',padding:24}}>
      <div style={{background:'var(--white)',borderRadius:24,padding:'32px 28px',width:'100%',maxWidth:360,boxShadow:'var(--shadow-lg)',textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:12}}>💰</div>
        <h1 style={{fontFamily:'var(--font-display)',fontSize:24,fontWeight:400,marginBottom:6}}>Finanças Maciel</h1>
        <p style={{fontSize:13,color:'var(--gray-500)',marginBottom:24}}>Digite a senha para acessar</p>
        <input
          type="password"
          className="form-input"
          placeholder="Senha"
          value={senha}
          onChange={e=>setSenha(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&tentar()}
          style={{textAlign:'center',fontSize:18,letterSpacing:4,marginBottom:12}}
          autoFocus
        />
        {erro && <p style={{fontSize:13,color:'var(--red)',marginBottom:8}}>Senha incorreta</p>}
        <button className="btn-primary" onClick={tentar} style={{marginTop:4}}>Entrar</button>
      </div>
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('fm_auth'))
  if (!authed) return <Login onLogin={() => setAuthed(true)} />
  const [tab,setTab]=useState('dashboard')
  const [mes,setMes]=useState(todayYM)
  const [toastData,setToastData]=useState(null)
  const [showMais,setShowMais]=useState(false)
  const desktop=useDesktop()
  const toast=(msg,type='success')=>setToastData({msg,type})const sair = () => { localStorage.removeItem('fm_auth'); setAuthed(false) }

  const [categories,setCategories]=useState([])
  const [cards,setCards]=useState([])
  const [members,setMembers]=useState([])

  const reloadGlobal=useCallback(async()=>{
    const [{data:cats},{data:cds},{data:mbrs}]=await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('cards').select('*').order('name'),
      supabase.from('members').select('*').order('name'),
    ])
    setCategories(cats||[]); setCards(cds||[]); setMembers(mbrs||[])
  },[])
  useEffect(()=>{ reloadGlobal() },[reloadGlobal])

  const mobileTabs=[
    {id:'dashboard',label:'Início',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>},
    {id:'lancamentos',label:'Extrato',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/></svg>},
    {id:'novo',label:'Lançar',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>},
    {id:'importar',label:'Fatura',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>},
    {id:'mais',label:'Mais',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>},
  ]

  const content=(
    <>
      {tab==='dashboard'   && <Dashboard mes={mes} setMes={setMes}/>}
      {tab==='lancamentos' && <Lancamentos mes={mes} setMes={setMes} toast={toast}/>}
      {tab==='novo'        && <NovoLancamento mes={mes} toast={toast} onSaved={()=>setTab('lancamentos')}/>}
      {tab==='importar'    && <ImportarJSON mes={mes} toast={toast}/>}
      {tab==='parcelas'    && <Parcelas mes={mes} setMes={setMes}/>}
      {tab==='orcamentos'  && <Orcamentos mes={mes} setMes={setMes}/>}
      {tab==='relatorios'  && <Relatorios/>}
      {tab==='recorrentes' && <Recorrentes mes={mes} toast={toast}/>}
      {tab==='config'      && <Configuracoes toast={toast}/>}
    </>
  )

  return (
    <AppCtx.Provider value={{categories,cards,members,reloadGlobal}}>
      <div className="app-shell">
        {desktop&&<Sidebar tab={tab} setTab={setTab}/>}
        <div className="page-content">
          {desktop?<div className="page-inner">{content}</div>:content}
        </div>

        {!desktop&&showMais&&(
          <div style={{position:'fixed',bottom:70,left:0,right:0,background:'var(--white)',borderTop:'1px solid var(--gray-100)',padding:'12px 16px',zIndex:99,boxShadow:'0 -4px 20px rgba(0,0,0,0.08)'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {[
                {id:'parcelas',label:'Parcelas',icon:'💳'},
                {id:'orcamentos',label:'Orçamentos',icon:'🎯'},
                {id:'relatorios',label:'Relatórios',icon:'📊'},
                {id:'recorrentes',label:'Recorrentes',icon:'🔁'},
                {id:'config',label:'Config.',icon:'⚙️'},
              ].map(t=>(
                <button key={t.id} onClick={()=>{setTab(t.id);setShowMais(false)}} style={{padding:'14px',background:tab===t.id?'var(--green-pale)':'var(--gray-50)',border:`1px solid ${tab===t.id?'var(--green)':'var(--gray-100)'}`,borderRadius:12,cursor:'pointer',display:'flex',alignItems:'center',gap:10,fontFamily:'var(--font-body)',fontSize:14,fontWeight:500,color:tab===t.id?'var(--green)':'var(--gray-700)'}}>
                  <span style={{fontSize:20}}>{t.icon}</span>{t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {!desktop&&(
          <nav className="bottom-nav">
            {mobileTabs.map(t=>(
              <button key={t.id} className={`nav-item ${(tab===t.id||(t.id==='mais'&&showMais))?'active':''}`}
                onClick={()=>{ if(t.id==='mais'){setShowMais(v=>!v)}else{setTab(t.id);setShowMais(false)} }}>
                {t.icon}{t.label}
              </button>
            ))}
          </nav>
        )}

        {toastData&&<Toast msg={toastData.msg} type={toastData.type} onHide={()=>setToastData(null)}/>}
      </div>
    </AppCtx.Provider>
  )
}
