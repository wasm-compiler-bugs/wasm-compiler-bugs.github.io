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
-- Table structure for table `github_bugs`
--

DROP TABLE IF EXISTS `github_bugs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `github_bugs` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `RepoID` int NOT NULL,
  `RawResponse` json NOT NULL,
  `BugID` int DEFAULT NULL,
  `Title` varchar(1000) DEFAULT NULL,
  `State` varchar(10) DEFAULT NULL,
  `Body` longtext,
  `HtmlURL` varchar(1000) DEFAULT NULL,
  `NumberOfComments` int DEFAULT NULL,
  `DATE_ADDED` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `TimelineResponse` json DEFAULT NULL,
  `TotalLinesOfCodeChanged` int DEFAULT NULL,
  `IssueNumber` int DEFAULT NULL,
  `BugFIxCommitSHA` varchar(255) DEFAULT NULL,
  `FilesforBugFix` int DEFAULT NULL,
  `TestCaseLOC` int DEFAULT NULL,
  `TestCaseCode` longtext,
  `FilesForTestCase` int DEFAULT NULL,
  `TestCaseFileNames` json DEFAULT NULL,
  `BugFixFileNames` json DEFAULT NULL,
  `ImpactCategory` varchar(100) DEFAULT NULL,
  `FromBugLabels` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`ID`),
  UNIQUE KEY `BugID` (`BugID`),
  FULLTEXT KEY `search_title` (`Title`),
  FULLTEXT KEY `search_body` (`Body`)
) ENGINE=InnoDB AUTO_INCREMENT=353172 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
