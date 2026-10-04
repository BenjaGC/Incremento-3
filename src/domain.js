// El subtipo identifica a la persona; las capacidades heredadas se conservan por compatibilidad.
class Usuario {
 constructor(row){this.row=row;}
 obtenerPermisos(){return {admin:false,soporte:false};}
 puedeAtender(){return false;}
 static desde(row){return row.admin?new Administrador(row):row.is_critical_tech?new TecnicoCritico(row):row.tipo_usuario==='TECNICO'?new TecnicoBasico(row):new Solicitante(row);}
}
class Solicitante extends Usuario {}
class Tecnico extends Usuario {
 obtenerPermisos(){return {admin:false,soporte:true};}
 puedeAtender(categoryId,categories){return !this.row.en_vacaciones&&this.row.user_status!==0&&(!this.row.competencies_configured||categories.includes(categoryId));}
}
class TecnicoBasico extends Tecnico {}
class TecnicoCritico extends Tecnico {}
class Administrador extends Usuario {
 obtenerPermisos(){return {admin:true,soporte:true};}
 // Los administradores existentes también pueden atender tickets: no se retira ese permiso.
 puedeAtender(categoryId,categories){return Tecnico.prototype.puedeAtender.call(this,categoryId,categories);}
}
class EstadoTicket {
 siguientesPermitidos(){return [];}
 puedeTransitar(action){return this.siguientesPermitidos().includes(action);}
 static desde(id){const Type={5:Pendiente,1:EnProceso,2:EnEspera,3:Cancelado,4:Resuelto,6:Cerrado}[id];return Type?new Type():new EstadoTicket();}
}
class Pendiente extends EstadoTicket {siguientesPermitidos(){return ['ver','cancelar'];}}
class Asignado extends Pendiente {}
class EnProceso extends EstadoTicket {siguientesPermitidos(){return ['espera','cancelar','resolver'];}}
class EnEspera extends EstadoTicket {siguientesPermitidos(){return ['espera','continuar','cancelar'];}}
class Cancelado extends EstadoTicket {}
class Resuelto extends EstadoTicket {siguientesPermitidos(){return ['cerrar'];}}
class Cerrado extends EstadoTicket {}
class Archivado extends EstadoTicket {}
class TareaProgramada {
 constructor(operation){this.operation=operation;}
 async ejecutar(){throw Error('Tarea abstracta');}
}
class T_DepuracionBD extends TareaProgramada {ejecutar(){return this.operation();}}
class T_MantenimientoTablas extends TareaProgramada {ejecutar(){return this.operation();}}
class T_IngestaCorreo extends TareaProgramada {ejecutar(){return this.operation();}}
class T_SincronizacionLDAP extends TareaProgramada {ejecutar(){return this.operation();}}
class T_CierreAutomatico extends TareaProgramada {ejecutar(){return this.operation();}}
class T_MonitoreoSLA extends TareaProgramada {ejecutar(){return this.operation();}}
class Notificacion {
 constructor(transport){this.transport=transport;}
 enviar(){throw Error('Notificación abstracta');}
}
class NotificacionCorreo extends Notificacion {enviar(message){return this.transport(message);}}
class NotificacionInApp extends Notificacion {enviar(message){return this.transport(message);}}
class NotificacionWhatsApp extends Notificacion {enviar(message){return this.transport(message);}}
module.exports={Usuario,Solicitante,Tecnico,TecnicoBasico,TecnicoCritico,Administrador,EstadoTicket,Pendiente,Asignado,EnProceso,EnEspera,Cancelado,Resuelto,Cerrado,Archivado,TareaProgramada,T_DepuracionBD,T_MantenimientoTablas,T_IngestaCorreo,T_SincronizacionLDAP,T_CierreAutomatico,T_MonitoreoSLA,Notificacion,NotificacionCorreo,NotificacionInApp,NotificacionWhatsApp};
