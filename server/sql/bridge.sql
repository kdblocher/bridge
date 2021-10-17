USE [master]
GO

IF DB_ID('Bridge') IS NULL
CREATE DATABASE [Bridge]
GO

IF NOT EXISTS (SELECT name FROM master.sys.server_principals WHERE name = 'bridge')
CREATE LOGIN [bridge] WITH PASSWORD=N'refinance-unweave-unglazed-dizzy-shuffling', DEFAULT_DATABASE=[Bridge], DEFAULT_LANGUAGE=[us_english], CHECK_EXPIRATION=OFF, CHECK_POLICY=OFF
GO

USE [Bridge]
GO

IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = 'bridge')
CREATE USER [bridge] FOR LOGIN [bridge] WITH DEFAULT_SCHEMA=[dbo]
GO
EXEC sp_addrolemember 'db_owner', 'bridge'
GO

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Hands]') AND type in (N'U'))
DROP TABLE [dbo].[Hands]

CREATE TABLE [dbo].[Hands](
	[Hand] [uniqueidentifier] NOT NULL,
	CONSTRAINT [PK_Hands] PRIMARY KEY CLUSTERED 
	(
		[Hand] ASC
	)
)
GO
