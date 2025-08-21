-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "telegram_user_id" INTEGER,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "first_name" TEXT,
    "last_name" TEXT,
    "avatar" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "last_login" DATETIME
);

-- CreateTable
CREATE TABLE "bets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "jogo" TEXT NOT NULL,
    "placar" TEXT,
    "mercado" TEXT NOT NULL,
    "linha_da_aposta" TEXT NOT NULL,
    "odd_tipster" REAL NOT NULL,
    "odd_real" REAL,
    "pegou" BOOLEAN NOT NULL DEFAULT false,
    "resultado" TEXT,
    "lucro_prejuizo" REAL,
    "chat_id" INTEGER NOT NULL,
    "message_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "bets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
