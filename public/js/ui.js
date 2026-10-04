// Presentación de Alpine: conserva los métodos y endpoints de negocio de app.js.
function withClinicUI(state) {
    return Object.defineProperties(state, Object.getOwnPropertyDescriptors(Object.defineProperties(clinicUI(),Object.getOwnPropertyDescriptors(clinicIncrement3()))));
}
function clinicUI() {
    return {
        sidebarOpen: false,
        filtroEstado: '', filtroPrioridad: '', filtroArea: '', filtroTecnico: '',
        ticketsError: '',
        modalUsuariosCSV:false, csvBusy:false, csvMessage:'', csvErrors:[],
        backupBusy:false, backupMessage:'', escalamiento:{jefatura_id:'',motivo:''}, escalamientoMessage:'',
        async importarUsuariosCSV() {
            const file=this.$refs.usuariosCSV?.files[0];
            if(!file){this.csvMessage='Selecciona un archivo CSV.';return;}
            this.csvBusy=true;this.csvMessage='Importando…';this.csvErrors=[];
            try{const body=new FormData();body.append('archivo',file);const r=await fetch('/usuarios/importar-csv',{method:'POST',headers:{Authorization:'Bearer '+this.usuario.token},body});const d=await r.json();this.csvMessage=d.message||d.error;this.csvErrors=d.errores||[];}
            catch(e){this.csvMessage='No se pudo conectar con el servidor.';}finally{this.csvBusy=false;}
        },
        async respaldoManual() {
            this.backupBusy=true;this.backupMessage='Preparando respaldo SQL…';
            try{const r=await fetch('/admin/respaldo',{method:'POST',headers:{Authorization:'Bearer '+this.usuario.token}});if(!r.ok){const d=await r.json();throw Error(d.error);}
                const url=URL.createObjectURL(await r.blob());const a=document.createElement('a');a.href=url;a.download='clinica-respaldo-'+new Date().toISOString().slice(0,10)+'.sql';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.backupMessage='Respaldo descargado. Contiene datos y credenciales de usuarios; guárdalo de forma privada.';
            }catch(e){this.backupMessage=e.message;}finally{this.backupBusy=false;}
        },
        async escalarJefatura() {
            this.escalamientoMessage='Registrando escalamiento…';
            try{const r=await fetch('/incidente/escalar',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+this.usuario.token},body:JSON.stringify({id_ticket:this.detTicket.id_ticket,...this.escalamiento})});const d=await r.json();this.escalamientoMessage=d.message||d.error;}
            catch(e){this.escalamientoMessage='No se pudo conectar con el servidor.';}
        },
        filtroRapido: 'todos',
        get inicialesPerfil() { return (this.usuario?.nombre || '').split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase(); },
        get esSoporte() { return !!(this.usuario && (this.usuario.permisos === 'si' || this.usuario.esCritico || this.usuario.esTecnico)); },
        get tituloVista() {
            if (this.modalPanelAdmin) return 'Administración';
            return { bandeja: 'Bandeja de soporte', mistickets: 'Mis tickets', historial: 'Historial de tickets', busqueda: 'Resultados de búsqueda' }[this.modo] || 'Centro de soporte';
        },
        get ticketsFiltrados() {
            return this.listaTickets.filter(t => (this.filtroRapido === 'todos' || (this.filtroRapido === 'asignados' && this.esTecnicoDe(t)) || (this.filtroRapido === 'sin-asignar' && !t.assigned_user_id) || (this.filtroRapido === 'sla' && t.alerta_75_enviada==1)) && (!this.filtroEstado || t.estado === this.filtroEstado)
                && (!this.filtroPrioridad || String(t.ticket_priority_id) === this.filtroPrioridad)
                && (!this.filtroArea || (t.habitacion || t.habitacion_ticket) === this.filtroArea)
                && (!this.filtroTecnico || (t.tecnico_asignado || 'Sin asignar') === this.filtroTecnico));
        },
        get areasVista() { return [...new Set(this.listaTickets.map(t => t.habitacion || t.habitacion_ticket).filter(Boolean))].sort(); },
        get tecnicosVista() { return [...new Set(this.listaTickets.map(t => t.tecnico_asignado || 'Sin asignar'))].sort(); },
        get prioridadesVista() { return [...new Set(this.listaTickets.map(t => t.ticket_priority_id).filter(Boolean))]; },
        get hayFiltros() { return !!(this.filtroEstado || this.filtroPrioridad || this.filtroArea || this.filtroTecnico || this.filtroRapido !== 'todos'); },
        limpiarFiltros() { this.filtroEstado = ''; this.filtroPrioridad = ''; this.filtroArea = ''; this.filtroTecnico = ''; this.filtroRapido = 'todos'; },
        nombrePrioridad(id) { return this.prioridades.find(p => String(p.priority_id) === String(id))?.priority_name || (id ? `Prioridad ${id}` : 'Sin prioridad'); },
        contarEstado(estado) { return this.listaTickets.filter(t => t.estado === estado).length; },
        fechaSLA(t) {
            if (!t.sla_deadline) return 'Sin plazo';
            const fecha = new Date(t.sla_deadline);
            return Number.isNaN(fecha.getTime()) ? 'Sin plazo' : new Intl.DateTimeFormat('es-CL', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }).format(fecha);
        },
        async navegar(vista) {
            this.sidebarOpen = false; this.profileOpen = false; this.modalPanelAdmin = false;
            this.limpiarFiltros(); this.ticketsError = '';
            if (vista === 'admin') { if (this.usuario?.permisos === 'si') this.modalPanelAdmin = true; return; }
            if (vista === 'historial') return this.verHistorial();
            if (vista === 'mistickets') return this.verMisTickets();
            return this.verBandeja();
        },
        async verBandeja() {
            if (!this.usuario) return;
            if (!this.esSoporte) return this.verMisTickets();
            this.modo = 'bandeja'; this.busqueda = ''; this.cargando = true; this.ticketsError = '';
            try {
                const r = await fetch(`/incidentes?usuario=${encodeURIComponent(this.usuario.nombre)}`);
                const datos = await r.json();
                if (!r.ok || !Array.isArray(datos)) throw new Error(datos.error || 'No se pudo cargar la bandeja.');
                this.incidentesActivos = datos; this.calcularNotificaciones();
                this.listaTickets = this.usuario.permisos === 'si' ? datos : datos.filter(t => this.esTecnicoDe(t) || this.esSolicitanteDe(t));
            } catch (e) { this.listaTickets = []; this.ticketsError = 'No se pudieron cargar los tickets. Comprueba la conexión e intenta nuevamente.'; }
            finally { this.cargando = false; }
        },
        initUI() {
            this.$watch('usuario', user => {
                if (user) { this.navegar(this.esSoporte ? 'bandeja' : 'mistickets'); this.cargarPrioridades(); }
                else { this.modalPanelAdmin = false; this.sidebarOpen = false; }
            });
            if (this.usuario) { this.navegar(this.esSoporte ? 'bandeja' : 'mistickets'); this.cargarPrioridades(); }
        }
    };
}

// Accesibilidad de los formularios y diálogos existentes, incluidos templates.
document.addEventListener('DOMContentLoaded', () => {
    let nextId = 0;
    const enhance = () => {
        document.querySelectorAll('input:not([data-labeled]),select:not([data-labeled]),textarea:not([data-labeled])').forEach(control => {
            control.dataset.labeled = 'true';
            const previous = control.previousElementSibling;
            let label = control.closest('label') || (previous?.tagName === 'LABEL' ? previous : null);
            const names = {'login.rut':'RUT','login.pass':'Contraseña','reg.nombre':'Nombre completo','reg.rut':'RUT','reg.correo':'Correo electrónico (opcional)','reg.pass':'Contraseña','rec.rut':'RUT','rec.codigo':'Código de verificación','rec.nueva':'Nueva contraseña','rec.confirmar':'Confirmar contraseña'};
            const name = names[control.getAttribute('x-model')];
            if (!label && name) {
                label = document.createElement('label'); label.textContent = name;
                const target = control.closest('.rut-wrap') || control;
                target.before(label);
            }
            if (label) { control.id ||= `clinic-field-${++nextId}`; label.htmlFor = control.id; }
            else if (!control.getAttribute('aria-label') && !control.labels?.length) {
                control.setAttribute('aria-label', control.getAttribute('placeholder') || control.getAttribute('title') || control.getAttribute('x-model')?.split('.').pop() || 'Seleccionar archivo');
            }
        });
        document.querySelectorAll('.close-btn:not([aria-label])').forEach(el => el.setAttribute('aria-label', 'Cerrar'));
        document.querySelectorAll('.modal-overlay,.stats-overlay,.session-overlay').forEach(el => {
            el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true');
            if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', el.querySelector('.modal-title,.stats-header,h2')?.textContent.trim() || 'Detalle');
        });
    };
    enhance();
    new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
    let lastDialog = null, restoreFocus = null;
    const visibleDialog = () => [...document.querySelectorAll('[role="dialog"]')].filter(el => el.getClientRects().length).sort((a,b) => (+getComputedStyle(a).zIndex || 0) - (+getComputedStyle(b).zIndex || 0)).at(-1);
    const focusable = el => [...el.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(item => !item.disabled && item.getClientRects().length);
    new MutationObserver(() => {
        const dialog = visibleDialog();
        document.body.classList.toggle('has-dialog', !!dialog);
        if (dialog === lastDialog) return;
        if (dialog) { restoreFocus = document.activeElement; lastDialog = dialog; focusable(dialog)[0]?.focus({ preventScroll: true }); }
        else { lastDialog = null; if (restoreFocus?.isConnected) restoreFocus.focus({ preventScroll: true }); }
    }).observe(document.body, { attributes:true, attributeFilter:['style'], subtree:true });
    document.addEventListener('keydown', event => {
        const dialog = visibleDialog();
        if (dialog && event.key === 'Escape') {
            dialog.querySelector('.close-btn,.stats-header button')?.click();
            return;
        }
        if (!dialog || event.key !== 'Tab') return;
        const items = focusable(dialog), first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus({ preventScroll: true }); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus({ preventScroll: true }); }
    });
});
