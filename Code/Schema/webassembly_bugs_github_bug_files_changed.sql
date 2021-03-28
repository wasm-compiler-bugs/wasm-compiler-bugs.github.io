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
-- Table structure for table `github_bug_files_changed`
--

DROP TABLE IF EXISTS `github_bug_files_changed`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `github_bug_files_changed` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `IssueID` int NOT NULL,
  `CommitID` int NOT NULL,
  `Filename` varchar(1000) NOT NULL,
  `Additions` int NOT NULL,
  `Deletions` int NOT NULL,
  `RawURL` varchar(1000) DEFAULT NULL,
  `FileSHA` varchar(255) DEFAULT NULL,
  `ContentResponse` json DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `file_uniqiue` (`IssueID`,`CommitID`,`FileSHA`),
  KEY `fk_commitid` (`CommitID`),
  CONSTRAINT `fk_commitid` FOREIGN KEY (`CommitID`) REFERENCES `github_bug_commits` (`ID`),
  CONSTRAINT `fk_issueid` FOREIGN KEY (`IssueID`) REFERENCES `github_bugs` (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=195365 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2021-03-28 15:17:51
