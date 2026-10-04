# Verificación de la entrega — 3 de octubre de 2026

## Revisión adicional para GitHub y clínica

Se instaló una copia nueva exportada con `npm ci`: 291 paquetes instalados, 0 vulnerabilidades conocidas reportadas por npm y advertencias de dependencias deprecadas. La comprobación de sintaxis aprobó 41 archivos JavaScript. Se ejecutaron de forma secuencial y aprobaron las cuatro suites: `test:install`, `test:security`, `test:regression` y `test:ui`.

Esta revisión corrigió y añadió comprobaciones para:

- CSV: almacenamiento bcrypt, límite de 72 bytes, rechazo sin inserciones y cambio inicial obligatorio.
- Técnicos básicos: conservación del perfil tras reinicio real del servidor y selección de cuentas activas.
- Permisos: reasignación administrativa, bloqueo de mutaciones por técnicos no asignados y atribución por ID de sesión aunque existan nombres repetidos.
- Interfaz: acciones de estado según permisos y estado real, identidad por ID y consulta del límite de adjuntos para funcionarios.
- SLA: acumulación de pausas y porcentaje estable al retomar; cumplimiento contra la fecha límite prorrogada.
- Reportes: los tickets cerrados conservan su presencia en KPIs, desempeño y exportación.
- Instalación: cuenta MySQL dedicada, migración con administrador temporal, segunda migración con la cuenta del servicio sin permisos globales, rechazo de reinstalación y restauración de respaldo completo.
- Configuración: `DB_PORT` en pruebas y respaldo de interfaz; versión mínima de Node coherente con las dependencias.

El recorrido de interfaz finalizó con 0 errores inesperados. Se verificaron manuales, las seis categorías de tickets, estados, búsqueda, filtros, historial, herramientas administrativas, vistas de 1440 y 390 px, descargas PDF/Excel/CSV y un PDF de 24 páginas. Las pruebas operaron sobre bases temporales `clinica_ui_test_*` y archivos aislados; no instalaron ni borraron datos de `mydb`.

El código queda preparado para compartir e instalar. No se ha desplegado en la clínica ni publicado en el repositorio remoto durante esta revisión. SMTP, IMAP, LDAP e IMER se ejercitaron con transportes o entradas de prueba; falta comprobar los servicios reales, HTTPS, servidor, arranque automático, respaldo programado y aceptación de TI. Consultar `DESPLIEGUE-CLINICA.md`. Estos resultados no certifican ausencia absoluta de bugs ni cumplimiento formal de una norma ISO.

Los registros detallados se conservan localmente en `artifacts/entrega-github-1791010306479/artifacts/`; no se incluyen en el paquete público porque contienen datos y archivos de pruebas.

## Revisión inicial para el equipo — 3 de octubre de 2026

Se exportó una copia limpia desde el proyecto actual y se instaló con `npm ci`: 291 paquetes instalados y 0 vulnerabilidades reportadas por npm en esa ejecución (con advertencias de bibliotecas deprecadas). Se comprobaron 39 archivos JavaScript.

En esa copia exportada se ejecutaron y aprobaron `test:install`, `test:security`, `test:regression` y `test:ui`, con bases temporales separadas de la instalación original. El recorrido de interfaz terminó con 0 errores inesperados. Incluyó tickets, permisos, manuales, administración, descargas PDF (incluido documento de 24 páginas), vistas de 1440 y 390 px y las funciones del Incremento III. La prueba de instalación comprobó rechazo de reinstalación, administrador, respaldo y restauración.

Se corrigió el mensaje del inicializador y la guía para indicar `db:migrate` antes de `npm start`, distinguir las credenciales MySQL de las de la página y comprobar la longitud de la clave del administrador. Se añadió una guía para compañeros y un formato de reporte de errores.

Estas pruebas no certifican ausencia de todos los bugs ni sustituyen las pruebas en los computadores del equipo. Correo, LDAP e IMER se ejercitaron con servicios simulados; queda pendiente verificar los servicios reales y el despliegue de la clínica.

## Registro anterior

Entorno local: Windows, Node.js 24, MySQL 8.4 y Chromium de Playwright. Se utilizaron bases temporales y archivos aislados. Los servicios externos de correo/directorio de las pruebas fueron simulados.

| Comprobación | Resultado |
| --- | --- |
| Instalación limpia de dependencias en la carpeta exportada (`npm ci`) | Correcta |
| Sintaxis del código y scripts exportados | Correcta, 38 archivos antes de añadir este informe |
| Auditoría npm | 0 vulnerabilidades conocidas reportadas; no constituye auditoría integral |
| Autorización, alcance de tickets, adjuntos, XSS, caducidad y recuperación | Pruebas automatizadas superadas |
| Recorrido de tickets, búsqueda, filtros, historial y manuales | Superado |
| Administración y permisos de navegación | Superado |
| Interfaz de escritorio y móvil de 390 px | Recorridos superados |
| Reasignación, escalamiento, repuestos, pausa SLA, CSV y webhook IMER | Superado en entorno aislado; IMER simulado |
| PDF de ticket, etiqueta y reporte; Excel y CSV | Descargas comprobadas |
| PDF extenso | 24 páginas; contenido final y paginación comprobados con PyMuPDF |
| Respaldo manual SQL | Restaurado en otra base y registros contrastados |
| Instalación inicial y rechazo de reinstalación sobre tablas | Superado |
| Creación de administrador, contraseña cifrada y rechazo de duplicados | Superado |
| Respaldo de instalación con SQL y archivo de prueba | ZIP leído y SQL restaurado |
| Funciones del Incremento III | Suite de regresión superada, incluyendo escritorio y móvil |
| Revisión del paquete por secretos locales y archivos privados | Sin coincidencias detectadas en los archivos seleccionados |

Queda pendiente verificar la instalación en el servidor que elija la clínica, recepción de correo real, integraciones autorizadas, HTTPS, respaldos programados y piloto con usuarios. No se ha publicado ni desplegado desde esta entrega.

Los comandos para repetir las pruebas se encuentran en README e INSTALACION. Los resultados detallados se generan localmente en artifacts y se excluyen del paquete.
