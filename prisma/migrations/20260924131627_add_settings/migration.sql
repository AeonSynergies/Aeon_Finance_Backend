-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "waveLoginBufferMins" INTEGER NOT NULL DEFAULT 5,
    "amazonLoginBufferMins" INTEGER NOT NULL DEFAULT 30,
    "physicalLoginBufferMins" INTEGER NOT NULL DEFAULT 5,
    "mealBreakBufferMins" INTEGER NOT NULL DEFAULT 2,
    "logoutBufferMins" INTEGER NOT NULL DEFAULT 15,
    "amazonAutoLogoutEstimateBufferMins" INTEGER NOT NULL DEFAULT 30,
    "ptoEarnCodes" TEXT[] DEFAULT ARRAY['PTO']::TEXT[],
    "bonusEarnCodes" TEXT[] DEFAULT ARRAY['BON', 'BNH']::TEXT[],
    "trainingEarnCodes" TEXT[] DEFAULT ARRAY['TRN']::TEXT[],
    "vtoEarnCodes" TEXT[] DEFAULT ARRAY['VTO']::TEXT[],
    "fuzzyAmazonMatchThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "fuzzyBreakReportMatchThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.60,
    "mealWaiverExemptStates" TEXT[] DEFAULT ARRAY['CA', 'TX']::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);
