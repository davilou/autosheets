/*
  Warnings:

  - A unique constraint covering the columns `[user_id,bet_id]` on the table `monitor_queue` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "monitor_queue_user_id_bet_id_key" ON "monitor_queue"("user_id", "bet_id");
