module.exports=function(){
 if(process.env.NODE_ENV!=='production')return;
 const required=['DB_HOST','DB_USER','DB_PASSWORD','DB_NAME','PUBLIC_ORIGIN','MAIL_USER','MAIL_PASSWORD','CLINICA_BACKUP_DIR'];
 const missing=required.filter(k=>!process.env[k]);if(missing.length)throw Error('Falta configuración de producción: '+missing.join(', '));
 if(process.env.DB_USER==='root')throw Error('Producción requiere una cuenta MySQL dedicada, no root.');
 const origin=new URL(process.env.PUBLIC_ORIGIN);if(origin.protocol!=='https:')throw Error('PUBLIC_ORIGIN debe usar HTTPS.');
 if(/^clinica_ui_test_/.test(process.env.DB_NAME)||process.env.CLINIC_TEST_PUBLIC)throw Error('No se permite usar el entorno de demostración como producción.');
};
