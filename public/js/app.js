
function app() {
    return withClinicUI({
        // ── Session ──
        usuario: null,
        sessionDisplaced: false,
        heartbeatTimer: null,

        // ── UI state ──
        profileOpen: false,
        notifOpen: false,
        modalAuth: false,
        modalIncidente: false,
        modalPerfil: false,
        modalManuales: false,
        modalStats: false,
        modalDetalle: false,
        modalPrioridades: false,
        modalMatriz: false,
        modalReportesKPI: false,
        modalHorarioOperativo: false,
        modalInventario: false,
        modalMonitoreoSLA: false,
        modalReportesProgramados: false,
        modalFeriados: false,
        modalPanelAdmin: false,
        modalIntegracionExterna: false,
        modalStockInsumos: false,
        modalMapaCalor: false,

        // ── Auth ──
        authTab: 'login',
        authMsg: '',
        authMsgColor: 'red',
        login: { rut: '', pass: '' },
        reg:   { nombre: '', rut: '', correo: '', pass: '' },
        rec:   { paso: 1, rut: '', correoHint: '', codigo: '', codigoEstado: '', nueva: '', confirmar: '', reenviarCooldown: 0, verificado: false },

        // ── Tickets ──
        modo: 'vacio',        // 'vacio' | 'busqueda' | 'mistickets' | 'historial'
        cargando: false,
        listaTickets: [],
        incidentesActivos: [],
        histBannerText: '',
        msgVacio: '',
        busqueda: '',
        busquedaTimer: null,

        // ── Notifications ──
        notifCreador: [],
        notifTecnico: [],
        get notifTotal() { return this.notifCreador.length + this.notifTecnico.length; },

        // ── Nuevo incidente ──
        inc: { piso:'', habitacion:'', aparato:'', descripcion:'', priority_id:'', externoConfirmado:false, nombreActivo:'' },
        incMsg: '',
        incMsgColor: 'red',
        manualBanner: false,
        manualBannerIgnorado: false,
        manualUrl: '',
        manualesCache: [],

        // ── RF-06: mapeo de aparato → categoría (fijo, según catálogo del formulario) ──
        categoriaPorAparato: {
            'Computador/Hardware': 1,
            'Impresora': 2,
            'Teléfono IP': 3,
            'Sistema/Software': 4,
            'Red/Internet': 5,
            'Sistema Externo (ej. IMER)': 6
        },
        // ── RF-10: advertencia de responsabilidad externa ──
        get esCategoriaExterna() { return this.categoriaPorAparato[this.inc.aparato] === 6; },
        onCambioAparato() { this.inc.externoConfirmado = false; },
        // ── RF-23: nombre del activo obligatorio solo para Hardware (1) o Red (5) ──
        get requiereActivo() {
            const catId = this.categoriaPorAparato[this.inc.aparato];
            return catId === 1 || catId === 5;
        },
        sugerenciasActivo: [],
        async buscarSugerenciasActivo() {
            const q = this.inc.nombreActivo;
            if (!q || q.trim().length < 2) { this.sugerenciasActivo = []; return; }
            try {
                const r = await fetch(`/equipos/sugerencias?q=${encodeURIComponent(q.trim())}`);
                this.sugerenciasActivo = await r.json();
            } catch(e) { this.sugerenciasActivo = []; }
        },

        // ── RF-05: Prioridades y SLA ──
        prioridades: [],
        modalPrioridadesTab: 'lista', // 'lista' | 'form'
        prioridadForm: { priority_id: null, priority_name: '', sla_hours: '', color_hex: '#3d5a80' },
        prioridadMsg: '',
        prioridadMsgColor: 'red',

        // ── RF-06: Matriz Categoría x Prioridad y Técnico Crítico ──
        categorias: [],
        tecnicos: [],
        matriz: [],
        matrizForm: {},
        matrizMsg: '',
        matrizMsgColor: 'red',

        // ── RF-12: Reportes y KPIs ──
        kpiFiltros: { desde: '', hasta: '', area: '', priority_id: '' },
        kpiData: null,
        kpiCargando: false,
        kpiSinDatos: false,
        kpiChart: null,
        exportMsg: '',
        exportMsgColor: 'red',

        // ── RF-14: Ventana Operativa ──
        horarioForm: { hora_inicio: '08:00', hora_fin: '20:00' },
        horarioMsg: '',
        horarioMsgColor: 'red',
        horarioCorreosEncolados: 0,

        // ── RF-25: Inventario Consolidado ──
        inventarioFiltros: { desde:'', hasta:'' },
        inventarioData: null,
        inventarioCargando: false,
        inventarioSinDatos: false,
        inventarioExportMsg: '',
        inventarioExportMsgColor: 'red',

        // ── RF-29: Monitoreo automático de vencimiento SLA ──
        ticketsRiesgoSLA: [],
        monitoreoSLAIntervalo: null,
        monitoreoSLACargando: false,

        // ── RF-33: Reportes automáticos a gerencia ──
        reporteProgramadoForm: { destinatarios:'', periodicidad:'Semanal', activo:false, ultima_ejecucion:null },
        reporteProgramadoMsg: '',
        reporteProgramadoMsgColor: 'red',

        // ── RF-45: Calendario operativo (feriados) ──
        feriados: [],
        feriadoForm: { fecha:'', nombre:'' },
        feriadoMsg: '',
        feriadoMsgColor: 'red',

        // ── RF-47: Integraciones externas ──
        integracionExternaForm: { external_endpoint_url: '' },
        integracionExternaMsg: '',
        integracionExternaMsgColor: 'red',
        verificarExternoMsg: '',
        verificarExternoMsgColor: 'red',
        verificarExternoResultado: null,

        // ── RF-52: Stock de repuestos ──
        stockInsumos: [],
        stockEntradaForm: { material_id:'', cantidad:1 },
        stockMsg: '',
        stockMsgColor: 'red',

        // ── RF-53: Reasignación forzada ──
        reasignarForm: { nuevo_tecnico_id:'', motivo:'' },
        reasignarMsg: '',
        reasignarMsgColor: 'red',
        reasignarAdvertencia: '',

        // ── RF-55: Mapa de calor ──
        mapaCalorData: [],
        mapaCalorFiltroCategoria: '',
        mapaCalorCargando: false,

        // ── RF-57: Descarga masiva de adjuntos ──
        adjuntosZipMsg: '',
        adjuntosZipMsgColor: 'red',

        // ── RF-60: Desempeño por técnico ──
        modalDesempeno: false,
        desempenoTecnicoId: '',
        desempenoData: null,
        desempenoMsg: '',

        // ── RF-64: QR de activos ──
        modalQrActivos: false,
        qrActivoBusqueda: '',
        qrActivoSugerencias: [],
        qrActivoSeleccionado: null,
        qrActivoDataUrl: '',

        // ── Gestión de equipos (alta manual desde la interfaz) ──
        modalEquipos: false,
        equipoForm: { equipment_name:'', piso:'', habitacion:'', equipment_type:'' },
        equipoMsg: '',
        equipoMsgColor: 'red',
        listaEquipos: [],

        // ── Perfil ──
        perfil: { nombre:'', correo:'', passActual:'', passNueva:'', codigo:'', metodo:'actual' },
        perfilMsg: '',
        perfilMsgColor: 'red',

        // ── Manuales ──
        manuales: [],
        manualCargando: false,
        manualMsg: '',
        manualMsgColor: 'green',
        dropOver: false,

        // ── Stats ──
        statsCargando: false,
        statsError: false,
        chartsStats: {},

        // ── Detail window ──
        detTicket: {},
        detComentarios: [],
        detComentarioNuevo: '',
        detMsg: '',
        detMsgColor: 'red',
        detWin: { maximized:false, minimized:false, headerTitle:'Cargando...' },
        get esAdmin() { return this.usuario && this.usuario.permisos === 'si'; },
        get esCritico() { return this.usuario && this.usuario.esCritico === true; },
        esSolicitanteDe(ticket) { return !!this.usuario?.user_id && Number(ticket?.requester_user_id) === Number(this.usuario.user_id); },
        esTecnicoDe(ticket) { return !!this.usuario?.user_id && Number(ticket?.assigned_user_id) === Number(this.usuario.user_id); },
        get puedeGestionarTicket() { return this.esAdmin || (this.esSoporte && this.esTecnicoDe(this.detTicket)); },
        get puedeExportar() { return this.esAdmin || this.esCritico; },
        get puedeEscribir() {
            if (!this.usuario || !this.detTicket) return false;
            return this.esAdmin || this.esSolicitanteDe(this.detTicket) || this.esTecnicoDe(this.detTicket);
        },
        // ── RF-17: solo Admin o el técnico asignado pueden dejar notas privadas ──
        get puedeNotaPrivada() {
            if (!this.usuario || !this.detTicket) return false;
            return this.puedeGestionarTicket;
        },
        // ── RF-21: técnico asignado o Admin, con ticket Pendiente o En curso ──
        get puedeAjustarPrioridad() {
            if (!this.usuario || !this.detTicket) return false;
            const estadosValidos = ['Pendiente', 'En curso'];
            return this.puedeGestionarTicket && estadosValidos.includes(this.detTicket.estado);
        },
        // ── RF-24: técnico asignado o Admin, con ticket En curso ──
        get puedeImputarMateriales() {
            if (!this.usuario || !this.detTicket) return false;
            return this.puedeGestionarTicket && this.detTicket.estado === 'En curso';
        },
        // ── RF-47: solo aplica a tickets de categoría "Sistema Externo" activos ──
        get puedeVerificarExterno() {
            if (!this.detTicket) return false;
            return this.detTicket.aparato === 'Sistema Externo (ej. IMER)' && this.detTicket.estado !== 'Resuelto' && this.detTicket.estado !== 'Cancelado';
        },
        // ── RF-48: técnico asignado o Admin, ticket En curso, con equipo identificado ──
        get puedeImprimirEtiqueta() {
            if (!this.usuario || !this.detTicket) return false;
            return this.puedeGestionarTicket && this.detTicket.estado === 'En curso';
        },
        // ── RF-53: solo Admin, ticket Pendiente o En curso ──
        get puedeReasignarForzado() {
            if (!this.esAdmin || !this.detTicket) return false;
            return ['Pendiente', 'En curso'].includes(this.detTicket.estado);
        },
        // ── RF-18: solo el solicitante, sobre un ticket Resuelto/Cancelado ──
        get puedeReabrir() {
            if (!this.usuario || !this.detTicket) return false;
            const estadosCerrados = ['Resuelto', 'Cancelado', 'Cerrado'];
            return this.esSolicitanteDe(this.detTicket) && estadosCerrados.includes(this.detTicket.estado);
        },
        detNotaPrivada: '',
        detNotaPrivadaMsg: '',
        detNotaPrivadaMsgColor: 'red',
        detJustificacionReapertura: '',
        reabrirMsg: '',
        reabrirMsgColor: 'red',
        reabrirLimiteAlcanzado: false,

        // ── RF-21: ajuste técnico de urgencia ──
        ajustePrioridadForm: { priority_id:'', justificacion:'' },
        ajustePrioridadMsg: '',
        ajustePrioridadMsgColor: 'red',

        // ── RF-24: materiales consumidos ──
        detMateriales: [],
        catalogoMateriales: [],
        materialForm: { material_id:'', cantidad:1, costo_unitario:'' },
        materialMsg: '',
        materialMsgColor: 'red',

        // ── Custom prompt / alert ──
        prompt: { open:false, titulo:'', valor:'', placeholder:'', error:false, resolve: null },
        alerta: { open:false, titulo:'', msg:'' },

        // ════════════════════════════════════
        // INIT
        // ════════════════════════════════════
        init() {
            const saved = localStorage.getItem('usuario_actual');
            if (saved) {
                try { this.usuario = JSON.parse(saved); } catch { localStorage.removeItem('usuario_actual'); }
                if (!this.usuario?.user_id) { this.usuario = null; localStorage.removeItem('usuario_actual'); }
                this.$nextTick(() => { this.cargarActivosBackground(); this.precargarDesdeQrEquipo(); });
                this.iniciarHeartbeat();
            }
            this.initDrag();
            this.initUI();
            this.v3Init();
        },

        // ════════════════════════════════════
        // HEARTBEAT
        // ════════════════════════════════════
        iniciarHeartbeat() {
            if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = setInterval(async () => {
                if (!this.usuario) { clearInterval(this.heartbeatTimer); return; }
                try {
                    const r = await fetch('/sesion/verificar', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ rut: this.usuario.rut, token: this.usuario.token })
                    });
                    const d = await r.json();
                    if (!d.valida) {
                        clearInterval(this.heartbeatTimer);
                        localStorage.removeItem('usuario_actual');
                        this.usuario = null;
                        this.sessionDisplaced = true;
                        this.modo = 'vacio';
                    }
                } catch(e) {}
            }, 10000);
        },

        // ════════════════════════════════════
        // HELPERS
        // ════════════════════════════════════
        rutValido(rut) {
            if (!rut || typeof rut !== 'string') return false;
            rut = rut.trim().toUpperCase();
            if (!/^\d{7,9}-[\dK]$/.test(rut)) return false;
            const [cuerpo, dvIngresado] = rut.split('-');
            let suma = 0, mul = 2;
            for (let i = cuerpo.length - 1; i >= 0; i--) {
                suma += parseInt(cuerpo[i]) * mul;
                mul = mul === 7 ? 2 : mul + 1;
            }
            const r = 11 - (suma % 11);
            const dv = r === 11 ? '0' : r === 10 ? 'K' : String(r);
            return dvIngresado === dv;
        },

        colorEstado(e) {
            const m = { 'Resuelto':'#28a745','En espera':'#ffc107','Cancelado':'#6c757d','Pendiente':'#fd7e14' };
            return m[e] || '#007bff';
        },

        claseEstado(e) {
            const m = { 'Resuelto':'s-resuelto','En espera':'s-espera','Cancelado':'s-cancelado','Pendiente':'s-pendiente' };
            return m[e] || 's-curso';
        },

        setMsg(field, color, texto) {
            this[field + 'MsgColor'] = color;
            this[field + 'Msg']      = texto;
        },

        // ════════════════════════════════════
        // PROMPT / ALERT
        // ════════════════════════════════════
        pedirTexto(titulo, placeholder = '') {
            return new Promise(resolve => {
                this.prompt = { open:true, titulo, valor:'', placeholder, error:false, resolve };
            });
        },
        confirmPrompt() {
            if (!this.prompt.valor.trim()) { this.prompt.error = true; return; }
            const val = this.prompt.valor;
            this.prompt.open = false;
            this.prompt.resolve(val);
        },
        mostrarAlerta(msg, titulo = 'Aviso') {
            this.alerta = { open:true, titulo, msg };
        },

        // ════════════════════════════════════
        // AUTH — LOGIN / LOGOUT
        // ════════════════════════════════════
        async iniciarSesion() {
            if (!this.login.rut || !this.login.pass) return this.setMsg('auth','red','Llena todos los campos');
            this.setMsg('auth','blue','Iniciando sesión...');
            try {
                const r = await fetch('/login', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ rut: this.login.rut, password: this.login.pass }) });
                const d = await r.json();
                if (r.ok) {
                    this.usuario = { user_id:d.user_id, nombre:d.nombre, permisos:d.permisos, esCritico:d.esCritico, esTecnico:d.esTecnico, rut:d.rut, correo:d.correo, token:d.token, mustReset:d.mustReset };
                    localStorage.setItem('usuario_actual', JSON.stringify(this.usuario));
                    this.modalAuth = false;
                    this.login.pass = '';
                    this.authMsg = '';
                    if(d.mustReset){this.v3MustReset=true;await this.v3OpenSection('password');return;}
                    this.cargarActivosBackground();
                    this.iniciarHeartbeat();
                    this.precargarDesdeQrEquipo();
                } else { this.setMsg('auth','red', d.error); }
            } catch(e) { this.setMsg('auth','red','Error de conexión'); }
        },

        async registrar() {
            const { nombre, rut, correo, pass } = this.reg;
            if (!nombre) return this.setMsg('auth','red','El nombre es obligatorio');
            if (!pass)   return this.setMsg('auth','red','La contraseña es obligatoria');
            if (!this.rutValido(rut)) return this.setMsg('auth','red','RUT inválido (módulo 11)');
            this.setMsg('auth','blue','Registrando...');
            try {
                const r = await fetch('/registro', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ nombre, rut, correo, password: pass }) });
                const d = await r.json();
                if (r.ok) {
                    this.setMsg('auth','green', d.message);
                    setTimeout(() => {
                        this.authTab = 'login';
                        this.authMsg = '';
                        this.reg = { nombre:'', rut:'', correo:'', pass:'' };
                    }, 2500);
                } else { this.setMsg('auth','red', d.error); }
            } catch(e) { this.setMsg('auth','red','Error de conexión'); }
        },

        cerrarSesion() {
            if (this.usuario) {
                fetch('/sesion/cerrar', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ rut:this.usuario.rut, token:this.usuario.token }) }).catch(()=>{});
            }
            if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
            localStorage.removeItem('usuario_actual');
            this.usuario = null;
            this.modo = 'vacio';
            this.listaTickets = [];
        },

        switchRegistro() {
            this.authTab = 'registro';
            this.reg = { nombre:'', rut:'', correo:'', pass:'' };
            this.authMsg = '';
        },

        // ════════════════════════════════════
        // AUTH — RECOVERY
        // ════════════════════════════════════
        iniciarRecovery() {
            this.authTab = 'recover';
            this.rec = { paso:1, rut:'', correoHint:'', codigo:'', codigoEstado:'', nueva:'', confirmar:'', reenviarCooldown:0, verificado:false };
            this.authMsg = '';
        },

        async recPaso1() {
            if (!this.rec.rut.trim()) return this.setMsg('auth','red','Ingresa tu RUT');
            this.setMsg('auth','blue','Enviando código...');
            try {
                const r = await fetch('/recuperar-solicitar', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ rut: this.rec.rut }) });
                const d = await r.json();
                if (r.ok) {
                    this.rec.correoHint = d.correoHint ? `📧 Código enviado a ${d.correoHint}` : '📧 Código enviado a tu correo.';
                    this.rec.paso = 2;
                    this.setMsg('auth','green','Código enviado. Revisa tu correo.');
                } else { this.setMsg('auth','red', d.error); }
            } catch(e) { this.setMsg('auth','red','Error de conexión'); }
        },

        async reenviarCodigo() {
            if (this.rec.reenviarCooldown > 0) return;
            this.rec.codigo = ''; this.rec.codigoEstado = '';
            try {
                await fetch('/recuperar-solicitar', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ rut: this.rec.rut }) });
                this.setMsg('auth','green','Nuevo código enviado.');
            } catch(e) {}
            this.rec.reenviarCooldown = 30;
            const t = setInterval(() => {
                this.rec.reenviarCooldown--;
                if (this.rec.reenviarCooldown <= 0) clearInterval(t);
            }, 1000);
        },

        async recPaso2() {
            if (this.rec.codigo.length < 6) return;
            this.setMsg('auth','','');
            try {
                const r = await fetch('/recuperar-verificar', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ rut: this.rec.rut, codigo: this.rec.codigo }) });
                if (r.ok) {
                    this.rec.codigoEstado = 'ok';
                    this.rec.verificado   = true;
                    setTimeout(() => { this.rec.paso = 3; }, 900);
                } else {
                    this.rec.codigoEstado = 'error';
                    this.rec.verificado   = false;
                }
            } catch(e) { this.rec.codigoEstado = 'error'; }
        },

        async recPaso3() {
            if (!this.rec.verificado) return this.setMsg('auth','red','El código no fue verificado.');
            if (!this.rec.nueva || !this.rec.confirmar) return this.setMsg('auth','red','Completa ambos campos.');
            if (this.rec.nueva !== this.rec.confirmar)  return this.setMsg('auth','red','Las contraseñas no coinciden.');
            if (this.rec.nueva.length < 4)              return this.setMsg('auth','red','Mínimo 4 caracteres.');
            this.setMsg('auth','blue','Guardando...');
            try {
                const r = await fetch('/recuperar-cambiar', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ rut: this.rec.rut, codigo: this.rec.codigo, nuevaPassword: this.rec.nueva }) });
                const d = await r.json();
                if (r.ok) {
                    this.setMsg('auth','green','Contraseña actualizada. Ya puedes iniciar sesión.');
                    setTimeout(() => { this.authTab = 'login'; this.authMsg = ''; }, 2500);
                } else { this.setMsg('auth','red', d.error); }
            } catch(e) { this.setMsg('auth','red','Error de conexión'); }
        },

        // ════════════════════════════════════
        // TICKETS — LOAD
        // ════════════════════════════════════
        async cargarActivosBackground() {
            try {
                const usuarioParam = this.usuario ? encodeURIComponent(this.usuario.nombre) : '';
                const r = await fetch(`/incidentes?usuario=${usuarioParam}`);
                const d = await r.json();
                this.incidentesActivos = (r.ok && Array.isArray(d)) ? d : [];
                if (!r.ok) console.error('Error /incidentes:', d.error || d);
                this.calcularNotificaciones();
            } catch(e) { console.error('Error de conexión en cargarActivosBackground:', e); }
        },

        calcularNotificaciones() {
            if (!this.usuario || !Array.isArray(this.incidentesActivos)) { this.notifCreador=[]; this.notifTecnico=[]; return; }
            this.notifCreador = this.incidentesActivos.filter(t =>
                this.esSolicitanteDe(t) && t.notificacion_creador == 1);
            // RF-58: además de los pendientes, se avisa al técnico si su ticket llegó al 75% del SLA
            this.notifTecnico = this.incidentesActivos.filter(t =>
                this.esTecnicoDe(t) &&
                (t.estado === 'Pendiente' || t.alerta_75_enviada == 1));
        },

        toggleNotif() {
            this.notifOpen = !this.notifOpen;
        },

        onBusqueda() {
            this.modalPanelAdmin = false; this.limpiarFiltros(); this.ticketsError = "";
            const q = this.busqueda.trim();
            if (!q) { this.volverAVacio(); return; }
            this.buscarEnBD(q);
        },

        async buscarEnBD(q) {
            this.ticketsError = "";
            this.modo = 'busqueda';
            this.cargando = true;
            this.listaTickets = [];
            try {
                const usuarioParam = this.usuario ? encodeURIComponent(this.usuario.nombre) : '';
                const r = await fetch(`/incidentes/buscar?q=${encodeURIComponent(q)}&usuario=${usuarioParam}`);
                const d = await r.json();
                if (r.ok && Array.isArray(d)) {
                    this.listaTickets = d;
                    this.msgVacio = 'No se encontraron tickets activos con ese criterio.';
                } else {
                    this.listaTickets = [];
                    this.msgVacio = d.error || 'Error al buscar. Intenta de nuevo.'; this.ticketsError = this.msgVacio;
                }
            } catch(e) { this.msgVacio = 'Error al buscar. Intenta de nuevo.'; this.ticketsError = this.msgVacio; }
            this.cargando = false;
        },

        async verHistorial() {
            this.modalPanelAdmin = false; this.limpiarFiltros(); this.ticketsError = "";
            if (!this.usuario) return;
            this.modo = 'historial';
            this.busqueda = '';
            this.cargando = true;
            this.listaTickets = [];
            const esAdmin = this.usuario.permisos === 'si';
            const url = `/incidentes/cerrados?usuario=${encodeURIComponent(this.usuario.nombre)}&esAdmin=${esAdmin?'si':'no'}`;
            try {
                const r = await fetch(url);
                const data = await r.json();
                if (r.ok && Array.isArray(data)) {
                    this.listaTickets = data;
                    this.histBannerText = esAdmin
                        ? `Historial — todos los tickets cerrados (${data.length})`
                        : `Historial — tus tickets resueltos y cancelados (${data.length})`;
                    this.msgVacio = 'No hay tickets resueltos o cancelados aún.';
                } else {
                    console.error('Error /incidentes/cerrados:', data.error || data);
                    this.listaTickets = [];
                    this.msgVacio = data.error || 'Error al cargar el historial.'; this.ticketsError = this.msgVacio;
                }
            } catch(e) { this.msgVacio = 'Error al cargar el historial.'; this.ticketsError = this.msgVacio; }
            this.cargando = false;
        },

        async verMisTickets() {
            this.modalPanelAdmin = false; this.limpiarFiltros(); this.ticketsError = "";
            if (!this.usuario) return;
            this.modo = 'mistickets';
            this.busqueda = '';
            this.cargando = true;
            this.listaTickets = [];
            try {
                const usuarioParam = this.usuario ? encodeURIComponent(this.usuario.nombre) : '';
                const r = await fetch(`/incidentes?usuario=${usuarioParam}`);
                const todos = await r.json();
                if (r.ok && Array.isArray(todos)) {
                    this.incidentesActivos = todos;
                    this.calcularNotificaciones();
                    this.listaTickets = todos.filter(t => this.esSolicitanteDe(t));
                    this.msgVacio = 'No tienes tickets activos. Usa "Historial de tickets" para ver los cerrados.';
                } else {
                    console.error('Error /incidentes:', todos.error || todos);
                    this.msgVacio = todos.error || 'Error al cargar tus tickets.'; this.ticketsError = this.msgVacio;
                }
            } catch(e) { this.msgVacio = 'Error al cargar tus tickets.'; this.ticketsError = this.msgVacio; }
            this.cargando = false;
        },

        volverAVacio() {
            this.navegar(this.esSoporte ? 'bandeja' : 'mistickets');
        },

        async refrescarVista() {
            await this.cargarActivosBackground();
            if (this.modo === 'bandeja') await this.verBandeja();
            else if (this.modo === 'historial')  await this.verHistorial();
            else if (this.modo === 'mistickets') await this.verMisTickets();
            else if (this.modo === 'busqueda' && this.busqueda.trim()) await this.buscarEnBD(this.busqueda.trim());
        },

        // ════════════════════════════════════
        // INCIDENTE — CREATE
        // ════════════════════════════════════
        resetIncidente() {
            this.inc = { piso:'', habitacion:'', aparato:'', descripcion:'', priority_id:'', externoConfirmado:false, nombreActivo:'' };
            this.sugerenciasActivo = [];
            this.incMsg = '';
            this.manualBanner = false;
            this.manualBannerIgnorado = false;
            this.cargarPrioridades();
        },

        // ── RF-05/RF-06: carga las prioridades configuradas por el administrador ──
        async cargarPrioridades() {
            try {
                const r = await fetch('/prioridades');
                this.prioridades = await r.json();
            } catch(e) { this.prioridades = []; }
        },

        async verificarManual() {
            this.manualBanner = false;
            this.manualBannerIgnorado = false;
            this.manualUrl = '';
            if (!this.inc.aparato) return;
            if (!this.manualesCache.length) {
                try { const r = await fetch('/manuales'); this.manualesCache = await r.json(); } catch(e) {}
            }
            const norm = s => s.toLowerCase().replace(/[^a-záéíóúñ0-9]/g,'');
            const ap   = norm(this.inc.aparato);
            const found = this.manualesCache.find(m => {
                const n = norm(m.nombre);
                return n.includes(ap) || ap.includes(n.replace('.pdf',''));
            });
            if (found) { this.manualUrl = found.url; this.manualBanner = true; }
        },

        async enviarIncidente() {
            if (this.manualBanner && !this.manualBannerIgnorado) {
                this.setMsg('inc','orange','Por favor lee el manual primero, o haz clic en "Continuar igual".');
                return;
            }
            const { piso, habitacion, aparato, descripcion, priority_id, nombreActivo } = this.inc;
            if (!descripcion.trim()) return this.setMsg('inc','red','La descripción es obligatoria');
            if (descripcion.trim().length < 10) return this.setMsg('inc','red','La descripción debe tener al menos 10 caracteres.');
            if (!piso || !habitacion || !aparato) return this.setMsg('inc','red','Completa todos los campos.');
            if (!priority_id) return this.setMsg('inc','red','Selecciona un nivel de prioridad.');
            // RF-23: excepción — el nombre del activo es obligatorio para Hardware/Red
            if (this.requiereActivo && (!nombreActivo || !nombreActivo.trim())) {
                return this.setMsg('inc','red','Indica el nombre del activo/equipo para esta categoría.');
            }
            // RF-10: excepción — sin confirmación de responsabilidad externa, se mantiene bloqueado el envío
            if (this.esCategoriaExterna && !this.inc.externoConfirmado) {
                return this.setMsg('inc','red','Debes confirmar que entiendes la advertencia de responsabilidad externa.');
            }
            this.setMsg('inc','blue','Generando ticket...');
            const category_id = this.categoriaPorAparato[aparato] || 1;
            try {
                const r = await fetch('/incidente', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ creador: this.usuario.nombre, piso, habitacion, aparato, descripcion, priority_id, category_id, nombreActivo }) });
                const d = await r.json();
                if (r.ok) {
                    this.setMsg('inc','green', d.message);
                    setTimeout(() => {
                        this.modalIncidente = false;
                        this.resetIncidente();
                        this.refrescarVista();
                    }, 2000);
                } else { this.setMsg('inc','red', d.error || 'Error al crear el incidente'); }
            } catch(e) { this.setMsg('inc','red','Error de conexión'); }
        },

        // ════════════════════════════════════
        // PERFIL
        // ════════════════════════════════════
        abrirEditarPerfil() {
            this.perfil = {
                nombre:     this.usuario.nombre,
                correo:     this.usuario.correo || '',
                passActual: '', passNueva: '', codigo: '', metodo: 'actual'
            };
            this.perfilMsg = '';
            this.modalPerfil = true;
        },

        async solicitarCodigoEdicion() {
            const correo = this.perfil.correo || this.usuario.correo;
            if (!correo) return this.setMsg('perfil','red','No tienes un correo registrado.');
            this.setMsg('perfil','blue','Enviando código...');
            try {
                const r = await fetch('/recuperar-solicitar', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ rut: this.usuario.rut }) });
                const d = await r.json();
                if (r.ok) {
                    this.perfil.metodo = 'codigo';
                    this.setMsg('perfil','green','Código enviado al correo.');
                } else { this.setMsg('perfil','red', d.error); }
            } catch(e) { this.setMsg('perfil','red','Error de conexión'); }
        },

        async guardarPerfil() {
            if (!this.perfil.nombre) return this.setMsg('perfil','red','El nombre es obligatorio');
            const { nombre, correo, passActual, passNueva, codigo } = this.perfil;
            if (passNueva && !passActual && !codigo) return this.setMsg('perfil','red','Ingresa tu contraseña actual o un código.');
            if (passNueva && codigo) {
                this.setMsg('perfil','blue','Verificando código...');
                const rv = await fetch('/recuperar-verificar', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ rut: this.usuario.rut, codigo }) });
                if (!rv.ok) { const dv = await rv.json(); return this.setMsg('perfil','red', dv.error || 'Código incorrecto.'); }
            }
            this.setMsg('perfil','blue','Guardando cambios...');
            try {
                const r = await fetch('/editar-perfil', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ rut: this.usuario.rut, nombre, correo, passwordActual: passActual, passwordNueva: passNueva, codigo }) });
                const d = await r.json();
                if (r.ok) {
                    this.setMsg('perfil','green','Perfil actualizado');
                    this.usuario.nombre = nombre; this.usuario.correo = correo;
                    localStorage.setItem('usuario_actual', JSON.stringify(this.usuario));
                    setTimeout(() => { this.modalPerfil = false; }, 1500);
                } else { this.setMsg('perfil','red', d.error); }
            } catch(e) { this.setMsg('perfil','red','Error de conexión'); }
        },

        // ════════════════════════════════════
        // MANUALES
        // ════════════════════════════════════
        async abrirManuales() {
            this.manualMsg = '';
            this.modalManuales = true;
            await this.cargarManuales();
        },

        async cargarManuales() {
            this.manualCargando = true;
            try {
                const r = await fetch('/manuales');
                this.manuales = await r.json();
                this.manualesCache = [...this.manuales];
            } catch(e) { this.manuales = []; }
            this.manualCargando = false;
        },

        onDropManual(e) {
            this.dropOver = false;
            const f = e.dataTransfer.files[0];
            if (!f) return;
            this.procesarManual(f);
        },

        subirManual(e) {
            const f = e.target.files[0];
            if (!f) return;
            this.procesarManual(f);
        },

        async procesarManual(f) {
            if (f.type !== 'application/pdf') return this.setMsg('manual','red','Solo se permiten PDFs.');
            const limits=await (await fetch('/config-public')).json();
            if (f.size > limits.manual_mb*1024*1024) return this.setMsg('manual','red',`El archivo excede ${limits.manual_mb} MB.`);
            this.setMsg('manual','blue','Subiendo manual...');
            const fd = new FormData(); fd.append('manual', f);
            try {
                const r = await fetch('/manuales/subir', { method:'POST', body: fd });
                const d = await r.json();
                if (r.ok) {
                    this.setMsg('manual','green', `${d.message}`);
                    this.manualesCache = [];
                    await this.cargarManuales();
                } else { this.setMsg('manual','red', d.error || 'Error al subir'); }
            } catch(e) { this.setMsg('manual','red','Error de conexión'); }
        },

        async eliminarManual(filename) {
            const val = await this.pedirTexto('Escribe "confirmar" para eliminar este manual:');
            if (!val || val.toLowerCase() !== 'confirmar') { this.mostrarAlerta('Eliminación cancelada.'); return; }
            try {
                const r = await fetch(`/manuales/${encodeURIComponent(filename)}`, { method:'DELETE' });
                const d = await r.json();
                if (r.ok) {
                    this.setMsg('manual','green','Manual eliminado.');
                    this.manualesCache = [];
                    await this.cargarManuales();
                } else { this.setMsg('manual','red', d.error || 'Error al eliminar'); }
            } catch(e) { this.setMsg('manual','red','Error de conexión'); }
        },

        // ════════════════════════════════════
        // DETAIL WINDOW
        // ════════════════════════════════════
        async abrirDetalle(idTicket, ticketPrecargado) {
            let ticket = this.incidentesActivos.find(t => t.id_ticket === idTicket) || ticketPrecargado;
            if (!ticket) return;

            this.detTicket         = ticket;
            this.escalamiento = { jefatura_id:'', motivo:'' };
            this.escalamientoMessage = '';
            this.detComentarioNuevo = '';
            this.detMsg            = '';
            this.detNotaPrivada = '';
            this.detNotaPrivadaMsg = '';
            this.detJustificacionReapertura = '';
            this.reabrirMsg = '';
            this.reabrirLimiteAlcanzado = (ticket.reaperturas || 0) >= 3;
            this.ajustePrioridadForm = { priority_id: ticket.ticket_priority_id || '', justificacion: '' };
            this.ajustePrioridadMsg = '';
            this.materialForm = { material_id:'', cantidad:1, costo_unitario:'' };
            this.materialMsg = '';
            this.detMateriales = [];
            this.detWin.headerTitle = `TICKET: ${ticket.id_ticket} — ${ticket.aparato}`;
            if (this.prioridades.length === 0) this.cargarPrioridades();
            if ((this.puedeImputarMateriales || this.esAdmin) && this.catalogoMateriales.length === 0) this.cargarCatalogoMateriales();
            if (this.puedeImputarMateriales || this.esAdmin) this.cargarMaterialesTicket(ticket.id_ticket);
            this.verificarExternoMsg = '';
            this.verificarExternoResultado = null;
            this.reasignarForm = { nuevo_tecnico_id:'', motivo:'' };
            this.reasignarMsg = '';
            this.reasignarAdvertencia = '';
            if (this.esAdmin && this.tecnicos.length === 0) this.cargarTecnicosParaReasignar();

            try {
                const r = await fetch('/incidente/ver', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ id_ticket: idTicket, usuario: this.usuario.nombre }) });
                const d = await r.json();
                if (d.cambio) { ticket.estado = 'En curso'; this.calcularNotificaciones(); }
                if (d.notifLimpiada) { ticket.notificacion_creador = 0; this.calcularNotificaciones(); }
            } catch(e) {}

            try {
                const c = JSON.parse(ticket.comentarios || '[]');
                this.detComentarios = c;
            } catch(e) { this.detComentarios = []; }

            if (this.detWin.minimized) this.detWin.minimized = false;
            this.modalDetalle = true;
            this.$nextTick(() => {
                const area = document.getElementById('commentsArea');
                if (area) area.scrollTop = 0;
            });
        },

        cerrarDetalle() {
            this.modalDetalle = false;
            this.detWin.maximized = false;
            this.detWin.minimized = false;
            const w = document.getElementById('detailWindow');
            if (w) {
                w.style.top='50%'; w.style.left='50%';
                w.style.transform='translate(-50%,-50%)';
                w.style.width='720px'; w.style.height='86vh';
            }
        },

        toggleMaximize() { this.detWin.maximized = !this.detWin.maximized; if (this.detWin.maximized) this.detWin.minimized = false; },
        toggleMinimize() { this.detWin.minimized = !this.detWin.minimized; if (this.detWin.minimized) this.detWin.maximized = false; },

        initDrag() {
            this.$nextTick(() => {
                const header = document.getElementById('detailHeader');
                const win    = document.getElementById('detailWindow');
                if (!header || !win) return;
                let isDragging=false, sx,sy,il,it;
                header.addEventListener('mousedown', e => {
                    if (win.classList.contains('maximized') || win.classList.contains('minimized')) return;
                    isDragging = true;
                    const r = win.getBoundingClientRect();
                    win.style.transform='none'; win.style.left=r.left+'px'; win.style.top=r.top+'px';
                    sx=e.clientX; sy=e.clientY; il=r.left; it=r.top;
                });
                document.addEventListener('mousemove', e => {
                    if (!isDragging) return;
                    win.style.left=(il+(e.clientX-sx))+'px';
                    win.style.top=(it+(e.clientY-sy))+'px';
                });
                document.addEventListener('mouseup', ()=>{ isDragging=false; });
            });
        },

        // ════════════════════════════════════
        // COMENTAR
        // ════════════════════════════════════
        async publicarComentario() {
            const texto  = this.detComentarioNuevo;
            const adjRef = this.$refs.adjunto;
            const file   = adjRef && adjRef.files[0];
            if (!texto.trim() && !file) return this.setMsg('det','red','Escribe un comentario o adjunta un archivo.');
            this.setMsg('det','blue','Publicando...');
            const fd = new FormData();
            fd.append('id_ticket', this.detTicket.id_ticket);
            fd.append('usuario',   this.usuario.nombre);
            fd.append('texto',     texto);
            if (file) fd.append('archivo', file);
            try {
                if (file) {
                    const response = await fetch('/config-public');
                    const limits = await response.json();
                    if (!response.ok || !Number.isFinite(limits.upload_mb)) return this.setMsg('det','red',limits.error || 'No se pudo comprobar el tamaño permitido. Intenta nuevamente.');
                    if (file.size > limits.upload_mb*1024*1024) return this.setMsg('det','red',`El archivo excede ${limits.upload_mb} MB.`);
                }
                const r = await fetch('/incidente/comentar', { method:'POST', body: fd });
                const d = await r.json();
                if (r.ok) {
                    this.detComentarios    = d.comentarios;
                    this.detTicket.comentarios = JSON.stringify(d.comentarios);
                    this.detComentarioNuevo = '';
                    if (adjRef) adjRef.value = '';
                    this.setMsg('det','green','Publicado exitosamente.');
                    setTimeout(() => { this.detMsg=''; }, 2000);
                } else { this.setMsg('det','red', d.error || 'Error al publicar'); }
            } catch(e) { this.setMsg('det','red','Error de conexión'); }
        },

        // ════════════════════════════════════
        // TICKET ACTIONS
        // ════════════════════════════════════
        async accionTicket(tipo) {
            const id     = this.detTicket.id_ticket;
            const nombre = this.usuario.nombre;
            let endpoint, body, nuevoEstado;

            if (tipo === 'espera') {
                const info = await this.pedirTexto('Motivo para poner en espera:');
                if (!info) return;
                endpoint = '/incidente/espera'; body = { id_ticket:id, usuario:nombre, info_espera:info }; nuevoEstado='En espera';
            } else if (tipo === 'continuar') {
                endpoint = '/incidente/continuar'; body = { id_ticket:id, usuario:nombre }; nuevoEstado='En curso';
            } else if (tipo === 'cancelar') {
                const info = await this.pedirTexto('Motivo por el cual se cancela el ticket:');
                if (!info) return;
                endpoint = '/incidente/cancelar'; body = { id_ticket:id, usuario:nombre, info_cancelar:info }; nuevoEstado='Cancelado';
            } else if (tipo === 'resolver') {
                const info = await this.pedirTexto('Descripción de la resolución:');
                if (!info) return;
                endpoint = '/incidente/resolver'; body = { id_ticket:id, usuario:nombre, info_resolucion:info }; nuevoEstado='Resuelto';
            }

            this.setMsg('det','blue','Actualizando...');
            try {
                const r = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
                const d = await r.json();
                if (r.ok) {
                    this.detTicket.estado      = nuevoEstado;
                    this.detComentarios        = d.comentarios;
                    this.detTicket.comentarios = JSON.stringify(d.comentarios);
                    const idx = this.incidentesActivos.findIndex(t => t.id_ticket === id);
                    if (idx !== -1) { this.incidentesActivos[idx].estado = nuevoEstado; }
                    this.setMsg('det','green','Estado actualizado.');
                    setTimeout(() => { this.refrescarVista(); this.detMsg=''; }, 1200);
                } else { this.setMsg('det','red', d.error||'Error'); }
            } catch(e) { this.setMsg('det','red','Error de conexión'); }
        },

        // ════════════════════════════════════
        // RF-17 — NOTA TÉCNICA PRIVADA
        // ════════════════════════════════════
        async enviarNotaPrivada() {
            const texto = this.detNotaPrivada;
            if (!texto || !texto.trim()) return this.setMsg('detNotaPrivada','red','Escribe una nota antes de guardar.');

            this.setMsg('detNotaPrivada','blue','Guardando nota privada...');
            try {
                const r = await fetch('/incidente/nota-privada', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ id_ticket: this.detTicket.id_ticket, usuario: this.usuario.nombre, nota: texto }) });
                const d = await r.json();
                if (r.ok) {
                    this.detComentarios        = d.comentarios;
                    this.detTicket.comentarios = JSON.stringify(d.comentarios);
                    this.detNotaPrivada = '';
                    this.setMsg('detNotaPrivada','green','Nota técnica privada registrada.');
                    setTimeout(() => { this.detNotaPrivadaMsg=''; }, 2000);
                } else {
                    this.setMsg('detNotaPrivada','red', d.error || 'Error al guardar la nota.');
                }
            } catch(e) { this.setMsg('detNotaPrivada','red','Error de conexión'); }
        },

        // ════════════════════════════════════
        // RF-18 — REABRIR TICKET
        // ════════════════════════════════════
        async reabrirTicket() {
            const justificacion = this.detJustificacionReapertura;
            if (!justificacion || justificacion.trim().length < 10) {
                return this.setMsg('reabrir','red','La justificación debe tener al menos 10 caracteres.');
            }

            this.setMsg('reabrir','blue','Reabriendo ticket...');
            try {
                const r = await fetch('/incidente/reabrir', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ id_ticket: this.detTicket.id_ticket, usuario: this.usuario.nombre, justificacion }) });
                const d = await r.json();
                if (r.ok) {
                    this.detTicket.estado      = 'Pendiente';
                    this.detTicket.reaperturas = d.reaperturas;
                    this.detComentarios        = d.comentarios;
                    this.detTicket.comentarios = JSON.stringify(d.comentarios);
                    this.detJustificacionReapertura = '';
                    this.setMsg('reabrir','green', d.message);
                    setTimeout(() => { this.refrescarVista(); this.reabrirMsg=''; }, 1200);
                } else {
                    if (d.limiteAlcanzado) this.reabrirLimiteAlcanzado = true;
                    this.setMsg('reabrir','red', d.error || 'Error al reabrir el ticket.');
                }
            } catch(e) { this.setMsg('reabrir','red','Error de conexión'); }
        },

        // ════════════════════════════════════
        // RF-21 — AJUSTAR PRIORIDAD TÉCNICAMENTE
        // ════════════════════════════════════
        async ajustarPrioridad() {
            const { priority_id, justificacion } = this.ajustePrioridadForm;
            if (!priority_id) return this.setMsg('ajustePrioridad','red','Selecciona el nuevo nivel de prioridad.');
            if (!justificacion || justificacion.trim().length < 10) {
                return this.setMsg('ajustePrioridad','red','La justificación técnica debe tener al menos 10 caracteres.');
            }

            this.setMsg('ajustePrioridad','blue','Ajustando prioridad...');
            try {
                const r = await fetch('/incidente/ajustar-prioridad', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ id_ticket: this.detTicket.id_ticket, usuario: this.usuario.nombre, priority_id, justificacion }) });
                const d = await r.json();
                if (r.ok) {
                    this.detTicket.ticket_priority_id = priority_id;
                    this.detComentarios        = d.comentarios;
                    this.detTicket.comentarios = JSON.stringify(d.comentarios);
                    this.ajustePrioridadForm.justificacion = '';
                    this.setMsg('ajustePrioridad','green', d.message);
                    setTimeout(() => { this.ajustePrioridadMsg=''; }, 2500);
                } else {
                    this.setMsg('ajustePrioridad','red', d.error || 'Error al ajustar la prioridad.');
                }
            } catch(e) { this.setMsg('ajustePrioridad','red','Error de conexión'); }
        },

        // ════════════════════════════════════
        // RF-24 — MATERIALES CONSUMIDOS
        // ════════════════════════════════════
        async cargarCatalogoMateriales() {
            try {
                const r = await fetch('/materiales');
                this.catalogoMateriales = await r.json();
            } catch(e) { this.catalogoMateriales = []; }
        },

        async cargarMaterialesTicket(idTicket) {
            try {
                const r = await fetch(`/incidente/${idTicket}/materiales`);
                this.detMateriales = await r.json();
            } catch(e) { this.detMateriales = []; }
        },

        onSeleccionMaterial() {
            const m = this.catalogoMateriales.find(x => x.material_id == this.materialForm.material_id);
            this.materialForm.costo_unitario = m ? m.costo_unitario_referencia : '';
        },

        get costoTotalMaterialPreview() {
            const cant = Number(this.materialForm.cantidad) || 0;
            const costo = Number(this.materialForm.costo_unitario) || 0;
            return cant * costo;
        },

        async registrarMaterial() {
            const { material_id, cantidad, costo_unitario } = this.materialForm;
            if (!material_id) return this.setMsg('material','red','Selecciona un insumo del catálogo.');
            if (!cantidad || Number(cantidad) <= 0) return this.setMsg('material','red','Ingresa una cantidad válida.');
            if (costo_unitario === '' || Number(costo_unitario) < 0) return this.setMsg('material','red','Ingresa un costo unitario válido.');

            this.setMsg('material','blue','Registrando material...');
            try {
                const r = await fetch('/incidente/materiales', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ id_ticket: this.detTicket.id_ticket, usuario: this.usuario.nombre, material_id, cantidad, costo_unitario }) });
                const d = await r.json();
                if (r.ok) {
                    this.setMsg('material', d.requiereAprobacion ? 'orange' : 'green', d.message);
                    this.materialForm = { material_id:'', cantidad:1, costo_unitario:'' };
                    await this.cargarMaterialesTicket(this.detTicket.id_ticket);
                } else {
                    this.setMsg('material','red', d.error || 'Error al registrar el material.');
                }
            } catch(e) { this.setMsg('material','red','Error de conexión'); }
        },

        async aprobarMaterial(id) {
            try {
                const r = await fetch(`/materiales-usados/${id}/aprobar`, { method:'PUT' });
                const d = await r.json();
                if (r.ok) await this.cargarMaterialesTicket(this.detTicket.id_ticket);
                this.setMsg('material', r.ok ? 'green' : 'red', d.message || d.error);
            } catch(e) { this.setMsg('material','red','Error de conexión'); }
        },

        // ════════════════════════════════════
        // ESTADÍSTICAS
        // ════════════════════════════════════
        async abrirEstadisticas() {
            this.modalStats    = true;
            this.statsCargando = true;
            this.statsError    = false;
            Object.values(this.chartsStats).forEach(c => { try { Alpine.raw(c).destroy(); } catch(e){} });
            this.chartsStats = {};
            try {
                const r = await fetch('/estadisticas');
                if (!r.ok) throw new Error();
                const d = await r.json();
                this.statsCargando = false;
                await this.$nextTick();
                if (this.modalStats) this.renderStats(d);
            } catch(e) {
                this.statsCargando = false;
                this.statsError    = true;
            }
        },

        cerrarStats() {
            this.modalStats = false;
            Object.values(this.chartsStats).forEach(c => { try { Alpine.raw(c).destroy(); } catch(e){} });
            this.chartsStats = {};
        },

        // ════════════════════════════════════
        // RF-05 — PRIORIDADES Y SLA
        // ════════════════════════════════════
        async abrirPrioridades() {
            this.resetPrioridadForm();
            this.modalPrioridades = true;
            await this.cargarPrioridades();
        },

        resetPrioridadForm() {
            this.prioridadForm = { priority_id: null, priority_name: '', sla_hours: '', color_hex: '#3d5a80' };
            this.prioridadMsg = '';
        },

        editarPrioridad(p) {
            this.prioridadForm = { priority_id: p.priority_id, priority_name: p.priority_name, sla_hours: p.sla_hours, color_hex: p.color_hex };
            this.prioridadMsg = '';
        },

        async guardarPrioridad() {
            const { priority_id, priority_name, sla_hours, color_hex } = this.prioridadForm;

            if (!priority_name || !priority_name.trim()) {
                return this.setMsg('prioridad', 'red', 'El nombre de la prioridad es obligatorio.');
            }
            // Excepción: Tiempo negativo → el sistema bloquea la actualización
            if (sla_hours === '' || isNaN(Number(sla_hours)) || Number(sla_hours) <= 0) {
                return this.setMsg('prioridad', 'red', 'El tiempo de SLA no puede ser negativo, cero o vacío.');
            }

            this.setMsg('prioridad', 'blue', 'Guardando configuración...');
            try {
                const url    = priority_id ? `/prioridades/${priority_id}` : '/prioridades';
                const method = priority_id ? 'PUT' : 'POST';
                const r = await fetch(url, {
                    method, headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ priority_name: priority_name.trim(), sla_hours: Number(sla_hours), color_hex })
                });
                const d = await r.json();
                if (r.ok) {
                    this.setMsg('prioridad', 'green', d.message);
                    this.resetPrioridadForm();
                    await this.cargarPrioridades();
                } else {
                    this.setMsg('prioridad', 'red', d.error || 'Error al guardar la prioridad.');
                }
            } catch (e) { this.setMsg('prioridad', 'red', 'Error de conexión'); }
        },

        // ════════════════════════════════════
        // RF-06 — MATRIZ CATEGORÍA VS PRIORIDAD
        // ════════════════════════════════════
        async abrirMatriz() {
            this.modalMatriz = true;
            this.matrizMsg = '';
            await this.cargarPrioridades();
            try {
                const [rCat, rTec, rMat] = await Promise.all([
                    fetch('/categorias'), fetch('/tecnicos'), fetch('/matriz-categorias')
                ]);
                this.categorias = await rCat.json();
                this.tecnicos   = await rTec.json();
                const matrizExistente = await rMat.json();

                this.matrizForm = {};
                matrizExistente.forEach(m => {
                    this.matrizForm[m.category_id + '_' + m.priority_id] = m.preferred_user_id || '';
                });
            } catch (e) {
                this.categorias = []; this.tecnicos = []; this.matriz = [];
            }
        },

        async guardarMatriz(category_id, priority_id) {
            const preferred_user_id = this.matrizForm[category_id + '_' + priority_id] || null;
            this.setMsg('matriz', 'blue', 'Actualizando matriz...');
            try {
                const r = await fetch('/matriz-categorias', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ category_id, priority_id, preferred_user_id })
                });
                const d = await r.json();
                if (r.ok) this.setMsg('matriz', 'green', d.message);
                else this.setMsg('matriz', 'red', d.error || 'Error al actualizar la matriz.');
            } catch (e) { this.setMsg('matriz', 'red', 'Error de conexión'); }
        },

        async marcarTecnicoCritico(user_id, critico) {
            this.setMsg('matriz', 'blue', 'Actualizando Técnico Crítico...');
            try {
                const r = await fetch(`/tecnicos/${user_id}/critico`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ critico })
                });
                const d = await r.json();
                if (r.ok) {
                    this.setMsg('matriz', 'green', d.message);
                    const rTec = await fetch('/tecnicos');
                    this.tecnicos = await rTec.json();
                } else {
                    this.setMsg('matriz', 'red', d.error || 'Error al actualizar.');
                }
            } catch (e) { this.setMsg('matriz', 'red', 'Error de conexión'); }
        },

        // ════════════════════════════════════
        // RF-12 — REPORTES Y KPIs
        // ════════════════════════════════════
        async abrirReportesKPI() {
            this.modalReportesKPI = true;
            await this.cargarPrioridades();
            await this.cargarKPI();
        },

        async cargarKPI() {
            this.kpiCargando = true;
            this.kpiSinDatos = false;
            if (this.kpiChart) { try { Alpine.raw(this.kpiChart).destroy(); } catch(e){} this.kpiChart = null; }

            const params = new URLSearchParams();
            if (this.kpiFiltros.desde)       params.append('desde', this.kpiFiltros.desde);
            if (this.kpiFiltros.hasta)       params.append('hasta', this.kpiFiltros.hasta);
            if (this.kpiFiltros.area)        params.append('area', this.kpiFiltros.area);
            if (this.kpiFiltros.priority_id) params.append('priority_id', this.kpiFiltros.priority_id);

            try {
                const r = await fetch('/reportes/kpi?' + params.toString());
                const d = await r.json();
                this.kpiCargando = false;

                if (d.sinDatos) {
                    this.kpiSinDatos = true;
                    this.kpiData = null;
                    return;
                }

                this.kpiData = d;
                await this.$nextTick();
                if (this.modalReportesKPI) this.renderKPIChart(d.porPrioridad);
            } catch (e) {
                this.kpiCargando = false;
                this.kpiSinDatos = true;
                this.kpiData = null;
            }
        },

        renderKPIChart(porPrioridad) {
            const ctx = document.getElementById('chartKpiPrioridad');
            if (!ctx) return;
            this.kpiChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: porPrioridad.map(p => p.priority_name),
                    datasets: [{
                        label: '% Cumplimiento SLA',
                        data: porPrioridad.map(p => p.pctCumplimiento),
                        backgroundColor: porPrioridad.map(p => p.color_hex || '#3d5a80')
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true, max: 100 } }
                }
            });
        },

        // ════════════════════════════════════
        // RF-13 — EXPORTAR REPORTE CONSOLIDADO
        // ════════════════════════════════════
        async exportarReporte(formato) {
            this.exportMsg = ''; this.exportMsgColor = 'blue'; this.exportMsg = 'Compilando archivo...';
            try {
                const r = await fetch('/reportes/exportar', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        usuario: this.usuario.nombre,
                        formato,
                        desde: this.kpiFiltros.desde,
                        hasta: this.kpiFiltros.hasta,
                        area: this.kpiFiltros.area,
                        priority_id: this.kpiFiltros.priority_id
                    })
                });

                if (!r.ok) {
                    const d = await r.json();
                    this.exportMsgColor = 'red';
                    this.exportMsg = d.error || 'No fue posible compilar el archivo. Descarga bloqueada.';
                    return;
                }

                const blob = await r.blob();
                const extensiones = { excel: 'xlsx', csv: 'csv', pdf: 'pdf' };
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `reporte_kpi.${extensiones[formato]}`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);

                this.exportMsgColor = 'green';
                this.exportMsg = 'Archivo descargado correctamente.';
                setTimeout(() => { this.exportMsg = ''; }, 2500);
            } catch (e) {
                this.exportMsgColor = 'red';
                this.exportMsg = 'Error de conexión al exportar.';
            }
        },

        // ════════════════════════════════════
        // RF-14 — VENTANA OPERATIVA
        // ════════════════════════════════════
        async abrirHorarioOperativo() {
            this.modalHorarioOperativo = true;
            this.horarioMsg = '';
            try {
                const r = await fetch('/horario-operativo');
                const d = await r.json();
                this.horarioForm = { hora_inicio: d.hora_inicio, hora_fin: d.hora_fin };
                this.horarioCorreosEncolados = d.correosEncolados;
            } catch (e) {
                this.setMsg('horario', 'red', 'Error al cargar la configuración.');
            }
        },

        async guardarHorarioOperativo() {
            const { hora_inicio, hora_fin } = this.horarioForm;
            const formatoValido = /^([01]\d|2[0-3]):([0-5]\d)$/;

            // Excepción: Formato inválido → se bloquea la actualización
            if (!formatoValido.test(hora_inicio) || !formatoValido.test(hora_fin)) {
                return this.setMsg('horario', 'red', 'El rango horario debe tener formato HH:mm válido.');
            }

            this.setMsg('horario', 'blue', 'Actualizando ventana operativa...');
            try {
                const r = await fetch('/horario-operativo', {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ hora_inicio, hora_fin })
                });
                const d = await r.json();
                if (r.ok) this.setMsg('horario', 'green', d.message);
                else this.setMsg('horario', 'red', d.error || 'Error al actualizar.');
            } catch (e) { this.setMsg('horario', 'red', 'Error de conexión'); }
        },

        async procesarColaCorreos() {
            this.setMsg('horario', 'blue', 'Procesando cola de correos...');
            try {
                const r = await fetch('/horario-operativo/procesar-cola', { method: 'POST' });
                const d = await r.json();
                this.setMsg('horario', r.ok ? 'green' : 'red', d.message || d.error);
                const r2 = await fetch('/horario-operativo');
                const d2 = await r2.json();
                this.horarioCorreosEncolados = d2.correosEncolados;
            } catch (e) { this.setMsg('horario', 'red', 'Error de conexión'); }
        },

        // ════════════════════════════════════
        // RF-25 — INVENTARIO CONSOLIDADO
        // ════════════════════════════════════
        async abrirInventarioConsolidado() {
            this.modalInventario = true;
            this.inventarioExportMsg = '';
            await this.cargarInventarioConsolidado();
        },

        async cargarInventarioConsolidado() {
            this.inventarioCargando = true;
            this.inventarioSinDatos = false;
            const params = new URLSearchParams();
            if (this.inventarioFiltros.desde) params.append('desde', this.inventarioFiltros.desde);
            if (this.inventarioFiltros.hasta) params.append('hasta', this.inventarioFiltros.hasta);
            try {
                const r = await fetch('/reportes/materiales?' + params.toString());
                const d = await r.json();
                this.inventarioCargando = false;
                if (d.sinDatos) { this.inventarioSinDatos = true; this.inventarioData = null; return; }
                d.porInsumo.forEach(g => g._abierto = false);
                this.inventarioData = d;
            } catch(e) {
                this.inventarioCargando = false;
                this.inventarioSinDatos = true;
                this.inventarioData = null;
            }
        },

        async exportarInventarioConsolidado() {
            this.inventarioExportMsgColor = 'blue'; this.inventarioExportMsg = 'Compilando archivo...';
            try {
                const r = await fetch('/reportes/materiales/exportar', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usuario: this.usuario.nombre, desde: this.inventarioFiltros.desde, hasta: this.inventarioFiltros.hasta })
                });
                if (!r.ok) {
                    const d = await r.json();
                    this.inventarioExportMsgColor = 'red';
                    this.inventarioExportMsg = d.error || 'No fue posible compilar el archivo.';
                    return;
                }
                const blob = await r.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'inventario_consolidado.xlsx';
                document.body.appendChild(a); a.click(); a.remove();
                window.URL.revokeObjectURL(url);
                this.inventarioExportMsgColor = 'green';
                this.inventarioExportMsg = 'Archivo descargado correctamente.';
                setTimeout(() => { this.inventarioExportMsg = ''; }, 2500);
            } catch(e) {
                this.inventarioExportMsgColor = 'red';
                this.inventarioExportMsg = 'Error de conexión al exportar.';
            }
        },

        // ════════════════════════════════════
        // RF-29 — MONITOREO AUTOMÁTICO DE VENCIMIENTO SLA
        // ════════════════════════════════════
        async abrirMonitoreoSLA() {
            this.modalMonitoreoSLA = true;
            await this.cargarTicketsRiesgoSLA();
            // Refresco periódico mientras el modal está abierto (vigilancia "en tiempo real")
            this.monitoreoSLAIntervalo = setInterval(() => this.cargarTicketsRiesgoSLA(), 30000);
        },

        cerrarMonitoreoSLA() {
            this.modalMonitoreoSLA = false;
            if (this.monitoreoSLAIntervalo) { clearInterval(this.monitoreoSLAIntervalo); this.monitoreoSLAIntervalo = null; }
        },

        async cargarTicketsRiesgoSLA() {
            this.monitoreoSLACargando = true;
            try {
                const r = await fetch('/tickets/riesgo-sla');
                this.ticketsRiesgoSLA = await r.json();
            } catch(e) { this.ticketsRiesgoSLA = []; }
            this.monitoreoSLACargando = false;
        },

        // ════════════════════════════════════
        // RF-33 — REPORTES AUTOMÁTICOS A GERENCIA
        // ════════════════════════════════════
        async abrirReportesProgramados() {
            this.modalReportesProgramados = true;
            this.reporteProgramadoMsg = '';
            try {
                const r = await fetch('/reportes-programados');
                const d = await r.json();
                this.reporteProgramadoForm = {
                    destinatarios: d.destinatarios || '', periodicidad: d.periodicidad || 'Semanal',
                    activo: d.activo == 1, ultima_ejecucion: d.ultima_ejecucion
                };
            } catch(e) { this.setMsg('reporteProgramado','red','Error al cargar la configuración.'); }
        },

        async guardarReporteProgramado() {
            const { destinatarios, periodicidad, activo } = this.reporteProgramadoForm;
            this.setMsg('reporteProgramado','blue','Guardando configuración...');
            try {
                const r = await fetch('/reportes-programados', {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ destinatarios, periodicidad, activo })
                });
                const d = await r.json();
                this.setMsg('reporteProgramado', r.ok ? 'green' : 'red', d.message || d.error);
            } catch(e) { this.setMsg('reporteProgramado','red','Error de conexión'); }
        },

        async enviarReporteProgramadoAhora() {
            this.setMsg('reporteProgramado','blue','Generando y enviando reporte...');
            try {
                const r = await fetch('/reportes-programados/enviar-ahora', { method:'POST' });
                const d = await r.json();
                this.setMsg('reporteProgramado', r.ok ? 'green' : 'red', d.message || d.error);
                if (r.ok) this.reporteProgramadoForm.ultima_ejecucion = d.ultima_ejecucion;
            } catch(e) { this.setMsg('reporteProgramado','red','Error de conexión'); }
        },

        // ════════════════════════════════════
        // RF-45 — CALENDARIO OPERATIVO (FERIADOS)
        // ════════════════════════════════════
        async abrirFeriados() {
            this.modalFeriados = true;
            this.feriadoForm = { fecha:'', nombre:'' };
            this.feriadoMsg = '';
            await this.cargarFeriados();
        },

        async cargarFeriados() {
            try {
                const r = await fetch('/feriados');
                this.feriados = await r.json();
            } catch(e) { this.feriados = []; }
        },

        async guardarFeriado() {
            const { fecha, nombre } = this.feriadoForm;
            if (!fecha) return this.setMsg('feriado','red','Selecciona una fecha.');
            if (!nombre || !nombre.trim()) return this.setMsg('feriado','red','Ingresa el nombre del feriado.');

            this.setMsg('feriado','blue','Guardando feriado...');
            try {
                const r = await fetch('/feriados', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ fecha, nombre: nombre.trim() }) });
                const d = await r.json();
                if (r.ok) {
                    this.setMsg('feriado','green', d.message);
                    this.feriadoForm = { fecha:'', nombre:'' };
                    await this.cargarFeriados();
                } else {
                    this.setMsg('feriado','red', d.error || 'Error al guardar el feriado.');
                }
            } catch(e) { this.setMsg('feriado','red','Error de conexión'); }
        },

        async eliminarFeriado(id) {
            try {
                const r = await fetch(`/feriados/${id}`, { method:'DELETE' });
                if (r.ok) await this.cargarFeriados();
            } catch(e) {}
        },

        // ════════════════════════════════════
        // RF-47 — INTEGRACIONES EXTERNAS
        // ════════════════════════════════════
        async abrirIntegracionExterna() {
            this.modalIntegracionExterna = true;
            this.integracionExternaMsg = '';
            try {
                const r = await fetch('/configuracion-externa');
                const d = await r.json();
                this.integracionExternaForm.external_endpoint_url = d.external_endpoint_url || '';
            } catch(e) { this.setMsg('integracionExterna','red','Error al cargar la configuración.'); }
        },

        async guardarIntegracionExterna() {
            this.setMsg('integracionExterna','blue','Guardando...');
            try {
                const r = await fetch('/configuracion-externa', { method:'PUT', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ external_endpoint_url: this.integracionExternaForm.external_endpoint_url.trim() }) });
                const d = await r.json();
                this.setMsg('integracionExterna', r.ok ? 'green' : 'red', d.message || d.error);
            } catch(e) { this.setMsg('integracionExterna','red','Error de conexión'); }
        },

        async verificarConexionExterna() {
            this.verificarExternoMsgColor = 'blue'; this.verificarExternoMsg = 'Probando conexión...';
            this.verificarExternoResultado = null;
            try {
                const r = await fetch('/incidente/verificar-externo', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ id_ticket: this.detTicket.id_ticket, usuario: this.usuario.nombre }) });
                const d = await r.json();
                if (r.ok) {
                    this.verificarExternoResultado = d.resultado;
                    this.verificarExternoMsgColor = d.resultado.exito ? 'green' : 'red';
                    this.verificarExternoMsg = d.resultado.exito
                        ? `Conexión OK (${d.resultado.tiempoMs}ms).`
                        : `Falló la conexión: ${d.resultado.error}`;
                    this.detComentarios = d.comentarios;
                    this.detTicket.comentarios = JSON.stringify(d.comentarios);
                } else {
                    this.verificarExternoMsgColor = 'red';
                    this.verificarExternoMsg = d.error;
                }
            } catch(e) { this.verificarExternoMsgColor='red'; this.verificarExternoMsg = 'Error de conexión'; }
        },

        // ════════════════════════════════════
        // RF-48 — ETIQUETA QR
        // ════════════════════════════════════
        async imprimirEtiquetaQR() {
            const ventana = window.open('', '_blank', 'width=300,height=250');
            if (!ventana) return this.setMsg('det','red','Permite las ventanas emergentes para imprimir o descarga la etiqueta en PDF.');
            try {
                const rQr = await fetch(`/incidente/${this.detTicket.id_ticket}/qr`);
                if (!rQr.ok) throw new Error('No se pudo obtener el QR');
                const dQr = await rQr.json();
                ventana.document.write(`
                    <html><head><title>Etiqueta ${this.detTicket.id_ticket}</title></head>
                    <body style="text-align:center;font-family:sans-serif;padding:10px">
                        <p style="font-weight:bold;margin:4px">${this.detTicket.id_ticket}</p>
                        <img src="${dQr.qr}" style="width:150px;height:150px">
                        <p style="font-size:10px;color:#666">Clínica Aconcagua — Soporte Técnico</p>
                        <script>window.onload=()=>window.print();<\/script>
                    </body></html>
                `);
                ventana.document.close();
                await fetch('/incidente/etiqueta/registrar', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ id_ticket: this.detTicket.id_ticket, usuario: this.usuario.nombre }) });
            } catch(e) { ventana.close(); this.setMsg('det','red','No fue posible generar la etiqueta. Intenta descargarla en PDF.'); }
        },

        // Excepción: impresora no configurada → se descarga la etiqueta en PDF
        async descargarEtiquetaPDF() {
            try {
                const r = await fetch(`/incidente/${this.detTicket.id_ticket}/etiqueta-pdf?usuario=${encodeURIComponent(this.usuario.nombre)}`);
                if (!r.ok) { const d = await r.json(); return this.setMsg('det','red', d.error || 'Error generando la etiqueta.'); }
                const blob = await r.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `etiqueta_${this.detTicket.id_ticket}.pdf`;
                document.body.appendChild(a); a.click(); a.remove();
                window.URL.revokeObjectURL(url);
            } catch(e) { this.setMsg('det','red','Error de conexión al descargar la etiqueta.'); }
        },

        // ════════════════════════════════════
        // RF-52 — STOCK DE REPUESTOS
        // ════════════════════════════════════
        async abrirStockInsumos() {
            this.modalStockInsumos = true;
            this.stockMsg = '';
            await this.cargarStockInsumos();
        },

        async cargarStockInsumos() {
            try {
                const r = await fetch('/insumos/stock');
                this.stockInsumos = await r.json();
            } catch(e) { this.stockInsumos = []; }
        },

        async registrarEntradaStock() {
            const { material_id, cantidad } = this.stockEntradaForm;
            if (!material_id) return this.setMsg('stock','red','Selecciona un insumo.');
            if (!cantidad || Number(cantidad) <= 0) return this.setMsg('stock','red','Ingresa una cantidad válida.');

            this.setMsg('stock','blue','Registrando entrada...');
            try {
                const r = await fetch('/insumos/entrada', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ material_id, cantidad, usuario: this.usuario.nombre }) });
                const d = await r.json();
                if (r.ok) {
                    this.setMsg('stock','green', d.message);
                    this.stockEntradaForm = { material_id:'', cantidad:1 };
                    await this.cargarStockInsumos();
                } else {
                    this.setMsg('stock','red', d.error || 'Error al registrar la entrada.');
                }
            } catch(e) { this.setMsg('stock','red','Error de conexión'); }
        },

        // ════════════════════════════════════
        // RF-53 — REASIGNACIÓN FORZADA
        // ════════════════════════════════════
        async cargarTecnicosParaReasignar() {
            try {
                const r = await fetch('/tecnicos');
                this.tecnicos = await r.json();
            } catch(e) { this.tecnicos = []; }
        },

        async reasignarTicketForzado(confirmar) {
            const { nuevo_tecnico_id, motivo } = this.reasignarForm;
            if (!nuevo_tecnico_id) return this.setMsg('reasignar','red','Selecciona un técnico.');
            if (!motivo || !motivo.trim()) return this.setMsg('reasignar','red','Indica el motivo del cambio.');

            this.setMsg('reasignar','blue','Reasignando...');
            this.reasignarAdvertencia = '';
            try {
                const r = await fetch('/incidente/reasignar', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ id_ticket: this.detTicket.id_ticket, usuario: this.usuario.nombre, nuevo_tecnico_id, motivo, confirmar: !!confirmar }) });
                const d = await r.json();
                if (r.ok) {
                    this.detTicket.tecnico_asignado = this.tecnicos.find(t => t.user_id == nuevo_tecnico_id)?.first_name;
                    this.detTicket.assigned_user_id = Number(nuevo_tecnico_id);
                    this.detComentarios = d.comentarios;
                    this.detTicket.comentarios = JSON.stringify(d.comentarios);
                    this.reasignarForm = { nuevo_tecnico_id:'', motivo:'' };
                    this.setMsg('reasignar','green', d.message);
                } else if (d.advertencia) {
                    this.reasignarAdvertencia = d.error;
                    this.reasignarMsg = '';
                } else {
                    this.setMsg('reasignar','red', d.error || 'Error al reasignar.');
                }
            } catch(e) { this.setMsg('reasignar','red','Error de conexión'); }
        },

        // ════════════════════════════════════
        // RF-55 — MAPA DE CALOR
        // ════════════════════════════════════
        async abrirMapaCalor() {
            this.modalMapaCalor = true;
            if (this.categorias.length === 0) {
                try { const r = await fetch('/categorias'); this.categorias = await r.json(); } catch(e) { this.categorias = []; }
            }
            await this.cargarMapaCalor();
        },

        async cargarMapaCalor() {
            this.mapaCalorCargando = true;
            const params = this.mapaCalorFiltroCategoria ? `?category_id=${this.mapaCalorFiltroCategoria}` : '';
            try {
                const r = await fetch('/reportes/mapa-calor' + params);
                this.mapaCalorData = await r.json();
            } catch(e) { this.mapaCalorData = []; }
            this.mapaCalorCargando = false;
        },

        intensidadColor(total, max) {
            if (max === 0) return '#eee';
            const pct = total / max;
            const r = Math.round(255 - pct * 45);
            const g = Math.round(230 - pct * 180);
            const b = Math.round(230 - pct * 200);
            return `rgb(${r},${g},${b})`;
        },

        // ════════════════════════════════════
        // RF-57 — DESCARGAR ADJUNTOS EN ZIP
        // ════════════════════════════════════
        async descargarAdjuntosZip() {
            this.adjuntosZipMsgColor = 'blue'; this.adjuntosZipMsg = 'Compilando archivo...';
            try {
                const r = await fetch(`/incidente/${this.detTicket.id_ticket}/adjuntos-zip`);
                if (!r.ok) {
                    const d = await r.json();
                    this.adjuntosZipMsgColor = 'red';
                    this.adjuntosZipMsg = d.error || 'No fue posible compilar los adjuntos.';
                    return;
                }
                const blob = await r.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `adjuntos_${this.detTicket.id_ticket}.zip`;
                document.body.appendChild(a); a.click(); a.remove();
                window.URL.revokeObjectURL(url);
                this.adjuntosZipMsgColor = 'green';
                this.adjuntosZipMsg = 'Archivo descargado correctamente.';
                setTimeout(() => { this.adjuntosZipMsg = ''; }, 2500);
            } catch(e) {
                this.adjuntosZipMsgColor = 'red';
                this.adjuntosZipMsg = 'Error de conexión al compilar los adjuntos.';
            }
        },

        // ════════════════════════════════════
        // RF-60 — DESEMPEÑO POR TÉCNICO
        // ════════════════════════════════════
        async abrirDesempeno() {
            this.modalDesempeno = true;
            this.desempenoData = null;
            this.desempenoMsg = '';
            if (this.tecnicos.length === 0) await this.cargarTecnicosParaReasignar();
        },

        async cargarDesempenoTecnico() {
            if (!this.desempenoTecnicoId) return;
            this.desempenoMsg = 'Cargando...';
            this.desempenoData = null;
            try {
                const r = await fetch(`/reportes/desempeno-tecnico?user_id=${this.desempenoTecnicoId}`);
                const d = await r.json();
                if (r.ok) { this.desempenoData = d; this.desempenoMsg = ''; }
                else this.desempenoMsg = d.error || 'Error al cargar el informe.';
            } catch(e) { this.desempenoMsg = 'Error de conexión'; }
        },

        // ════════════════════════════════════
        // RF-64 — QR DE ACTIVOS (generación) + prellenado al escanear
        // ════════════════════════════════════
        abrirQrActivos() {
            this.modalQrActivos = true;
            this.qrActivoBusqueda = '';
            this.qrActivoSugerencias = [];
            this.qrActivoSeleccionado = null;
            this.qrActivoDataUrl = '';
        },

        async buscarActivoParaQr() {
            const q = this.qrActivoBusqueda;
            if (!q || q.trim().length < 2) { this.qrActivoSugerencias = []; return; }
            try {
                const r = await fetch(`/equipos/sugerencias-completas?q=${encodeURIComponent(q.trim())}`);
                this.qrActivoSugerencias = await r.json();
            } catch(e) { this.qrActivoSugerencias = []; }
        },

        async generarQrActivo(equipmentId) {
            try {
                const r = await fetch(`/equipos/${equipmentId}/qr`);
                const d = await r.json();
                if (r.ok) {
                    this.qrActivoSeleccionado = d.nombre;
                    this.qrActivoDataUrl = d.qr;
                    this.qrActivoSugerencias = [];
                    this.qrActivoBusqueda = d.nombre;
                }
            } catch(e) {}
        },

        imprimirQrActivo() {
            const ventana = window.open('', '_blank', 'width=300,height=250');
            if (!ventana) return window.alert('Permite las ventanas emergentes del navegador para imprimir el QR.');
            ventana.document.write(`
                <html><head><title>QR ${this.qrActivoSeleccionado}</title></head>
                <body style="text-align:center;font-family:sans-serif;padding:10px">
                    <p style="font-weight:bold;margin:4px">${this.qrActivoSeleccionado}</p>
                    <img src="${this.qrActivoDataUrl}" style="width:150px;height:150px">
                    <p style="font-size:10px;color:#666">Escanea para reportar una falla en este equipo</p>
                    <script>window.onload=()=>window.print();<\/script>
                </body></html>
            `);
            ventana.document.close();
        },

        // Se ejecuta al cargar la app: si viene ?equipo=ID en la URL, prellena el formulario de incidente
        async precargarDesdeQrEquipo() {
            const params = new URLSearchParams(window.location.search);
            const equipoId = params.get('equipo');
            if (!equipoId) return;
            try {
                const r = await fetch(`/equipos/${equipoId}`);
                if (!r.ok) return; // Excepción: QR no reconocido → se deja el formulario de creación manual normal
                const d = await r.json();
                this.resetIncidente();
                this.inc.nombreActivo = d.equipment_name;
                // La ubicación se guarda como "Piso - Habitación"; se separa para prellenar ambos campos
                const partes = (d.location || '').split(' - ');
                this.inc.piso = partes[0] ? partes[0].trim() : '';
                this.inc.habitacion = partes[1] ? partes[1].trim() : (d.location || '');
                this.inc.aparato = d.equipment_type || '';
                this.modalIncidente = true;
            } catch(e) { /* QR no reconocido: no se hace nada, queda el flujo manual normal */ }
        },

        // ════════════════════════════════════
        // GESTIÓN DE EQUIPOS (alta manual desde la interfaz)
        // ════════════════════════════════════
        async abrirEquipos() {
            this.modalEquipos = true;
            this.equipoForm = { equipment_name:'', piso:'', habitacion:'', equipment_type:'' };
            this.equipoMsg = '';
            await this.cargarListaEquipos();
        },

        async cargarListaEquipos() {
            try {
                const r = await fetch('/equipos');
                this.listaEquipos = await r.json();
            } catch(e) { this.listaEquipos = []; }
        },

        async guardarEquipo() {
            const { equipment_name, piso, habitacion, equipment_type } = this.equipoForm;
            if (!equipment_name || !equipment_name.trim()) return this.setMsg('equipo','red','El nombre del equipo es obligatorio.');
            if (!piso || !habitacion || !habitacion.trim()) return this.setMsg('equipo','red','Indica el piso y la habitación/área.');
            if (!equipment_type) return this.setMsg('equipo','red','Selecciona el tipo de equipo.');

            this.setMsg('equipo','blue','Guardando...');
            try {
                const r = await fetch('/equipos', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ equipment_name: equipment_name.trim(), piso, habitacion: habitacion.trim(), equipment_type }) });
                const d = await r.json();
                if (r.ok) {
                    this.setMsg('equipo','green', d.message);
                    this.equipoForm = { equipment_name:'', piso:'', habitacion:'', equipment_type:'' };
                    await this.cargarListaEquipos();
                } else {
                    this.setMsg('equipo','red', d.error || 'Error al guardar el equipo.');
                }
            } catch(e) { this.setMsg('equipo','red','Error de conexión'); }
        },

        async eliminarEquipo(id) {
            try {
                const r = await fetch(`/equipos/${id}`, { method:'DELETE' });
                const d = await r.json();
                if (r.ok) await this.cargarListaEquipos();
                else this.setMsg('equipo','red', d.error);
            } catch(e) { this.setMsg('equipo','red','Error de conexión'); }
        },

        renderStats(d) {
            // Tarjetas
            const total = Object.values(d.porEstado).reduce((a,b)=>a+b,0);
            const cards = [
                { label:'Total tickets', valor:total,                       color:'#2c3e50', bg:'#ecf0f1' },
                { label:'En curso',      valor:d.porEstado['En curso']||0,  color:'#007bff', bg:'#e8f4ff' },
                { label:'Pendientes',    valor:d.porEstado['Pendiente']||0, color:'#fd7e14', bg:'#fff3e6' },
                { label:'En espera',     valor:d.porEstado['En espera']||0, color:'#e0a800', bg:'#fff8e6' },
                { label:'Resueltos',     valor:d.porEstado['Resuelto']||0,  color:'#28a745', bg:'#e8f8ed' },
                { label:'Cancelados',    valor:d.porEstado['Cancelado']||0, color:'#6c757d', bg:'#f0f1f2' },
            ];
            document.getElementById('statsCards').innerHTML = cards.map(c =>
                `<div class="stats-card" style="border-top-color:${c.color};background:${c.bg}">
                    <div class="val" style="color:${c.color}">${c.valor}</div>
                    <div class="lbl">${c.label}</div>
                </div>`).join('');

            const PAL_D = ['#3266ad','#e07b39','#28a745','#9c27b0','#ffc107','#dc3545','#17a2b8','#6c757d'];
            const PAL_B = ['#3d5a80','#5ba49b','#fd7e14','#7c4dff','#00bcd4','#e91e63'];
            const mkChart = (id,type,labels,data,opts={}) => {
                const ctx = document.getElementById(id);
                if (!ctx) return;
                this.chartsStats[id] = new Chart(ctx, { type, data: { labels, datasets:[{ data, ...opts }] },
                    options: { responsive:true, maintainAspectRatio:false,
                        plugins:{ legend:{ position:'right', labels:{ font:{size:11}, boxWidth:12, padding:8 } } } } });
            };

            mkChart('chartAparato','doughnut', Object.keys(d.porAparato), Object.values(d.porAparato),
                { backgroundColor:PAL_D, borderWidth:2, borderColor:'#fff' });
            mkChart('chartEstado','pie', Object.keys(d.porEstado), Object.values(d.porEstado),
                { backgroundColor: Object.keys(d.porEstado).map(k => ({'En curso':'#007bff','En espera':'#ffc107','Resuelto':'#28a745','Cancelado':'#6c757d','Pendiente':'#fd7e14'}[k]||'#999')),
                  borderWidth:2, borderColor:'#fff' });

            const pisoCtx = document.getElementById('chartPiso');
            if (pisoCtx) {
                this.chartsStats['chartPiso'] = new Chart(pisoCtx, { type:'bar',
                    data:{ labels:Object.keys(d.porPiso), datasets:[{ label:'Incidentes', data:Object.values(d.porPiso), backgroundColor:'#5ba49b', borderRadius:6, borderSkipped:false }] },
                    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
                        scales:{ y:{beginAtZero:true,ticks:{stepSize:1,font:{size:11}}}, x:{ticks:{font:{size:11},autoSkip:false,maxRotation:35}} } } });
            }

            const sorted = Object.entries(d.porCreador).sort((a,b)=>b[1]-a[1]).slice(0,6);
            const crCtx  = document.getElementById('chartCreador');
            if (crCtx) {
                this.chartsStats['chartCreador'] = new Chart(crCtx, { type:'bar',
                    data:{ labels:sorted.map(e=>e[0]), datasets:[{ label:'Tickets', data:sorted.map(e=>e[1]), backgroundColor:PAL_B, borderRadius:6, borderSkipped:false }] },
                    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
                        scales:{ x:{beginAtZero:true,ticks:{stepSize:1,font:{size:11}}}, y:{ticks:{font:{size:11}}} } } });
            }

            const wrap = document.getElementById('wrapSemanas');
            if (!d.semanasResueltas || !d.semanasResueltas.length) {
                if (wrap) wrap.innerHTML='<p style="color:#888;text-align:center;margin-top:60px;font-size:13px">Sin datos aún.</p>';
            } else {
                if (wrap && !document.getElementById('chartSemanas')) wrap.innerHTML='<canvas id="chartSemanas"></canvas>';
                const semCtx = document.getElementById('chartSemanas');
                if (semCtx) {
                    this.chartsStats['chartSemanas'] = new Chart(semCtx, { type:'line',
                        data:{ labels:d.semanasResueltas.map(s=>s.semana), datasets:[{ label:'Resueltos', data:d.semanasResueltas.map(s=>s.total),
                            fill:true, backgroundColor:'rgba(40,167,69,.12)', borderColor:'#28a745',
                            pointBackgroundColor:'#28a745', pointRadius:5, tension:.35, borderWidth:2.5 }] },
                        options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
                            scales:{ y:{beginAtZero:true,ticks:{stepSize:1,font:{size:11}}}, x:{ticks:{font:{size:11},autoSkip:false,maxRotation:35}} } } });
                }
            }
        },

        // ════════════════════════════════════
        // PDF EXPORT
        // ════════════════════════════════════
        async exportarPDF() {
            const ticket = this.detTicket;
            if (!ticket) return;
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
            const W=210, H=297, mx=15, cw=W-mx*2;
            let y=20;
            const ensureSpace = height => { if(y+height>H-20){doc.addPage();y=20;} };
            const writeLines = (lines, x=mx, step=5) => {
                for (const line of lines) { ensureSpace(step); doc.text(line,x,y); y+=step; }
            };

            doc.setFillColor(44,62,80); doc.rect(0,0,W,28,'F');
            doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont('helvetica','bold');
            doc.text('TICKETERA CLÍNICA ACONCAGUA', W/2,11,{align:'center'});
            doc.setFontSize(10); doc.setFont('helvetica','normal');
            doc.text('Bitácora de Seguimiento de Ticket', W/2,19,{align:'center'});
            doc.setFontSize(8);
            doc.text(`Generado el: ${new Date().toLocaleString('es-CL')}`, W/2,25,{align:'center'});

            y=36; doc.setTextColor(0,0,0);
            doc.setFillColor(240,244,248); doc.rect(mx,y-4,cw,42,'F');
            doc.setDrawColor(200,210,220); doc.rect(mx,y-4,cw,42,'S');
            doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(44,62,80);
            doc.text(`${ticket.id_ticket}  —  ${ticket.aparato}`, mx+4,y+3);

            const estado = ticket.estado||'En curso';
            const ec = {'En curso':[0,123,255],'En espera':[255,193,7],'Resuelto':[40,167,69],'Cancelado':[108,117,125],'Pendiente':[253,126,20]};
            doc.setFillColor(...(ec[estado]||[100,100,100]));
            doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold');
            doc.roundedRect(W-mx-30,y-2,28,8,3,3,'F');
            doc.text(estado.toUpperCase(),W-mx-16,y+3,{align:'center'});

            doc.setTextColor(80,80,80); doc.setFont('helvetica','normal'); doc.setFontSize(9); y+=12;
            [['Creador',ticket.creador],['Fecha creación',ticket.fecha],
             ['Ubicación',`${ticket.piso||'S/I'} — ${ticket.habitacion||'S/I'}`],
             ['Técnico',ticket.tecnico_asignado||'Sin asignar']].forEach(([l,v])=>{
                doc.setFont('helvetica','bold'); doc.text(`${l}:`,mx+4,y);
                doc.setFont('helvetica','normal'); doc.text(v||'—',mx+42,y); y+=6; });

            y+=4; doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.text('Descripción:',mx,y); y+=5;
            doc.setFont('helvetica','normal');
            const dl = doc.splitTextToSize(ticket.descripcion||'—',cw);
            writeLines(dl); y+=6;

            ensureSpace(16);
            doc.setFillColor(44,62,80); doc.rect(mx,y,cw,8,'F');
            doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(10);
            doc.text('Bitácora de Seguimiento',mx+4,y+5.5); y+=12;

            const comentarios = this.detComentarios;
            if (!comentarios.length) {
                doc.setTextColor(150,150,150); doc.setFont('helvetica','italic'); doc.setFontSize(9);
                doc.text('Sin actualizaciones registradas.',mx,y);
            } else {
                for (const c of comentarios) {
                    const esBit = c.texto && c.texto.startsWith('📋 Cambio de estado:');
                    const imgM  = c.texto && c.texto.match(/<img\s+src="([^"]+)"/i);
                    const imgSrc= imgM ? imgM[1] : null;
                    const parsed = new DOMParser().parseFromString((c.texto||'').replace(/<br\s*\/?\s*>/gi,'\n'),'text/html');
                    // Helvetica cannot encode emoji: preserve readable text and attachment labels.
                    const clean = (parsed.body.textContent||'').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[—–]/g,'-').replace(/→/g,' -> ').replace(/[^\x20-\x7E\u00A0-\u00FF\n\r\t]/gu,'').trim();
                    doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
                    const lines = clean ? doc.splitTextToSize(clean,cw-12) : [];
                    let alto = lines.length ? (8+lines.length*4.5+4) : 14;
                    let imgData=null, imgW=0, imgH=0;
                    if (imgSrc) {
                        try {
                            imgData = await this.loadImgB64(imgSrc);
                            const info = await this.imgDims(imgSrc);
                            const ratio=info.w/info.h, maxH=70, maxW=cw-8;
                            imgW=Math.min(maxW,ratio*maxH); imgH=imgW/ratio;
                            if(imgH>maxH){imgH=maxH;imgW=imgH*ratio;}
                            alto+=imgH+4;
                        } catch(e){imgData=null;}
                    }
                    // Split long updates into bounded blocks; one comment may span several pages.
                    const pending = [...lines];
                    do {
                    ensureSpace(23);
                    const capacity = Math.max(1, Math.floor((H-20-y-14)/4.5));
                    const chunk = pending.splice(0,capacity);
                    const showImage = !pending.length && imgData && y+14+chunk.length*4.5+imgH+4<=H-20;
                    alto = 14+chunk.length*4.5+(showImage?imgH+4:0);
                    doc.setFillColor(esBit?240:248,esBit?240:249,esBit?240:250);
                    doc.setDrawColor(esBit?150:0,esBit?150:123,esBit?150:255);
                    doc.setLineWidth(.4); doc.rect(mx,y,cw,alto,'FD');
                    doc.setFillColor(esBit?108:0,esBit?117:123,esBit?125:255); doc.rect(mx,y,2.5,alto,'F');
                    doc.setTextColor(100,100,100); doc.setFont('helvetica','bold'); doc.setFontSize(7.5);
                    doc.text(`${c.usuario}   —   ${c.fecha}`,mx+6,y+5);
                    let yi=y+10;
                    if(chunk.length){doc.setTextColor(50,50,50);doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.text(chunk,mx+6,yi,{lineHeightFactor:1.5});yi+=chunk.length*4.5+2;}
                    if(showImage){doc.addImage(imgData,'JPEG',mx+6,yi,imgW,imgH);imgData=null;}
                    y+=alto+3;
                    if(pending.length){doc.addPage();y=20;}
                    } while(pending.length);
                    if(imgData){ensureSpace(imgH+6);doc.addImage(imgData,'JPEG',mx+6,y,imgW,imgH);y+=imgH+6;}
                }
            }

            const tp = doc.internal.getNumberOfPages();
            for(let i=1;i<=tp;i++){
                doc.setPage(i);doc.setFontSize(7);doc.setTextColor(150,150,150);doc.setFont('helvetica','normal');
                doc.text('Clínica Aconcagua — Panel de Operaciones',mx,H-8);
                doc.text(`Pág. ${i} / ${tp}`,W-mx,H-8,{align:'right'});
            }
            doc.save(`Bitacora_${ticket.id_ticket}.pdf`);
        },

        loadImgB64(src) {
            return new Promise((res,rej)=>{
                const img=new Image(); img.crossOrigin='anonymous';
                img.onload=()=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);try{res(c.toDataURL('image/jpeg',.85));}catch(e){rej(e);}};
                img.onerror=rej;
                img.src=src.startsWith('http')?src:(location.origin+src+'?t='+Date.now());
            });
        },

        imgDims(src) {
            return new Promise((res,rej)=>{
                const img=new Image();img.onload=()=>res({w:img.naturalWidth,h:img.naturalHeight});img.onerror=rej;
                img.src=src.startsWith('http')?src:(location.origin+src);
            });
        },
    });
}
