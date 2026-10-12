-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: toy_store_db
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'09120000000','مدیر فروشگاه','admin','2026-09-22 00:24:07','2026-09-22 00:24:07'),(2,'09121111111','مشتری نمونه','customer','2026-09-22 00:24:07','2026-09-22 00:24:07');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,1,'Rubber Duck — Classic Bath Toy','rubber-duck-classic-bath-toy','TOY-DUCK-001','A timeless floating companion, rendered live in 3D. Inspect every angle in the viewer — what you spin is what ships.',NULL,NULL,'USD',12.99,16.99,'USD','2026-10-07 23:46:33',42,1,'{\"Weight\": \"320 g\", \"Material\": \"Non-toxic ABS + plush\", \"Age range\": \"3+ years\", \"Dimensions\": \"18 × 12 × 10 cm\"}','2026-09-30 12:26:35','2026-09-30 12:26:35'),(2,1,'Splash Squad Submarine','splash-squad-submarine','TOY-SUB-002','Bath-time exploration vessel with a spinning propeller and a watertight crew hatch.',NULL,NULL,'USD',18.50,NULL,'USD','2026-10-07 23:46:33',25,1,'{\"Material\": \"Recycled ABS\", \"Age range\": \"4+ years\"}','2026-09-30 12:26:35','2026-09-30 12:26:35'),(3,2,'Interlocking Blocks — 500 Piece Set','interlocking-blocks-500','TOY-BLK-500','Five hundred precision-moulded blocks with a 0.02 mm tolerance, so towers actually stay towers.',NULL,NULL,'USD',64.00,79.00,'USD','2026-10-07 23:46:33',12,1,'{\"Pieces\": 500, \"Material\": \"ABS\", \"Age range\": \"5+ years\"}','2026-09-30 12:26:35','2026-09-30 12:26:35'),(4,2,'Magnetic Tiles — 100 Piece Starter','magnetic-tiles-starter-100','TOY-MAG-100','Translucent magnetic tiles for two-dimensional thinkers who are not ready to read instructions.',NULL,NULL,'USD',48.25,NULL,'USD','2026-10-07 23:46:33',30,1,'{\"Pieces\": 100, \"Magnets\": \"Rare-earth, fully sealed\", \"Age range\": \"3+ years\"}','2026-09-30 12:26:35','2026-09-30 12:26:35'),(5,3,'Astronaut Figure — SERAPH Edition','astronaut-figure-seraph','TOY-FIG-009','Hand-finished resin figure on a weighted base, numbered on the underside.',NULL,NULL,'USD',129.00,NULL,'USD','2026-10-07 23:46:33',4,1,'{\"Scale\": \"1:12\", \"Edition\": \"Numbered, 500 units\", \"Material\": \"Resin\"}','2026-09-30 12:26:35','2026-09-30 12:26:35'),(6,4,'Trail Blazer 4x4 Rock Crawler','trail-blazer-4x4','TOY-RC-014','Two-speed gearbox, oil-filled shocks and a 40 minute run time on rough terrain.',NULL,NULL,'USD',189.99,219.99,'USD','2026-10-07 23:46:33',0,1,'{\"Scale\": \"1:10\", \"Runtime\": \"40 minutes\", \"Top speed\": \"28 km/h\"}','2026-09-30 12:26:35','2026-09-30 12:26:35'),(7,6,'9mm Blaster Pistol','9mm-blaster-pistol','TOY-3D-9MM','Interactive 3D preview of the 9mm blaster pistol, streamed from the store\'s object storage. No toman price has been approved for it yet, so it cannot be purchased.',NULL,NULL,'IRT',NULL,NULL,NULL,NULL,0,1,'{\"Format\": \"GLB\"}','2026-10-08 23:00:16','2026-10-10 15:10:15'),(8,6,'AK-47 Blaster Rifle','ak-47-blaster-rifle','TOY-3D-AK47','Interactive 3D preview of the AK-47 blaster rifle, streamed from the store\'s object storage. No toman price has been approved for it yet, so it cannot be purchased.',NULL,NULL,'IRT',NULL,NULL,NULL,NULL,0,1,'{\"Format\": \"GLB\"}','2026-10-08 23:00:16','2026-10-10 15:10:15'),(9,1,'Classic Rubber Duck','classic-rubber-duck','TOY-3D-DUCK','The classic bath-time rubber duck, rendered in real time from the store\'s object storage. No toman price has been approved for it yet, so it cannot be purchased.',NULL,NULL,'IRT',NULL,NULL,NULL,NULL,0,1,'{\"Format\": \"GLB\"}','2026-10-08 23:00:16','2026-10-10 15:10:15'),(10,5,'Ford Mustang 1965 Model Car','ford-mustang-1965','TOY-3D-MUSTANG','Interactive 3D preview of the 1965 Ford Mustang, streamed from the store\'s object storage. No toman price has been approved for it yet, so it cannot be purchased.',NULL,NULL,'IRT',NULL,NULL,NULL,NULL,0,1,'{\"Format\": \"GLB\"}','2026-10-08 23:00:17','2026-10-10 15:10:15'),(11,5,'Porsche 911 Turbo 1975 Model Car','porsche-911-turbo-1975','TOY-3D-911T','Interactive 3D preview of the 1975 Porsche 911 Turbo 930, streamed from the store\'s object storage. No toman price has been approved for it yet, so it cannot be purchased.',NULL,NULL,'IRT',NULL,NULL,NULL,NULL,0,1,'{\"Format\": \"GLB\"}','2026-10-08 23:00:17','2026-10-10 15:10:15'),(12,5,'Porsche 911 Carrera 4S Model Car','porsche-911-carrera-4s','TOY-3D-911C4S','Interactive 3D preview of the Porsche 911 Carrera 4S, streamed from the store\'s object storage. No toman price has been approved for it yet, so it cannot be purchased.',NULL,NULL,'IRT',NULL,NULL,NULL,NULL,0,1,'{\"Format\": \"GLB\"}','2026-10-08 23:00:17','2026-10-10 15:10:15'),(13,6,'Colt Python Revolver Model','colt-python-revolver','TOY-3D-COLT','Interactive 3D preview of the Colt Python revolver, streamed from the store\'s object storage. No toman price has been approved for it yet, so it cannot be purchased.',NULL,NULL,'IRT',NULL,NULL,NULL,NULL,0,1,'{\"Format\": \"GLB\"}','2026-10-08 23:00:18','2026-10-10 15:10:15'),(14,6,'Halo SMG Blaster','halo-smg-blaster','TOY-3D-SMG','Interactive 3D preview of the Halo 2 anniversary SMG, streamed from the store\'s object storage. No toman price has been approved for it yet, so it cannot be purchased.',NULL,NULL,'IRT',NULL,NULL,NULL,NULL,0,1,'{\"Format\": \"GLB\"}','2026-10-08 23:00:18','2026-10-10 15:10:15');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping data for table `media3d`
--

LOCK TABLES `media3d` WRITE;
/*!40000 ALTER TABLE `media3d` DISABLE KEYS */;
INSERT INTO `media3d` VALUES (1,1,'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb',NULL,NULL,NULL,'studio','{\"fov\": 40, \"target\": [0, 0.5, 0], \"position\": [4, 3, 6], \"max_distance\": 12, \"min_distance\": 2.5, \"auto_rotate_speed\": 1.2}',1,1.00,'2026-09-30 12:26:35','2026-09-30 12:26:35'),(2,7,'models/9_mm.glb',NULL,5454796,NULL,'studio',NULL,1,1.00,'2026-10-08 23:00:16','2026-10-08 23:00:16'),(3,8,'models/ak-47.glb',NULL,4858380,NULL,'studio',NULL,1,1.00,'2026-10-08 23:00:16','2026-10-08 23:00:16'),(4,9,'models/duck.glb','models/duck_opt.glb',42752,NULL,'studio',NULL,1,1.00,'2026-10-08 23:00:16','2026-10-08 23:00:16'),(5,10,'models/ford_mustang_1965.glb',NULL,17459564,NULL,'studio',NULL,1,1.00,'2026-10-08 23:00:17','2026-10-08 23:00:17'),(6,11,'models/free_1975_porsche_911_930_turbo.glb',NULL,21970656,NULL,'studio',NULL,1,1.00,'2026-10-08 23:00:17','2026-10-08 23:00:17'),(7,12,'models/free_porsche_911_carrera_4s.glb',NULL,21076404,NULL,'studio',NULL,1,1.00,'2026-10-08 23:00:17','2026-10-08 23:00:17'),(8,13,'models/gameready_colt_python_revolver.glb',NULL,3449952,NULL,'studio',NULL,1,1.00,'2026-10-08 23:00:18','2026-10-08 23:00:18'),(9,14,'models/halo_2_anniversary_-_smg.glb',NULL,6083680,NULL,'studio',NULL,1,1.00,'2026-10-08 23:00:18','2026-10-08 23:00:18');
/*!40000 ALTER TABLE `media3d` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-11 23:20:20
