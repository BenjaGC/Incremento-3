class Reporte { redondear(valor,decimales=1){return Number(Number(valor).toFixed(decimales));} generar(){throw Error('Reporte abstracto');} }
class ReporteKPI extends Reporte { generar(filas){
        let sumaMinutos = 0;
        let cumplidos = 0;
        const agrupadoPrioridad = {};

        filas.forEach(f => {
            sumaMinutos += f.minutos_resolucion;
            const horasResolucion = f.minutos_resolucion / 60;
            const cumpleSla = f.cumple_sla === undefined ? horasResolucion <= f.sla_hours : Number(f.cumple_sla) === 1;
            if (cumpleSla) cumplidos++;

            if (!agrupadoPrioridad[f.priority_id]) {
                agrupadoPrioridad[f.priority_id] = {
                    priority_name: f.priority_name,
                    color_hex: f.color_hex,
                    total: 0,
                    cumplidos: 0,
                    sumaMinutos: 0
                };
            }
            agrupadoPrioridad[f.priority_id].total++;
            agrupadoPrioridad[f.priority_id].sumaMinutos += f.minutos_resolucion;
            if (cumpleSla) agrupadoPrioridad[f.priority_id].cumplidos++;
        });

        const porPrioridad = Object.values(agrupadoPrioridad).map(p => ({
            priority_name: p.priority_name,
            color_hex: p.color_hex,
            total: p.total,
            cumplidos: p.cumplidos,
            pctCumplimiento: Number(((p.cumplidos / p.total) * 100).toFixed(1)),
            mttrHoras: Number((p.sumaMinutos / p.total / 60).toFixed(1))
        }));

        return ({
            sinDatos: false,
            totalTickets: filas.length,
            mttrHoras: Number((sumaMinutos / filas.length / 60).toFixed(1)),
            cumplimientoSlaPct: Number(((cumplidos / filas.length) * 100).toFixed(1)),
            porPrioridad
        });

}}
class ReporteFinanciero extends Reporte { generar(movimientos){
        const agrupado = {};
        let totalGastado = 0;
        movimientos.forEach(m => {
            totalGastado += Number(m.costo_total);
            if (!agrupado[m.insumo]) {
                agrupado[m.insumo] = { insumo: m.insumo, cantidadTotal: 0, costoAcumulado: 0, movimientos: [] };
            }
            agrupado[m.insumo].cantidadTotal += m.cantidad;
            agrupado[m.insumo].costoAcumulado += Number(m.costo_total);
            agrupado[m.insumo].movimientos.push(m);
        });

        const porInsumo = Object.values(agrupado).map(g => ({
            insumo: g.insumo,
            cantidadTotal: g.cantidadTotal,
            costoAcumulado: Number(g.costoAcumulado.toFixed(2)),
            costoPromedio: Number((g.costoAcumulado / g.cantidadTotal).toFixed(2)),
            movimientos: g.movimientos
        }));

        return ({
            sinDatos: false,
            totalGastado: Number(totalGastado.toFixed(2)),
            totalMovimientos: movimientos.length,
            porInsumo,
            movimientos
        });

}}
class ReporteDesempeno extends Reporte { generar(data){return {...data,promedioHoras:this.redondear(data.promedioHoras),promedioEquipoHoras:this.redondear(data.promedioEquipoHoras)};} }
module.exports={Reporte,ReporteKPI,ReporteFinanciero,ReporteDesempeno};
