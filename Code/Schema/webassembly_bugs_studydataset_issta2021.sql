-- MySQL dump 10.13  Distrib 8.0.20, for Win64 (x86_64)
--
-- Host: 192.168.1.122    Database: webassembly_bugs
-- ------------------------------------------------------
-- Server version	8.0.23

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
-- Table structure for table `studydataset_issta2021`
--

DROP TABLE IF EXISTS `studydataset_issta2021`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `studydataset_issta2021` (
  `ID` int NOT NULL DEFAULT '0',
  `Owner` varchar(255) NOT NULL DEFAULT '',
  `Repo` varchar(255) NOT NULL DEFAULT '',
  `RepoID` int NOT NULL DEFAULT '0',
  `Title` text,
  `HTMLURL` text,
  `TimelineResponse` json DEFAULT NULL,
  `Body` longtext,
  `Stars` longtext,
  `RawResponse` json DEFAULT NULL,
  `CreatedDate` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `ClosedDate` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `NumberOfComments` int DEFAULT NULL,
  `State` varchar(10) DEFAULT NULL,
  `TotalLinesOfCodeChanged` int DEFAULT NULL,
  `BugFIxCommitSHA` varchar(255) DEFAULT NULL,
  `FilesforBugFix` int DEFAULT NULL,
  `TestCaseLOC` int DEFAULT NULL,
  `TestCaseFileNames` json DEFAULT NULL,
  `TestCaseCode` json DEFAULT NULL,
  `IsFound1` bigint NOT NULL DEFAULT '0',
  `IsFound2` bigint NOT NULL DEFAULT '0',
  `ImpactCategory` varchar(100) DEFAULT NULL,
  `FilesForTestCase` int DEFAULT NULL,
  `FaultInExistingBackend` varchar(255) DEFAULT NULL,
  `InvolvingExistingBackend` varchar(255) DEFAULT NULL,
  `FaultInExistingFrontend` varchar(255) DEFAULT NULL,
  `InvolvingExistingFrontend` varchar(255) DEFAULT NULL,
  `DuplicateIssueRefersTo` int DEFAULT NULL,
  `BugFixFileNames` json DEFAULT NULL,
  `TestCaseBinarySize` int DEFAULT NULL,
  `Notes` varchar(1000) DEFAULT NULL,
  `IsRedundant` tinyint(1) NOT NULL DEFAULT '0',
  `BugFixCommitID` int DEFAULT NULL,
  `IsImplementation` tinyint(1) NOT NULL,
  `DuplicateIssueURL` varchar(1000) DEFAULT NULL,
  `DuplicateFixCategory` varchar(45) DEFAULT NULL,
  `NeedsNewImpactAndImpl` tinyint DEFAULT NULL,
  `ExistingBackendSubcomponent` varchar(45) DEFAULT NULL,
  `ExistingFrontendSubcomponent` varchar(45) DEFAULT NULL,
  `FrontendCompilerComponentAffected` varchar(45) DEFAULT NULL,
  `BackendCompilerComponentAffected` varchar(45) DEFAULT NULL,
  `BugFixNumberOfFunctions` int DEFAULT NULL,
  `FromBugLabels` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2021-03-28 15:17:50
