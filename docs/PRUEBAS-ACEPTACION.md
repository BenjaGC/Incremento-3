# Verificación P-26 a P-35

Ejecutado el 13 de septiembre de 2026 sobre una base MySQL temporal, con archivos temporales y transporte de correo simulado. Los registros de prueba no se incorporaron a la base real. Ejecutar `npm ci` y `npm run test:ui` desde el proyecto original, con MySQL iniciado y credenciales DB válidas en `.env`.

| ID | Caso | Resultado observado |
|---|---|---|
| P-26 | Reasignación manual | Cambio de técnico persistido en MySQL. |
| P-27 | Escalamiento | Ticket Urgente escalado al administrador elegido; comentario privado y auditoría guardados. Envío de correo simulado. |
| P-28 | Repuesto disponible | Consumo de 2 unidades; stock pasa de 2 a 0, movimiento y costo guardados. |
| P-29 | Repuesto sin stock | Rechazo HTTP 400 esperado, sin nuevo movimiento ni stock negativo. |
| P-30 | Pausa por proveedor | Pausar nuevamente conserva el inicio; reanudar devuelve al SLA el tiempo pausado. |
| P-31 | Webhook IMER | Contrato provisional probado con evento simulado: HTTP 201, actividad guardada y reintento sin duplicados. **Pendiente validación contra IMER real.** |
| P-32 | CSV válido | Usuario importado con RUT válido módulo 11 y rol Usuario. |
| P-33 | CSV corrupto | Rechazo HTTP 400 esperado por dígito verificador incorrecto; no agrega usuarios. |
| P-34 | Reporte consolidado | XLSX descargado, leído y contrastado con ticket, cantidad y costo persistidos. |
| P-35 | Respaldo manual | Descarga exige sesión Admin; SQL restaurado en otra base y contenido contrastado. |

Estas son pruebas de integración reales contra HTTP/MySQL. P-28, P-29 y P-35 no deben presentarse como pruebas unitarias aisladas: corrige la columna Tipo de tu tabla o añade pruebas unitarias específicas. El sistema conserva la prioridad real «Urgente»; no se añadió una prioridad ficticia «Crítica». La jefatura se selecciona entre administradores activos porque no existe un rol independiente Jefatura.

## Uso de las nuevas funciones

- Administración → Usuarios y respaldo: importar CSV o descargar respaldo SQL.
- Detalle de un ticket activo, como Admin → Escalar a jefatura: seleccionar administrador, indicar motivo y registrar.
- Repuestos, reasignación, espera por proveedor e inventario consolidado conservan sus accesos existentes.
- Correos al administrador: consultar `CORREOS-ADMINISTRADOR.md`. La prueba automática no entrega mensajes reales a buzones.

CSV UTF-8, hasta 2 MB y 1000 usuarios; columnas exactas `nombre,rut,correo,password`. La contraseña debe tener al menos 8 caracteres y no superar 72 bytes UTF-8. RUT con guion y dígito verificador correcto. El archivo completo se valida antes de guardar y cualquier conflicto revierte la importación. La revisión actual almacena las contraseñas nuevas mediante bcrypt y exige cambiarlas en el primer acceso. Las cuentas heredadas se convierten a bcrypt después de validar sus credenciales al iniciar sesión.

## IMER: contrato provisional

Configurar en `.env` `IMER_WEBHOOK_TOKEN` con un secreto propio y reiniciar Node. Sin esa variable, el endpoint responde 503.

`POST /integraciones/imer/webhook`, encabezados `Authorization: Bearer <secreto>` y `Content-Type: application/json`.

```json
{
  "evento_id": "identificador-unico-del-evento",
  "id_ticket": "codigo-de-un-ticket-existente",
  "descripcion": "Descripcion de la falla informada por el proveedor"
}
```

El ticket debe existir y pertenecer a Sistema Externo (categoría 6). El evento agrega actividad y aviso interno al creador; no crea automáticamente otro ticket. La misma combinación ticket/evento no se procesa dos veces. Antes de declarar P-31 exitoso con IMER, confirmar su documentación, autenticación y formato, configurar una URL accesible y recibir un evento real. No se ha realizado esa conexión externa.

## Respaldos y evidencias

El servidor necesita `mysqldump`. En Windows se usa por defecto MySQL Server 8.4; para otra instalación definir `MYSQLDUMP_PATH` en `.env` con la ruta completa. El respaldo contiene datos y credenciales de usuarios: conservarlo de forma privada.

Resultados detallados: `artifacts/pruebas-aceptacion.json`. Regresión de interfaz: `artifacts/verificacion.json`. Capturas reales del entorno QA: `artifacts/aceptacion-administracion.png` y `artifacts/aceptacion-csv-rechazado.png`. No equivalen a diez capturas de figuras: la numeración 10.2–10.11 del documento adjunto todavía requiere capturas individuales si tu entrega académica las exige.

Archivos principales: `src/acceptance.js`, `src/server.js`, `public/js/app.js`, `public/js/ui.js`, `public/index.html`, `public/css/theme.css`, `scripts/acceptance-checks.cjs` y `scripts/test-ui.cjs`.
