# Ticketera Clínica Aconcagua — Incremento III

Sistema de soporte informático con tickets, seguimiento SLA, inventario, reportes, manuales y administración. Backend Node.js/Express, base MySQL y frontend HTML/CSS/JavaScript con Alpine.js.

## Documentación del Incremento III

Repositorio privado del equipo, administrado por Benjamín (BenjaGC). El código se encuentra en la raíz; los documentos académicos están organizados en carpetas.

- [Informe del Incremento III](Entrega-academica/01-Informe-Incremento-III/)
- [Casos de uso](Entrega-academica/02-Casos-de-uso/)
- [Diagramas](Entrega-academica/03-Diagramas/)
- [Planificación y sprint](Entrega-academica/04-Planificacion-y-Sprint/)
- [Pruebas y evidencias](Entrega-academica/05-Pruebas-y-Evidencias/)
- [Presentación](Entrega-academica/06-Presentacion/)
- [Manuales](Entrega-academica/07-Manuales/)

Los documentos finales y los enlaces de video están pendientes de recibir. [Índice de la entrega académica](Entrega-academica/README.md).

## Estado de la entrega

Código preparado para revisión e instalación en un entorno de prueba. No incluye usuarios, contraseñas, tickets, adjuntos ni credenciales de la instalación local. La publicación de este repositorio no constituye un despliegue en la clínica.

Entrega revisada el 3 de octubre de 2026. Instalación, seguridad, regresión e interfaz verificadas en bases aisladas; consultar [registro de verificación](docs/VERIFICACION-ENTREGA.md). Los servicios institucionales y el servidor de destino aún deben configurarse y comprobarse con TI.

- [Instalar desde cero](docs/INSTALACION.md)
- [Instalación y operación en la clínica](docs/DESPLIEGUE-CLINICA.md)
- [Pruebas entre compañeros y registro de errores](docs/PRUEBAS-DEL-EQUIPO.md)
- [Estado de pruebas y requisitos de uso real](docs/PASO-A-USO-REAL.md)
- [Organización de la entrega académica](docs/INSTRUCCIONES-GITHUB-PARA-EL-EQUIPO.md)

## Inicio rápido

Requisitos: Node.js compatible con `package.json` (validado localmente con Node 24), npm y MySQL 8.4. Trabajar desde la carpeta que contiene este README.

```powershell
npm ci
Copy-Item .env.example .env
```

Crear una base VACÍA y una cuenta MySQL dedicada, completar `.env`, y después:

```powershell
npm run db:init
```

Antes de iniciar, seguir el apartado de migraciones de [INSTALACION.md](docs/INSTALACION.md): configurar temporalmente una cuenta MySQL autorizada y ejecutar `npm run db:migrate`. Retirar esas credenciales temporales y ejecutar `npm start`. Abrir http://localhost:3000. Seguir las instrucciones para crear el primer administrador. No hay una contraseña administrativa predeterminada.

`npm run db:init` se niega a operar si la base ya contiene tablas. Los SQL originales contienen instrucciones de recreación: no importarlos manualmente encima de una instalación existente.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm start` | Arrancar el servidor; MySQL debe estar activo. Ctrl+C detiene ese proceso Node. |
| `npm run dev` | Desarrollo con reinicio al cambiar archivos. |
| `npm run check` | Comprobar sintaxis de código y scripts. |
| `npm run db:init` | Instalar estructura base y catálogos en una base vacía. |
| `npm run db:migrate` | Preparar las ampliaciones y los disparadores; consultar credenciales temporales en la guía. |
| `npm run admin:create -- RUT "Nombre" correo` | Crear administrador localmente; requiere CLINICA_ADMIN_PASSWORD temporal. |
| `npm run backup` | Respaldar SQL y archivos; requiere mysqldump y directorio privado de destino. |
| `npm run test:security` | Pruebas de autorización, sesiones y recuperación en base temporal. |
| `npm run test:regression` | Pruebas del Incremento III en base temporal. |
| `npm run test:ui` | Recorrido de interfaz, aceptación, descargas y administración. |

Las pruebas necesitan dependencias de desarrollo, `npx playwright install chromium`, acceso a MySQL con permisos para crear/eliminar bases de prueba y puerto 3200 libre. Ejecutarlas una por una en un entorno separado. Los envíos de correo de estas pruebas son simulados y no certifican recepción SMTP real.

## Estructura

- `src/`: servidor, permisos, modelos, ampliaciones de base y tareas.
- `public/`: interfaz, estilos y bibliotecas del navegador.
- `database/`: esquema inicial sin registros personales y catálogos básicos.
- `scripts/`: instalación, administrador, respaldos y pruebas.
- `docs/`: instrucciones y límites de la entrega.

Las ampliaciones del Incremento III están también en `src/increment3-schema.js` y módulos relacionados; `database/clinica.sql` por sí solo no representa toda la estructura final.

## Publicación y operación

GitHub guarda el código. Esta aplicación no puede ejecutarse con GitHub Pages: necesita Node.js, MySQL y almacenamiento persistente. Antes del uso real se debe definir el servidor, acceso HTTPS, cuenta responsable, correo institucional, respaldos y restauración.

No subir `.env`, respaldos con usuarios, archivos privados ni contraseñas. Las integraciones externas permanecen sin configurar hasta disponer de servicios y credenciales autorizados.

## Documentación académica y videos

`Entrega-academica/` ya contiene las carpetas para organizar informe, diagramas, presentación y evidencias, siguiendo la guía de organización. Agregar aquí los enlaces definitivos a los videos cuando estén disponibles; no hay enlaces de video verificados incluidos en esta entrega.

Para comprobar también la instalación inicial y el respaldo con archivos: `npm run test:install`. Requiere Python y mysqldump. Para el recorrido de PDF, instalar PyMuPDF con `python -m pip install pymupdf`.
