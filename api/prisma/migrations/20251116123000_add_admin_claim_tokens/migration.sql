PRAGMA foreign_keys=OFF;

CREATE TABLE "new_AdminIdentity" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "secretHash" TEXT,
  "claimTokenHash" TEXT,
  "displayName" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_AdminIdentity" ("id", "secretHash", "claimTokenHash", "displayName", "createdAt", "updatedAt")
SELECT "id", "secretHash", NULL, "displayName", "createdAt", "updatedAt" FROM "AdminIdentity";

DROP TABLE "AdminIdentity";

ALTER TABLE "new_AdminIdentity" RENAME TO "AdminIdentity";

UPDATE "AdminIdentity"
SET "claimTokenHash" = lower(hex(randomblob(32)))
WHERE "claimTokenHash" IS NULL;

INSERT INTO "AdminIdentity" ("id", "secretHash", "claimTokenHash", "displayName", "createdAt", "updatedAt")
SELECT DISTINCT g."ownerId", NULL, lower(hex(randomblob(32))), NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Group" g
WHERE g."ownerId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "AdminIdentity" ai WHERE ai."id" = g."ownerId"
  );

PRAGMA foreign_keys=ON;
