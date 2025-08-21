-- CreateTable
CREATE TABLE "google_drive_credentials" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expiry" DATETIME,
    "scope" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "last_connected" DATETIME,
    "last_error" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "google_drive_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "google_drive_credentials_user_id_email_key" ON "google_drive_credentials"("user_id", "email");
