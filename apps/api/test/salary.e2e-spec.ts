import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { RankGroup, UnitType } from '@prisma/client';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PERMISSIONS } from './../src/common/constants';
import { PrismaService } from './../src/prisma/prisma.service';

interface SalaryRecordResponseBody {
  id: string;
  coefficient: number;
}

interface RankResponseBody {
  id: string;
  code: string;
  name: string;
  category: string | null;
  sectorGroup: string | null;
  rankGroup: RankGroup;
  isActive: boolean;
}

const unwrapData = <T>(body: unknown): T => {
  if (typeof body === 'object' && body !== null && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
};

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);
const EXPECTED_LEGACY_SUNSET =
  process.env.SALARY_LEGACY_STEPS_SUNSET ?? '2026-12-31';

describe('Salary Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  let hrToken = '';
  let lecturerToken = '';

  let tempUserId = '';
  let tempEmployeeId = '';
  let tempUnitId = '';

  const createdRankIds: string[] = [];
  const createdStepIds: string[] = [];
  const createdSalaryRecordIds: string[] = [];

  const httpServer = (): Parameters<typeof request>[0] =>
    app.getHttpServer() as unknown as Parameters<typeof request>[0];

  const nextUniqueCode = (prefix: string): string =>
    `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const nextEffectiveDate = (offsetDays: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return toIsoDate(date);
  };

  const findAvailableStepLevel = async (
    rankGroup: RankGroup,
  ): Promise<number> => {
    const levels = await prisma.civilServantRankStep.findMany({
      where: { rankGroup },
      select: { level: true },
    });
    const used = new Set(levels.map((item) => item.level));
    for (let level = 99; level >= 1; level -= 1) {
      if (!used.has(level)) {
        return level;
      }
    }
    throw new Error(`No free salary level in rank group ${rankGroup}`);
  };

  const createRankDirect = async (
    rankGroup: RankGroup,
    isActive = true,
    category = 'E2E',
  ): Promise<string> => {
    const rank = await prisma.civilServantRank.create({
      data: {
        code: nextUniqueCode('E2E-SAL-RANK'),
        name: `E2E Salary Rank ${rankGroup}`,
        rankGroup,
        category,
        sectorGroup: 'KHAC',
        rankType: 'TEST',
        minCoefficient: 1.0,
        maxCoefficient: 10.0,
        isActive,
      },
      select: { id: true },
    });
    createdRankIds.push(rank.id);
    return rank.id;
  };

  const createStepDirect = async (
    rankGroup: RankGroup,
    level: number,
    coefficient: number,
    isActive = true,
  ): Promise<string> => {
    const step = await prisma.civilServantRankStep.create({
      data: {
        rankGroup,
        level,
        coefficient,
        isActive,
      },
      select: { id: true },
    });
    createdStepIds.push(step.id);
    return step.id;
  };

  const issueAccessToken = (permissions: string[], roles: string[]): string =>
    jwt.sign({
      sub: `e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      email: `e2e.${Date.now()}@sgu.edu.vn`,
      permissions,
      roles,
      unitId: null,
    });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);

    hrToken = issueAccessToken(
      [
        PERMISSIONS.SALARY_CONFIG_MANAGE,
        PERMISSIONS.SALARY_WRITE,
        PERMISSIONS.SALARY_READ,
      ],
      ['HR_ADMIN'],
    );
    lecturerToken = issueAccessToken(
      [PERMISSIONS.SALARY_READ_OWN],
      ['EMPLOYEE'],
    );

    const unit = await prisma.unit.create({
      data: {
        code: nextUniqueCode('E2E-UNIT'),
        name: 'E2E Salary Unit',
        unitType: UnitType.PHONG,
      },
      select: { id: true },
    });
    tempUnitId = unit.id;

    const user = await prisma.user.create({
      data: {
        email: `salary.e2e.${Date.now()}@sgu.edu.vn`,
        passwordHash: 'e2e-not-used',
        isActive: true,
      },
      select: { id: true },
    });
    tempUserId = user.id;

    const employee = await prisma.employee.create({
      data: {
        userId: tempUserId,
        employeeCode: nextUniqueCode('E2EEMP'),
        citizenId: nextUniqueCode('012345'),
        fullName: 'Salary E2E Employee',
        dob: new Date('1990-01-01T00:00:00.000Z'),
        gender: 'NAM',
        unitId: tempUnitId,
      },
      select: { id: true },
    });
    tempEmployeeId = employee.id;
  });

  afterAll(async () => {
    if (createdSalaryRecordIds.length > 0) {
      await prisma.salaryRecord.deleteMany({
        where: { id: { in: createdSalaryRecordIds } },
      });
    }

    if (tempEmployeeId) {
      await prisma.salaryRecord.deleteMany({
        where: { employeeId: tempEmployeeId },
      });
    }

    if (createdStepIds.length > 0) {
      await prisma.civilServantRankStep.deleteMany({
        where: { id: { in: createdStepIds } },
      });
    }

    if (createdRankIds.length > 0) {
      await prisma.civilServantRank.deleteMany({
        where: { id: { in: createdRankIds } },
      });
    }

    if (tempEmployeeId) {
      await prisma.employee.deleteMany({ where: { id: tempEmployeeId } });
    }
    if (tempUserId) {
      await prisma.user.deleteMany({ where: { id: tempUserId } });
    }
    if (tempUnitId) {
      await prisma.unit.deleteMany({ where: { id: tempUnitId } });
    }

    await app.close();
  });

  it('POST /civil-servant-ranks should allow HR with salary:config_manage', async () => {
    const payload = {
      code: nextUniqueCode('E2E-API-RANK'),
      name: 'E2E API Rank',
      rankGroup: 'A1',
      category: 'E2E',
      rankType: 'TEST',
      minCoefficient: 1.11,
      maxCoefficient: 9.99,
      isActive: true,
    };

    const response = await request(httpServer())
      .post('/civil-servant-ranks')
      .set('Authorization', `Bearer ${hrToken}`)
      .send(payload)
      .expect(201);

    const body = unwrapData<RankResponseBody>(response.body);
    createdRankIds.push(body.id);
  });

  it('POST /civil-servant-ranks should deny employee without salary:config_manage', async () => {
    const payload = {
      code: nextUniqueCode('E2E-API-RANK-DENY'),
      name: 'Denied Rank',
      rankGroup: 'A1',
    };

    await request(httpServer())
      .post('/civil-servant-ranks')
      .set('Authorization', `Bearer ${lecturerToken}`)
      .send(payload)
      .expect(403);
  });

  it('POST /civil-servant-ranks should derive sectorGroup from category', async () => {
    const payload = {
      code: nextUniqueCode('E2E-API-RANK-SECTOR'),
      name: 'E2E API Rank Sector',
      rankGroup: 'A1',
      category: 'Y_TE',
      rankType: 'TEST',
      minCoefficient: 1.11,
      maxCoefficient: 9.99,
      isActive: true,
    };

    const response = await request(httpServer())
      .post('/civil-servant-ranks')
      .set('Authorization', `Bearer ${hrToken}`)
      .send(payload)
      .expect(201);

    const body = unwrapData<RankResponseBody>(response.body);
    createdRankIds.push(body.id);
    expect(body.sectorGroup).toBe('Y_TE');
  });

  it('PATCH /civil-servant-ranks/:id should re-derive sectorGroup when category changes', async () => {
    const createPayload = {
      code: nextUniqueCode('E2E-API-RANK-PATCH'),
      name: 'E2E API Rank Patch',
      rankGroup: 'A1',
      category: 'GV_DAI_HOC',
      rankType: 'TEST',
      minCoefficient: 1.11,
      maxCoefficient: 9.99,
      isActive: true,
    };

    const createdResponse = await request(httpServer())
      .post('/civil-servant-ranks')
      .set('Authorization', `Bearer ${hrToken}`)
      .send(createPayload)
      .expect(201);
    const created = unwrapData<RankResponseBody>(createdResponse.body);
    createdRankIds.push(created.id);
    expect(created.sectorGroup).toBe('GIANG_VIEN');

    const updateResponse = await request(httpServer())
      .patch(`/civil-servant-ranks/${created.id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ category: 'HANH_CHINH' })
      .expect(200);

    const updated = unwrapData<RankResponseBody>(updateResponse.body);
    expect(updated.sectorGroup).toBe('HANH_CHINH');
  });

  it('GET /civil-servant-ranks should return 400 for invalid sectorGroup', async () => {
    await request(httpServer())
      .get('/civil-servant-ranks')
      .query({ sectorGroup: 'INVALID_SECTOR' })
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(400);
  });

  it('GET /civil-servant-ranks should filter by sectorGroup', async () => {
    const payload = {
      code: nextUniqueCode('E2E-API-RANK-FILTER'),
      name: 'E2E API Rank Filter',
      rankGroup: 'A1',
      category: 'GV_DAI_HOC',
      rankType: 'TEST',
      minCoefficient: 1.11,
      maxCoefficient: 9.99,
      isActive: true,
    };

    const createdResponse = await request(httpServer())
      .post('/civil-servant-ranks')
      .set('Authorization', `Bearer ${hrToken}`)
      .send(payload)
      .expect(201);
    const created = unwrapData<RankResponseBody>(createdResponse.body);
    createdRankIds.push(created.id);

    const response = await request(httpServer())
      .get('/civil-servant-ranks')
      .query({ sectorGroup: 'GIANG_VIEN' })
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    const data = unwrapData<RankResponseBody[]>(response.body);
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((item) => item.sectorGroup === 'GIANG_VIEN')).toBe(true);
    expect(data.some((item) => item.id === created.id)).toBe(true);
  });

  it('GET /civil-servant-ranks should combine sectorGroup and active filters', async () => {
    const activePayload = {
      code: nextUniqueCode('E2E-API-RANK-ACTIVE'),
      name: 'E2E API Rank Active',
      rankGroup: 'A1',
      category: 'GV_DAI_HOC',
      rankType: 'TEST',
      minCoefficient: 1.11,
      maxCoefficient: 9.99,
      isActive: true,
    };
    const inactivePayload = {
      ...activePayload,
      code: nextUniqueCode('E2E-API-RANK-INACTIVE'),
      name: 'E2E API Rank Inactive',
      isActive: false,
    };

    const activeResponse = await request(httpServer())
      .post('/civil-servant-ranks')
      .set('Authorization', `Bearer ${hrToken}`)
      .send(activePayload)
      .expect(201);
    const activeRank = unwrapData<RankResponseBody>(activeResponse.body);
    createdRankIds.push(activeRank.id);

    const inactiveResponse = await request(httpServer())
      .post('/civil-servant-ranks')
      .set('Authorization', `Bearer ${hrToken}`)
      .send(inactivePayload)
      .expect(201);
    const inactiveRank = unwrapData<RankResponseBody>(inactiveResponse.body);
    createdRankIds.push(inactiveRank.id);

    const response = await request(httpServer())
      .get('/civil-servant-ranks')
      .query({
        sectorGroup: 'GIANG_VIEN',
        active: 'true',
        search: 'E2E API Rank',
      })
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    const data = unwrapData<RankResponseBody[]>(response.body);
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((item) => item.sectorGroup === 'GIANG_VIEN')).toBe(true);
    expect(data.every((item) => item.isActive === true)).toBe(true);
    expect(data.some((item) => item.id === activeRank.id)).toBe(true);
    expect(data.some((item) => item.id === inactiveRank.id)).toBe(false);
  });

  it('GET /civil-servant-ranks/sectors should return only non-null whitelisted values', async () => {
    const response = await request(httpServer())
      .get('/civil-servant-ranks/sectors')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    const sectors = unwrapData<string[]>(response.body);
    expect(sectors.length).toBeGreaterThan(0);
    expect(sectors.every((value) => typeof value === 'string')).toBe(true);
    expect(sectors.every((value) => value.length > 0)).toBe(true);
    expect(sectors).toContain('GIANG_VIEN');
    expect(sectors).toContain('Y_TE');
    expect(sectors).not.toContain('NULL');
  });

  it('POST /salary-scale/:rankGroup/steps should create a step for config manager', async () => {
    const level = await findAvailableStepLevel('A1');

    const response = await request(httpServer())
      .post('/salary-scale/A1/steps')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        level,
        coefficient: 9.98,
        isActive: true,
      })
      .expect(201);

    const body = unwrapData<{ id: string }>(response.body);
    createdStepIds.push(body.id);
  });

  it('GET /civil-servant-ranks/:rankId/steps should keep backward-compatible deprecation headers', async () => {
    const rankId = await createRankDirect('A1', true);

    const response = await request(httpServer())
      .get(`/civil-servant-ranks/${rankId}/steps`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    expect(response.headers.deprecation).toBe('true');
    expect(response.headers.sunset).toBe(EXPECTED_LEGACY_SUNSET);
    expect(response.headers.link).toContain('successor-version');
  });

  it('POST /employees/:id/salary-records should reject inactive rank', async () => {
    const rankId = await createRankDirect('A1', false);

    await request(httpServer())
      .post(`/employees/${tempEmployeeId}/salary-records`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        civilServantRankId: rankId,
        salaryLevel: 1,
        currentLevelDate: nextEffectiveDate(3),
        effectiveFrom: nextEffectiveDate(4),
      })
      .expect(400);
  });

  it('POST /employees/:id/salary-records should reject inactive step', async () => {
    const rankId = await createRankDirect('A2_1', true);
    const level = await findAvailableStepLevel('A2_1');
    await createStepDirect('A2_1', level, 6.66, false);

    await request(httpServer())
      .post(`/employees/${tempEmployeeId}/salary-records`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        civilServantRankId: rankId,
        salaryLevel: level,
        currentLevelDate: nextEffectiveDate(5),
        effectiveFrom: nextEffectiveDate(6),
      })
      .expect(400);
  });

  it('POST /employees/:id/salary-records should derive coefficient from step and reject duplicate effectiveFrom', async () => {
    const rankId = await createRankDirect('A2_2', true);
    const level = await findAvailableStepLevel('A2_2');
    await createStepDirect('A2_2', level, 6.66, true);

    const effectiveFrom = nextEffectiveDate(15);

    const createPayload = {
      civilServantRankId: rankId,
      salaryLevel: level,
      // Backward compatibility field. Service must ignore this and derive from step.
      coefficient: 999.99,
      currentLevelDate: nextEffectiveDate(14),
      effectiveFrom,
      decisionNo: nextUniqueCode('QD-E2E'),
      percentEnjoy: 100,
    };

    const firstResponse = await request(httpServer())
      .post(`/employees/${tempEmployeeId}/salary-records`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send(createPayload)
      .expect(201);

    const firstBody = unwrapData<SalaryRecordResponseBody>(firstResponse.body);
    createdSalaryRecordIds.push(firstBody.id);
    expect(firstBody.coefficient).toBeCloseTo(6.66, 2);

    await request(httpServer())
      .post(`/employees/${tempEmployeeId}/salary-records`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send(createPayload)
      .expect(409);
  });
});
