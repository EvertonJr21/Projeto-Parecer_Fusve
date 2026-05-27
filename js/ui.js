// Interface: navegação, busca, cadastro, tabelas, dashboard

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
  autoSave();
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


// ══════ BASE ══════
function renderBase(q=''){
  const fq=q.toUpperCase();
  const lst=fq?DB.filter(p=>p.cod.includes(fq)||p.nome.toUpperCase().includes(fq)):DB;
  document.getElementById('base-info').textContent=lst.length+' registros';
  const tb=document.getElementById('tb-base');
  if(!lst.length){tb.innerHTML=`<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--tx3)">Nenhum resultado.</td></tr>`;return;}
  tb.innerHTML=lst.map(p=>`<tr>
    <td class="tc">${p.cod}</td>
    <td class="tn">${p.nome}<small>${p.cat||''}</small></td>
    <td>${p.padrao.map(m=>`<span class="bd bd-b">${m}</span>`).join(' ')||'<span style="color:var(--tx3)">—</span>'}</td>
    <td>${p.permitidas.map(m=>`<span class="bd bd-g">${m}</span>`).join(' ')||'<span style="color:var(--tx3)">—</span>'}</td>
    <td>${p.restritas.map(m=>`<span class="bd bd-o">${m}</span>`).join(' ')||'<span style="color:var(--tx3)">—</span>'}</td>
    <td>${p.proibidas.map(m=>`<span class="bd bd-r">${m}</span>`).join(' ')||'<span style="color:var(--tx3)">—</span>'}</td>
    <td>${validadeHTML(p.data)}</td>
    <td style="white-space:nowrap">
      <button class="btn btn-out btn-sm" onclick="editP('${p.cod}')">✏️</button>
      ${p.pdfDataUrl?`<a href="${p.pdfDataUrl}" target="_blank" class="btn btn-out btn-sm" style="margin-left:4px;text-decoration:none">📄</a>`:''}
    </td>
  </tr>`).join('');
}
function filtBase(q){renderBase(q);}
function editP(cod){
  const p=DB.find(x=>x.cod===cod);
  const pr=PRODS.find(x=>x.cod===cod)||{cod,nome:p.nome,cat:p.cat};
  document.querySelectorAll('.pg').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('on'));
  document.getElementById('pg-cadastrar').classList.add('on');
  document.querySelectorAll('.ni')[4].classList.add('on');
  selP(pr,'cad');document.getElementById('si-cad').value=pr.cod+' · '+pr.nome;
}


// ══════ DASHBOARD ══════
function renderDash(){
  updNC();
  const cats={};DB.forEach(p=>{cats[p.cat||'OUTRO']=(cats[p.cat||'OUTRO']||0)+1;});
  const s=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,7);
  const mx=s[0]?.[1]||1;
  const cs=['#3182CE','#38A169','#DD6B20','#E53E3E','#805AD5','#00B5D8','#D69E2E'];
  document.getElementById('ch-cats').innerHTML=s.length?s.map(([k,v],i)=>`<div class="bar-row"><div class="bar-lbl">${k}</div><div class="bar-trk"><div class="bar-f" style="width:${(v/mx*100).toFixed(0)}%;background:${cs[i%cs.length]}"></div></div><div class="bar-n">${v}</div></div>`).join(''):'<div style="padding:20px;color:var(--tx3);font-size:13px;text-align:center">Nenhum parecer cadastrado ainda.</div>';
  const hEl=document.getElementById('ch-hist');
  if(!hist.length){hEl.innerHTML='<div style="padding:20px;color:var(--tx3);font-size:13px;text-align:center">Sem atividade nesta sessão.</div>';return;}
  hEl.innerHTML=hist.slice(0,6).map(h=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--bdr)"><span style="font-family:var(--mono);font-size:10px;color:var(--tx3);flex-shrink:0">${h.ts}</span><span style="font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h.nome}</span>${h.alert?'<span class="bd bd-r">⚠</span>':h.tipo==='cotacao'?'<span class="bd bd-gr">Lote</span>':'<span class="bd bd-b">Consulta</span>'}</div>`).join('');
}
function updNC(){
  const cp=DB.length,sp=PRODS.length-cp,pr=DB.filter(p=>p.proibidas&&p.proibidas.length).length;
  document.getElementById('kv-total').textContent=PRODS.length.toLocaleString('pt-BR');
  document.getElementById('kv-cp').textContent=cp;
  document.getElementById('kv-sp').textContent=sp.toLocaleString('pt-BR');
  document.getElementById('kv-pr').textContent=pr;
  document.getElementById('nc-base').textContent=cp;
  document.getElementById('nc-hist').textContent=hist.length;
}


// ══════ HISTÓRICO ══════
function renderHist(){
  const el=document.getElementById('hist-card');
  if(!hist.length){el.innerHTML='<div style="padding:32px;text-align:center;color:var(--tx3);font-size:13px">Nenhuma atividade nesta sessão.</div>';return;}
  el.innerHTML=`<div class="tw"><table><thead><tr><th>Hora</th><th>Código</th><th>Produto / Ação</th><th>Tipo</th></tr></thead><tbody>${hist.map(h=>`<tr><td style="font-family:var(--mono);font-size:11px;color:var(--tx3)">${h.ts}</td><td class="tc">${h.cod}</td><td class="tn">${h.nome}</td><td>${h.tipo==='cotacao'?`<span class="bd ${h.alert?'bd-r':'bd-gr'}">${h.alert?'⚠ ':''} Cotação</span>`:'<span class="bd bd-b">Consulta</span>'}</td></tr>`).join('')}</tbody></table></div>`;
}


// ══════ MODAL ══════
function openModal(){document.getElementById('modal-rules').classList.add('on');}
function closeModal(){document.getElementById('modal-rules').classList.remove('on');}


// ══════ TOAST ══════
function toast(m,t='ok'){const el=document.getElementById('toast');el.textContent=(t==='w'?'⚠ ':'✓ ')+m;el.style.background=t==='w'?'#92400E':'#276749';el.classList.add('on');setTimeout(()=>el.classList.remove('on'),2800);}



// ══════ INIT ══════
(function(){
  var loaded = loadFromStorage();
  if(loaded){
    console.log('Loaded ' + loaded + ' pareceres from localStorage');
  }
  updNC();
  renderDash();
})();
