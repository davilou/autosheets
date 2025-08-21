-- CreateTable
CREATE TABLE "user_spreadsheets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "spreadsheet_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template_type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "drive_email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "last_backup" DATETIME,
    "auto_backup" BOOLEAN NOT NULL DEFAULT false,
    "backup_frequency" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_spreadsheets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "user_spreadsheets_user_id_spreadsheet_id_key" ON "user_spreadsheets"("user_id", "spreadsheet_id");
