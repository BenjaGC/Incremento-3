# Puesta en servicio de la Ticketera Clínica Aconcagua

Este documento corresponde al servidor que utilizará la clínica. El repositorio de GitHub entrega el código y las guías; el servidor, las cuentas institucionales y la configuración de red deben completarse en el equipo de destino. El despliegue de la clínica todavía no está configurado ni verificado.

## 1. Datos que TI debe confirmar antes de instalar

Registrar el nombre de la persona que administrará el servidor, el responsable funcional de la ticketera, el computador o servidor de destino, la dirección HTTPS que utilizarán los funcionarios y si tendrán acceso desde fuera de la clínica. Registrar también el proveedor de correo, las carpetas persistentes y el destino privado de respaldos.

Guardar las contraseñas en el sistema privado que utilice TI. El registro de entrega solo debe indicar quién las custodia y para qué cuenta sirven.

| Cuenta | Contraseña y uso |
| --- | --- |
| Administrador de MySQL, por ejemplo `root` | Es una contraseña que ya existe en ese servidor MySQL. `Read-Host` únicamente la solicita; no la crea ni la cambia. Se utiliza temporalmente para la instalación y las migraciones. |
| Cuenta MySQL dedicada, por ejemplo `clinica_app` | TI elige una contraseña al crear la cuenta. Ese mismo valor se configura en `DB_PASSWORD`. |
| Administrador de la ticketera | Se crea después de preparar la base, con una contraseña temporal nueva de al menos 12 caracteres. La persona debe cambiarla en su primer ingreso. |
| Cuenta institucional de correo | Su proveedor entrega los datos de SMTP; se utiliza para las notificaciones y la recuperación de contraseña. |

Si se desconoce la contraseña del administrador de MySQL, obtenerla del responsable del servidor antes de grabar o ejecutar la migración. No sustituirla por la contraseña de la página. No modificar la cuenta existente para intentar adivinar una contraseña.

## 2. Instalar el código y preparar una base nueva

Instalar Node.js 24 y MySQL Server 8.4. El mínimo declarado por el proyecto es Node.js 22.12.0; la versión utilizada en la verificación local es Node.js 24. Workbench es un cliente y no sustituye al servidor MySQL.

Descargar una versión revisada del repositorio en una carpeta de aplicación administrada por TI. Abrir una terminal dentro de la carpeta que contiene `package.json` y seguir [INSTALACION.md](INSTALACION.md) en este orden:

1. Ejecutar `npm ci` y copiar una sola vez `.env.example` a `.env`.
2. Crear una base vacía y una cuenta MySQL exclusiva para esa base.
3. Completar `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME`; guardar el archivo.
4. Ejecutar `npm run db:init`. Solo corresponde a una base nueva sin tablas.
5. Definir temporalmente `CLINICA_MIGRATION_USER` y `CLINICA_MIGRATION_PASSWORD` con la cuenta autorizada y ejecutar `npm run db:migrate`.
6. Comprobar el mensaje de migración correcta y retirar ambas variables temporales.

Si la base ya contiene datos, conservarla: no utilizar `db:init` ni importar encima el SQL inicial. Aplicar el procedimiento de actualización del apartado 7.

## 3. Configurar el servicio de producción

Completar la configuración privada de `.env` en el servidor de destino. Los siguientes valores son referencias de formato; el dominio y las credenciales deben pertenecer a la clínica:

```dotenv
NODE_ENV=production
PORT=3000
PUBLIC_ORIGIN=https://ticketera.DOMINIO-DE-LA-CLINICA
CLINICA_DATA_DIR=C:/ClinicaAconcagua/datos
CLINICA_BACKUP_DIR=C:/ClinicaAconcagua/respaldos
MYSQLDUMP_PATH=C:/Program Files/MySQL/MySQL Server 8.4/bin/mysqldump.exe
```

En Linux utilizar rutas absolutas del servidor para datos y respaldos. Crear las carpetas con acceso para la cuenta que ejecutará la aplicación y acceso restringido para otras cuentas. Mantenerlas fuera del repositorio y de `public/`; los respaldos deben quedar separados de la carpeta de datos. Configurar además una copia de los respaldos en otro volumen o servidor según la política de TI.

Configurar `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `MAIL_USER`, `MAIL_PASSWORD` y `MAIL_FROM` según el proveedor institucional. Las demás integraciones solo se habilitan cuando TI dispone de su servicio y sus credenciales. El arranque de producción exige una cuenta MySQL dedicada y configuración de correo, origen HTTPS y destino de respaldos.

Configurar un proxy con certificado HTTPS válido delante del puerto de Node.js. Restringir el acceso directo a ese puerto para que solo lo alcance el proxy. Si el proxy está en el mismo servidor, debe conectarse al backend mediante `127.0.0.1:3000`. `PUBLIC_ORIGIN` no instala el certificado ni el proxy.

Solo después de limitar el acceso al backend, configurar `TRUST_PROXY_HOPS` con el número real de proxies confiables. Con un único proxy delante de Node.js corresponde `TRUST_PROXY_HOPS=1`; si la instalación tiene otra topología, TI debe definir el valor. Comprobar que la aplicación reconoce la conexión HTTPS y que el navegador recibe la cookie de sesión con el atributo `Secure`.

Registrar un servicio o una tarea de arranque utilizando el mecanismo de administración del servidor. La orden de ejecución es `node server.js`, con la carpeta del proyecto como directorio de trabajo y una cuenta de servicio que tenga acceso a `.env`, datos y registros. Configurar MySQL para arrancar antes del servicio de la ticketera y dirigir los registros a una carpeta privada. Mantener una sola instancia de Node.js: esta versión conserva códigos de recuperación y límites de intentos en la memoria del proceso.

## 4. Crear el administrador y habilitar usuarios

Arrancar el servicio y comprobar `/health/ready`: debe responder `{"status":"ready"}`. Crear al administrador siguiendo el apartado correspondiente de [INSTALACION.md](INSTALACION.md), con su RUT, nombre y correo institucional reales. La contraseña temporal no se guarda en archivos ni se pasa como argumento visible del comando.

Ingresar desde la dirección HTTPS, cambiar la contraseña temporal y revisar áreas, equipos, categorías, prioridades, horario operativo y responsables. Definir con el responsable funcional si las altas serán mediante registro, importación o administración. Esta versión mantiene disponible el registro de usuarios; TI debe aprobar esa política antes de publicar el acceso.

## 5. Comprobar el servidor de destino

Utilizar usuarios autorizados y un incidente de prueba sin datos de pacientes. Registrar el resultado, la fecha y la persona que verifica cada punto:

| Comprobación | Resultado que debe observarse |
| --- | --- |
| Inicio y reinicio | El servicio inicia automáticamente y `/health/ready` responde correctamente. Los datos guardados persisten después del reinicio. |
| HTTPS y red | Los computadores autorizados acceden al dominio y el puerto del backend no queda accesible directamente. |
| Roles | El funcionario solo ve sus tickets autorizados. El equipo de soporte y el administrador tienen sus acciones correspondientes. |
| Operación | Crear, consultar, comentar, adjuntar, asignar, cambiar estado, buscar y consultar historial. |
| Documentos | Cargar un manual de prueba, abrirlo y descargarlo; exportar y abrir PDF, Excel y CSV. |
| Correo real | Crear un incidente y resolverlo; comprobar la llegada a los buzones que correspondan. Probar recuperación de contraseña. |
| Integraciones utilizadas | Recibir un evento real autorizado y comprobar el resultado. Marcar como no utilizada cualquier integración no contratada. |
| Respaldo y restauración | Restaurar una copia en otra base y carpeta de datos; comprobar usuarios, tickets, adjuntos y manuales. |

Las suites automatizadas del repositorio no comprueban por sí solas la red, los certificados ni los buzones de la clínica. Sus resultados no sustituyen esta aceptación en el servidor de destino.

## 6. Programar los respaldos

Con el directorio de trabajo situado en el proyecto, el comando es `npm run backup`. Se obtiene un ZIP con `database.sql`, `uploads/`, `manuales/` y un manifiesto. El botón de respaldo SQL de la interfaz no incluye los archivos adjuntos ni los manuales.

Coordinar una ventana sin escrituras para que el SQL y los archivos correspondan al mismo estado. Ejecutar el respaldo, abrir el ZIP y revisar que incluya los tres componentes. Programar la frecuencia y la retención con TI, comprobar el resultado de cada ejecución y ensayar la restauración en una instalación independiente. Conservar la cuenta MySQL definidora de los disparadores o adaptar su identidad durante una restauración administrada por TI.

## 7. Actualizar y regresar a una versión anterior

Guardar la versión del código en uso y un respaldo de base y archivos. Detener escrituras y el servicio. Preparar la versión nueva en una carpeta aparte, conservar la configuración privada y mantener las rutas persistentes de datos y respaldos.

Ejecutar las migraciones con la cuenta autorizada antes de arrancar la nueva versión. El servidor también comprueba ampliaciones al iniciar; no arrancar varias instancias durante esta operación. Comprobar salud, acceso, un ticket y las descargas antes de reabrir el servicio.

Si la actualización falla, conservar sus registros. Restaurar el conjunto de base y archivos respaldados en un destino separado, conectar el código anterior a ese destino y comprobarlo antes de habilitar usuarios. No suponer que basta con regresar únicamente el código si cambió la estructura de la base.

## 8. Entrega y piloto

TI y el responsable funcional deben confirmar la instalación, las cuentas, el correo, los respaldos y el ensayo de restauración. Registrar la versión entregada y un contacto para comunicar incidentes. Realizar un piloto con funcionarios y registrar uso, tiempos, errores y observaciones para el Incremento IV.

Esta entrega queda preparada para instalar y verificar. La aceptación de producción se completa con las comprobaciones del servidor y los servicios reales que elija la clínica.
