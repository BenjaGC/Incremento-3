// Entrega reproducible: solo código y documentación seleccionados, nunca datos locales.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'artifacts','entrega-github-'+Date.now());
fs.mkdirSync(out,{recursive:true});
const copy=p=>{const dest=path.join(out,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.cpSync(path.join(root,p),dest,{recursive:true});};
for(const p of ['src','public/css','public/js','public/vendor','public/index.html','public/increment3-panel.html','database/clinica.sql','database/datos-iniciales.sql','server.js','package-lock.json','.env.example','.gitignore','docs/VERIFICACION-ENTREGA.md','docs/INSTALACION.md','docs/PASO-A-USO-REAL.md','docs/INSTRUCCIONES-GITHUB-PARA-EL-EQUIPO.md','docs/README-GITHUB.md'])copy(p);
const entries=['comprobar-sintaxis','test-installation','migrar-base','inicializar-base','crear-administrador','respaldar-instalacion','production-test-ui','test-production-security','test-production-regression','test-server','test-integration-server','preparar-github'];
copy('docs/PRUEBAS-DEL-EQUIPO.md');
copy('docs/DESPLIEGUE-CLINICA.md');
copy('docs/PRUEBAS-ACEPTACION.md');
copy('docs/LEEME-EQUIPO.txt');
fs.copyFileSync(path.join(root,'docs/LEEME-EQUIPO.txt'),path.join(out,'LEEME-PRIMERO.txt'));
const seen=new Set();
function script(name){const rel='scripts/'+name;if(seen.has(rel))return;seen.add(rel);copy(rel);const body=fs.readFileSync(path.join(root,rel),'utf8');for(const m of body.matchAll(/require\(['"]\.\/([^'"]+)['"]\)/g)){const dependency=m[1].endsWith('.cjs')?m[1]:m[1]+'.cjs';script(dependency);}}
entries.forEach(n=>script(n+'.cjs'));
for(const dir of ['uploads','manuales']){fs.mkdirSync(path.join(out,'public',dir),{recursive:true});fs.writeFileSync(path.join(out,'public',dir,'.gitkeep'),'');}
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json')));
pkg.scripts={start:'node server.js',dev:'node --watch server.js',check:'node scripts/comprobar-sintaxis.cjs','db:migrate':'node scripts/migrar-base.cjs','db:init':'node scripts/inicializar-base.cjs','admin:create':'node scripts/crear-administrador.cjs',backup:'node scripts/respaldar-instalacion.cjs','test:install':'node scripts/test-installation.cjs','test:security':'node scripts/test-production-security.cjs','test:regression':'node scripts/test-production-regression.cjs','test:ui':'node scripts/production-test-ui.cjs','prepare:github':'node scripts/preparar-github.cjs'};
fs.writeFileSync(path.join(out,'package.json'),JSON.stringify(pkg,null,2)+'\n');
const readme=fs.readFileSync(path.join(root,'docs/README-GITHUB.md'),'utf8').replace(/\]\(([^/:)]+\.md)\)/g,'](docs/$1)');
fs.writeFileSync(path.join(out,'README.md'),readme);
fs.writeFileSync(path.join(root,'artifacts/ultima-entrega-github.txt'),out);
console.log(out);
