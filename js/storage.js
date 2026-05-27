// Persistência: localStorage, export/import JSON

// ══════ STATE ══════
let selProd=null, cadProd=null, pdfObj=null, editCod=null, hist=[];
let mc={padrao:[],permitida:[],restrita:[],proibida:[]};
let bioItens=[], bioFiltro='all';


// ══════ AUTO-SAVE (localStorage) ══════
// Saves pareceres to localStorage so data persists across sessions
// pdfDataUrl is also saved so uploaded PDFs are preserved

var _unsaved = false;

function autoSave(){
  try {
    localStorage.setItem('huv_pareceres', JSON.stringify(DB));
    _unsaved = false;
    hideSaveBar();
  } catch(e) {
    // localStorage full (likely due to large pdfDataUrl) — notify
    console.warn('localStorage save failed:', e.message);
    showSaveBar('⚠ Dados grandes demais para salvar automaticamente. Clique em Baixar JSON.');
  }
}

function loadFromStorage(){
  try {
    var saved = localStorage.getItem('huv_pareceres');
    if(!saved) return false;
    var parsed = JSON.parse(saved);
    if(!Array.isArray(parsed) || !parsed.length) return false;
    // Merge: storage takes priority over hardcoded DB
    parsed.forEach(function(p){
      var idx = DB.findIndex(function(x){return x.cod===p.cod;});
      if(idx>=0) DB[idx]=p; else DB.push(p);
    });
    return parsed.length;
  } catch(e){
    console.warn('Storage load failed:', e);
    return false;
  }
}

function markUnsaved(){
  _unsaved = true;
  showSaveBar('Você tem alterações não salvas. Baixe o JSON para não perder os dados.');
}

function showSaveBar(msg){
  var bar = document.getElementById('save-bar');
  var msgEl = document.getElementById('save-bar-msg');
  if(msgEl) msgEl.textContent = msg || 'Alterações não salvas.';
  if(bar) bar.classList.add('visible');
}

function hideSaveBar(){
  var bar = document.getElementById('save-bar');
  if(bar) bar.classList.remove('visible');
}


// ══════ EXPORT / IMPORT JSON ══════

function exportJSON(){
  // Export only DB (pareceres) — PRODS stays in the HTML
  // Strip pdfDataUrl from export to keep file small; user keeps PDFs locally
  var exportData = DB.map(function(p){
    return {
      cod: p.cod, nome: p.nome, cat: p.cat,
      padrao: p.padrao, permitidas: p.permitidas,
      restritas: p.restritas, proibidas: p.proibidas,
      observacao: p.observacao, responsavel: p.responsavel,
      data: p.data, parecer: p.parecer
      // pdfDataUrl intentionally excluded — keeps JSON lightweight
    };
  });
  var payload = {
    versao: '1.0',
    gerado_em: new Date().toISOString(),
    total: exportData.length,
    pareceres: exportData
  };
  var json = JSON.stringify(payload, null, 2);
  var blob = new Blob([json], {type: 'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'pareceres-huv-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  autoSave();
  hideSaveBar();
  toast('Base exportada com sucesso!');
}

function importJSON(){
  document.getElementById('import-json-inp').click();
}

function handleImportJSON(input){
  var file = input.files[0];
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(e){
    try {
      var data = JSON.parse(e.target.result);
      var pareceres = data.pareceres || data; // support both formats
      if(!Array.isArray(pareceres)) throw new Error('Formato inválido');
      var added = 0, updated = 0;
      pareceres.forEach(function(p){
        if(!p.cod || !p.nome) return;
        var idx = DB.findIndex(function(x){return x.cod===p.cod;});
        var entry = {
          cod: p.cod, nome: p.nome, cat: p.cat||'',
          padrao: p.padrao||[], permitidas: p.permitidas||[],
          restritas: p.restritas||[], proibidas: p.proibidas||[],
          observacao: p.observacao||'', responsavel: p.responsavel||'',
          data: p.data||'', parecer: p.parecer||'', pdfDataUrl: null
        };
        if(idx>=0){ DB[idx]=entry; updated++; }
        else { DB.push(entry); added++; }
      });
      autoSave();
      updNC();
      if(document.getElementById('pg-base').classList.contains('on')) renderBase();
      toast('Importado: +' + added + ' novos, ' + updated + ' atualizados.');
    } catch(err){
      toast('Erro ao importar: ' + err.message, 'w');
    }
  };
  reader.readAsText(file, 'utf-8');
  input.value = '';
}

