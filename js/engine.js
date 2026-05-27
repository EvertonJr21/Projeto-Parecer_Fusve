// Motor de regras: parser Bionexo, busca por marca, comparação, validade

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


// ══════ BIONEXO ══════



// ══════ BUSCA POR MARCA ══════
function buscarPorMarca(q) {
  var el = document.getElementById('marca-result');
  q = q.trim().toUpperCase();
  if (q.length < 2) { el.innerHTML = ''; return; }

  var results = [];
  DB.forEach(function(p) {
    var roles = [];
    if (p.padrao.some(function(m){ return m.toUpperCase().indexOf(q) >= 0; }))
      roles.push({tipo:'padrao', label:'PADRÃO', marcas: p.padrao.filter(function(m){return m.toUpperCase().indexOf(q)>=0;})});
    if (p.permitidas.some(function(m){ return m.toUpperCase().indexOf(q) >= 0; }))
      roles.push({tipo:'permitida', label:'PERMITIDA', marcas: p.permitidas.filter(function(m){return m.toUpperCase().indexOf(q)>=0;})});
    if (p.restritas.some(function(m){ return m.toUpperCase().indexOf(q) >= 0; }))
      roles.push({tipo:'restrita', label:'RESTRITA', marcas: p.restritas.filter(function(m){return m.toUpperCase().indexOf(q)>=0;})});
    if (p.proibidas.some(function(m){ return m.toUpperCase().indexOf(q) >= 0; }))
      roles.push({tipo:'proibida', label:'PROIBIDA', marcas: p.proibidas.filter(function(m){return m.toUpperCase().indexOf(q)>=0;})});
    if (roles.length) results.push({p: p, roles: roles});
  });

  if (!results.length) {
    el.innerHTML = '<div class="card" style="padding:24px;text-align:center;color:var(--tx3)">Nenhum produto encontrado com essa marca na base de pareceres.</div>';
    return;
  }

  var html = '<div style="font-size:12px;color:var(--tx3);margin-bottom:10px">' + results.length + ' produto(s) encontrado(s)</div>';
  results.forEach(function(r) {
    r.roles.forEach(function(role) {
      html += '<div class="marca-card">';
      html += '<div class="marca-card-hdr">';
      html += '<span class="marca-cat-badge">' + (r.p.cat||'—') + '</span>';
      html += '<span style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--blue)">' + r.p.cod + '</span>';
      html += '<span style="font-size:13px;font-weight:600;color:var(--tx);flex:1">' + r.p.nome + '</span>';
      html += '<span class="marca-role role-' + role.tipo + '">' + role.label + '</span>';
      html += '<button class="btn btn-out btn-sm" onclick="abrirCons(\'' + r.p.cod + '\')" style="margin-left:8px">Ver produto</button>';
      html += '</div>';
      html += '<div style="padding:10px 16px;font-size:12px;color:var(--tx2);display:flex;flex-wrap:wrap;gap:6px">';
      role.marcas.forEach(function(m) {
        var highlighted = m.replace(new RegExp(q, 'gi'), function(match) {
          return '<mark style="background:#FEF08A;padding:0 1px;border-radius:2px">' + match + '</mark>';
        });
        html += '<span class="tag ' + role.tipo + '">' + highlighted + '</span>';
      });
      html += '</div></div>';
    });
  });
  el.innerHTML = html;
}


// ══════ COMPARAR COTAÇÕES ══════
function parseCotacaoSimples(raw) {
  var lines = raw.split('\n').map(function(l){return l.trim();}).filter(function(l){return l.length>2;});
  var itens = [];
  lines.forEach(function(line, i) {
    var parts = line.split(/\s{2,}|\t/).map(function(p){return p.trim();}).filter(Boolean);
    if (!parts.length || !/^\d+$/.test(parts[0])) return;
    var cod = parts[0];
    var marca = parts[parts.length-1].toUpperCase();
    var desc = parts.length >= 3 ? parts.slice(1,-1).join(' ') : '';
    if (marca === cod) return;
    var prodInfo = PRODS.find(function(p){return p.cod===cod;});
    var nome = prodInfo ? prodInfo.nome : (desc || 'Produto '+cod);
    itens.push({num: i+1, cod: cod, nome: nome, marca: marca});
  });
  return itens;
}

function avaliarMarca(cod, marca) {
  var par = DB.find(function(p){return p.cod===cod;});
  if (!par) return {status:'sempar', label:'Sem Parecer'};
  var mU = marca.toUpperCase();
  function matchIn(arr) { return arr.some(function(m){return m.toUpperCase()===mU||mU.indexOf(m.toUpperCase())>=0||m.toUpperCase().indexOf(mU)>=0;}); }
  if (matchIn(par.proibidas)) return {status:'proibida', label:'PROIBIDA'};
  if (matchIn(par.padrao))    return {status:'padrao',   label:'PADRÃO'};
  if (matchIn(par.permitidas))return {status:'permitida',label:'PERMITIDA'};
  if (matchIn(par.restritas)) return {status:'restrita', label:'RESTRITA'};
  return {status:'desconhecida', label:'Não cadastrada'};
}

function scoreStatus(s) {
  return {padrao:4, permitida:3, restrita:1, desconhecida:2, sempar:2, proibida:0}[s] || 0;
}

function compararCotacoes() {
  var rawA = document.getElementById('cmp-a').value.trim();
  var rawB = document.getElementById('cmp-b').value.trim();
  if (!rawA || !rawB) { toast('Preencha as duas cotações.','w'); return; }

  var itensA = parseCotacaoSimples(rawA);
  var itensB = parseCotacaoSimples(rawB);
  if (!itensA.length || !itensB.length) { toast('Nenhum item válido encontrado. Use: CÓDIGO  MARCA','w'); return; }

  // Merge by cod
  var allCods = [...new Set([...itensA.map(function(i){return i.cod;}), ...itensB.map(function(i){return i.cod;})])];
  var rows = allCods.map(function(cod) {
    var a = itensA.find(function(i){return i.cod===cod;});
    var b = itensB.find(function(i){return i.cod===cod;});
    var evA = a ? avaliarMarca(cod, a.marca) : null;
    var evB = b ? avaliarMarca(cod, b.marca) : null;
    return {cod:cod, nome:(a||b).nome, a:a, b:b, evA:evA, evB:evB};
  });

  var scoreA = rows.reduce(function(s,r){return s+(r.evA?scoreStatus(r.evA.status):0);},0);
  var scoreB = rows.reduce(function(s,r){return s+(r.evB?scoreStatus(r.evB.status):0);},0);
  var proibA = rows.filter(function(r){return r.evA&&r.evA.status==='proibida';}).length;
  var proibB = rows.filter(function(r){return r.evB&&r.evB.status==='proibida';}).length;

  var statusColors = {padrao:'#2B6CB0',permitida:'#276749',restrita:'#7B341E',proibida:'#9B2C2C',desconhecida:'#A0AEC0',sempar:'#553C9A'};
  var statusBg     = {padrao:'var(--blue-l)',permitida:'var(--green-l)',restrita:'var(--orange-l)',proibida:'var(--red-l)',desconhecida:'var(--surf2)',sempar:'#FAF5FF'};

  function pillEv(ev) {
    if (!ev) return '<span style="color:var(--tx3);font-size:11px">—</span>';
    return '<span class="bd" style="background:'+statusBg[ev.status]+';color:'+statusColors[ev.status]+'">'+ev.label+'</span>';
  }

  var vencedor = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : 'Empate';
  var vencedorColor = scoreA > scoreB ? 'var(--blue)' : scoreB > scoreA ? '#276749' : 'var(--tx2)';

  var html = '<div class="card">';
  // Summary
  html += '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:center;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--bdr)">';
  html += '<div style="text-align:center;padding:14px;background:var(--blue-l);border-radius:var(--r)">';
  html += '<div style="font-size:22px;font-weight:700;color:var(--blue);font-family:var(--mono)">' + scoreA + '</div>';
  html += '<div style="font-size:11px;font-weight:700;color:var(--blue);text-transform:uppercase;margin-top:3px">Cotação A</div>';
  html += proibA ? '<div style="font-size:11px;color:var(--red);margin-top:4px">⚠ '+proibA+' proibida(s)</div>' : '';
  html += '</div>';
  html += '<div style="text-align:center"><div style="font-size:13px;font-weight:700;color:'+vencedorColor+'">';
  html += vencedor === 'Empate' ? '🟰 Empate' : '🏆 Cotação ' + vencedor + ' recomendada';
  html += '</div></div>';
  html += '<div style="text-align:center;padding:14px;background:var(--green-l);border-radius:var(--r)">';
  html += '<div style="font-size:22px;font-weight:700;color:#276749;font-family:var(--mono)">' + scoreB + '</div>';
  html += '<div style="font-size:11px;font-weight:700;color:#276749;text-transform:uppercase;margin-top:3px">Cotação B</div>';
  html += proibB ? '<div style="font-size:11px;color:var(--red);margin-top:4px">⚠ '+proibB+' proibida(s)</div>' : '';
  html += '</div></div>';

  // Table
  html += '<div class="tw"><table class="bio-tbl"><thead><tr>';
  html += '<th>#</th><th>Código</th><th>Produto</th>';
  html += '<th style="background:var(--blue-l);color:var(--blue)">Cotação A — Marca / Parecer</th>';
  html += '<th style="background:var(--green-l);color:#276749">Cotação B — Marca / Parecer</th>';
  html += '</tr></thead><tbody>';

  rows.forEach(function(r, i) {
    var proib = (r.evA&&r.evA.status==='proibida')||(r.evB&&r.evB.status==='proibida');
    var rowClass = proib ? 'r-proibida' : '';
    html += '<tr class="'+rowClass+'">';
    html += '<td class="item-num">' + (i+1) + '</td>';
    html += '<td class="item-cod">' + r.cod + '</td>';
    html += '<td class="item-desc">' + r.nome + '</td>';
    html += '<td>';
    if (r.a) html += '<div style="font-weight:600;margin-bottom:3px">' + r.a.marca + '</div>' + pillEv(r.evA);
    else html += '<span style="color:var(--tx3);font-size:11px">Não cotado</span>';
    html += '</td>';
    html += '<td>';
    if (r.b) html += '<div style="font-weight:600;margin-bottom:3px">' + r.b.marca + '</div>' + pillEv(r.evB);
    else html += '<span style="color:var(--tx3);font-size:11px">Não cotado</span>';
    html += '</td>';
    html += '</tr>';
  });

  html += '</tbody></table></div></div>';
  var el = document.getElementById('cmp-result');
  el.innerHTML = html;
  el.style.display = 'block';
}


// ══════ VALIDADE PARECER ══════
function validadeHTML(dataStr) {
  if (!dataStr) return '<span class="val-none">—</span>';
  try {
    var d = new Date(dataStr);
    var now = new Date();
    var months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (months < 0) return '<span class="val-ok">✓ Vigente</span>';
    if (months < 12) return '<span class="val-ok">✓ ' + months + 'm</span>';
    if (months < 18) return '<span class="val-warn">⚠ ' + months + 'm</span>';
    return '<span class="val-exp">⚠ ' + months + 'm — Rever</span>';
  } catch(e) { return '<span class="val-none">—</span>'; }
}


// ══════ EXPORTAR RELATÓRIO COTAÇÃO (print) ══════
function exportarRelatorio() {
  if (!bioItens.length) { toast('Nenhuma cotação verificada.','w'); return; }
  window.print();
}

