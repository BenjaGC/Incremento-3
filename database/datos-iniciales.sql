-- Catálogos básicos NUEVOS para una base vacía, no datos recuperados.
-- Ejecutado únicamente en la instalación local creada para este proyecto.
INSERT INTO role (role_id, role_name) VALUES (1, 'Admin'), (2, 'Usuario');
INSERT INTO status (status_id, status_name, is_closed) VALUES
  (1, 'En curso', 0), (2, 'En espera', 0), (3, 'Cancelado', 1),
  (4, 'Resuelto', 1), (5, 'Pendiente', 0);
INSERT INTO priority (priority_id, priority_name, sla_hours, color_hex) VALUES
  (1, 'Normal', 24, '#3498db'), (2, 'Urgente', 4, '#e74c3c');
INSERT INTO category (category_id, category_name) VALUES (1, 'Computador/Hardware'), (2, 'Impresora'), (3, 'Teléfono IP'), (4, 'Sistema/Software'), (5, 'Red/Internet'), (6, 'Sistema Externo (ej. IMER)');
INSERT INTO operating_hours (operating_hours_id) VALUES (1);
INSERT INTO system_config (config_id) VALUES (1);
INSERT INTO scheduled_report (config_id, destinatarios, activo) VALUES (1, '', 0);
