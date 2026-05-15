-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'QUIZ_NEW';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "quizId" TEXT;

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "timeLimitMinutes" INTEGER,
    "dueDate" TIMESTAMP(3),
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT true,
    "showAnswers" BOOLEAN NOT NULL DEFAULT true,
    "questions" JSONB NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "questionOrder" JSONB NOT NULL,
    "optionOrders" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "score" INTEGER,
    "totalPoints" INTEGER NOT NULL,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Quiz_classroomId_idx" ON "Quiz"("classroomId");

-- CreateIndex
CREATE INDEX "Quiz_createdById_idx" ON "Quiz"("createdById");

-- CreateIndex
CREATE INDEX "QuizAttempt_studentId_idx" ON "QuizAttempt"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_quizId_studentId_key" ON "QuizAttempt"("quizId", "studentId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
