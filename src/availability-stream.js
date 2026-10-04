const { WebSocketServer, WebSocket } = require('ws');

module.exports = function attachAvailability(server, { pool, snapshot, log }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/api/v3/availability/live') return socket.destroy();
    let validOrigin=true;try{validOrigin=!req.headers.origin||new URL(req.headers.origin).host===req.headers.host;}catch{validOrigin=false;}
    if (!validOrigin) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  wss.on('connection', ws => {
    let token, busy = false;
    const timeout = setTimeout(() => ws.close(4401, 'Autenticación requerida'), 5000);
    const send = async () => {
      if (!token || busy || ws.readyState !== WebSocket.OPEN) return;
      busy = true;
      try {
        const [[u]] = await pool.query(`SELECT u.user_id FROM user u WHERE u.session_token=? AND u.user_status=1 AND u.must_reset_password=0 AND u.last_login>DATE_SUB(NOW(),INTERVAL 8 HOUR) AND EXISTS(SELECT 1 FROM user_role r WHERE r.user_id=u.user_id AND r.role_id=1 AND r.active=1)`, [token]);
        if (!u) { ws.close(4403, 'Acceso denegado'); return; }
        ws.send(JSON.stringify({ type: 'availability', data: await snapshot() }));
      } catch (error) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type:'sync-error', message:'Sin sincronización. Se conserva la última actualización válida.' }));
        await log(error,'error',{operation:'availability-stream'}).catch(()=>{});
      } finally { busy = false; }
    };
    ws.on('message', raw => {
      if (token) return;
      try { const msg=JSON.parse(raw); if(msg.type!=='auth'||typeof msg.token!=='string'||msg.token.length>256) throw Error(); token=msg.token;clearTimeout(timeout);send(); }
      catch { ws.close(4401,'Autenticación inválida'); }
    });
    const timer=setInterval(send,15000);
    ws.on('error',()=>{});
    ws.on('close',()=>{clearTimeout(timeout);clearInterval(timer);});
  });
  server.on('close',()=>{for(const ws of wss.clients)ws.terminate();wss.close();});
  return wss;
};
