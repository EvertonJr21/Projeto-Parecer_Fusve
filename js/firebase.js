// Integração Firebase Firestore — estado, CRUD e import/export JSON

// ══════ STATE ══════
let selProd=null, cadProd=null, pdfObj=null, editCod=null, hist=[];
let mc={padrao:[],permitida:[],restrita:[],proibida:[]};
let bioItens=[], bioFiltro='all';

// ══════ FIREBASE CONFIG ══════
import { initializeApp }                        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, doc,
         getDocs, setDoc, deleteDoc,
         orderBy, query }                       from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const _fbConfig = {
  apiKey:            "AIzaSyDr4EBejWBEtcpRDOaSJnyPdVXBnbVNMrk",
  authDomain:        "parecer-tecnico-huv.firebaseapp.com",
  projectId:         "parecer-tecnico-huv",
  storageBucket:     "parecer-tecnico-huv.firebasestorage.app",
  messagingSenderId: "842738770974",
  appId:             "1:842738770974:web:3d7fe2530379a1d6e5ba0f",
  measurementId:     "G-F08DXXMKG9"
};

const _app = initializeApp(_fbConfig);
const _db  = getFirestore(_app);
const _col = collection(_db, 'pareceres');

// ── Row helpers ───────────────────────────────────────────────────────────────
function _toFirestore(p) {
  return {
    cod:          p.cod          || '',
    nome:         p.nome         || '',
    cat:          p.cat          || '',
    padrao:       p.padrao        || [],
    permitidas:   p.permitidas    || [],
    restritas:    p.restritas     || [],
    proibidas:    p.proibidas     || [],
    observacao:   p.observacao    || '',
    responsavel:  p.responsavel   || '',
    data_parecer: p.data          || '',
    parecer:      p.parecer       || '',
    pdf_data_url: p.pdfDataUrl    || '',
  };
}

function _fromFirestore(id, data) {
  return {
    cod:        id,
    nome:       data.nome         || '',
    cat:        data.cat          || '',
    padrao:     data.padrao        || [],
    permitidas: data.permitidas    || [],
    restritas:  data.restritas     || [],
    proibidas:  data.proibidas     || [],
    observacao: data.observacao    || '',
    responsavel:data.responsavel   || '',
    data:       data.data_parecer  || '',
    parecer:    data.parecer       || '',
    pdfDataUrl: data.pdf_data_url  || null,
  };
}

// ── Load ─────────────────────────────────────────────────────────────────────
async function fbLoad() {
  try {
    document.getElementById('fb-status').textContent = 'Carregando...';
    const snap = await getDocs(query(_col, orderBy('__name__')));
    DB.length = 0;
    snap.forEach(function(d) { DB.push(_fromFirestore(d.id, d.data())); });
    // Cache local
    try { localStorage.setItem('huv_cache', JSON.stringify(DB)); } catch(e) {}
    document.getElementById('fb-status').textContent = 'Online ● ' + DB.length + ' pareceres';
    document.getElementById('fb-status').style.color = '#68D391';
    console.log('Firebase: ' + DB.length + ' pareceres carregados.');
    return DB.length;
  } catch(e) {
    console.error('Firebase load error:', e);
    document.getElementById('fb-status').textContent = '⚠ Offline — dados locais';
    document.getElementById('fb-status').style.color = '#FCD34D';
    // Fallback: localStorage
    try {
      var saved = JSON.parse(localStorage.getItem('huv_cache') || '[]');
      saved.forEach(function(p) {
        var idx = DB.findIndex(function(x){ return x.cod===p.cod; });
        if(idx>=0) DB[idx]=p; else DB.push(p);
      });
    } catch(e2) {}
    return DB.length;
  }
}

// ── Save (upsert by cod) ──────────────────────────────────────────────────────
async function fbSave(p) {
  try {
    await setDoc(doc(_db, 'pareceres', p.cod), _toFirestore(p));
    try { localStorage.setItem('huv_cache', JSON.stringify(DB)); } catch(e) {}
  } catch(e) {
    console.error('Firebase save error:', e);
    toast('Erro ao salvar: ' + e.message, 'w');
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
async function fbDelete(cod) {
  try {
    await deleteDoc(doc(_db, 'pareceres', cod));
    var idx = DB.findIndex(function(p){ return p.cod===cod; });
    if(idx >= 0) DB.splice(idx, 1);
    try { localStorage.setItem('huv_cache', JSON.stringify(DB)); } catch(e) {}
  } catch(e) {
    console.error('Firebase delete error:', e);
    toast('Erro ao apagar: ' + e.message, 'w');
  }
}

// ── Batch import ──────────────────────────────────────────────────────────────
async function fbImportBatch(lista) {
  var erros = 0;
  for(var i=0; i<lista.length; i++) {
    try {
      await setDoc(doc(_db, 'pareceres', lista[i].cod), _toFirestore(lista[i]));
      var idx = DB.findIndex(function(p){ return p.cod===lista[i].cod; });
      if(idx>=0) DB[idx]=lista[i]; else DB.push(lista[i]);
    } catch(e) { erros++; }
  }
  try { localStorage.setItem('huv_cache', JSON.stringify(DB)); } catch(e) {}
  if(erros) toast(erros + ' erro(s) na importação.','w');
}

// ══════ EXPORT / IMPORT JSON ══════
function exportJSON() {
  var data = DB.map(function(p) {
    return {cod:p.cod,nome:p.nome,cat:p.cat,padrao:p.padrao,permitidas:p.permitidas,
            restritas:p.restritas,proibidas:p.proibidas,observacao:p.observacao,
            responsavel:p.responsavel,data:p.data,parecer:p.parecer};
  });
  var blob = new Blob([JSON.stringify({versao:'1.0',gerado_em:new Date().toISOString(),
    total:data.length,pareceres:data},null,2)],{type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pareceres-huv-' + new Date().toISOString().slice(0,10) + '.json';
  a.click(); URL.revokeObjectURL(a.href);
  toast('Base exportada!');
}

function importJSON() { document.getElementById('import-json-inp').click(); }

function handleImportJSON(input) {
  var file = input.files[0]; if(!file) return;
  var reader = new FileReader();
  reader.onload = async function(e) {
    try {
      var data  = JSON.parse(e.target.result);
      var lista = data.pareceres || data;
      if(!Array.isArray(lista)) throw new Error('Formato inválido');
      toast('Importando ' + lista.length + ' pareceres...');
      await fbImportBatch(lista);
      updNC();
      if(document.getElementById('pg-base').classList.contains('on')) renderBase();
      toast('Importado: ' + lista.length + ' pareceres.');
    } catch(err) { toast('Erro: ' + err.message,'w'); }
  };
  reader.readAsText(file,'utf-8');
  input.value='';
}


