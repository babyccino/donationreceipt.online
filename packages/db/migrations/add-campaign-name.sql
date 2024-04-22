CREATE TABLE campaigns (
	id text(191) PRIMARY KEY NOT NULL,
	account_id text(191) NOT NULL,
	start_date integer NOT NULL,
	end_date integer NOT NULL,
	created_at integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL
);

PRAGMA foreign_keys=off;

BEGIN TRANSACTION;

ALTER TABLE campaigns RENAME TO campaigns_old;

CREATE TABLE campaigns (
  id text(191) PRIMARY KEY NOT NULL,
	account_id text(191) NOT NULL,
	name text(191) NOT NULL,
	start_date integer NOT NULL,
	end_date integer NOT NULL,
	created_at integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL
);

INSERT INTO campaigns (id, account_id, name, start_date, end_date, created_at)
  SELECT id, account_id, format('Campaign %d', ROWID), start_date, end_date, created_at
  FROM campaigns_old;

COMMIT;

PRAGMA foreign_keys=on;
