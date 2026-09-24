-- CreateTable
CREATE TABLE "SystemWordbook" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemWordbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemWord" (
    "id" SERIAL NOT NULL,
    "systemWordbookId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "phonetic" TEXT,
    "meanings" JSONB[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemWord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemWordbook_name_key" ON "SystemWordbook"("name");

-- CreateIndex
CREATE INDEX "SystemWord_systemWordbookId_idx" ON "SystemWord"("systemWordbookId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemWord_systemWordbookId_text_key" ON "SystemWord"("systemWordbookId", "text");

-- AddForeignKey
ALTER TABLE "SystemWord" ADD CONSTRAINT "SystemWord_systemWordbookId_fkey" FOREIGN KEY ("systemWordbookId") REFERENCES "SystemWordbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
