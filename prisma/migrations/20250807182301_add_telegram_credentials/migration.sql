-- CreateTable
CREATE TABLE "telegram_credentials" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "api_id" TEXT NOT NULL,
    "api_hash" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "session_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "last_connected" DATETIME,
    "last_error" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "telegram_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "telegram_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "credential_id" TEXT NOT NULL,
    "session_data" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connection_logs" TEXT,
    "backup_data" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "telegram_sessions_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "telegram_credentials" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_credentials_user_id_session_name_key" ON "telegram_credentials"("user_id", "session_name");
