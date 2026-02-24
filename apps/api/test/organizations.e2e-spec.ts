import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { configureApp } from './../src/app.setup';

interface LoginResponseBody {
  accessToken: string;
}

interface UnitTreeNode {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  level: number;
  path: string;
  status: string;
  isDeleted: boolean;
  deletedAt: string | null;
  children: UnitTreeNode[];
}

const findUnitByCode = (
  nodes: UnitTreeNode[],
  code: string,
): UnitTreeNode | undefined => {
  for (const node of nodes) {
    if (node.code === code) {
      return node;
    }

    const foundInChildren = findUnitByCode(node.children ?? [], code);
    if (foundInChildren) {
      return foundInChildren;
    }
  }

  return undefined;
};

const unwrapData = <T>(body: unknown): T => {
  if (typeof body === 'object' && body !== null && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
};

describe('Organizations (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let prisma: PrismaService;
  const httpServer = (): Parameters<typeof request>[0] =>
    app.getHttpServer() as unknown as Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    // Login as admin to get token
    const loginRes = await request(httpServer())
      .post('/auth/login')
      .send({ email: 'admin@sgu.edu.vn', password: 'Admin@123' });
    const loginBody = unwrapData<LoginResponseBody>(loginRes.body);
    adminToken = loginBody.accessToken;

    // Clean up test data
    prisma = app.get(PrismaService);
    await prisma.unit.deleteMany({
      where: { code: 'TEST_KHOA' },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /units', () => {
    it('should return the organization tree', async () => {
      const res = await request(httpServer())
        .get('/units')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const tree = unwrapData<UnitTreeNode[]>(res.body);
      expect(Array.isArray(tree)).toBe(true);
      // Should have at least the seeded root unit ("SGU")
      expect(tree.length).toBeGreaterThanOrEqual(1);
      // Root node should have expected shape
      const root = tree[0];
      expect(root).toHaveProperty('id');
      expect(root).toHaveProperty('code');
      expect(root).toHaveProperty('name');
      expect(root).toHaveProperty('children');
    });

    it('should return 401 without auth', async () => {
      await request(httpServer()).get('/units').expect(401);
    });
  });

  describe('POST /units', () => {
    it('should create a new child unit', async () => {
      // Get existing root unit
      const treeRes = await request(httpServer())
        .get('/units')
        .set('Authorization', `Bearer ${adminToken}`);
      const tree = unwrapData<UnitTreeNode[]>(treeRes.body);
      const rootId = tree[0]?.id;
      expect(rootId).toBeDefined();
      if (!rootId) {
        throw new Error('Root unit not found');
      }

      const res = await request(httpServer())
        .post('/units')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'TEST_KHOA',
          name: 'Khoa Test',
          parentId: rootId,
          unitType: 'KHOA',
        })
        .expect(201);

      const body = unwrapData<UnitTreeNode>(res.body);
      expect(body.code).toBe('TEST_KHOA');
      expect(body.parentId).toBe(rootId);
      expect(body.level).toBe(1);
      expect(body.path).toContain('test_khoa');
    });

    it('should reject duplicate code', async () => {
      const treeRes = await request(httpServer())
        .get('/units')
        .set('Authorization', `Bearer ${adminToken}`);
      const tree = unwrapData<UnitTreeNode[]>(treeRes.body);
      const rootId = tree[0]?.id;
      expect(rootId).toBeDefined();
      if (!rootId) {
        throw new Error('Root unit not found');
      }

      await request(httpServer())
        .post('/units')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'TEST_KHOA',
          name: 'Duplicate',
          parentId: rootId,
          unitType: 'KHOA',
        })
        .expect(409);
    });
  });

  describe('PATCH /units/:id', () => {
    it('should update a unit name', async () => {
      // Find the test unit we created
      const treeRes = await request(httpServer())
        .get('/units')
        .set('Authorization', `Bearer ${adminToken}`);
      const tree = unwrapData<UnitTreeNode[]>(treeRes.body);
      const root = tree[0];
      const testUnit = root.children.find((c) => c.code === 'TEST_KHOA');
      expect(testUnit).toBeDefined();
      if (!testUnit) {
        throw new Error('Test unit not found');
      }

      const res = await request(httpServer())
        .patch(`/units/${testUnit.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Khoa Test Updated' })
        .expect(200);

      const body = unwrapData<UnitTreeNode>(res.body);
      expect(body.name).toBe('Khoa Test Updated');
    });
  });

  describe('GET /units/:id/employees', () => {
    it('should return employees list (empty for new unit)', async () => {
      const treeRes = await request(httpServer())
        .get('/units')
        .set('Authorization', `Bearer ${adminToken}`);
      const tree = unwrapData<UnitTreeNode[]>(treeRes.body);
      const root = tree[0];
      const testUnit = root.children.find((c) => c.code === 'TEST_KHOA');
      expect(testUnit).toBeDefined();
      if (!testUnit) {
        throw new Error('Test unit not found');
      }

      const res = await request(httpServer())
        .get(`/units/${testUnit.id}/employees`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = unwrapData<unknown[]>(res.body);
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe('DELETE /units/:id', () => {
    it('should soft-delete a unit (set isDeleted/deletedAt)', async () => {
      const treeRes = await request(httpServer())
        .get('/units')
        .set('Authorization', `Bearer ${adminToken}`);
      const tree = unwrapData<UnitTreeNode[]>(treeRes.body);
      const root = tree[0];
      const testUnit = root.children.find((c) => c.code === 'TEST_KHOA');
      expect(testUnit).toBeDefined();
      if (!testUnit) {
        throw new Error('Test unit not found');
      }

      const res = await request(httpServer())
        .delete(`/units/${testUnit.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = unwrapData<UnitTreeNode>(res.body);
      expect(body.isDeleted).toBe(true);
      expect(body.deletedAt).toBeTruthy();
    });

    it('should hide soft-deleted units by default', async () => {
      const res = await request(httpServer())
        .get('/units')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const tree = unwrapData<UnitTreeNode[]>(res.body);
      const unit = findUnitByCode(tree, 'TEST_KHOA');
      expect(unit).toBeUndefined();
    });

    it('should include soft-deleted units for admin when requested', async () => {
      const res = await request(httpServer())
        .get('/units?includeSoftDeleted=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const tree = unwrapData<UnitTreeNode[]>(res.body);
      const unit = findUnitByCode(tree, 'TEST_KHOA');
      expect(unit).toBeDefined();
      expect(unit?.isDeleted).toBe(true);
    });
  });

  describe('DELETE /units/:id/hard', () => {
    it('should permanently delete a previously soft-deleted unit', async () => {
      const treeRes = await request(httpServer())
        .get('/units?includeSoftDeleted=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const tree = unwrapData<UnitTreeNode[]>(treeRes.body);
      const testUnit = findUnitByCode(tree, 'TEST_KHOA');
      expect(testUnit).toBeDefined();
      if (!testUnit) {
        throw new Error('Soft-deleted test unit not found');
      }

      const hardDeleteRes = await request(httpServer())
        .delete(`/units/${testUnit.id}/hard`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const deletedBody = unwrapData<UnitTreeNode>(hardDeleteRes.body);
      expect(deletedBody.code).toBe('TEST_KHOA');

      const verifyRes = await request(httpServer())
        .get('/units?includeSoftDeleted=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const verifyTree = unwrapData<UnitTreeNode[]>(verifyRes.body);
      expect(findUnitByCode(verifyTree, 'TEST_KHOA')).toBeUndefined();
    });
  });
});
