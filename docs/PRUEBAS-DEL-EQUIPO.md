# Entrega para revisión entre compañeros

Esta es la aplicación actual, con las funciones del Incremento III y los scripts de instalación. Cada compañero instala una base independiente en su computador; sus cambios no llegan al PC de Benjamín ni a los otros compañeros.

El paquete comienza sin cuentas, tickets, archivos adjuntos ni manuales cargados. Incluye estructura, catálogos y migraciones de la base. No necesita acceder al computador de Benjamín. Los archivos cargados y los datos de las pruebas quedan en la instalación de cada compañero.

## Instalar

1. Extraer el ZIP en una carpeta propia (no ejecutar desde dentro del ZIP).
2. Instalar Node.js 24 y MySQL Server 8.4. Workbench es un cliente: instalar solo Workbench no instala el servidor. Conocer la contraseña de la cuenta administradora de MySQL de ese computador.
3. Abrir la carpeta que contiene `package.json` en Visual Studio Code. Abrir una terminal PowerShell.
4. Seguir [INSTALACION.md](INSTALACION.md) en orden: `npm ci`, `.env`, base y cuenta dedicadas, `db:init`, `db:migrate`, `npm start` y primer administrador.
5. Abrir http://localhost:3000. Si se cambió PORT, usar ese puerto. MySQL debe estar encendido cada vez que se use la aplicación.

No hay contraseñas predefinidas. La clave de root de MySQL, la de clinica_app y la del administrador de la página son distintas. No compartir `.env`.

## Qué probar manualmente

Utilizar cuentas y documentos de prueba propios, sin información de pacientes.

| Área | Comprobación |
| --- | --- |
| Instalación | Base nueva, migración, creación del administrador, inicio, parada con Ctrl+C y reinicio conservando datos. |
| Acceso | Registro, RUT válido e inválido, duplicados, contraseña incorrecta, cambio inicial de contraseña y cierre de sesión. |
| Permisos | Comparar una cuenta de funcionario y una administrativa; comprobar que el funcionario solo accede a los tickets y acciones autorizados. |
| Tickets | Crear, buscar, filtrar, abrir detalle, comentar, adjuntar archivos, asignar/reasignar, cambiar estados e historial. |
| SLA | Prioridades, vencimiento, pausa y reanudación conforme al flujo disponible. |
| Documentos | Cargar un manual PDF de prueba, abrirlo y descargarlo; exportar tickets y reportes y abrir los archivos descargados. |
| Inventario | Registrar existencias y consumo; comprobar rechazo cuando no hay stock suficiente. |
| Administración | Categorías, archivo histórico, importación Excel, parámetros, auditoría, papelera, mantenimiento, mensajes, encuestas, competencias y disponibilidad. |
| Usabilidad | Escritorio y ventana estrecha; botones, formularios, foco, scroll, mensajes de error y estados vacíos. |
| Persistencia | Reiniciar la aplicación y confirmar que los usuarios, tickets y documentos guardados continúan disponibles. |

Las funciones de correo, recuperación por correo, IMAP, LDAP, WhatsApp e IMER necesitan configuración de sus servicios. Un mensaje «No configurado» no demuestra un fallo de conexión del producto. Anotar esas pruebas como pendientes hasta configurar cada integración. No se incluyen credenciales de servicios externos.

## Reportar un error

Copiar este formato por cada problema:

```text
Título:
Versión del paquete / fecha:
Windows y navegador:
Rol utilizado:
Pantalla:
Pasos exactos para repetirlo:
1.
2.
Resultado esperado:
Resultado observado:
¿Ocurre siempre?:
Captura o video:
Mensaje de consola/terminal, sin contraseñas ni datos privados:
```

Si el fallo impide iniciar sesión, instalar o guardar datos, indicarlo al comienzo. No reiniciar ni borrar la base inmediatamente: conservar el mensaje y los pasos que lo causaron.

## Compartir cambios de código

Enviar el informe y los archivos de código modificados, indicando qué se cambió. No enviar `.env`, `node_modules`, respaldos, logs ni datos personales. No comprimir indiscriminadamente una carpeta ya usada.

Este paquete es para pruebas previas a GitHub. Subir el código a GitHub no aloja el backend ni MySQL. La puesta en uso de la clínica requiere su propia infraestructura, correo, HTTPS, respaldos y aceptación por TI.
