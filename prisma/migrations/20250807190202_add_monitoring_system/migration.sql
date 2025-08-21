-- CreateTable
CREATE TABLE "monitored_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "credential_id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "chat_title" TEXT NOT NULL,
    "chat_type" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "keywords" TEXT,
    "exclude_keywords" TEXT,
    "allowed_users" TEXT,
    "blocked_users" TEXT,
    "min_odds" REAL,
    "max_odds" REAL,
    "time_filters" TEXT,
    "last_activity" DATETIME,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "bet_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "monitored_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "monitored_groups_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "telegram_credentials" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_monitor_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "credential_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_heartbeat" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_messages" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "performance" TEXT,
    CONSTRAINT "user_monitor_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_monitor_sessions_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "telegram_credentials" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "monitor_queue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "message_data" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "scheduled_for" DATETIME,
    "processed_at" DATETIME,
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "monitor_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "monitored_groups_user_id_credential_id_chat_id_key" ON "monitored_groups"("user_id", "credential_id", "chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_monitor_sessions_user_id_credential_id_key" ON "user_monitor_sessions"("user_id", "credential_id");

-- CreateIndex
CREATE INDEX "monitor_queue_status_priority_scheduled_for_idx" ON "monitor_queue"("status", "priority", "scheduled_for");
