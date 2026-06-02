// Geração do relatório PDF via jsPDF + autoTable

// ══════ GERAR RELATÓRIO PDF ══════
function gerarRelatorioPDF(listaOverride){
  var lista=listaOverride||DB;
  if(!lista.length){toast('Nenhum parecer para gerar PDF.','w');return;}
  var doc=new jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  var pageW=doc.internal.pageSize.getWidth(),pageH=doc.internal.pageSize.getHeight();
  var mL=12,mR=12,cW=pageW-mL-mR;
  var hoje=new Date().toLocaleDateString('pt-BR'),hojeISO=new Date().toISOString().slice(0,10);
  doc.setFillColor(44,82,130);doc.rect(0,0,pageW,20,'F');
  doc.setTextColor(255,255,255);doc.setFontSize(13);doc.setFont('helvetica','bold');
  doc.text('Parecer Técnico HUV',mL,9);
  doc.setFontSize(7.5);doc.setFont('helvetica','normal');
  doc.text('Hospital Universitário de Vassouras · FUSVE',mL,15);
  doc.text('Emitido em: '+hoje,pageW-mR,9,{align:'right'});
  var fl=listaOverride?'(filtrado — '+lista.length+' de '+DB.length+')':'Todos os pareceres';
  doc.text('Relatório de Pareceres Técnicos · '+fl,pageW-mR,15,{align:'right'});
  var y=24;
  var boxes=[
    {label:'Total',val:lista.length,fr:235,fg:248,fb:255,br:190,bg:227,bb:248,vr:44,vg:82,vb:130},
    {label:'Com Padrão',val:lista.filter(function(p){return p.padrao&&p.padrao.length;}).length,fr:240,fg:255,fb:244,br:154,bg:230,bb:180,vr:39,vg:103,vb:73},
    {label:'C/ Proibida',val:lista.filter(function(p){return p.proibidas&&p.proibidas.length;}).length,fr:255,fg:245,fb:245,br:254,bg:178,bb:178,vr:155,vg:44,vb:44},
    {label:'C/ Restrita',val:lista.filter(function(p){return p.restritas&&p.restritas.length;}).length,fr:255,fg:247,fb:237,br:253,bg:186,bb:116,vr:123,vg:52,vb:30},
    {label:'Com PDF',val:lista.filter(function(p){return p.pdfDataUrl;}).length,fr:250,fg:245,fb:255,br:214,bg:188,bb:253,vr:85,vg:60,vb:154},
  ];
  var bw=(cW-8)/boxes.length;
  boxes.forEach(function(b,i){var bx=mL+i*(bw+2);doc.setFillColor(b.fr,b.fg,b.fb);doc.setDrawColor(b.br,b.bg,b.bb);doc.roundedRect(bx,y,bw,14,1.5,1.5,'FD');doc.setFontSize(15);doc.setFont('helvetica','bold');doc.setTextColor(b.vr,b.vg,b.vb);doc.text(String(b.val),bx+bw/2,y+7,{align:'center'});doc.setFontSize(6);doc.setFont('helvetica','normal');doc.setTextColor(74,85,104);doc.text(b.label,bx+bw/2,y+12,{align:'center'});});
  y=42;doc.setFontSize(7);doc.setFont('helvetica','bold');doc.setTextColor(74,85,104);doc.text('Legenda:',mL,y);
  var lg=[{t:'P = Padrão',r:44,g:82,b:130},{t:'A = Permitida',r:39,g:103,b:73},{t:'R = Restrita',r:123,g:52,b:30},{t:'X = Proibida',r:155,g:44,b:44}];
  var lx=mL+20;lg.forEach(function(l){doc.setFillColor(l.r,l.g,l.b);doc.circle(lx-2,y-1.5,1.6,'F');doc.setTextColor(l.r,l.g,l.b);doc.setFont('helvetica','bold');doc.text(l.t,lx+0.5,y);lx+=48;});
  var sorted=lista.slice().sort(function(a,b){var ca=(a.cat||'').toUpperCase(),cb=(b.cat||'').toUpperCase();if(ca!==cb)return ca<cb?-1:1;return parseInt(a.cod||0)-parseInt(b.cod||0);});
  function fmt(a){return(a&&a.length)?a.join(', '):'—';}
  function fv(d){if(!d)return '—';try{var dt=new Date(d),now=new Date();var m=(now.getFullYear()-dt.getFullYear())*12+(now.getMonth()-dt.getMonth());return d.split('-').reverse().join('/')+' ('+m+'m)';}catch(e){return d;}}
  var rows=sorted.map(function(p,i){return[String(i+1),p.cod,p.nome||'—',p.cat||'—',fmt(p.padrao),fmt(p.permitidas),fmt(p.restritas),fmt(p.proibidas),(p.observacao||'').substring(0,55)||'—',p.responsavel||'—',fv(p.data)];});
  doc.autoTable({startY:y+5,head:[['#','Cód.','Produto','Categoria','P Padrão','A Permitidas','R Restritas','X Proibidas','Observações','Responsável','Validade']],body:rows,theme:'grid',styles:{fontSize:6.8,cellPadding:{top:2.2,right:2.5,bottom:2.2,left:2.5},overflow:'linebreak',lineColor:[226,232,240],lineWidth:0.25,textColor:[26,32,44],font:'helvetica',minCellHeight:7},headStyles:{fillColor:[44,82,130],textColor:[255,255,255],fontStyle:'bold',fontSize:7,halign:'center',cellPadding:{top:3,right:2,bottom:3,left:2}},columnStyles:{0:{cellWidth:8,halign:'center',fontStyle:'bold',textColor:[100,116,139]},1:{cellWidth:14,halign:'center',fontStyle:'bold',textColor:[44,82,130]},2:{cellWidth:52},3:{cellWidth:26},4:{cellWidth:24,textColor:[44,82,130],fontStyle:'bold'},5:{cellWidth:24,textColor:[39,103,73]},6:{cellWidth:20,textColor:[123,52,30]},7:{cellWidth:24,textColor:[155,44,44],fontStyle:'bold'},8:{cellWidth:33},9:{cellWidth:24},10:{cellWidth:18,halign:'center',fontSize:6.2}},alternateRowStyles:{fillColor:[247,250,252]},didParseCell:function(d){if(d.section==='body'&&rows[d.row.index]&&rows[d.row.index][7]!=='—')d.cell.styles.fillColor=[255,245,245];},didDrawPage:function(){var pg=doc.internal.getCurrentPageInfo().pageNumber;doc.setFontSize(6.5);doc.setTextColor(160,174,192);doc.setFont('helvetica','normal');doc.setDrawColor(226,232,240);doc.line(mL,pageH-8,pageW-mR,pageH-8);doc.text('Parecer Técnico HUV · Hospital Universitário de Vassouras',mL,pageH-4);doc.text('Gerado em '+hoje+' · SOULMV',pageW/2,pageH-4,{align:'center'});doc.text('Pág. '+pg+' de {totalPages}',pageW-mR,pageH-4,{align:'right'});},margin:{top:0,left:mL,right:mR,bottom:12},showHead:'everyPage',tableWidth:'wrap'});
  if(typeof doc.putTotalPages==='function')doc.putTotalPages('{totalPages}');
  doc.save('pareceres-tecnicos-huv-'+hojeISO+(listaOverride?'-filtrado':'')+'.pdf');
  toast('PDF gerado!');
}

