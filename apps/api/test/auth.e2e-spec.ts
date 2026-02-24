import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';

interface LoginResponseBody {
  accessToken: string;
  expiresIn: number;
}

interface UserProfileResponseBody {
  email: string;
}

const unwrapData = <T>(body: unknown): T => {
  if (typeof body === 'object' && body !== null && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
};

const toCookieList = (
  setCookieHeader: string | string[] | undefined,
): string[] => {
  if (Array.isArray(setCookieHeader)) {
    return setCookieHeader;
  }

  if (typeof setCookieHeader === 'string') {
    return [setCookieHeader];
  }

  return [];
};

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  const httpServer = (): Parameters<typeof request>[0] =>
    app.getHttpServer() as unknown as Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Login flow', () => {
    it('should login successfully with admin account', async () => {
      const response = await request(httpServer())
        .post('/auth/login')
        .send({
          email: 'admin@sgu.edu.vn',
          password: 'Admin@123',
        })
        .expect(200);

      const body = unwrapData<Partial<LoginResponseBody>>(response.body);
      expect(typeof body.accessToken).toBe('string');
      expect(typeof body.expiresIn).toBe('number');

      const setCookieHeader = response.headers['set-cookie'];
      const cookies = toCookieList(setCookieHeader);
      const refreshCookie = cookies?.find((cookie) =>
        cookie.startsWith('refreshToken='),
      );
      expect(refreshCookie).toBeDefined();
    });

    it('should fail to login with wrong password', async () => {
      await request(httpServer())
        .post('/auth/login')
        .send({
          email: 'admin@sgu.edu.vn',
          password: 'WrongPassword',
        })
        .expect(401);
    });

    it('should refresh access token from httpOnly refresh cookie', async () => {
      const loginResponse = await request(httpServer())
        .post('/auth/login')
        .send({
          email: 'admin@sgu.edu.vn',
          password: 'Admin@123',
        })
        .expect(200);

      const setCookieHeader = loginResponse.headers['set-cookie'];
      const cookies = toCookieList(setCookieHeader);
      const refreshCookie = cookies?.find((cookie) =>
        cookie.startsWith('refreshToken='),
      );
      expect(refreshCookie).toBeDefined();

      const refreshResponse = await request(httpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshCookie ?? '')
        .expect(200);

      const body = unwrapData<Partial<LoginResponseBody>>(refreshResponse.body);
      expect(typeof body.accessToken).toBe('string');
      expect(typeof body.expiresIn).toBe('number');
    });
  });

  describe('RBAC Protection', () => {
    let adminToken: string;

    beforeAll(async () => {
      const response = await request(httpServer()).post('/auth/login').send({
        email: 'admin@sgu.edu.vn',
        password: 'Admin@123',
      });
      const body = unwrapData<LoginResponseBody>(response.body);
      adminToken = body.accessToken;
    });

    it('GET /users/me should return profiles for authenticated users', async () => {
      const response = await request(httpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = unwrapData<UserProfileResponseBody>(response.body);
      expect(body.email).toBe('admin@sgu.edu.vn');
    });

    it('GET /users/me should return 401 without token', async () => {
      await request(httpServer()).get('/users/me').expect(401);
    });

    it('GET /users should be accessible by admin', async () => {
      await request(httpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('GET /users should return 401 for invalid token', async () => {
      await request(httpServer())
        .get('/users')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);
    });
  });
});
