// Estado global e funções de suporte (sem dependências)

// ══════ STATE ══════
let selProd=null, cadProd=null, pdfObj=null, editCod=null, hist=[];
let mc={padrao:[],permitida:[],restrita:[],proibida:[]};
let bioItens=[], bioFiltro='all';


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


