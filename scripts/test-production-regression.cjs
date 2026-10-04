const {chromium,expect} = require('@playwright/test');
const mysql = require('mysql2/promise');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawn} = require('node:child_process');
const crypto = require('node:crypto');
require('dotenv').config({quiet:true});

(async()=>{
    fs.mkdirSync('artifacts',{recursive:true});
    const dbName='clinica_ui_test_'+Date.now();
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),'clinica-ui-'));
    const db=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD,multipleStatements:true});
    let child,browser;
    const errors=[],checks=[];
    const record=checks.push.bind(checks);
    checks.push=(message)=>{console.log('OK:',message);return record(message);};
    try {
        await db.query('CREATE DATABASE ??',[dbName]); await db.changeUser({database:dbName});
        await db.query(fs.readFileSync('database/clinica.sql','utf8'));
        await db.query(fs.readFileSync('database/datos-iniciales.sql','utf8'));
        const password=crypto.randomBytes(18).toString('hex');
        for(const [id,name,rut,role,critical] of [[1,'Soporte QA','11111111-1',1,0],[2,'Funcionario QA','22222222-2',2,0],[3,'Critico QA','33333333-3',2,1]]) {
            await db.query("INSERT INTO user (user_id,first_name,first_last_name,second_last_name,institutional_email,rut,username,password_hash,is_critical_tech) VALUES (?,?,'','',?,?,?,?,?)",[id,name,`${id}@temp.com`,rut,rut,password,critical]);
            await db.query('INSERT INTO user_role (assignment_date,active,role_id,user_id) VALUES (NOW(),1,?,?)',[role,id]);
        }
        const [fixtureEquipment]=await db.query("INSERT INTO equipment(equipment_name,equipment_type) VALUES ('Equipo cierre QA','Otro')");
        await db.query("INSERT INTO ticket(ticket_code,title,description,requester_user_id,category_id,status_id,priority_id,equipment_id,assigned_user_id,resolution_date) VALUES ('INC0000001','Cierre automático QA','Validación de cierre automático',1,1,4,1,?,1,DATE_SUB(NOW(),INTERVAL 8 DAY))",[fixtureEquipment.insertId]);
        for(const file of ['index.html','css','js','vendor']) fs.cpSync(path.join('public',file),path.join(temp,file),{recursive:true});
        fs.mkdirSync(path.join(temp,'uploads'));fs.mkdirSync(path.join(temp,'manuales'));
        child=spawn(process.execPath,['scripts/test-server.cjs'],{env:{...process.env,NODE_ENV:'test',CLINICA_DATA_DIR:'',CLINIC_TEST_PORT:'3200',DB_NAME:dbName,CLINIC_TEST_PUBLIC:temp,IMER_WEBHOOK_TOKEN:'acceptance-isolated'},stdio:['ignore','pipe','pipe'],windowsHide:true});
        let serverLog='';child.stdout.on('data',d=>serverLog+=d);child.stderr.on('data',d=>serverLog+=d);
        let ready=false;
        for(let i=0;i<120;i++){if(child.exitCode!==null)break;try{if((await fetch('http://127.0.0.1:3200')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
        if(!ready)throw Error('Servidor QA no disponible: '+serverLog);
        browser=await chromium.launch();
        const context=await browser.newContext({viewport:{width:1440,height:1000}});
        const page=await context.newPage();
        page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.stack);});
        page.on('response',r=>{if(r.status()>=500)errors.push(`${r.status()} ${new URL(r.url()).pathname}`);});
        page.on('console',m=>{if(m.type()==='error' && !m.text().includes('net::ERR_FAILED'))errors.push(m.text());});
        const login=async(rut)=>{
            await page.goto('http://127.0.0.1:3200');
            await page.locator('.welcome-panel').getByRole('button',{name:'Iniciar sesión'}).click();
            await page.locator('[x-model="login.rut"]').fill(rut);
            await page.locator('[x-model="login.pass"]').fill(password);
            await page.locator('[x-show="authTab===\'login\'"]').getByRole('button',{name:/Ingresar|Iniciar/i}).click();
            await expect(page.locator('.page-heading h1')).toBeVisible();
        };
        await require('./production-regression-checks.cjs')({db,page,login,password,temp});
        await page.close();
        const restartServer=async()=>{
            child.kill();await new Promise(r=>child.once('exit',r));
            child=spawn(process.execPath,['scripts/test-server.cjs'],{env:{...process.env,NODE_ENV:'test',CLINICA_DATA_DIR:'',CLINIC_TEST_PORT:'3200',DB_NAME:dbName,CLINIC_TEST_PUBLIC:temp,IMER_WEBHOOK_TOKEN:'acceptance-isolated'},stdio:['ignore','pipe','pipe'],windowsHide:true});
            let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
            for(let i=0;i<120;i++){if(child.exitCode!==null)break;try{if((await fetch('http://127.0.0.1:3200')).ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}
            throw Error('No se pudo reiniciar el servidor aislado: '+log);
        };
        await require('./production-operational-checks.cjs')({db,password,restartServer});
    } finally {
        if(browser)await browser.close();
        if(child && child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}
        await db.changeUser({database:'mysql'});
        await db.query('DROP DATABASE ??',[dbName]);await db.end();
        if(path.dirname(temp)===os.tmpdir() && path.basename(temp).startsWith('clinica-ui-')) fs.rmSync(temp,{recursive:true,force:true});
    }
})().catch(e=>{console.error(e);process.exitCode=1});
