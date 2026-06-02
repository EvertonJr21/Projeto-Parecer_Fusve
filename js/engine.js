// Motor: parser Bionexo PDF, filtro PDF, busca por marca

// ══════ BIONEXO PDF PARSER ══════
// Parses text extracted from Bionexo PDF via PDF.js
function parseBionexoText(fullText) {
  var lines = fullText.split('\n');
  var meta = {};
  var itens = [];
  var itemNum = 0;

  // Extract metadata
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var mSol = line.match(/Solic[iu]ta[cç][aã]o N\.\s*(\d+)/);
    if (mSol) meta.solicitacao = mSol[1];
    var mId = line.match(/ID:\s*(\d+)/);
    if (mId) meta.id_cotacao = mId[1];
    var mTipo = line.match(/Tipo de cota[cç][aã]o:\s*([^\s][^\t]+?)(?:\s{3,}|$)/);
    if (mTipo) meta.tipo = mTipo[1].trim();
    var mDatas = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/);
    if (mDatas) { meta.data_criacao = mDatas[1]; meta.vencimento = mDatas[2]; }
    var mComp = line.match(/Comprador:\s*(.+?)$/);
    if (mComp) meta.comprador = mComp[1].trim();
    var mHosp = line.match(/\b(HMK|HUV)\b/);
    if (mHosp) meta.hospital = mHosp[1];
  }

  // Parse items: code at line start + ends with quantity + "Para análise"
  // Two patterns to handle varying unit spacing
  var itemRe = new RegExp(
    '^(\\d{4,6})\\s{2,}' +
    '(.+?)\\s{1,}' +
    '(Unidade|Frasco|Litro|un|KIT|Kit|Caixa|CAIXA|Metro|PAR|Par|Ampola|Comprimido|ml|ML|g|G|kg|KG|L)\\s{2,}' +
    '([\\d\\.\\,]+)\\s+' +
    'Para\\s+an[aá]lise',
    'i'
  );
  var fallbackRe = new RegExp(
    '^(\\d{4,6})\\s{2,}' +
    '(.+?)\\s{2,}' +
    '([\\d\\.\\,]+)\\s+' +
    'Para\\s+an[aá]lise'
  );
  var contRe = new RegExp('^\\s{5,}\\S');

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var stripped = line.replace(/^\s+/, '');
    var m = itemRe.exec(stripped);
    var cod, desc, un, qtyRaw;

    if (m) {
      cod = m[1]; desc = m[2].trim(); un = m[3].trim(); qtyRaw = m[4];
    } else {
      var m2 = fallbackRe.exec(stripped);
      if (!m2) continue;
      cod = m2[1]; desc = m2[2].trim(); un = ''; qtyRaw = m2[3];
    }

    // Handle description continuation on next line
    if (i + 1 < lines.length) {
      var nextLine = lines[i + 1];
      if (nextLine &&
          contRe.test(nextLine) &&
          !/^\s*\d{4,6}\s/.test(nextLine) &&
          !/Para an[aá]lise/.test(nextLine) &&
          !/Cota[cç][aã]o \d/.test(nextLine)) {
        desc = desc + ' ' + nextLine.trim();
        i++;
      }
    }

    var qtyStr = qtyRaw.replace(/\./g, '').replace(',', '.');
    var qty = parseFloat(qtyStr) || 0;

    itemNum++;
    itens.push({
      num: itemNum,
      cod: cod,
      desc: desc,
      un: un,
      qty: qty,
      qty_fmt: qtyRaw,
      status: 'Para análise'
    });
  }

  return { meta: meta, itens: itens };
}


// ══════ PDF.js TEXT EXTRACTION ══════
async function handleBioFile(file) {
  if (!file) return;
  
  var ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'txt' || ext === 'csv') {
    // Plain text: read directly
    var reader = new FileReader();
    reader.onload = function(e) {
      parseBionexoAndProcess(e.target.result, file.name);
    };
    reader.readAsText(file, 'utf-8');
    return;
  }
  
  // PDF: use PDF.js
  try {
    var arrayBuffer = await file.arrayBuffer();
    var loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    var pdf = await loadingTask.promise;
    
    var fullText = '';
    for (var p = 1; p <= pdf.numPages; p++) {
      var page = await pdf.getPage(p);
      var content = await page.getTextContent();
      
      // Reconstruct text preserving layout
      // Sort items by Y position (descending = top to bottom) then X
      var items = content.items.slice().sort(function(a, b) {
        var yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > 3) return yDiff;
        return a.transform[4] - b.transform[4];
      });
      
      // Group items into lines by Y coordinate
      var lineGroups = [];
      var currentY = null;
      var currentLine = [];
      
      items.forEach(function(item) {
        var y = Math.round(item.transform[5]);
        if (currentY === null || Math.abs(y - currentY) > 3) {
          if (currentLine.length > 0) lineGroups.push(currentLine);
          currentLine = [item];
          currentY = y;
        } else {
          currentLine.push(item);
        }
      });
      if (currentLine.length > 0) lineGroups.push(currentLine);
      
      // For each line group, sort by X and join with spacing based on X gaps
      lineGroups.forEach(function(group) {
        group.sort(function(a, b) { return a.transform[4] - b.transform[4]; });
        var lineStr = '';
        var prevEnd = 0;
        group.forEach(function(item) {
          var x = item.transform[4];
          // Add spaces based on gap from previous item end
          if (prevEnd > 0 && x - prevEnd > 8) {
            var spaces = Math.round((x - prevEnd) / 5);
            lineStr += ' '.repeat(Math.max(1, spaces));
          }
          lineStr += item.str;
          prevEnd = x + (item.width || 0);
        });
        fullText += lineStr + '\n';
      });
    }
    
    parseBionexoAndProcess(fullText, file.name);
    
  } catch(err) {
    console.error('PDF parse error:', err);
    toast('Erro ao ler o PDF: ' + err.message, 'w');
  }
}

function parseBionexoAndProcess(text, fname) {
  var result = parseBionexoText(text);
  if (!result.itens.length) {
    toast('Nenhum item encontrado no arquivo. Verifique se é um relatório Bionexo válido.', 'w');
    return;
  }
  document.getElementById('bio-loaded-name').textContent = fname + ' · ' + result.itens.length + ' itens';
  document.getElementById('bio-loaded-bar').style.display = 'flex';
  processarBio(result.itens, Object.assign(result.meta, {fname: fname}));
}

function verificarManual(){
  const raw=document.getElementById('bio-manual').value.trim();
  if(!raw){toast('Digite os itens antes de verificar.','w');return;}
  const lines=raw.split('\n').map(l=>l.trim()).filter(l=>l.length>2);
  const itens=[];
  lines.forEach((line,i)=>{
    const parts=line.split(/\s{2,}|	/).map(p=>p.trim()).filter(Boolean);
    if(!parts.length)return;
    // flexible: first token = code, last = qty if numeric, rest = desc
    let cod=parts[0],desc='',un='',qty=0;
    if(!/^\d+$/.test(cod))return;
    if(parts.length>=2)desc=parts[1]||'';
    if(parts.length>=3)un=parts[2]||'';
    if(parts.length>=4)qty=parseFloat(parts[3])||0;
    itens.push({num:i+1,cod,desc,un,qty,statusBio:'Para análise'});
  });
  if(!itens.length){toast('Nenhum item válido. Verifique o formato.','w');return;}
  processarBio(itens,{solNum:'Manual',solTipo:'',solData:new Date().toLocaleDateString('pt-BR'),fname:'Entrada manual'});
}

function processarBio(itens, meta){
  bioItens=itens.map(item=>{
    const par=DB.find(p=>p.cod===item.cod);
    const prodInfo=PRODS.find(p=>p.cod===item.cod);
    const nomeProd=prodInfo?prodInfo.nome:item.desc;
    const cat=prodInfo?prodInfo.cat:'';
    const sugs=MARCAS_SUG[cat]||[];

    if(!par){
      return {...item,nome:nomeProd,cat,par:null,sugs,status:'sempar'};
    }

    // Determine status from parecer (no brand input — just flag what exists)
    let status='ok';
    if(par.proibidas.length)status='tem_proibida';
    else if(par.restritas.length)status='tem_restrita';
    else if(par.padrao.length)status='ok';
    else if(par.permitidas.length)status='ok';

    return {...item,nome:nomeProd,cat,par,sugs,status};
  });

  // Show meta
  if(meta.solNum){
    document.getElementById('bio-meta-wrap').style.display='block';
    document.getElementById('bio-meta-items').innerHTML=[
      meta.solNum?`<div style="background:var(--blue-l);border:1px solid var(--blue-m);border-radius:var(--r);padding:8px 14px"><div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase">Solicitação</div><div style="font-size:13px;font-weight:600;color:var(--blue)">${meta.solNum}</div></div>`:'',
      meta.solTipo?`<div style="background:var(--surf2);border:1px solid var(--bdr);border-radius:var(--r);padding:8px 14px"><div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase">Tipo</div><div style="font-size:13px;font-weight:600">${meta.solTipo}</div></div>`:'',
      meta.solData?`<div style="background:var(--surf2);border:1px solid var(--bdr);border-radius:var(--r);padding:8px 14px"><div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase">Data</div><div style="font-size:13px;font-weight:600">${meta.solData}</div></div>`:'',
    ].filter(Boolean).join('');
  }

  bioFiltro='all';
  renderBio();
  document.getElementById('bio-result-wrap').style.display='block';

  const bloq=bioItens.filter(i=>i.status==='tem_proibida').length;
  const nc=document.getElementById('nc-bio');
  if(bloq>0){nc.textContent=`⚠ ${bloq}`;nc.classList.add('alert');}
  else{nc.textContent=bioItens.length;nc.classList.remove('alert');}

  hist.unshift({ts:new Date().toLocaleTimeString('pt-BR'),cod:'—',nome:`Cotação ${meta.solNum||'manual'}: ${bioItens.length} itens${bloq?' ('+bloq+' bloqueados)':''}`,tipo:'cotacao',alert:bloq>0});
  updNC();
}

function renderBio(){
  const itens=bioFiltro==='all'?bioItens:bioFiltro==='proibida'?bioItens.filter(i=>i.status==='tem_proibida'):bioItens.filter(i=>i.status==='sempar'||i.status==='tem_restrita');

  const counts={ok:0,tem_proibida:0,tem_restrita:0,sempar:0};
  bioItens.forEach(i=>counts[i.status]=(counts[i.status]||0)+1);
  const total=bioItens.length;

  document.getElementById('bio-sum').innerHTML=`
    <div class="bs-item ok"><div class="bs-v">${counts.ok||0}</div><div class="bs-l">Com Parecer OK</div></div>
    <div class="bs-item warn"><div class="bs-v">${counts.tem_restrita||0}</div><div class="bs-l">C/ Restritas</div></div>
    <div class="bs-item danger"><div class="bs-v">${counts.tem_proibida||0}</div><div class="bs-l">C/ Proibidas</div></div>
    <div class="bs-item perm"><div class="bs-v">${counts.sempar||0}</div><div class="bs-l">Sem Parecer</div></div>
    <div class="bs-item na"><div class="bs-v">${total}</div><div class="bs-l">Total</div></div>`;

  const stCfg={
    ok:        {pill:'<span class="status-pill sp-padrao">🔵 Com Parecer</span>',row:''},
    tem_proibida:{pill:'<span class="status-pill sp-proibida">🔴 Tem Proibidas</span>',row:'r-proibida'},
    tem_restrita:{pill:'<span class="status-pill sp-restrita">🟡 Tem Restritas</span>',row:'r-restrita'},
    sempar:    {pill:'<span class="status-pill sp-sempar">🟣 Sem Parecer</span>',row:'r-sempar'},
  };

  document.getElementById('bio-tbody').innerHTML=itens.map(item=>{
    const s=stCfg[item.status]||stCfg['sempar'];
    const par=item.par;

    // Marcas column
    let marcasHtml='<span style="color:var(--tx3);font-size:11px">—</span>';
    if(par){
      const parts=[];
      if(par.padrao.length)parts.push(par.padrao.map(m=>`<span class="bd bd-b">${m}</span>`).join(' '));
      if(par.permitidas.length)parts.push(par.permitidas.map(m=>`<span class="bd bd-g">${m}</span>`).join(' '));
      if(par.restritas.length)parts.push(par.restritas.map(m=>`<span class="bd bd-o">⚠ ${m}</span>`).join(' '));
      if(par.proibidas.length)parts.push(par.proibidas.map(m=>`<span class="bd bd-r">🚫 ${m}</span>`).join(' '));
      if(parts.length)marcasHtml='<div style="display:flex;flex-wrap:wrap;gap:4px">'+parts.join('')+'</div>';
    } else if(item.sugs.length){
      marcasHtml='<div style="display:flex;flex-wrap:wrap;gap:4px">'+item.sugs.map(m=>`<span class="bd bd-p" title="Sugestão de mercado">${m}</span>`).join('')+'</div>';
    }

    return `<tr class="${s.row}">
      <td class="item-num">${item.num}</td>
      <td class="item-cod">${item.cod}</td>
      <td><div class="item-desc">${item.nome||item.desc}</div>${item.cat?`<div style="font-size:11px;color:var(--tx3);margin-top:2px">${item.cat}</div>`:''}</td>
      <td style="color:var(--tx3);font-size:12px">${item.un}</td>
      <td class="item-qty">${item.qty>0?item.qty.toLocaleString('pt-BR'):''}</td>
      <td><span style="font-size:11px;color:var(--tx3)">${item.statusBio}</span></td>
      <td>${s.pill}</td>
      <td style="max-width:260px">${marcasHtml}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="abrirCons('${item.cod}')">Ver</button></td>
    </tr>`;
  }).join('');

  // Update filter buttons
  ['all','proibida','atencao'].forEach(f=>{
    const el=document.getElementById('fbtn-'+f);
    if(el)el.style.background=bioFiltro===f?'var(--blue)':'';
    if(el)el.style.color=bioFiltro===f?'#fff':'';
  });
}

function filtBio(f){bioFiltro=f;renderBio();}

function abrirCons(cod){
  const p=PRODS.find(x=>x.cod===cod);
  if(!p)return;
  document.querySelectorAll('.pg').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('on'));
  document.getElementById('pg-consultar').classList.add('on');
  document.querySelectorAll('.ni')[1].classList.add('on');
  selP(p,'cons');
  document.getElementById('si-cons').value=p.cod+' · '+p.nome;
}

function limparBio(){
  bioItens=[];bioFiltro='all';
  document.getElementById('bio-result-wrap').style.display='none';
  document.getElementById('bio-loaded-bar').style.display='none';
  document.getElementById('bio-manual').value='';
  document.getElementById('bio-file-inp').value='';
  const nc=document.getElementById('nc-bio');
  nc.textContent='Bionexo';nc.classList.remove('alert');
}

// ══════ FILTRO PDF ══════
function abrirModalPDF(){
  var cats=[...new Set(DB.map(function(p){return p.cat||'';}).filter(Boolean))].sort();
  var sel=document.getElementById('pdf-fil-cat');
  sel.innerHTML='<option value="">Todas as categorias</option>';
  cats.forEach(function(c){sel.innerHTML+='<option value="'+c+'">'+c+'</option>';});
  atualizarPreviewPDF();
  document.getElementById('modal-pdf-filtro').classList.add('on');
}
function fecharModalPDF(){document.getElementById('modal-pdf-filtro').classList.remove('on');}
function atualizarPreviewPDF(){
  var n=filtrarParaPDF().length;
  var el=document.getElementById('pdf-preview-count');
  if(el) el.textContent=n+' parecer(es) serão incluídos';
}
function filtrarParaPDF(){
  var cat   =document.getElementById('pdf-fil-cat').value;
  var status=document.getElementById('pdf-fil-status').value;
  var texto =(document.getElementById('pdf-fil-texto').value||'').toUpperCase();
  return DB.filter(function(p){
    if(cat    && p.cat!==cat) return false;
    if(texto  && p.nome.toUpperCase().indexOf(texto)<0 && p.cod.indexOf(texto)<0) return false;
    if(status==='padrao'    && (!p.padrao   ||!p.padrao.length))   return false;
    if(status==='proibida'  && (!p.proibidas||!p.proibidas.length)) return false;
    if(status==='restrita'  && (!p.restritas||!p.restritas.length)) return false;
    if(status==='sempadrao' &&   p.padrao   && p.padrao.length)    return false;
    return true;
  });
}
function gerarPDFFiltrado(){
  var lista=filtrarParaPDF();
  if(!lista.length){toast('Nenhum item com esses filtros.','w');return;}
  fecharModalPDF();
  gerarRelatorioPDF(lista);
}

// ══════ BUSCA POR MARCA ══════
function buscarPorMarca(q){
  var el=document.getElementById('marca-result');
  q=(q||'').trim().toUpperCase();
  if(q.length<2){el.innerHTML='';return;}
  var results=[];
  DB.forEach(function(p){
    var roles=[];
    function chk(arr,tipo,label){var f=arr?arr.filter(function(m){return m.toUpperCase().indexOf(q)>=0;}):[]; if(f.length)roles.push({tipo:tipo,label:label,marcas:f});}
    chk(p.padrao,'padrao','PADRÃO'); chk(p.permitidas,'permitida','PERMITIDA');
    chk(p.restritas,'restrita','RESTRITA'); chk(p.proibidas,'proibida','PROIBIDA');
    if(roles.length) results.push({p:p,roles:roles});
  });
  if(!results.length){el.innerHTML='<div class="card" style="padding:24px;text-align:center;color:var(--tx3)">Nenhum produto encontrado.</div>';return;}
  var html='<div style="font-size:12px;color:var(--tx3);margin-bottom:10px">'+results.length+' produto(s)</div>';
  results.forEach(function(r){
    r.roles.forEach(function(role){
      var cm={padrao:'bd-b',permitida:'bd-g',restrita:'bd-o',proibida:'bd-r'};
      html+='<div style="background:var(--surf);border:1px solid var(--bdr);border-radius:var(--r-lg);overflow:hidden;margin-bottom:8px;box-shadow:var(--sh)">';
      html+='<div style="padding:10px 16px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:10px;background:var(--surf2)">';
      html+='<span style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--blue);background:var(--blue-l);border:1px solid var(--blue-m);padding:2px 8px;border-radius:4px">'+r.p.cod+'</span>';
      html+='<span style="font-size:13px;font-weight:600;color:var(--tx);flex:1">'+r.p.nome+'</span>';
      html+='<span class="bd '+cm[role.tipo]+'">'+role.label+'</span>';
      html+='<button class="btn btn-out btn-sm" onclick="abrirCons(\''+r.p.cod+'\')" style="margin-left:6px">Ver</button>';
      html+='</div><div style="padding:9px 16px;display:flex;flex-wrap:wrap;gap:6px">';
      role.marcas.forEach(function(m){
        var hl=m.replace(new RegExp(q,'gi'),function(x){return '<mark style="background:#FEF08A;padding:0 1px;border-radius:2px">'+x+'</mark>';});
        html+='<span class="tag '+role.tipo+'">'+hl+'</span>';
      });
      html+='</div></div>';
    });
  });
  el.innerHTML=html;
}

