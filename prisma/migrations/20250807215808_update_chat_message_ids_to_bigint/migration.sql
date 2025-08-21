/*
  Warnings:

  - You are about to alter the column `chat_id` on the `bets` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `message_id` on the `bets` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_bets" (
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
    "chat_id" BIGINT NOT NULL,
    "message_id" BIGINT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "bets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_bets" ("chat_id", "created_at", "id", "jogo", "linha_da_aposta", "lucro_prejuizo", "mercado", "message_id", "odd_real", "odd_tipster", "pegou", "placar", "resultado", "updated_at", "user_id") SELECT "chat_id", "created_at", "id", "jogo", "linha_da_aposta", "lucro_prejuizo", "mercado", "message_id", "odd_real", "odd_tipster", "pegou", "placar", "resultado", "updated_at", "user_id" FROM "bets";
DROP TABLE "bets";
ALTER TABLE "new_bets" RENAME TO "bets";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
