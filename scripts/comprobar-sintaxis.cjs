const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');let count=0;
function check(file){const r=spawnSync(process.execPath,['--check',file],{stdio:'inherit',windowsHide:true});if(r.status!==0)process.exit(r.status||1);count++;}
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.(js|cjs)$/.test(file))check(file);}}
check(path.join(root,'server.js'));for(const folder of ['src','public/js','scripts'])walk(path.join(root,folder));console.log('Sintaxis correcta: '+count+' archivos.');
