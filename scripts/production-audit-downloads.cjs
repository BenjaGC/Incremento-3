const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({page,db,login})=>{
 await page.evaluate(()=>localStorage.clear()); await login('11111111-1');
 const out=path.resolve('artifacts/auditoria-descargas');fs.mkdirSync(out,{recursive:true});
 const [[ticket]]=await db.query('SELECT ticket_code FROM ticket WHERE status_id IN (1,2,5) AND is_archived=0 ORDER BY ticket_id DESC LIMIT 1');
 await db.query('UPDATE ticket SET status_id=1,assigned_user_id=1 WHERE ticket_code=?',[ticket.ticket_code]);
 await page.evaluate(()=>Alpine.$data(document.documentElement).cargarActivosBackground());
 await page.waitForFunction(code=>Alpine.$data(document.documentElement).incidentesActivos.some(t=>t.id_ticket===code),ticket.ticket_code);
 await page.evaluate(async code=>{await Alpine.$data(document.documentElement).abrirDetalle(code);},ticket.ticket_code);
 const download=async(method,arg,file)=>{
  const pending=page.waitForEvent('download',{timeout:20000});
  await page.evaluate(async({method,arg})=>await Alpine.$data(document.documentElement)[method](arg),{method,arg});
  const d=await pending;assert.equal(await d.failure(),null);await d.saveAs(path.join(out,file));
  assert.ok(fs.statSync(path.join(out,file)).size>50);console.log('DESCARGA OK',file);
 };
 await download('exportarPDF',null,'ticket.pdf');
 const probe=await page.evaluate(async()=>{const s=Alpine.$data(document.documentElement);const r=await fetch('/incidente/'+s.detTicket.id_ticket+'/etiqueta-pdf?usuario='+encodeURIComponent(s.usuario.nombre));return {status:r.status,body:r.ok?'PDF':await r.text()};});
 assert.equal(probe.status,200,JSON.stringify(probe));
 await download('descargarEtiquetaPDF',null,'etiqueta.pdf');
 await db.query('UPDATE ticket SET status_id=4,resolution_date=NOW() WHERE ticket_code=?',[ticket.ticket_code]);
 for(const [format,ext] of [['pdf','pdf'],['excel','xlsx'],['csv','csv']])await download('exportarReporte',format,'reporte.'+ext);
 assert.ok(fs.readFileSync(path.join(out,'reporte.csv'),'utf8').includes(ticket.ticket_code));
 const XLSX=require('xlsx'),wb=XLSX.readFile(path.join(out,'reporte.xlsx'));
 assert.ok(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]).some(row=>row.Ticket===ticket.ticket_code));
 const [[material]]=await db.query('SELECT material_id,stock_actual FROM insumo_catalogo LIMIT 1');
 for(const cantidad of [-1,0,0.5,'abc']){
  const r=await page.request.post('http://127.0.0.1:3200/insumos/entrada',{data:{usuario:'Soporte QA',material_id:material.material_id,cantidad}});assert.equal(r.status(),400);
 }
 const r=await page.request.post('http://127.0.0.1:3200/insumos/entrada',{data:{usuario:'Soporte QA',material_id:material.material_id,cantidad:2}});assert.equal(r.status(),200);
 const [[after]]=await db.query('SELECT stock_actual FROM insumo_catalogo WHERE material_id=?',[material.material_id]);assert.equal(after.stock_actual,material.stock_actual+2);
 await page.evaluate(()=>{
  const s=Alpine.$data(document.documentElement);
  s.detTicket.descripcion='Texto de prueba de paginacion. '.repeat(2200)+' FIN_DESCRIPCION_QA';
  s.detComentarios=[{usuario:'Tecnico QA',fecha:'2026-09-16',texto:'Comentario extenso de seguimiento. '.repeat(2200)+' FIN_COMENTARIO_QA'}];
 });
 await download('exportarPDF',null,'ticket-largo.pdf');
 require('node:child_process').execFileSync('python',['-c',
  'import pymupdf,sys,pathlib\np=pathlib.Path(sys.argv[1])\nfor f in p.glob("*.pdf"):\n d=pymupdf.open(f); assert len(d)>0; text="".join(x.get_text() for x in d)\n if f.name=="etiqueta.pdf": assert len(d)==1 and "Soporte" in text\n if f.name=="ticket-largo.pdf":\n  assert "FIN_DESCRIPCION_QA" in text and "FIN_COMENTARIO_QA" in text\n  assert all(b[3]<800 for page in d for b in page.get_text("blocks") if "Panel de Operaciones" not in b[4] and "Pág." not in b[4])\n d[0].get_pixmap().save(str(f.with_suffix(".png")))\n print(f.name,len(d),"paginas verificadas")',out],{stdio:'inherit',windowsHide:true});
 await page.evaluate(async()=>{
  const s=Alpine.$data(document.documentElement), original=window.open;
  window.open=()=>null;try{await s.imprimirEtiquetaQR();if(!s.detMsg.includes('ventanas'))throw Error('Sin aviso popup bloqueado');}finally{window.open=original;}
 });
 console.log('OK: PDF extensos, reportes, etiqueta y popup bloqueado');
};

