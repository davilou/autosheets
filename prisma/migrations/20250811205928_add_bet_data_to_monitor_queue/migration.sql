-- AlterTable
ALTER TABLE "monitor_queue" ADD COLUMN "chat_id" BIGINT;
ALTER TABLE "monitor_queue" ADD COLUMN "jogo" TEXT;
ALTER TABLE "monitor_queue" ADD COLUMN "linha_da_aposta" TEXT;
ALTER TABLE "monitor_queue" ADD COLUMN "lucro_prejuizo" REAL;
ALTER TABLE "monitor_queue" ADD COLUMN "mercado" TEXT;
ALTER TABLE "monitor_queue" ADD COLUMN "message_id" BIGINT;
ALTER TABLE "monitor_queue" ADD COLUMN "odd_real" REAL;
ALTER TABLE "monitor_queue" ADD COLUMN "odd_tipster" REAL;
ALTER TABLE "monitor_queue" ADD COLUMN "pegou" BOOLEAN DEFAULT false;
ALTER TABLE "monitor_queue" ADD COLUMN "placar" TEXT;
ALTER TABLE "monitor_queue" ADD COLUMN "resultado" TEXT;
