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

-- First, create shape table for hand pattern looksups
IF OBJECT_ID('tempdb..#nums','U') IS NOT NULL
DROP TABLE #nums
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[deals]') AND type in (N'U'))
DROP TABLE [dbo].[deals]
IF OBJECT_ID('shape_table','U') IS NOT NULL
DROP TABLE shape_table

--all temp tables just lower case
CREATE TABLE #nums (suit_count tinyint)
INSERT INTO #nums (suit_count)
VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12),(13)

CREATE TABLE shape_table (
	id smallint PRIMARY KEY CLUSTERED IDENTITY(1,1),
	spade_length tinyint,
	heart_length tinyint,
	diamond_length tinyint,
	club_length tinyint
	)

INSERT INTO shape_table
SELECT	
	d.suit_count as spade_length,
	c.suit_count as heart_length,
	b.suit_count as diamond_length,
	a.suit_count as club_length
FROM #nums d
CROSS JOIN #nums a
CROSS JOIN #nums b
CROSS JOIN #nums c
WHERE a.suit_count + b.suit_count + c.suit_count + d.suit_count = 13

CREATE TABLE [dbo].[deals](
	[deal] BINARY(13) NOT NULL,
	shape_north smallint NOT NULL,
	shape_east smallint NOT NULL,
	shape_south smallint NOT NULL,
	shape_west smallint NOT NULL,
	hcp_north tinyint NOT NULL,
	hcp_east tinyint NOT NULL,
	hcp_south tinyint NOT NULL,
	hcp_west tinyint NOT NULL,
	tricks_north_clubs tinyint,
	tricks_north_diamonds tinyint,
	tricks_north_hearts tinyint,
	tricks_north_spades tinyint,
	tricks_north_notrump tinyint,
	tricks_east_clubs tinyint,
	tricks_east_diamonds tinyint,
	tricks_east_hearts tinyint,
	tricks_east_spades tinyint,
	tricks_east_notrump tinyint,
	tricks_south_clubs tinyint,
	tricks_south_diamonds tinyint,
	tricks_south_hearts tinyint,
	tricks_south_spades tinyint,
	tricks_south_notrump tinyint,
	tricks_west_clubs tinyint,
	tricks_west_diamonds tinyint,
	tricks_west_hearts tinyint,
	tricks_west_spades tinyint,
	tricks_west_notrump tinyint,
	par_north_nonevul smallint,
	par_east_nonevul smallint,
	par_south_nonevul smallint,
	par_west_nonevul smallint,
	par_north_nsvul smallint,
	par_east_nsvul smallint,
	par_south_nsvul smallint,
	par_west_nsvul smallint,
	par_north_ewvul smallint,
	par_east_ewvul smallint,
	par_south_ewvul smallint,
	par_west_ewvul smallint,
	par_north_allvul smallint,
	par_east_allvul smallint,
	par_south_allvul smallint,
	par_west_allvul smallint,
	when_dealt datetime				-- For an extra 3 btyes, store when the hand was generated
	CONSTRAINT [PK_deal] PRIMARY KEY CLUSTERED 	([deal] ASC),
	CONSTRAINT FK_north_shape FOREIGN KEY (shape_north) REFERENCES shape_table(id),
	CONSTRAINT FK_east_shape FOREIGN KEY (shape_east) REFERENCES shape_table(id),
	CONSTRAINT FK_south_shape FOREIGN KEY (shape_south) REFERENCES shape_table(id),
	CONSTRAINT FK_west_shape FOREIGN KEY (shape_west) REFERENCES shape_table(id)
)

--example index to test write speed slowdown and begin analysis of what indexes we will actually want
CREATE INDEX IX_north on dbo.deals (shape_north, hcp_north)
INCLUDE (tricks_north_spades, tricks_north_hearts, tricks_north_diamonds, tricks_north_clubs)

GO

