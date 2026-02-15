CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`providerNpi` varchar(10) NOT NULL,
	`alertType` enum('excessive_billing','sudden_spike','overcharging','unbundling','critical_risk') NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`riskScore` int NOT NULL,
	`totalSpending` varchar(20) NOT NULL,
	`status` enum('new','investigating','resolved','dismissed') NOT NULL DEFAULT 'new',
	`notificationSent` int NOT NULL DEFAULT 0,
	`analysisId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analysisRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileSize` int NOT NULL,
	`fileUrl` text NOT NULL,
	`status` enum('uploading','processing','analyzing','completed','failed') NOT NULL DEFAULT 'uploading',
	`progress` int NOT NULL DEFAULT 0,
	`totalRecords` int NOT NULL DEFAULT 0,
	`anomalousRecords` int NOT NULL DEFAULT 0,
	`highRiskProviders` int NOT NULL DEFAULT 0,
	`totalSpending` varchar(20) NOT NULL DEFAULT '0',
	`dateRangeStart` varchar(10),
	`dateRangeEnd` varchar(10),
	`resultsUrl` text,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `analysisRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `procedureBenchmarks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hcpcsCode` varchar(10) NOT NULL,
	`avgCost` varchar(20) NOT NULL,
	`stdCost` varchar(20) NOT NULL,
	`medianCost` varchar(20) NOT NULL,
	`avgClaimsPerBen` varchar(20) NOT NULL,
	`stdClaimsPerBen` varchar(20) NOT NULL,
	`medianClaimsPerBen` varchar(20) NOT NULL,
	`sampleSize` int NOT NULL,
	`analysisId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `procedureBenchmarks_id` PRIMARY KEY(`id`),
	CONSTRAINT `procedureBenchmarks_hcpcsCode_unique` UNIQUE(`hcpcsCode`)
);
--> statement-breakpoint
CREATE TABLE `providers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`npi` varchar(10) NOT NULL,
	`totalSpending` varchar(20) NOT NULL DEFAULT '0',
	`totalClaims` int NOT NULL DEFAULT 0,
	`totalBeneficiaries` int NOT NULL DEFAULT 0,
	`uniqueProcedures` int NOT NULL DEFAULT 0,
	`avgRiskScore` int NOT NULL DEFAULT 0,
	`avgCostPerClaim` varchar(20) NOT NULL DEFAULT '0',
	`avgClaimsPerBeneficiary` varchar(20) NOT NULL DEFAULT '0',
	`specialty` varchar(255),
	`location` varchar(255),
	`practiceSize` varchar(50),
	`complianceHistory` text,
	`lastAnalyzed` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `providers_id` PRIMARY KEY(`id`),
	CONSTRAINT `providers_npi_unique` UNIQUE(`npi`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`billingProviderNpi` varchar(10) NOT NULL,
	`servicingProviderNpi` varchar(10) NOT NULL,
	`hcpcsCode` varchar(10) NOT NULL,
	`claimFromMonth` varchar(10) NOT NULL,
	`totalUniqueBeneficiaries` int NOT NULL,
	`totalClaims` int NOT NULL,
	`totalPaid` varchar(20) NOT NULL,
	`costPerClaim` varchar(20) NOT NULL,
	`claimsPerBeneficiary` varchar(20) NOT NULL,
	`costZScore` varchar(20) NOT NULL DEFAULT '0',
	`claimsPerBenZScore` varchar(20) NOT NULL DEFAULT '0',
	`fraudRiskScore` int NOT NULL DEFAULT 0,
	`anomalyFlag` int NOT NULL DEFAULT 0,
	`analysisId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
