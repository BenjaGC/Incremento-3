# Instrucciones para subir la Ticketera Clínica Aconcagua a GitHub

Para Benjamín y el equipo — Incremento III

Repositorio: https://github.com/BenjaGC/Ticketera-Clinica-Aconcagua

## 1. Qué se está entregando

El repositorio debe reunir el código del sistema y los documentos académicos. La captura del otro grupo sirve como ejemplo de organización: no demuestra que su aplicación esté instalada o funcionando en una clínica.

GitHub permite guardar, compartir y descargar el proyecto. Subirlo NO deja nuestra ticketera funcionando en Internet: el sistema necesita un servidor Node.js, una base MySQL y almacenamiento para los archivos. GitHub Pages no ejecuta ese backend.

## 2. Estado del código que hay que subir

Usar la entrega nueva `Ticketera-Clinica-Aconcagua-Entrega-GitHub-20261003.zip`. Las entregas anteriores y la copia del video quedaron desactualizadas. No copiar toda la carpeta del computador.

Los documentos académicos se agregan por separado. El paquete nuevo contiene el código y las instrucciones revisadas. Tener archivos subidos no equivale a tener el sistema aprobado para producción.

## 3. Organización propuesta

Los nombres siguientes son una propuesta de organización; no significa que ya existan todos esos documentos. Solo subir material realmente elaborado y revisado.

```text
Incremento-3/
├── README.md
├── .gitignore
├── .env.example
├── package.json
├── package-lock.json
├── server.js
├── src/
├── public/
├── database/
├── scripts/
├── docs/
└── Entrega-academica/
    ├── 01-Informe-Incremento-III/
    ├── 02-Casos-de-uso/
    ├── 03-Diagramas/
    ├── 04-Planificacion-y-Sprint/
    ├── 05-Pruebas-y-Evidencias/
    ├── 06-Presentacion/
    └── 07-Manuales/
```

Mantener el código en la raíz permite abrir el proyecto y ejecutar sus comandos sin buscar otra carpeta. `docs/` contiene instrucciones técnicas de instalación y operación. `Entrega-academica/` contiene lo que se presenta al profesor.

GitHub no muestra carpetas vacías: no es necesario crearlas hasta tener un archivo para poner dentro.

## 4. Qué va en cada carpeta académica

| Carpeta | Archivos que hay que poner |
| --- | --- |
| 01-Informe-Incremento-III | Informe final en Word y, si corresponde, su PDF. Comprobar que sea la versión del Incremento III. |
| 02-Casos-de-uso | Descripciones y diagramas de los casos de uso del incremento, con sus versiones finales. |
| 03-Diagramas | Diagramas de clases, secuencia, componentes, despliegue, navegación y modelos de base de datos que pida el profesor. Incluir el archivo editable si lo tienen y una exportación PDF o PNG legible. |
| 04-Planificacion-y-Sprint | Planificación, backlog y planillas del sprint realmente utilizadas. |
| 05-Pruebas-y-Evidencias | Matriz de pruebas y capturas revisadas. Cada imagen debe corresponder a la prueba indicada; no reutilizar una captura para aparentar pruebas diferentes. |
| 06-Presentacion | PPTX definitivo y una copia PDF si la tienen. |
| 07-Manuales | Manual de instalación y manual de usuario del sistema. No mezclar documentos internos de la clínica sin autorización. |

Los casos de uso solicitados para este incremento son: CU-04, CU-07, CU-30, CU-31, CU-37, CU-40, CU-41, CU-43, CU-46, CU-49, CU-50, CU-54, CU-56, CU-59, CU-62, CU-63 y CU-65. Comprobarlos contra el informe definitivo; esta lista no certifica por sí sola su implementación.

Para las capturas, se puede usar un nombre de archivo como `P-50_nombre-de-la-prueba.png`. El número o título no tiene que aparecer dibujado sobre la imagen. La captura debe mostrar la interfaz y el resultado real, sin código, trazas técnicas ni datos privados. La explicación y la fuente van en el informe. Si se usaron datos de ejemplo, indicarlo en la descripción de la prueba para no confundirlos con resultados de uso de la clínica.

## 5. Qué código sí se entrega

Usar las carpetas y archivos de la entrega revisada, manteniendo sus nombres:

- `src/`: backend, permisos, reglas de negocio y ampliaciones de la base de datos.
- `public/`: interfaz, estilos, JavaScript y recursos permitidos. Excluir archivos subidos por usuarios y manuales privados.
- `database/`: estructura base y catálogos iniciales sin usuarios ni tickets reales. Las ampliaciones del Incremento III también están en el código de inicialización; no compartir únicamente el SQL original como si representara todo el incremento.
- `scripts/`: utilidades y pruebas seleccionadas para esta entrega.
- `docs/`: instalación, requisitos y estado de preparación.
- `server.js`, `package.json` y `package-lock.json`: arranque y dependencias.
- `.env.example`: plantilla vacía de configuración; nunca sustituirla por el archivo `.env` del computador.
- `.gitignore`: exclusiones de archivos locales.

No cambiar nombres ni mover archivos internos del código para que se vean más bonitos: algunas rutas dependen de esa estructura.

IMPORTANTE: el SQL inicial contiene instrucciones para recrear tablas. Es para una base nueva y vacía, no para importarlo encima de datos de la clínica. Para actualizar una instalación existente se requiere el procedimiento de actualización correspondiente y un respaldo.

## 6. Qué NO subir

No arrastrar la carpeta completa `web.clinica` al navegador. No subir:

- `.env` ni otros archivos con contraseñas, tokens o cuentas de correo configuradas.
- `node_modules/`: se reconstruye instalando las dependencias.
- `.local-backup/`, respaldos SQL con información personal ni carpetas físicas de MySQL.
- `artifacts/`, registros `.log`, configuraciones locales y datos temporales.
- Tickets, adjuntos, directorios o correos reales de funcionarios.
- Cuentas de demostración con sus contraseñas.
- Videos pesados dentro del código; poner enlaces en el README.

ATENCIÓN: `.gitignore` ayuda al usar Git, pero no evita que una persona seleccione y suba manualmente un secreto con la opción del navegador. Revisar los archivos antes de pulsar el botón final.

Si se subió una contraseña por accidente, eliminar el archivo no borra el historial. Avisar de inmediato y cambiar esa contraseña; después revisar la limpieza del historial.

## 7. Cómo subir los documentos desde el navegador

1. Iniciar sesión en la cuenta de GitHub que tiene permiso para escribir en el repositorio.
2. Abrir https://github.com/BenjaGC/Ticketera-Clinica-Aconcagua.
3. Revisar lo que ya existe. No borrar ni reemplazar el documento del Incremento II para subir el III: son entregas diferentes.
4. En el computador, crear `Entrega-academica` y organizar dentro las carpetas de la sección 3 que tengan archivos.
5. En GitHub, pulsar **Add file** y luego **Upload files**.
6. Arrastrar la carpeta `Entrega-academica` al área de carga. Esperar a que termine.
7. Revisar la lista: debe incluir rutas como `Entrega-academica/01-Informe-Incremento-III/Informe-Incremento-III.pdf`.
8. Escribir en el mensaje de cambio: `Agregar documentación académica del Incremento III`.
9. Si aparece la opción de crear una nueva rama, seleccionarla y llamarla `entrega-incremento-iii`. Así pueden revisar la entrega antes de incorporarla a la principal.
10. Pulsar **Propose changes** o **Commit changes**, según la opción elegida. Los textos pueden aparecer en inglés.
11. Si se creó una rama, abrir o crear la **Pull request** hacia `main`, revisar la pestaña **Files changed** y comprobar que solo estén los archivos esperados.
12. Cuando esté revisado, quien tenga permiso puede pulsar **Merge pull request** y confirmar. Si GitHub indica conflictos o bloqueos, no forzar: revisar el mensaje antes de continuar.
13. Volver a la pestaña **Code**, seleccionar `main` y comprobar que las carpetas ya aparecen.

La carga por navegador tiene un límite de 25 MiB por archivo y hasta 100 archivos por carga. Si hay más, hacer varias cargas conservando las rutas. Si un archivo supera el límite, no insistir ni dividir el código arbitrariamente: usar Git/GitHub Desktop o un enlace para material audiovisual.

## 8. Cómo subir el código cuando esté revisado

1. Recibir de Benjamín el paquete actualizado y confirmado para entrega.
2. Extraerlo en una carpeta aparte. No subir solamente el ZIP: GitHub debe mostrar los archivos del proyecto.
3. Abrir la carpeta extraída hasta ver `server.js`, `package.json`, `src`, `public` y `database` juntos.
4. Revisar la sección 6 de esta guía y comprobar que no haya credenciales ni datos privados.
5. En la raíz del repositorio, usar **Add file > Upload files** y subir el contenido de esa carpeta, no la carpeta exterior con nombre de descarga.
6. Comprobar también los archivos que empiezan por punto: `.gitignore` y `.env.example`. No agregar `.env`.
7. Usar el mensaje `Agregar código revisado de la Ticketera Clínica Aconcagua` y seguir el mismo proceso de rama, revisión e incorporación a `main`.
8. Si se supera el límite de cantidad de archivos, usar GitHub Desktop: clonar el repositorio, copiar el contenido revisado dentro de la carpeta clonada, revisar cada cambio y hacer commit y push. No inicializar otro repositorio dentro del existente ni usar una subida forzada.
9. No reemplazar a ciegas un README que ya contenga información del equipo. Integrar la instalación y los enlaces académicos en el mismo documento.

## 9. Qué debe decir el README

El README es la portada. Incluir:

1. Título: Ticketera Clínica Aconcagua — Incremento III.
2. Descripción breve del sistema y del incremento.
3. Integrantes del equipo, si corresponde a la entrega.
4. Enlaces relativos a informe, diagramas, presentación y evidencias.
5. Requisitos y enlace a instrucciones de instalación.
6. Estado real: código entregado, pruebas verificadas y aspectos pendientes; no afirmar que está operando en la clínica si todavía no está instalado.
7. Enlaces al video de presentación y al video de instalación.

Para los videos: subirlos al servicio que acuerden con el profesor y colocar los enlaces. Revisar que el profesor pueda abrirlos desde otra cuenta o una ventana privada. No pegar enlaces `localhost`, `C:\Users\...` ni rutas del computador: esas direcciones no sirven para otra persona.

## 10. Revisión final antes de mandar el enlace

- Abrir el repositorio en `main` y comprobar la estructura.
- Abrir el informe y el PPT correctos.
- Revisar que las capturas correspondan a cada prueba y no estén duplicadas por error.
- Abrir ambos enlaces de video desde otra sesión.
- Comprobar que no se subió `.env`, una contraseña o una base con datos personales.
- Confirmar que el profesor tenga acceso si el repositorio es privado.
- No cambiar la visibilidad a público sin acuerdo del equipo y revisión del contenido.
- Enviar el enlace del repositorio, indicando qué versión se entrega y qué falta para instalarla en la clínica.

Referencia para los pasos y límites de carga: https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository?platform=linux
