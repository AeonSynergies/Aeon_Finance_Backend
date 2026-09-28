import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { createTestOrg, deleteTestOrg } from '../test-utils/test-org';
import { SettingsService } from './settings.service';

describe('SettingsService (integration, real database)', () => {
  let service: SettingsService;
  let prisma: PrismaService;
  let testOrg: Awaited<ReturnType<typeof createTestOrg>>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SettingsService, PrismaService],
    }).compile();

    service = module.get(SettingsService);
    prisma = module.get(PrismaService);
    await prisma.$connect();
    testOrg = await createTestOrg(prisma);
  });

  afterEach(async () => {
    await prisma.settings
      .delete({ where: { orgId: testOrg.orgId } })
      .catch(() => {});
  });

  afterAll(async () => {
    await deleteTestOrg(prisma, testOrg.orgId);
    await prisma.$disconnect();
  });

  it('getOrCreate creates the org settings row with engine defaults on first call', async () => {
    const settings = await service.getOrCreate(testOrg.orgId);

    expect(settings.orgId).toBe(testOrg.orgId);
    expect(settings.waveLoginBufferMins).toBe(5);
    expect(settings.amazonLoginBufferMins).toBe(30);
    expect(settings.physicalLoginBufferMins).toBe(5);
    expect(settings.mealBreakBufferMins).toBe(2);
    expect(settings.logoutBufferMins).toBe(15);
    expect(settings.amazonAutoLogoutEstimateBufferMins).toBe(30);
    expect(settings.ptoEarnCodes).toEqual(['PTO']);
    expect(settings.bonusEarnCodes).toEqual(['BON', 'BNH']);
    expect(settings.trainingEarnCodes).toEqual(['TRN']);
    expect(settings.vtoEarnCodes).toEqual(['VTO']);
    expect(settings.fuzzyAmazonMatchThreshold).toBe(0.75);
    expect(settings.fuzzyBreakReportMatchThreshold).toBe(0.6);
    expect(settings.mealWaiverExemptStates).toEqual(['CA', 'TX']);
  });

  it('getOrCreate returns the same row on repeated calls, not a fresh one', async () => {
    const first = await service.getOrCreate(testOrg.orgId);
    const second = await service.getOrCreate(testOrg.orgId);

    expect(second.id).toBe(first.id);
    expect(second.updatedAt).toEqual(first.updatedAt);
  });

  it('update applies only the given fields and leaves the rest untouched', async () => {
    await service.getOrCreate(testOrg.orgId);

    const updated = await service.update(testOrg.orgId, {
      ptoEarnCodes: ['PTO', 'SICK'],
      bonusEarnCodes: ['BON', 'BNH'],
    });

    expect(updated.ptoEarnCodes).toEqual(['PTO', 'SICK']);
    expect(updated.bonusEarnCodes).toEqual(['BON', 'BNH']);
    expect(updated.waveLoginBufferMins).toBe(5);
    expect(updated.logoutBufferMins).toBe(15);
  });

  it('update creates the org settings row first if it does not exist yet', async () => {
    const updated = await service.update(testOrg.orgId, {
      logoutBufferMins: 20,
    });

    expect(updated.logoutBufferMins).toBe(20);
    expect(updated.waveLoginBufferMins).toBe(5);
  });

  it('getThresholds maps the persisted row into the shape validateTimecardRow expects', async () => {
    await service.update(testOrg.orgId, {
      ptoEarnCodes: ['PTO', 'BON'],
      bonusEarnCodes: ['BON', 'BNH'],
    });

    const thresholds = await service.getThresholds(testOrg.orgId);

    expect(thresholds.ptoEarnCodes).toEqual(['PTO', 'BON']);
    expect(thresholds.bonusEarnCodes).toEqual(['BON', 'BNH']);
    expect(thresholds.fuzzyAmazonMatchThreshold).toBe(0.75);
  });
});

describe('SettingsService organization isolation (integration, real database)', () => {
  let service: SettingsService;
  let prisma: PrismaService;
  let orgA: Awaited<ReturnType<typeof createTestOrg>>;
  let orgB: Awaited<ReturnType<typeof createTestOrg>>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SettingsService, PrismaService],
    }).compile();
    service = module.get(SettingsService);
    prisma = module.get(PrismaService);
    await prisma.$connect();
    orgA = await createTestOrg(prisma);
    orgB = await createTestOrg(prisma);
  });

  afterAll(async () => {
    await deleteTestOrg(prisma, orgA.orgId);
    await deleteTestOrg(prisma, orgB.orgId);
    await prisma.$disconnect();
  });

  it("one org's update does not change another org's thresholds", async () => {
    await service.update(orgA.orgId, { logoutBufferMins: 42 });
    expect((await service.getThresholds(orgA.orgId)).logoutBufferMins).toBe(42);
    expect((await service.getThresholds(orgB.orgId)).logoutBufferMins).toBe(15);
  });
});
