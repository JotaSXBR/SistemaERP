/*
  Warnings:

  - A unique constraint covering the columns `[id,user_id]` on the table `memberships` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_membership_id_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "memberships_id_user_id_key" ON "memberships"("id", "user_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_membership_id_user_id_fkey" FOREIGN KEY ("membership_id", "user_id") REFERENCES "memberships"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;
