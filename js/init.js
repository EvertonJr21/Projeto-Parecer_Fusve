// Inicialização — carrega Firebase e renderiza

// ══════ INIT ══════
(async function(){
  updNC();
  renderDash();
  await fbLoad();
  updNC();
  renderDash();
  if(document.getElementById('pg-base').classList.contains('on')) renderBase();
})();
