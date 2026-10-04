-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: mydb
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `attachment`
--

DROP TABLE IF EXISTS `attachment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attachment` (
  `attachment_id` int NOT NULL AUTO_INCREMENT,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  `file_size_mb` decimal(10,2) DEFAULT NULL,
  `upload_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `upload_by_user_id` int NOT NULL,
  `ticket_id` int NOT NULL,
  PRIMARY KEY (`attachment_id`),
  KEY `fk_attachment_ticket1_idx` (`ticket_id`),
  KEY `upload_by_user_id_idx` (`upload_by_user_id`),
  CONSTRAINT `fk_attachment_ticket1` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`ticket_id`),
  CONSTRAINT `fk_attachment_user` FOREIGN KEY (`upload_by_user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `audit_log`
--

DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_log` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `action_type` varchar(100) NOT NULL,
  `affected_table` varchar(100) NOT NULL,
  `affected_record_id` int DEFAULT NULL,
  `previous_value` text,
  `new_value` text,
  `ip_address` varchar(45) DEFAULT NULL,
  `browser_info` varchar(255) DEFAULT NULL,
  `action_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user_id` int NOT NULL,
  `ticket_id` int NOT NULL,
  PRIMARY KEY (`log_id`),
  KEY `fk_audit_log_user1_idx` (`user_id`),
  KEY `fk_audit_log_ticket1_idx` (`ticket_id`),
  CONSTRAINT `fk_audit_log_ticket1` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`ticket_id`),
  CONSTRAINT `fk_audit_log_user1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `auto_close_log`
--

DROP TABLE IF EXISTS `auto_close_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auto_close_log` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` int NOT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `category`
--

DROP TABLE IF EXISTS `category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `category` (
  `category_id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) NOT NULL,
  `description` text,
  `default_sla_hours` int NOT NULL DEFAULT '24',
  `is_active` tinyint NOT NULL DEFAULT '1',
  `creation_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`category_id`),
  UNIQUE KEY `category_name_UNIQUE` (`category_name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `category_priority_matrix`
--

DROP TABLE IF EXISTS `category_priority_matrix`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `category_priority_matrix` (
  `matrix_id` int NOT NULL AUTO_INCREMENT,
  `category_id` int NOT NULL,
  `priority_id` int NOT NULL,
  `preferred_user_id` int DEFAULT NULL,
  PRIMARY KEY (`matrix_id`),
  UNIQUE KEY `uniq_cat_prior` (`category_id`,`priority_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `comment`
--

DROP TABLE IF EXISTS `comment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `comment` (
  `comment_id` int NOT NULL AUTO_INCREMENT,
  `content` text NOT NULL,
  `comment_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_internal` tinyint NOT NULL DEFAULT '0',
  `user_id` int NOT NULL,
  `ticket_id` int NOT NULL,
  `is_private` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`comment_id`),
  KEY `fk_comment_user1_idx` (`user_id`),
  KEY `fk_comment_ticket1_idx` (`ticket_id`),
  CONSTRAINT `fk_comment_ticket1` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`ticket_id`),
  CONSTRAINT `fk_comment_user1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=164 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `email_queue`
--

DROP TABLE IF EXISTS `email_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_queue` (
  `queue_id` int NOT NULL AUTO_INCREMENT,
  `destinatario` varchar(255) NOT NULL,
  `asunto` varchar(255) NOT NULL,
  `html_body` longtext NOT NULL,
  `encolado_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `enviado` tinyint(1) NOT NULL DEFAULT '0',
  `enviado_date` datetime DEFAULT NULL,
  PRIMARY KEY (`queue_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `equipment`
--

DROP TABLE IF EXISTS `equipment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `equipment` (
  `equipment_id` int NOT NULL AUTO_INCREMENT,
  `equipment_name` varchar(100) NOT NULL,
  `equipment_type` varchar(50) NOT NULL,
  `model` varchar(100) DEFAULT NULL,
  `serial_number` varchar(100) DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  `warranty_expiration` date DEFAULT NULL,
  `location` varchar(100) DEFAULT NULL,
  `is_active` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`equipment_id`),
  UNIQUE KEY `serial_number_UNIQUE` (`serial_number`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `export_log`
--

DROP TABLE IF EXISTS `export_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `export_log` (
  `export_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `formato` varchar(10) NOT NULL,
  `exito` tinyint(1) NOT NULL DEFAULT '1',
  `export_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`export_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `external_integration_log`
--

DROP TABLE IF EXISTS `external_integration_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `external_integration_log` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` int NOT NULL,
  `endpoint` varchar(255) NOT NULL,
  `tiempo_respuesta_ms` int DEFAULT NULL,
  `exito` tinyint(1) NOT NULL DEFAULT '0',
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `holiday_exception`
--

DROP TABLE IF EXISTS `holiday_exception`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `holiday_exception` (
  `holiday_id` int NOT NULL AUTO_INCREMENT,
  `fecha` date NOT NULL,
  `nombre` varchar(100) NOT NULL,
  PRIMARY KEY (`holiday_id`),
  UNIQUE KEY `fecha` (`fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `insumo_catalogo`
--

DROP TABLE IF EXISTS `insumo_catalogo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `insumo_catalogo` (
  `material_id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) NOT NULL,
  `costo_unitario_referencia` decimal(10,2) NOT NULL DEFAULT '0.00',
  `stock_actual` int NOT NULL DEFAULT '0',
  `stock_minimo` int NOT NULL DEFAULT '5',
  PRIMARY KEY (`material_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `insumo_entrada`
--

DROP TABLE IF EXISTS `insumo_entrada`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `insumo_entrada` (
  `entrada_id` int NOT NULL AUTO_INCREMENT,
  `material_id` int NOT NULL,
  `cantidad` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`entrada_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `label_print_log`
--

DROP TABLE IF EXISTS `label_print_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `label_print_log` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `formato` varchar(10) NOT NULL DEFAULT 'print',
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `material`
--

DROP TABLE IF EXISTS `material`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `material` (
  `material_id` int NOT NULL AUTO_INCREMENT,
  `material_name` varchar(100) NOT NULL,
  `description` text,
  `stock` int NOT NULL DEFAULT '0',
  `minimum_stock` int NOT NULL DEFAULT '0',
  `unit_measure` varchar(20) NOT NULL DEFAULT 'unidad',
  `unit_cost` decimal(10,2) DEFAULT NULL,
  `is_active` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`material_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `material_used`
--

DROP TABLE IF EXISTS `material_used`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `material_used` (
  `material_used_id` int NOT NULL AUTO_INCREMENT,
  `quantity` int NOT NULL DEFAULT '1',
  `usage_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `comment` varchar(255) DEFAULT NULL,
  `observation` text,
  `registered_by_user_id` int NOT NULL,
  `ticket_id` int NOT NULL,
  `material_id` int NOT NULL,
  PRIMARY KEY (`material_used_id`),
  KEY `fk_material_used_ticket1_idx` (`ticket_id`),
  KEY `fk_material_used_material1_idx` (`material_id`),
  KEY `registered_by_user_id_idx` (`registered_by_user_id`),
  CONSTRAINT `fk_material_used_material1` FOREIGN KEY (`material_id`) REFERENCES `material` (`material_id`),
  CONSTRAINT `fk_material_used_ticket1` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`ticket_id`),
  CONSTRAINT `fk_registered_by_user_id` FOREIGN KEY (`registered_by_user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notification`
--

DROP TABLE IF EXISTS `notification`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification` (
  `notification_id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(150) NOT NULL,
  `message` text NOT NULL,
  `notification_type` varchar(45) NOT NULL,
  `delivery_channel` varchar(45) NOT NULL,
  `is_read` tinyint NOT NULL DEFAULT '0',
  `sent_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user_id` int NOT NULL,
  PRIMARY KEY (`notification_id`),
  KEY `fk_notification_user1_idx` (`user_id`),
  CONSTRAINT `fk_notification_user1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `operating_hours`
--

DROP TABLE IF EXISTS `operating_hours`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `operating_hours` (
  `operating_hours_id` int NOT NULL AUTO_INCREMENT,
  `hora_inicio` time NOT NULL DEFAULT '08:00:00',
  `hora_fin` time NOT NULL DEFAULT '20:00:00',
  PRIMARY KEY (`operating_hours_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `priority`
--

DROP TABLE IF EXISTS `priority`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `priority` (
  `priority_id` int NOT NULL AUTO_INCREMENT,
  `priority_name` varchar(45) NOT NULL,
  `sla_hours` int NOT NULL DEFAULT '24',
  `color_hex` varchar(7) DEFAULT NULL,
  `is_active` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`priority_id`),
  UNIQUE KEY `priority_name_UNIQUE` (`priority_name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `priority_change_log`
--

DROP TABLE IF EXISTS `priority_change_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `priority_change_log` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `priority_anterior` int DEFAULT NULL,
  `priority_nueva` int DEFAULT NULL,
  `justificacion` varchar(500) NOT NULL,
  `log_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `qr_ticket`
--

DROP TABLE IF EXISTS `qr_ticket`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `qr_ticket` (
  `qr_ticket_id` int NOT NULL AUTO_INCREMENT,
  `qr_token` varchar(255) NOT NULL,
  `qr_expiration` datetime NOT NULL,
  `ticket_id` int NOT NULL,
  PRIMARY KEY (`qr_ticket_id`),
  UNIQUE KEY `qr_token_UNIQUE` (`qr_token`),
  UNIQUE KEY `ticket_id_UNIQUE` (`ticket_id`),
  KEY `fk_qr_ticket_ticket1_idx` (`ticket_id`),
  CONSTRAINT `fk_qr_ticket_ticket1` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `report_dispatch_log`
--

DROP TABLE IF EXISTS `report_dispatch_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report_dispatch_log` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `config_id` int DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `exito` tinyint(1) NOT NULL DEFAULT '1',
  `intentos` int NOT NULL DEFAULT '1',
  `detalle` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`log_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `role`
--

DROP TABLE IF EXISTS `role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role` (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `role_name_UNIQUE` (`role_name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `scheduled_report`
--

DROP TABLE IF EXISTS `scheduled_report`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scheduled_report` (
  `config_id` int NOT NULL AUTO_INCREMENT,
  `destinatarios` text NOT NULL,
  `periodicidad` varchar(10) NOT NULL DEFAULT 'Semanal',
  `activo` tinyint(1) NOT NULL DEFAULT '0',
  `ultima_ejecucion` datetime DEFAULT NULL,
  PRIMARY KEY (`config_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `session`
--

DROP TABLE IF EXISTS `session`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session` (
  `session_id` int NOT NULL AUTO_INCREMENT,
  `session_token` varchar(200) NOT NULL,
  `ip_address` varchar(45) NOT NULL,
  `login_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime DEFAULT NULL,
  `is_active` tinyint NOT NULL DEFAULT '1',
  `user_id` int NOT NULL,
  PRIMARY KEY (`session_id`),
  UNIQUE KEY `session_token_UNIQUE` (`session_token`),
  KEY `fk_session_user_idx` (`user_id`),
  CONSTRAINT `fk_session_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `status`
--

DROP TABLE IF EXISTS `status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `status` (
  `status_id` int NOT NULL AUTO_INCREMENT,
  `status_name` varchar(45) NOT NULL,
  `description` text,
  `is_active` tinyint NOT NULL DEFAULT '1',
  `is_closed` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`status_id`),
  UNIQUE KEY `status_name_UNIQUE` (`status_name`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `status_history`
--

DROP TABLE IF EXISTS `status_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `status_history` (
  `history_id` int NOT NULL AUTO_INCREMENT,
  `previous_status_id` int DEFAULT NULL,
  `new_status_id` int NOT NULL,
  `change_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `change_reason` varchar(200) DEFAULT NULL,
  `ticket_id` int NOT NULL,
  `changed_by_user_id` int NOT NULL,
  PRIMARY KEY (`history_id`),
  KEY `fk_status_history_ticket1_idx` (`ticket_id`),
  KEY `changed_by_user_id_idx` (`changed_by_user_id`),
  CONSTRAINT `fk_status_history_ticket1` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`ticket_id`),
  CONSTRAINT `fk_status_history_user` FOREIGN KEY (`changed_by_user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_config`
--

DROP TABLE IF EXISTS `system_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_config` (
  `config_id` int NOT NULL AUTO_INCREMENT,
  `modalidad_atencion` varchar(20) NOT NULL DEFAULT 'Presencial',
  `external_endpoint_url` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`config_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ticket`
--

DROP TABLE IF EXISTS `ticket`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ticket` (
  `ticket_id` int NOT NULL AUTO_INCREMENT,
  `ticket_code` varchar(20) NOT NULL,
  `title` varchar(150) NOT NULL,
  `description` text NOT NULL,
  `creation_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `close_date` datetime DEFAULT NULL,
  `assignment_date` datetime DEFAULT NULL,
  `sla_due_date` datetime DEFAULT NULL,
  `reopen_count` int NOT NULL DEFAULT '0',
  `time_spent_minutes` int NOT NULL DEFAULT '0',
  `is_archived` tinyint NOT NULL DEFAULT '0',
  `ticket_origin` enum('web','email','phone','internal') NOT NULL DEFAULT 'web',
  `requester_user_id` int NOT NULL,
  `technician_user_id` int DEFAULT NULL,
  `category_id` int NOT NULL,
  `status_id` int NOT NULL,
  `priority_id` int NOT NULL,
  `equipment_id` int NOT NULL,
  `assigned_user_id` int DEFAULT NULL,
  `notify_creator` tinyint(1) NOT NULL DEFAULT '0',
  `resolution_date` datetime DEFAULT NULL,
  `sla_deadline` datetime DEFAULT NULL,
  `piso_ticket` varchar(50) DEFAULT NULL,
  `habitacion_ticket` varchar(100) DEFAULT NULL,
  `alerta_sla_nivel` int NOT NULL DEFAULT '0',
  `alerta_75_enviada` tinyint(1) NOT NULL DEFAULT '0',
  `auto_cerrado` tinyint(1) NOT NULL DEFAULT '0',
  `pausa_inicio` datetime DEFAULT NULL,
  PRIMARY KEY (`ticket_id`),
  UNIQUE KEY `ticket_code_UNIQUE` (`ticket_code`),
  KEY `fk_ticket_category1_idx` (`category_id`),
  KEY `fk_ticket_status1_idx` (`status_id`),
  KEY `fk_ticket_priority1_idx` (`priority_id`),
  KEY `fk_ticket_equipment1_idx` (`equipment_id`),
  KEY `fk_ticket_requester_idx` (`requester_user_id`),
  KEY `fk_ticket_technician_idx` (`technician_user_id`),
  CONSTRAINT `fk_ticket_category1` FOREIGN KEY (`category_id`) REFERENCES `category` (`category_id`),
  CONSTRAINT `fk_ticket_equipment1` FOREIGN KEY (`equipment_id`) REFERENCES `equipment` (`equipment_id`),
  CONSTRAINT `fk_ticket_priority1` FOREIGN KEY (`priority_id`) REFERENCES `priority` (`priority_id`),
  CONSTRAINT `fk_ticket_requester` FOREIGN KEY (`requester_user_id`) REFERENCES `user` (`user_id`),
  CONSTRAINT `fk_ticket_status1` FOREIGN KEY (`status_id`) REFERENCES `status` (`status_id`),
  CONSTRAINT `fk_ticket_technician` FOREIGN KEY (`technician_user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=75 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ticket_evaluation`
--

DROP TABLE IF EXISTS `ticket_evaluation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ticket_evaluation` (
  `id_ticket_evaluation` int NOT NULL AUTO_INCREMENT,
  `user_rating` tinyint NOT NULL,
  `closing_comment` text,
  `ticket_id` int NOT NULL,
  PRIMARY KEY (`id_ticket_evaluation`),
  UNIQUE KEY `ticket_id_UNIQUE` (`ticket_id`),
  KEY `fk_ticket_evaluation_ticket1_idx` (`ticket_id`),
  CONSTRAINT `fk_ticket_evaluation_ticket1` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ticket_material`
--

DROP TABLE IF EXISTS `ticket_material`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ticket_material` (
  `ticket_material_id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` int NOT NULL,
  `material_id` int NOT NULL,
  `cantidad` int NOT NULL,
  `costo_unitario` decimal(10,2) NOT NULL,
  `costo_total` decimal(10,2) NOT NULL,
  `user_id` int DEFAULT NULL,
  `requiere_aprobacion` tinyint(1) NOT NULL DEFAULT '0',
  `aprobado` tinyint(1) DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ticket_material_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(50) NOT NULL,
  `first_last_name` varchar(50) NOT NULL,
  `second_last_name` varchar(50) NOT NULL,
  `institutional_email` varchar(150) NOT NULL,
  `rut` varchar(15) NOT NULL,
  `username` varchar(45) NOT NULL,
  `password_hash` varchar(250) NOT NULL,
  `user_status` tinyint DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_login` datetime DEFAULT NULL,
  `phone_number` varchar(12) DEFAULT NULL,
  `session_token` varchar(255) DEFAULT NULL,
  `is_critical_tech` tinyint(1) NOT NULL DEFAULT '0',
  `en_vacaciones` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `institutional_email_UNIQUE` (`institutional_email`),
  UNIQUE KEY `rut_UNIQUE` (`rut`),
  UNIQUE KEY `username_UNIQUE` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_role`
--

DROP TABLE IF EXISTS `user_role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_role` (
  `user_role_id` int NOT NULL AUTO_INCREMENT,
  `assignment_date` datetime NOT NULL,
  `active` tinyint NOT NULL,
  `role_id` int NOT NULL,
  `user_id` int NOT NULL,
  PRIMARY KEY (`user_role_id`),
  UNIQUE KEY `uk_user_role` (`role_id`,`user_id`),
  KEY `fk_user_role_role1_idx` (`role_id`),
  KEY `fk_user_role_user1_idx` (`user_id`),
  CONSTRAINT `fk_user_role_role1` FOREIGN KEY (`role_id`) REFERENCES `role` (`role_id`),
  CONSTRAINT `fk_user_role_user1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-11  1:29:57
