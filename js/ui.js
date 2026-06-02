// Interface: navegação, busca, cadastro, tabelas, dashboard, toast

// ══════ NAV ══════
function pg(id,btn){
  document.querySelectorAll('.pg').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('on'));
  document.getElementById('pg-'+id).classList.add('on');
  if(btn)btn.classList.add('on');
  if(id==='base')renderBase();
  if(id==='dashboard')renderDash();
  if(id==='historico')renderHist();
}

// ══════ SEARCH ══════
function buscar(q,ctx){
  q=q.trim().toUpperCase();
  const d=document.getElementById('sd-'+ctx);
  if(q.length<1){d.style.display='none';return;}
  const isN=/^\d+$/.test(q);
  const res=PRODS.filter(p=>isN?p.cod.startsWith(q):(p.nome.includes(q)||p.cod.includes(q))).slice(0,14);
  if(!res.length){d.style.display='none';return;}
  d.innerHTML=res.map(p=>`<div class="sri-item" onmousedown="selP(${JSON.stringify(p).replace(/"/g,'&quot;')},'${ctx}')"><span class="sri-cod">${p.cod}</span><div><div class="sri-nome">${hl(p.nome,q)}</div><div class="sri-cat">${p.cat}</div></div></div>`).join('');
  d.style.display='block';
}
function hl(t,q){
  if(!q||q.length<1)return t;
  var tU=t.toUpperCase(),qU=q.toUpperCase(),idx=tU.indexOf(qU);
  if(idx<0)return t;
  return t.slice(0,idx)+'<mark style="background:#BEE3F8;color:#2B6CB0;border-radius:2px;padding:0 1px">'+t.slice(idx,idx+q.length)+'</mark>'+t.slice(idx+q.length);
}
function fechaSR(ctx){const d=document.getElementById('sd-'+ctx);if(d)d.style.display='none';}

function selP(p,ctx){
  if(ctx==='cons'){
    selProd=p;
    document.getElementById('si-cons').value=p.cod+' · '+p.nome;
    document.getElementById('pc-cod').textContent=p.cod;
    document.getElementById('pc-nome').textContent=p.nome;
    document.getElementById('pc-cat').textContent=p.cat;
    const par=DB.find(x=>x.cod===p.cod);
    const pdfEl=document.getElementById('pc-pdf');
    pdfEl.innerHTML=par&&par.pdfDataUrl?`<a href="${par.pdfDataUrl}" target="_blank" class="btn btn-out btn-sm">📄 Ver Parecer</a>`:'';
    const body=document.getElementById('pcard-body');
    if(!par||(!par.padrao.length&&!par.permitidas.length&&!par.restritas.length&&!par.proibidas.length)){
      // Show suggestions
      const sugs=MARCAS_SUG[p.cat]||MARCAS_SUG['MATERIAL MEDICO']||[];
      const sugHtml=sugs.length?`<div class="sug-box"><div class="sug-title">🟣 Marcas reconhecidas para ${p.cat}<span style="font-weight:400;text-transform:none;letter-spacing:0;color:#805AD5;font-size:11px">— sem parecer cadastrado</span></div><div class="tags">${sugs.map(m=>`<span class="tag sugerida">${m}</span>`).join('')}</div><div style="font-size:11px;color:#805AD5;margin-top:8px">⚠ Sugestão de mercado — não substitui avaliação técnica formal.</div></div>`:'';
      body.innerHTML=`<div class="no-parecer"><div style="font-size:13px;color:var(--tx2);margin-bottom:8px">⚠️ Produto sem parecer técnico cadastrado.</div><div style="font-size:12px;color:var(--tx3)">Use "Editar Parecer" para vincular marcas.</div></div>${sugHtml}`;
    } else {
      let obs=par.observacao?`<div class="obs-box"><span>📌</span><span>${par.observacao}</span></div>`:'';
      let sugs=MARCAS_SUG[p.cat]||[];
      // Remove already categorized from suggestions
      const allCat=[...par.padrao,...par.permitidas,...par.restritas,...par.proibidas].map(m=>m.toUpperCase());
      const remSugs=sugs.filter(s=>!allCat.some(m=>m.includes(s.toUpperCase().split(' ')[0])||s.toUpperCase().includes(m.split(' ')[0])));
      const sugHtml=remSugs.length?`<div class="sug-box" style="margin:0 18px 16px"><div class="sug-title">🟣 Outras marcas reconhecidas para ${p.cat}</div><div class="tags">${remSugs.map(m=>`<span class="tag sugerida">${m}</span>`).join('')}</div></div>`:'';
      body.innerHTML=`<div class="mgrid">
        <div class="mgcol padrao"><div class="mghd"><div class="mgdot"></div><div class="mglbl">Padrão</div><div class="mgdsc">— comprar sempre</div></div><div class="tags">${mTags(par.padrao,'padrao')}</div></div>
        <div class="mgcol permitida"><div class="mghd"><div class="mgdot"></div><div class="mglbl">Permitidas</div><div class="mgdsc">— se padrão indisponível</div></div><div class="tags">${mTags(par.permitidas,'permitida')}</div></div>
        <div class="mgcol restrita"><div class="mghd"><div class="mgdot"></div><div class="mglbl">Restritas</div><div class="mgdsc">— consultar antes</div></div><div class="tags">${mTags(par.restritas,'restrita')}</div></div>
        <div class="mgcol proibida"><div class="mghd"><div class="mgdot"></div><div class="mglbl">Proibidas</div><div class="mgdsc">— não comprar</div></div><div class="tags">${mTags(par.proibidas,'proibida')}</div></div>
      </div>${obs}${sugHtml}`;
    }
    document.getElementById('pcard-cons').style.display='block';
    hist.unshift({ts:new Date().toLocaleTimeString('pt-BR'),cod:p.cod,nome:p.nome,tipo:'consulta'});
    updNC();
  }
  else if(ctx==='cad'){
    cadProd=p;
    document.getElementById('si-cad').value=p.cod+' · '+p.nome;
    document.getElementById('f-cod').value=p.cod;
    document.getElementById('f-nome').value=p.nome;
    document.getElementById('f-cat').value=p.cat||'';
    const ex=DB.find(x=>x.cod===p.cod);
    if(ex){
      editCod=p.cod;
      mc={padrao:[...ex.padrao],permitida:[...ex.permitidas],restrita:[...ex.restritas],proibida:[...ex.proibidas]};
      document.getElementById('f-obs').value=ex.observacao||'';
      document.getElementById('f-resp').value=ex.responsavel||'';
      document.getElementById('f-data').value=ex.data||'';
      if(ex.pdfDataUrl){pdfObj={name:ex.parecer,dataUrl:ex.pdfDataUrl};showPdf(ex.parecer,ex.pdfDataUrl);}
      toast('Parecer carregado para edição.');
    } else {editCod=null;mc={padrao:[],permitida:[],restrita:[],proibida:[]};}
    renderTags();
  }
}

function mTags(arr,tipo){return arr.length?arr.map(m=>`<span class="tag ${tipo}">${m}</span>`).join(''):`<span class="no-marca">Nenhuma</span>`;}

// ══════ BIONEXO ══════


// ══════ CADASTRO ══════
function aM(tipo){
  const inp=document.getElementById('mi-'+tipo);
  const v=inp.value.trim().toUpperCase();
  if(!v)return;
  if(mc[tipo].includes(v)){toast('Já adicionada.','w');return;}
  ['padrao','permitida','restrita','proibida'].forEach(t=>{if(t!==tipo)mc[t]=mc[t].filter(m=>m!==v);});
  mc[tipo].push(v);inp.value='';renderTags();
}
function rM(tipo,nome){mc[tipo]=mc[tipo].filter(m=>m!==nome);renderTags();}
function renderTags(){
  ['padrao','permitida','restrita','proibida'].forEach(t=>{
    const el=document.getElementById('tg-'+t);if(!el)return;
    el.innerHTML=mc[t].length?mc[t].map(m=>`<span class="tag ${t}">${m}<button class="tag-rm" onclick="rM('${t}','${m}')">✕</button></span>`).join(''):`<span class="no-marca">Nenhuma</span>`;
  });
}
function doPdf(file){if(!file)return;const r=new FileReader();r.onload=e=>{pdfObj={name:file.name,dataUrl:e.target.result};showPdf(file.name,e.target.result);toast('PDF vinculado.');};r.readAsDataURL(file);}
function showPdf(name,url){document.getElementById('pdf-fn').textContent='📄 '+name;document.getElementById('pdf-fn').style.display='block';document.getElementById('pdf-view').style.display='block';document.getElementById('pdf-a').href=url;}
function salvar(){
  const cod=document.getElementById('f-cod').value.trim();
  const nome=document.getElementById('f-nome').value.trim();
  if(!cod||!nome){toast('Código e nome obrigatórios.','w');return;}
  if(!Object.values(mc).some(a=>a.length)){toast('Adicione ao menos uma marca.','w');return;}
  const idx=DB.findIndex(p=>p.cod===cod);
  const novo={cod,nome,cat:document.getElementById('f-cat').value,padrao:[...mc.padrao],permitidas:[...mc.permitida],restritas:[...mc.restrita],proibidas:[...mc.proibida],observacao:document.getElementById('f-obs').value.trim(),responsavel:document.getElementById('f-resp').value.trim(),data:document.getElementById('f-data').value,parecer:pdfObj?pdfObj.name:(idx>=0?DB[idx].parecer:''),pdfDataUrl:pdfObj?pdfObj.dataUrl:(idx>=0?DB[idx].pdfDataUrl:null)};
  if(idx>=0)DB[idx]=novo;else DB.push(novo);
  updNC();toast(idx>=0?'Parecer atualizado!':'Produto cadastrado!');limpar();
}
function limpar(){
  ['f-cod','f-nome','f-obs','f-resp','si-cad','f-data'].forEach(i=>{const e=document.getElementById(i);if(e)e.value='';});
  document.getElementById('f-cat').value='';
  mc={padrao:[],permitida:[],restrita:[],proibida:[]};pdfObj=null;editCod=null;cadProd=null;
  renderTags();
  document.getElementById('pdf-fn').style.display='none';document.getElementById('pdf-view').style.display='none';
}
function irCad(){
  if(!selProd)return;
  document.querySelectorAll('.pg').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('on'));
  document.getElementById('pg-cadastrar').classList.add('on');
  document.querySelectorAll('.ni')[4].classList.add('on');
  selP(selProd,'cad');
  document.getElementById('si-cad').value=selProd.cod+' · '+selProd.nome;
}



// ══════ APAGAR PARECER ══════
function confirmarApagar(cod) {
  var par = DB.find(function(p){ return p.cod===cod; });
  if(!par) return;
  document.getElementById('apagar-nome').textContent = par.cod + ' — ' + par.nome;
  document.getElementById('apagar-cod-hidden').value = cod;
  document.getElementById('modal-apagar').classList.add('on');
}
function cancelarApagar() {
  document.getElementById('modal-apagar').classList.remove('on');
}
async function executarApagar() {
  var cod = document.getElementById('apagar-cod-hidden').value;
  await fbDelete(cod);
  cancelarApagar();
  updNC();
  renderBase();
  toast('Parecer removido.');
}

// ══════ BASE ══════
var _filtCat='', _filtTexto='';

function renderBase() {
  var fq  = _filtTexto.toUpperCase();
  var cat = _filtCat;
  var lst = DB.filter(function(p){
    if(cat && (p.cat||'')!==cat) return false;
    if(fq && !p.cod.includes(fq) && !p.nome.toUpperCase().includes(fq)) return false;
    return true;
  });

  // Rebuild category dropdown
  var cats = [...new Set(DB.map(function(p){return p.cat||'';}).filter(Boolean))].sort();
  var sel  = document.getElementById('fil-cat');
  if(sel) {
    var cur = sel.value;
    sel.innerHTML = '<option value="">Todas as categorias</option>';
    cats.forEach(function(c){ sel.innerHTML+='<option value="'+c+'"'+(c===cur?' selected':'')+'>'+c+'</option>'; });
  }

  document.getElementById('base-info').textContent = lst.length+' registro(s)';
  var tb = document.getElementById('tb-base');
  if(!lst.length){
    tb.innerHTML='<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--tx3)">Nenhum resultado.</td></tr>';
    return;
  }

  function bds(arr,cls){ return arr&&arr.length ? arr.map(function(m){return '<span class="bd '+cls+'">'+m+'</span>';}).join(' ') : '<span style="color:var(--tx3)">—</span>'; }
  function valHTML(d){
    if(!d) return '<span style="color:var(--tx3);font-size:11px">—</span>';
    try{
      var dt=new Date(d),now=new Date();
      var m=(now.getFullYear()-dt.getFullYear())*12+(now.getMonth()-dt.getMonth());
      if(m<12)  return '<span style="font-size:11px;font-weight:600;color:#276749">✓ '+m+'m</span>';
      if(m<18)  return '<span style="font-size:11px;font-weight:700;color:#92400E">⚠ '+m+'m</span>';
      return '<span style="font-size:11px;font-weight:700;color:#9B2C2C">⚠ '+m+'m — Rever</span>';
    }catch(e){return '<span style="color:var(--tx3);font-size:11px">—</span>';}
  }

  tb.innerHTML = lst.map(function(p){
    var pdfBtn = p.pdfDataUrl ? '<a href="'+p.pdfDataUrl+'" target="_blank" class="btn btn-out btn-sm" style="text-decoration:none" title="Ver PDF">📄</a>' : '';
    return '<tr>'
      +'<td class="tc">'+p.cod+'</td>'
      +'<td class="tn">'+p.nome+'<small>'+(p.cat||'')+'</small></td>'
      +'<td>'+bds(p.padrao,'bd-b')+'</td>'
      +'<td>'+bds(p.permitidas,'bd-g')+'</td>'
      +'<td>'+bds(p.restritas,'bd-o')+'</td>'
      +'<td>'+bds(p.proibidas,'bd-r')+'</td>'
      +'<td>'+valHTML(p.data)+'</td>'
      +'<td style="white-space:nowrap;display:flex;gap:4px">'
      +'<button class="btn btn-out btn-sm" onclick="editP(\''+p.cod+'\')" title="Editar">✏️</button>'
      +pdfBtn
      +'<button class="btn btn-sm" onclick="confirmarApagar(\''+p.cod+'\')" style="background:var(--red-l);color:var(--red);border:1px solid var(--red-m)" title="Apagar">🗑</button>'
      +'</td></tr>';
  }).join('');
}

function filtBase(q){ _filtTexto=q||''; renderBase(); }
function filtCat(c) { _filtCat=c||'';   renderBase(); }

function editP(cod){
  var p  = DB.find(function(x){return x.cod===cod;});
  var pr = PRODS.find(function(x){return x.cod===cod;})||{cod:p.cod,nome:p.nome,cat:p.cat};
  document.querySelectorAll('.pg').forEach(function(x){x.classList.remove('on');});
  document.querySelectorAll('.ni').forEach(function(n){n.classList.remove('on');});
  document.getElementById('pg-cadastrar').classList.add('on');
  document.querySelectorAll('.ni')[4].classList.add('on');
  selP(pr,'cad');
  document.getElementById('si-cad').value=pr.cod+' · '+pr.nome;
}

// ══════ SALVAR (Firebase) ══════
async function salvar(){
  var cod  = document.getElementById('f-cod').value.trim();
  var nome = document.getElementById('f-nome').value.trim();
  if(!cod||!nome){toast('Código e nome obrigatórios.','w');return;}
  if(!Object.values(mc).some(function(a){return a.length;})){toast('Adicione ao menos uma marca.','w');return;}
  var idx  = DB.findIndex(function(p){return p.cod===cod;});
  var novo = {
    cod:        cod, nome:nome,
    cat:        document.getElementById('f-cat').value,
    padrao:     [...mc.padrao],    permitidas: [...mc.permitida],
    restritas:  [...mc.restrita],  proibidas:  [...mc.proibida],
    observacao: document.getElementById('f-obs').value.trim(),
    responsavel:document.getElementById('f-resp').value.trim(),
    data:       document.getElementById('f-data').value,
    parecer:    pdfObj ? pdfObj.name    : (idx>=0 ? DB[idx].parecer    : ''),
    pdfDataUrl: pdfObj ? pdfObj.dataUrl : (idx>=0 ? DB[idx].pdfDataUrl : null),
  };
  if(idx>=0) DB[idx]=novo; else DB.push(novo);
  await fbSave(novo);
  updNC();
  toast(idx>=0 ? 'Parecer atualizado!' : 'Produto cadastrado!');
  limpar();
}

// ══════ DASHBOARD ══════
function renderDash(){
  updNC();
  var cats={};
  DB.forEach(function(p){cats[p.cat||'OUTRO']=(cats[p.cat||'OUTRO']||0)+1;});
  var s=Object.entries(cats).sort(function(a,b){return b[1]-a[1];}).slice(0,7);
  var mx=s[0]?s[0][1]:1;
  var cs=['#3182CE','#38A169','#DD6B20','#E53E3E','#805AD5','#00B5D8','#D69E2E'];
  var ce=document.getElementById('ch-cats');
  if(ce) ce.innerHTML=s.length?s.map(function(e,i){return '<div class="bar-row"><div class="bar-lbl">'+e[0]+'</div><div class="bar-trk"><div class="bar-f" style="width:'+(e[1]/mx*100).toFixed(0)+'%;background:'+cs[i%cs.length]+'"></div></div><div class="bar-n">'+e[1]+'</div></div>';}).join(''):'<div style="padding:20px;color:var(--tx3);font-size:13px;text-align:center">Nenhum dado.</div>';
  var he=document.getElementById('ch-hist');
  if(!he) return;
  if(!hist.length){he.innerHTML='<div style="padding:20px;color:var(--tx3);font-size:13px;text-align:center">Sem consultas.</div>';return;}
  he.innerHTML=hist.slice(0,6).map(function(h){return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--bdr)"><span style="font-family:var(--mono);font-size:10px;color:var(--tx3);flex-shrink:0">'+h.ts+'</span><span style="font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+h.nome+'</span><span class="bd bd-b">Consulta</span></div>';}).join('');
}

// ══════ HISTÓRICO ══════
function renderHist(){
  var el=document.getElementById('hist-card');
  if(!hist.length){el.innerHTML='<div style="padding:32px;text-align:center;color:var(--tx3);font-size:13px">Nenhuma atividade.</div>';return;}
  el.innerHTML='<div class="tw"><table><thead><tr><th>Hora</th><th>Código</th><th>Produto</th><th>Tipo</th></tr></thead><tbody>'+hist.map(function(h){return '<tr><td style="font-family:var(--mono);font-size:11px;color:var(--tx3)">'+h.ts+'</td><td class="tc">'+h.cod+'</td><td class="tn">'+h.nome+'</td><td><span class="bd bd-b">Consulta</span></td></tr>';}).join('')+'</tbody></table></div>';
}

// ══════ MODAL ══════
function openModal(){document.getElementById('modal-rules').classList.add('on');}
function closeModal(){document.getElementById('modal-rules').classList.remove('on');}

// ══════ TOAST ══════
function toast(m,t){
  var el=document.getElementById('toast');
  el.textContent=(t==='w'?'⚠ ':'✓ ')+m;
  el.style.background=t==='w'?'#92400E':'#276749';
  el.classList.add('on');
  setTimeout(function(){el.classList.remove('on');},2800);
}

// ══════ UPDNC ══════
function updNC(){
  var cp=DB.length,pr=DB.filter(function(p){return p.proibidas&&p.proibidas.length;}).length;
  var sp=4579-cp;
  var kv=document.getElementById('kv-total'); if(kv) kv.textContent=(4579).toLocaleString('pt-BR');
  var kc=document.getElementById('kv-cp');    if(kc) kc.textContent=cp;
  var ks=document.getElementById('kv-sp');    if(ks) ks.textContent=sp.toLocaleString('pt-BR');
  var kr=document.getElementById('kv-pr');    if(kr) kr.textContent=pr;
  var nb=document.getElementById('nc-base');  if(nb) nb.textContent=cp;
  var nh=document.getElementById('nc-hist');  if(nh) nh.textContent=hist.length;
}

