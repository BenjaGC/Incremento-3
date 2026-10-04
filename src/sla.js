// El plazo incluye las pausas ya completadas; el porcentaje solo consume tiempo activo.
module.exports=function consumedSLA(ticket,now=Date.now()){
 const created=new Date(ticket.creation_date).getTime();
 const deadline=new Date(ticket.sla_deadline_efectivo).getTime();
 const paused=Number(ticket.sla_paused_seconds||0)*1000;
 const reference=ticket.status_id===2&&ticket.pausa_inicio?new Date(ticket.pausa_inicio).getTime():now;
 const duration=deadline-created-paused;
 if(!Number.isFinite(duration)||duration<=0)return 0;
 return Math.max(0,Math.min(999,(reference-created-paused)/duration*100));
};
