import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';

interface LoginResponseBody {
  accessToken: string;
}

type TokenMap = {
  admin: string;
  hr: string;
  manager: string;
  lecturerA: string;
  lecturerB: string;
  noRole: string;
};

type EmployeeIdMap = {
  hr: string;
  manager: string;
  lecturerA: string;
  lecturerB: string;
};

const unwrapData = <T>(body: unknown): T => {
  if (typeof body === 'object' && body !== null && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
};

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

describe('RBAC Any Permissions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let leaveTypeId: string;
  let noRoleUserId: string;

  const tokens: Partial<TokenMap> = {};
  const employeeIds: Partial<EmployeeIdMap> = {};

  const createdLeaveRequestIds: string[] = [];
  const createdDegreeIds: string[] = [];
  const createdCertificateIds: string[] = [];

  let leaveWindowCursor = 0;
  const nextLeaveWindow = (): { fromDate: string; toDate: string } => {
    leaveWindowCursor += 7;
    const start = new Date(
      Date.now() + leaveWindowCursor * 24 * 60 * 60 * 1000,
    );
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return {
      fromDate: toIsoDate(start),
      toDate: toIsoDate(end),
    };
  };

  const httpServer = (): Parameters<typeof request>[0] =>
    app.getHttpServer() as unknown as Parameters<typeof request>[0];

  const loginAs = async (email: string, password: string): Promise<string> => {
    const response = await request(httpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const body = unwrapData<LoginResponseBody>(response.body);
    return body.accessToken;
  };

  const loadEmployeeId = async (email: string): Promise<string> => {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        employee: {
          select: {
            id: true,
          },
        },
      },
    });

    const employeeId = user?.employee?.id;
    if (!employeeId) {
      throw new Error(`Missing employee profile for ${email}`);
    }
    return employeeId;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    const noRoleEmail = 'rbac.e2e.norole@sgu.edu.vn';
    const noRolePassword = 'NoRole@123';
    const passwordHash = await bcrypt.hash(noRolePassword, 10);

    const noRoleUser = await prisma.user.upsert({
      where: { email: noRoleEmail },
      update: {
        passwordHash,
        isActive: true,
      },
      create: {
        email: noRoleEmail,
        passwordHash,
        isActive: true,
      },
      select: { id: true },
    });
    noRoleUserId = noRoleUser.id;

    await prisma.userRole.deleteMany({
      where: { userId: noRoleUser.id },
    });

    leaveTypeId = (
      await prisma.leaveType.findUnique({
        where: { code: 'PHEP_TRUONG' },
        select: { id: true },
      })
    )?.id as string;

    if (!leaveTypeId) {
      throw new Error('Missing seed leave type PHEP_TRUONG');
    }

    employeeIds.hr = await loadEmployeeId('hr@sgu.edu.vn');
    employeeIds.manager = await loadEmployeeId('manager.fit@sgu.edu.vn');
    employeeIds.lecturerA = await loadEmployeeId('lecturer.a@sgu.edu.vn');
    employeeIds.lecturerB = await loadEmployeeId('lecturer.b@sgu.edu.vn');

    tokens.admin = await loginAs('admin@sgu.edu.vn', 'Admin@123');
    tokens.hr = await loginAs('hr@sgu.edu.vn', 'Hr@12345');
    tokens.manager = await loginAs('manager.fit@sgu.edu.vn', 'Manager@123');
    tokens.lecturerA = await loginAs('lecturer.a@sgu.edu.vn', 'Employee@123');
    tokens.lecturerB = await loginAs('lecturer.b@sgu.edu.vn', 'Employee@123');
    tokens.noRole = await loginAs(noRoleEmail, noRolePassword);
  });

  afterAll(async () => {
    if (createdLeaveRequestIds.length > 0) {
      await prisma.leaveRequest.deleteMany({
        where: { id: { in: createdLeaveRequestIds } },
      });
    }

    if (createdDegreeIds.length > 0) {
      await prisma.degree.deleteMany({
        where: { id: { in: createdDegreeIds } },
      });
    }

    if (createdCertificateIds.length > 0) {
      await prisma.certificate.deleteMany({
        where: { id: { in: createdCertificateIds } },
      });
    }

    if (noRoleUserId) {
      await prisma.userRole.deleteMany({
        where: { userId: noRoleUserId },
      });
      await prisma.user.delete({
        where: { id: noRoleUserId },
      });
    }

    await app.close();
  });

  describe('Employees RequireAnyPermissions', () => {
    it('GET /employees should allow manager (employees:read_unit)', async () => {
      await request(httpServer())
        .get('/employees')
        .set('Authorization', `Bearer ${tokens.manager as string}`)
        .expect(200);
    });

    it('GET /employees should allow employee (employees:read_own)', async () => {
      await request(httpServer())
        .get('/employees')
        .set('Authorization', `Bearer ${tokens.lecturerA as string}`)
        .expect(200);
    });

    it('GET /employees should deny user without permissions', async () => {
      await request(httpServer())
        .get('/employees')
        .set('Authorization', `Bearer ${tokens.noRole as string}`)
        .expect(403);
    });

    it('GET /employees/:id should allow own employee profile', async () => {
      const response = await request(httpServer())
        .get(`/employees/${employeeIds.lecturerA as string}`)
        .set('Authorization', `Bearer ${tokens.lecturerA as string}`)
        .expect(200);

      const body = unwrapData<{ id: string }>(response.body);
      expect(body.id).toBe(employeeIds.lecturerA);
    });

    it('GET /employees/:id should deny employee reading other profile', async () => {
      await request(httpServer())
        .get(`/employees/${employeeIds.lecturerB as string}`)
        .set('Authorization', `Bearer ${tokens.lecturerA as string}`)
        .expect(403);
    });

    it('GET /employees/:id should deny user without permissions', async () => {
      await request(httpServer())
        .get(`/employees/${employeeIds.lecturerA as string}`)
        .set('Authorization', `Bearer ${tokens.noRole as string}`)
        .expect(403);
    });
  });

  describe('Salary RequireAnyPermissions', () => {
    it('GET /employees/:employeeId/salary-records should allow own salary read', async () => {
      await request(httpServer())
        .get(`/employees/${employeeIds.lecturerA as string}/salary-records`)
        .set('Authorization', `Bearer ${tokens.lecturerA as string}`)
        .expect(200);
    });

    it('GET /employees/:employeeId/salary-records should deny user without permissions', async () => {
      await request(httpServer())
        .get(`/employees/${employeeIds.lecturerA as string}/salary-records`)
        .set('Authorization', `Bearer ${tokens.noRole as string}`)
        .expect(403);
    });
  });

  describe('Leaves RequireAnyPermissions', () => {
    it('GET /leave-types should allow employee (leaves:read_own path)', async () => {
      await request(httpServer())
        .get('/leave-types')
        .set('Authorization', `Bearer ${tokens.lecturerA as string}`)
        .expect(200);
    });

    it('GET /leave-types should deny user without permissions', async () => {
      await request(httpServer())
        .get('/leave-types')
        .set('Authorization', `Bearer ${tokens.noRole as string}`)
        .expect(403);
    });

    it('GET /employees/:employeeId/leave-requests should allow own leaves', async () => {
      await request(httpServer())
        .get(`/employees/${employeeIds.lecturerA as string}/leave-requests`)
        .set('Authorization', `Bearer ${tokens.lecturerA as string}`)
        .expect(200);
    });

    it('GET /employees/:employeeId/leave-requests should allow manager by unit scope', async () => {
      await request(httpServer())
        .get(`/employees/${employeeIds.lecturerB as string}/leave-requests`)
        .set('Authorization', `Bearer ${tokens.manager as string}`)
        .expect(200);
    });

    it('GET /employees/:employeeId/leave-requests should deny user without permissions', async () => {
      await request(httpServer())
        .get(`/employees/${employeeIds.lecturerA as string}/leave-requests`)
        .set('Authorization', `Bearer ${tokens.noRole as string}`)
        .expect(403);
    });

    it('POST /employees/:employeeId/leave-requests should allow own create request', async () => {
      const range = nextLeaveWindow();
      const response = await request(httpServer())
        .post(`/employees/${employeeIds.lecturerA as string}/leave-requests`)
        .set('Authorization', `Bearer ${tokens.lecturerA as string}`)
        .send({
          fromDate: range.fromDate,
          toDate: range.toDate,
          leaveTypeId,
          reason: `RBAC e2e own leave ${Date.now()}`,
        })
        .expect(201);

      const body = unwrapData<{ id: string }>(response.body);
      createdLeaveRequestIds.push(body.id);
    });

    it('POST /employees/:employeeId/leave-requests should allow HR create for another employee', async () => {
      const range = nextLeaveWindow();
      const response = await request(httpServer())
        .post(`/employees/${employeeIds.lecturerB as string}/leave-requests`)
        .set('Authorization', `Bearer ${tokens.hr as string}`)
        .send({
          fromDate: range.fromDate,
          toDate: range.toDate,
          leaveTypeId,
          reason: `RBAC e2e hr leave ${Date.now()}`,
        })
        .expect(201);

      const body = unwrapData<{ id: string }>(response.body);
      createdLeaveRequestIds.push(body.id);
    });

    it('POST /employees/:employeeId/leave-requests should deny user without permissions', async () => {
      const range = nextLeaveWindow();
      await request(httpServer())
        .post(`/employees/${employeeIds.lecturerA as string}/leave-requests`)
        .set('Authorization', `Bearer ${tokens.noRole as string}`)
        .send({
          fromDate: range.fromDate,
          toDate: range.toDate,
          leaveTypeId,
          reason: `RBAC e2e denied leave ${Date.now()}`,
        })
        .expect(403);
    });

    it('GET /leave-requests should allow manager queue access', async () => {
      await request(httpServer())
        .get('/leave-requests')
        .set('Authorization', `Bearer ${tokens.manager as string}`)
        .expect(200);
    });

    it('GET /leave-requests should allow employee own queue path', async () => {
      await request(httpServer())
        .get('/leave-requests')
        .set('Authorization', `Bearer ${tokens.lecturerA as string}`)
        .expect(200);
    });

    it('GET /leave-requests should deny user without permissions', async () => {
      await request(httpServer())
        .get('/leave-requests')
        .set('Authorization', `Bearer ${tokens.noRole as string}`)
        .expect(403);
    });
  });

  describe('Education RequireAnyPermissions', () => {
    it('GET /employees/:employeeId/degrees should allow own education read', async () => {
      await request(httpServer())
        .get(`/employees/${employeeIds.lecturerA as string}/degrees`)
        .set('Authorization', `Bearer ${tokens.lecturerA as string}`)
        .expect(200);
    });

    it('GET /employees/:employeeId/degrees should deny user without permissions', async () => {
      await request(httpServer())
        .get(`/employees/${employeeIds.lecturerA as string}/degrees`)
        .set('Authorization', `Bearer ${tokens.noRole as string}`)
        .expect(403);
    });

    it('POST /employees/:employeeId/degrees should allow own education write', async () => {
      const response = await request(httpServer())
        .post(`/employees/${employeeIds.lecturerA as string}/degrees`)
        .set('Authorization', `Bearer ${tokens.lecturerA as string}`)
        .send({
          degreeType: 'DAI_HOC',
          major: 'E2E RBAC Major',
          institution: 'SGU',
          graduationYear: 2020,
          degreeNumber: `E2E-DEG-${Date.now()}`,
          fileUrl: 'https://example.com/degree.pdf',
        })
        .expect(201);

      const body = unwrapData<{ id: string }>(response.body);
      createdDegreeIds.push(body.id);
    });

    it('POST /employees/:employeeId/degrees should deny user without permissions', async () => {
      await request(httpServer())
        .post(`/employees/${employeeIds.lecturerA as string}/degrees`)
        .set('Authorization', `Bearer ${tokens.noRole as string}`)
        .send({
          degreeType: 'DAI_HOC',
          major: 'Denied Degree',
          institution: 'SGU',
          graduationYear: 2021,
        })
        .expect(403);
    });

    it('GET /employees/:employeeId/certificates should allow own education read', async () => {
      await request(httpServer())
        .get(`/employees/${employeeIds.lecturerA as string}/certificates`)
        .set('Authorization', `Bearer ${tokens.lecturerA as string}`)
        .expect(200);
    });

    it('GET /employees/:employeeId/certificates should deny user without permissions', async () => {
      await request(httpServer())
        .get(`/employees/${employeeIds.lecturerA as string}/certificates`)
        .set('Authorization', `Bearer ${tokens.noRole as string}`)
        .expect(403);
    });

    it('POST /employees/:employeeId/certificates should allow own education write', async () => {
      const response = await request(httpServer())
        .post(`/employees/${employeeIds.lecturerA as string}/certificates`)
        .set('Authorization', `Bearer ${tokens.lecturerA as string}`)
        .send({
          name: `E2E Certificate ${Date.now()}`,
          issuedBy: 'SGU',
          issuedDate: '2024-01-01',
          fileUrl: 'https://example.com/cert.pdf',
        })
        .expect(201);

      const body = unwrapData<{ id: string }>(response.body);
      createdCertificateIds.push(body.id);
    });

    it('POST /employees/:employeeId/certificates should deny user without permissions', async () => {
      await request(httpServer())
        .post(`/employees/${employeeIds.lecturerA as string}/certificates`)
        .set('Authorization', `Bearer ${tokens.noRole as string}`)
        .send({
          name: 'Denied Certificate',
          issuedBy: 'SGU',
        })
        .expect(403);
    });
  });
});
