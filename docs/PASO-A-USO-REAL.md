# Entrega del código y paso a uso real

Estado: código preparado para revisión en GitHub; el despliegue en la clínica no está configurado.

## Correcciones incorporadas

- Autorización central en rutas antiguas: identidad y alcance resueltos en servidor, sin confiar en el nombre o indicador de administrador enviado por el navegador.
- Listados de tickets limitados al solicitante/asignado, con alcance ampliado para soporte.
- Acceso autenticado a adjuntos; comprobación del ticket y tratamiento de contenido activo.
- Recuperación de contraseña con códigos criptográficos, caducidad, intentos máximos, consumo de código y respuesta genérica.
- Caducidad de sesión de ocho horas y revocación al recuperar contraseña.
- Saneamiento de comentarios y nombres de adjuntos.
- SMTP configurable, tiempos límite y cola de notificaciones operativas.
- Configuración diferenciada de producción y almacenamiento persistente configurable.
- Instalación inicial que rechaza bases con tablas; creación local de administrador con contraseña temporal propia.
- Corrección de consulta SLA y consulta del catálogo de materiales según permisos.

Esta revisión no equivale a una auditoría completa de seguridad ni a certificación ISO. No se afirma ausencia absoluta de errores.

## Verificación local

Las pruebas automatizadas se ejecutan con bases temporales, archivos aislados y correo simulado. Comprueban autorización, recuperación, recorridos de tickets, administración, funciones del Incremento III, descarga de reportes y restauración de respaldo SQL. Los resultados se generan en `artifacts/`, que no se publica porque puede contener datos de pruebas.

El recorrido completo de descargas requiere además Python con PyMuPDF (`python -m pip install pymupdf`) para abrir los PDF y comprobar contenido y paginación. Esa dependencia es de las pruebas, no del servidor de la aplicación.

## Requisitos que siguen dependiendo del despliegue

1. Designar responsable de TI y administrador funcional.
2. Definir servidor, dominio/red y acceso HTTPS. GitHub Pages no ejecuta Node.js ni MySQL.
3. Instalar una base limpia, revisar catálogos y crear cuentas reales autorizadas.
4. Configurar y verificar correo institucional y las integraciones que se utilizarán. Las pruebas con transporte simulado no comprueban recepción externa.
5. Configurar copias automáticas de base Y archivos, retención, permisos y ensayo de restauración en el servidor de destino.
6. Configurar arranque automático, monitoreo, espacio disponible, actualización y reversión.
7. Ejecutar piloto con funcionarios y registrar resultados reales para el Incremento IV.

## Límites operativos conocidos

- Las ampliaciones del esquema se aplican al arrancar: respaldar y probar la actualización antes de ejecutarla sobre datos reales; arrancar una sola instancia durante ese proceso.
- Recuperación y límites de intentos usan memoria del proceso. Un reinicio invalida códigos pendientes. No está configurado un almacén compartido para varias instancias.
- El token de sesión sigue en el almacenamiento del navegador; se ha reducido exposición mediante saneamiento, pero debe ampliarse la revisión de XSS y políticas del navegador antes de exposición pública.
- El registro de usuarios sigue disponible; TI debe decidir la política de altas para su instalación.
- Deben probarse capacidad, concurrencia y recuperación ante fallos en la infraestructura que elija la clínica.
- El script de respaldo empaqueta base y archivos: detener escrituras mientras se ejecuta para obtener coherencia entre ambos.

## Privacidad de la entrega

No publicar `.env`, contraseñas, tokens, respaldos ni exportaciones con usuarios, adjuntos y manuales privados. La base SQL inicial está sin registros personales; las ampliaciones del incremento se encuentran también en `src/`.
