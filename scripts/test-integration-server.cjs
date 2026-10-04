// Servidor de pruebas aislado: mismo código, otra base, otros archivos y sin correos.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const express = require('express');
if (!/^clinica_ui_test_\d+$/.test(process.env.DB_NAME || '') || !process.env.CLINIC_TEST_PUBLIC) throw Error('Se requiere un entorno de pruebas aislado.');
const listen = express.application.listen;
express.application.listen = function(_port, callback) { return listen.call(this, Number(process.env.CLINIC_TEST_PORT||3100), '127.0.0.1', callback); };
const mailPath = require.resolve('../src/config/mail');
require.cache[mailPath] = { id:mailPath, filename:mailPath, loaded:true, exports:{sendMail:(mail,callback)=>{
 if(process.env.CLINIC_CAPTURE_MAIL) fs.appendFileSync(process.env.CLINIC_CAPTURE_MAIL,JSON.stringify(mail)+'\n');
 const result={accepted:[mail.to]};if(callback)callback(null,result);return Promise.resolve(result);
}} };
const filename = path.resolve(__dirname,'../src/server.js');
const source = fs.readFileSync(filename,'utf8').replaceAll("path.join(__dirname, '..', 'public'", "path.join(process.env.CLINIC_TEST_PUBLIC");
const mod = new Module(filename, module);
mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
const integrationTest=process.env.CLINIC_INTEGRATION_TEST==='1'?`
app.post('/__integration/run',async(req,res)=>{if(req.headers['x-test-key']!==process.env.IMER_WEBHOOK_TOKEN)return res.sendStatus(403);try{const {action,data}=req.body;const result=action==='ingest'?await inc3.ingest(data):action==='directory'?await inc3.syncDirectory(data.entries,data.activeIds):action==='close'?await cerrarTicketsInactivos():null;res.json(result||{done:true});}catch(e){res.status(500).json({error:e.message});}});
`:'';
mod._compile(source+integrationTest,filename);
