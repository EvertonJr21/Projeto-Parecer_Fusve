// Geração do relatório PDF via jsPDF + autoTable

// ══════ GERAR RELATÓRIO PDF ══════
function gerarRelatorioPDF() {
  if (!DB.length) { toast('Nenhum parecer cadastrado.', 'w'); return; }

  var doc = new jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  var pageW  = doc.internal.pageSize.getWidth();   // 297
  var pageH  = doc.internal.pageSize.getHeight();  // 210
  var mL = 12, mR = 12;
  var cW = pageW - mL - mR;  // 273mm usable
  var hoje    = new Date().toLocaleDateString('pt-BR');
  var hojeISO = new Date().toISOString().slice(0,10);

  // ── HEADER ──────────────────────────────────────────────────────────────────
  doc.setFillColor(44,82,130);
  doc.rect(0,0,pageW,20,'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(13); doc.setFont('helvetica','bold');
  doc.text('Parecer Técnico HUV', mL, 9);
  doc.setFontSize(7.5); doc.setFont('helvetica','normal');
  doc.text('Hospital Universitário de Vassouras · FUSVE', mL, 15);
  doc.text('Emitido em: ' + hoje, pageW-mR, 9, {align:'right'});
  doc.text('Relatório de Pareceres Técnicos Cadastrados', pageW-mR, 15, {align:'right'});

  // ── SUMMARY BOXES ───────────────────────────────────────────────────────────
  var y = 24;
  var comPadrao   = DB.filter(function(p){return p.padrao&&p.padrao.length;}).length;
  var comProibida = DB.filter(function(p){return p.proibidas&&p.proibidas.length;}).length;
  var comRestrita = DB.filter(function(p){return p.restritas&&p.restritas.length;}).length;
  var comPdf      = DB.filter(function(p){return p.pdfDataUrl;}).length;
  var boxes = [
    {label:'Total de Pareceres', val:DB.length,   fr:235,fg:248,fb:255, br:190,bg:227,bb:248, vr:44, vg:82, vb:130},
    {label:'Com Marca Padrão',   val:comPadrao,   fr:240,fg:255,fb:244, br:154,bg:230,bb:180, vr:39, vg:103,vb:73 },
    {label:'C/ Marca Proibida',  val:comProibida, fr:255,fg:245,fb:245, br:254,bg:178,bb:178, vr:155,vg:44, vb:44 },
    {label:'C/ Marca Restrita',  val:comRestrita, fr:255,fg:247,fb:237, br:253,bg:186,bb:116, vr:123,vg:52, vb:30 },
    {label:'Com PDF Vinculado',  val:comPdf,      fr:250,fg:245,fb:255, br:214,bg:188,bb:253, vr:85, vg:60, vb:154},
  ];
  var bw = (cW - 8) / boxes.length;
  boxes.forEach(function(b,i){
    var bx = mL + i*(bw+2);
    doc.setFillColor(b.fr,b.fg,b.fb); doc.setDrawColor(b.br,b.bg,b.bb);
    doc.roundedRect(bx,y,bw,14,1.5,1.5,'FD');
    doc.setFontSize(15); doc.setFont('helvetica','bold');
    doc.setTextColor(b.vr,b.vg,b.vb);
    doc.text(String(b.val), bx+bw/2, y+7, {align:'center'});
    doc.setFontSize(6); doc.setFont('helvetica','normal');
    doc.setTextColor(74,85,104);
    doc.text(b.label, bx+bw/2, y+12, {align:'center'});
  });

  // ── LEGEND ──────────────────────────────────────────────────────────────────
  y = 42;
  doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(74,85,104);
  doc.text('Legenda:', mL, y);
  var lg=[
    {t:'P = Padrão (comprar sempre)',           r:44, g:82, b:130},
    {t:'A = Permitida (se padrão indisponível)',r:39, g:103,b:73 },
    {t:'R = Restrita (consultar antes)',         r:123,g:52, b:30 },
    {t:'X = Proibida (não comprar)',             r:155,g:44, b:44 },
  ];
  var lx = mL+22;
  lg.forEach(function(l){
    doc.setFillColor(l.r,l.g,l.b);
    doc.circle(lx-2,y-1.5,1.6,'F');
    doc.setTextColor(l.r,l.g,l.b); doc.setFont('helvetica','bold');
    doc.text(l.t, lx+0.5, y);
    lx += 62;
  });

  // ── DATA ────────────────────────────────────────────────────────────────────
  var sorted = DB.slice().sort(function(a,b){
    var ca=(a.cat||'').toUpperCase(), cb=(b.cat||'').toUpperCase();
    if(ca!==cb) return ca<cb?-1:1;
    return parseInt(a.cod||0)-parseInt(b.cod||0);
  });

  function fmt(arr){ return (arr&&arr.length)?arr.join(', '):'—'; }
  function fmtVal(d){
    if(!d) return '—';
    try{
      var dt=new Date(d), now=new Date();
      var m=(now.getFullYear()-dt.getFullYear())*12+(now.getMonth()-dt.getMonth());
      return d.split('-').reverse().join('/')+' ('+m+'m)';
    }catch(e){return d;}
  }

  var rows = sorted.map(function(p,i){
    return [
      String(i+1),           // # — STRING to prevent wrapping
      p.cod,
      p.nome||'—',
      p.cat||'—',
      fmt(p.padrao),
      fmt(p.permitidas),
      fmt(p.restritas),
      fmt(p.proibidas),
      (p.observacao||'').substring(0,55)||'—',
      p.responsavel||'—',
      fmtVal(p.data),
    ];
  });

  // ── TABLE ───────────────────────────────────────────────────────────────────
  // Column widths must sum to <= 273mm (A4 landscape minus margins)
  // #:6 + Cód:13 + Produto:50 + Cat:26 + PP:24 + AP:24 + RR:20 + XP:24 + Obs:34 + Resp:24 + Val:16 = 261
  doc.autoTable({
    startY: y+5,
    head:[['#','Cód.','Produto','Categoria','P Padrão','A Permitidas','R Restritas','X Proibidas','Observações','Responsável','Validade']],
    body: rows,
    theme:'grid',
    styles:{
      fontSize:6.8,
      cellPadding:{top:2.2,right:2.5,bottom:2.2,left:2.5},
      overflow:'linebreak',
      lineColor:[226,232,240],
      lineWidth:0.25,
      textColor:[26,32,44],
      font:'helvetica',
      minCellHeight:7,
    },
    headStyles:{
      fillColor:[44,82,130],
      textColor:[255,255,255],
      fontStyle:'bold',
      fontSize:7,
      halign:'center',
      cellPadding:{top:3,right:2,bottom:3,left:2},
    },
    columnStyles:{
      0: {cellWidth:8,  halign:'center', fontStyle:'bold', textColor:[100,116,139]},
      1: {cellWidth:14, halign:'center', fontStyle:'bold', textColor:[44,82,130]},
      2: {cellWidth:52},
      3: {cellWidth:26},
      4: {cellWidth:24, textColor:[44,82,130],  fontStyle:'bold'},
      5: {cellWidth:24, textColor:[39,103,73]},
      6: {cellWidth:20, textColor:[123,52,30]},
      7: {cellWidth:24, textColor:[155,44,44],  fontStyle:'bold'},
      8: {cellWidth:33},
      9: {cellWidth:24},
      10:{cellWidth:18, halign:'center', fontSize:6.2},
    },
    alternateRowStyles:{fillColor:[247,250,252]},
    didParseCell: function(data){
      if(data.section!=='body') return;
      var r=rows[data.row.index];
      if(r&&r[7]!=='—'){
        data.cell.styles.fillColor=[255,245,245];
      }
    },
    didDrawPage: function(){
      var pg=doc.internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(6.5); doc.setTextColor(160,174,192); doc.setFont('helvetica','normal');
      doc.setDrawColor(226,232,240);
      doc.line(mL,pageH-8,pageW-mR,pageH-8);
      doc.text('Parecer Técnico HUV · Hospital Universitário de Vassouras', mL, pageH-4);
      doc.text('Gerado em '+hoje+' · SOULMV', pageW/2, pageH-4, {align:'center'});
      doc.text('Pág. '+pg+' de {totalPages}', pageW-mR, pageH-4, {align:'right'});
    },
    margin:{top:0, left:mL, right:mR, bottom:12},
    showHead:'everyPage',
    tableWidth:'wrap',
  });

  if(typeof doc.putTotalPages==='function') doc.putTotalPages('{totalPages}');
  doc.save('pareceres-tecnicos-huv-'+hojeISO+'.pdf');
  toast('PDF gerado com sucesso!');
}

