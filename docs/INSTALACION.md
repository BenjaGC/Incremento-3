# Instalación nueva

## 1. Requisitos

Instalar Node.js 24 (la versión mínima admitida es 22.12.0), npm y MySQL 8.4. Usar una base exclusiva para esta aplicación. En Windows se recomienda instalar MySQL como servicio; `npm start` no instala ni arranca MySQL.

Descargar/clonar el repositorio y abrir una terminal en la carpeta que contiene `package.json`. Ejecutar `npm ci` y copiar `.env.example` a `.env`. No compartir el archivo completado.

## 2. Base de datos

En MySQL Workbench, conectado con una cuenta autorizada para crear bases:

Para una instalación local nueva, ejecutar una vez este SQL. Sustituir `CAMBIA_ESTA_CLAVE` por una clave propia y conservarla de forma privada:

```sql
CREATE DATABASE clinica CHARACTER SET utf8mb4;
CREATE USER 'clinica_app'@'localhost' IDENTIFIED BY 'CAMBIA_ESTA_CLAVE';
GRANT ALL PRIVILEGES ON clinica.* TO 'clinica_app'@'localhost';
```

Si la base o la cuenta ya existen, revisar su uso: no borrar una instalación para volver a ejecutar estas instrucciones. Para un servidor remoto, TI debe adaptar el host autorizado del usuario.

En `.env`, reemplazar las líneas correspondientes (sin duplicarlas):

```dotenv
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=clinica_app
DB_PASSWORD=CAMBIA_ESTA_CLAVE
DB_NAME=clinica
```

`DB_PASSWORD` debe ser la contraseña elegida en el SQL. Guardar el archivo antes de continuar. No volver a copiar la plantilla después de editar.

Ejecutar `npm run db:init`.

El instalador se detiene si encuentra tablas. No elimina datos existentes. Si falla una instalación parcial, revisar el error y la configuración antes de continuar: no se reintenta borrando tablas automáticamente.

## 3. Primer arranque

Antes de arrancar, preparar las ampliaciones con una cuenta MySQL autorizada para crear disparadores. En un PC local puede ser `root`. Esta contraseña YA EXISTE desde la instalación de MySQL: no es la elegida para `clinica_app` ni una contraseña nueva para la página.

En la misma terminal PowerShell, ejecutar una línea por vez:

```powershell
$env:CLINICA_MIGRATION_USER = "root"
$claveMigracion = Read-Host 'Contraseña EXISTENTE de root en MySQL' -AsSecureString
$env:CLINICA_MIGRATION_PASSWORD = [System.Net.NetworkCredential]::new('', $claveMigracion).Password
npm run db:migrate
```

Después de `Read-Host`, escribir la contraseña cuando aparezca el aviso y pulsar Enter. El texto entre comillas es la pregunta, no la contraseña. Si aparece `Access denied`, corregir esa credencial y repetir la migración; no repetir `db:init` ni borrar la base. Si no se conoce la clave de root, pedirla al responsable de la instalación de MySQL.

Solo cuando confirme «Ampliaciones y disparadores preparados», retirar las variables temporales:

```powershell
Remove-Item Env:CLINICA_MIGRATION_USER
Remove-Item Env:CLINICA_MIGRATION_PASSWORD
Remove-Variable claveMigracion
npm start
```

Cuando indique que está escuchando, comprobar http://localhost:3000/health/ready: debe responder `ready`. No iniciar varias instancias a la vez durante una actualización.

La interfaz se abre en http://localhost:3000. PORT permite usar otro puerto. Ctrl+C detiene el proceso Node iniciado en esa terminal; no detiene otros procesos iniciados anteriormente ni el servicio MySQL.

## 4. Primer administrador

Después del primer arranque, abrir una segunda terminal en la misma carpeta. En PowerShell:

```powershell
$claveAdmin = Read-Host 'Contraseña temporal de al menos 12 caracteres' -AsSecureString
$claveAdmin.Length
```

Aquí sí se elige una contraseña NUEVA para el administrador de la página. Si la longitud indicada es menor de 12, repetir el paso anterior. Con 12 o más caracteres, continuar:

```powershell
$env:CLINICA_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $claveAdmin).Password
npm run admin:create -- RUT-REAL "Nombre del administrador" correo-institucional
Remove-Item Env:CLINICA_ADMIN_PASSWORD
Remove-Variable claveAdmin
```

Sustituir RUT-REAL por un RUT válido con guion y correo-institucional por un correo válido. No dejar la contraseña escrita en un archivo ni subirla a GitHub. El script rechaza cuentas existentes: no cambia permisos de otra persona. La cuenta nueva debe cambiar su contraseña al iniciar sesión.

Para pruebas locales puede usarse `npm run admin:create -- "11111111-1" "Administrador de pruebas" "admin@example.test"`. Ese correo es ilustrativo y no recibe mensajes. Cada compañero elige su propia contraseña. Para probar correos, usar una cuenta real propia y configurar SMTP.

## 5. Correo e integraciones

Configurar MAIL_USER, MAIL_PASSWORD y MAIL_FROM con el servicio aprobado por TI. Para SMTP propio, completar SMTP_HOST y el puerto: normalmente 587 con SMTP_SECURE=false (STARTTLS) o 465 con SMTP_SECURE=true. Confirmar esos valores con el proveedor.

Configurar IMAP, LDAP, WhatsApp o IMER únicamente si se utilizarán. Las credenciales vacías no crean una integración real. Probar recepción y envío desde una cuenta autorizada antes de usar notificaciones en operación.

## 6. Pruebas

Usar una copia de desarrollo con cuenta MySQL capaz de crear y eliminar bases temporales, nunca la cuenta limitada del servicio clínico. Puerto 3200 libre. Ejecutar secuencialmente:

```powershell
npm ci
npx playwright install chromium
npm run check
npm run test:security
npm run test:regression
npm run test:ui
```

Las pruebas usan bases cuyo nombre empieza por `clinica_ui_test_`, carpetas temporales y transporte de correo simulado. No constituyen evidencia de recepción de correo institucional ni de funcionamiento en la red de la clínica.

## 7. Respaldo

Configurar CLINICA_BACKUP_DIR como una ruta privada fuera de `public/` y de CLINICA_DATA_DIR. Si mysqldump no está en la ubicación habitual, definir MYSQLDUMP_PATH. Ejecutar `npm run backup`. El ZIP contiene SQL, adjuntos, manuales y un manifiesto. Guardarlo fuera del repositorio y restringir su acceso: contiene información privada.

Detener escrituras durante el respaldo para mantener consistencia entre SQL y archivos. Programar la tarea y la retención con TI. Para restaurar, usar una base nueva, importar database.sql y recuperar uploads/manuales en el directorio de datos. Comprobar cuentas, tickets y descargas antes de cambiar la aplicación a esa base. Conservar la instalación anterior hasta verificar la restauración.

## 8. Uso en la clínica

No exponer el puerto de desarrollo directamente a Internet. Hace falta un servidor administrado, HTTPS mediante proxy, acceso de red controlado y arranque automático. En NODE_ENV=production se exigen configuración de correo, PUBLIC_ORIGIN HTTPS, directorio de respaldos y una cuenta MySQL diferente de root. Definir CLINICA_DATA_DIR fuera del código para conservar archivos entre actualizaciones.

TRUST_PROXY_HOPS solo debe configurarse cuando el backend acepte conexiones únicamente del proxy confiable. Un PUBLIC_ORIGIN con https no instala certificados por sí solo.

El servidor actual realiza ampliaciones al arrancar. Antes de actualizar: detener escrituras, respaldar base y archivos, comprobar la actualización en una copia y arrancar una sola instancia. Esta entrega no incluye un despliegue configurado para la clínica ni prueba de carga multiinstancia.

Para comprobar también la instalación inicial y el respaldo con archivos: `npm run test:install`. Requiere Python y mysqldump. Para el recorrido de PDF, instalar PyMuPDF con `python -m pip install pymupdf`.


## MySQL con registro binario: preparar disparadores

Si la primera migración indica que se requiere SUPER por el registro binario, no conceder permisos globales a la cuenta de la aplicación ni cambiar opciones globales del servidor. Después de db:init, ejecutar `node scripts/migrar-base.cjs` con una cuenta de instalación autorizada por TI, utilizando temporalmente CLINICA_MIGRATION_USER y CLINICA_MIGRATION_PASSWORD en el entorno. El script usa DB_NAME para elegir el esquema y no cambia las credenciales normales. Retirar ambas variables al terminar. Después ejecutar npm start con la cuenta dedicada de .env.

En PowerShell se puede solicitar la clave sin mostrarla con Read-Host -AsSecureString, convertirla temporalmente mediante System.Net.NetworkCredential y retirarla con Remove-Item Env:CLINICA_MIGRATION_PASSWORD. No guardar ni publicar esa clave. El administrador MySQL que creó los disparadores debe conservarse según la política de TI, ya que MySQL guarda su identidad como definidor.
