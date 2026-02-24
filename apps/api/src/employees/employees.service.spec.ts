import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Gender } from '@prisma/client';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../modules/audit/audit.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

interface PrismaMock {
  employee: {
    findFirst: jest.Mock;
    create: jest.Mock;
    count: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  user: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
  $transaction: jest.Mock;
}

const createPrismaMock = (): PrismaMock => {
  const prismaMock: PrismaMock = {
    employee: {
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  prismaMock.$transaction.mockImplementation(
    async (callback: (tx: PrismaMock) => Promise<unknown>) =>
      callback(prismaMock),
  );

  return prismaMock;
};

describe('EmployeesService', () => {
  let service: EmployeesService;
  let mockPrisma: PrismaMock;
  let mockAuditService: { record: jest.Mock };

  beforeEach(async () => {
    mockPrisma = createPrismaMock();
    mockAuditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_123456789');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        {
          provide: PrismaService,
          useValue: mockPrisma as unknown as PrismaService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      employeeCode: 'EMP001',
      fullName: 'Test Employee',
      citizenId: '123456789',
      email: 'test@example.com',
      dob: '1990-01-01',
      gender: Gender.NAM,
      unitId: 'unit-1',
    };

    it('should create new User if email provided and user does not exist', async () => {
      // Setup
      mockPrisma.employee.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const hashedPassword = 'hashed_123456789';
      const mockEmployee = { id: 'emp-1', ...createDto, userId: 'user-new' };
      const mockUser = { id: 'user-new', email: createDto.email };

      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.employee.create.mockResolvedValue(mockEmployee);

      // Execute
      const result = await service.create(createDto);

      // Verify
      expect(mockPrisma.employee.findFirst).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith(createDto.citizenId, 10);
      const userCreateCalls = mockPrisma.user.create.mock.calls as Array<
        [unknown]
      >;
      const userCreateArg = userCreateCalls[0]?.[0] as {
        data: {
          email: string;
          passwordHash: string;
          isActive: boolean;
        };
      };
      expect(userCreateArg.data.email).toBe(createDto.email);
      expect(userCreateArg.data.passwordHash).toBe(hashedPassword);
      expect(userCreateArg.data.isActive).toBe(true);

      const employeeCreateCalls = mockPrisma.employee.create.mock
        .calls as Array<[unknown]>;
      const employeeCreateArg = employeeCreateCalls[0]?.[0] as {
        data: {
          userId: string;
          employeeCode: string;
        };
      };
      expect(employeeCreateArg.data.userId).toBe('user-new');
      expect(employeeCreateArg.data.employeeCode).toBe(createDto.employeeCode);
      expect(result).toEqual(mockEmployee);
    });

    it('should link existing User if user exists but has no employee profile', async () => {
      // Setup
      mockPrisma.employee.findFirst.mockResolvedValue(null);
      const existingUser = {
        id: 'user-existing',
        email: createDto.email,
        employee: null,
      };
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      const mockEmployee = {
        id: 'emp-1',
        ...createDto,
        userId: 'user-existing',
      };
      mockPrisma.employee.create.mockResolvedValue(mockEmployee);

      // Execute
      await service.create(createDto);

      // Verify
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      const employeeCreateCalls = mockPrisma.employee.create.mock
        .calls as Array<[unknown]>;
      const employeeCreateArg = employeeCreateCalls[0]?.[0] as {
        data: {
          userId: string;
        };
      };
      expect(employeeCreateArg.data.userId).toBe('user-existing');
    });

    it('should fail if User exists and already linked to another employee', async () => {
      // Setup
      mockPrisma.employee.findFirst.mockResolvedValue(null);
      const linkedUser = {
        id: 'user-linked',
        email: createDto.email,
        employee: { id: 'other-emp' },
      };
      mockPrisma.user.findUnique.mockResolvedValue(linkedUser);

      // Execute & Verify
      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.employee.create).not.toHaveBeenCalled();
    });

    it('should fail if Employee data (email/citizenId/code) duplicates', async () => {
      // Setup
      mockPrisma.employee.findFirst.mockResolvedValue({ id: 'existing-emp' });

      // Execute & Verify
      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft-delete employee by setting deletedAt', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp-1',
        deletedAt: null,
      });
      const deletedAt = new Date('2026-02-11T12:00:00.000Z');
      mockPrisma.employee.update.mockResolvedValue({ id: 'emp-1', deletedAt });

      const result = await service.remove('emp-1');

      const updateCalls = mockPrisma.employee.update.mock.calls as Array<
        [unknown]
      >;
      const updateArg = updateCalls[0]?.[0] as {
        where: { id: string };
        data: { deletedAt: Date };
      };

      expect(updateArg.where.id).toBe('emp-1');
      expect(updateArg.data.deletedAt).toBeInstanceOf(Date);
      expect(result).toEqual({ id: 'emp-1', deletedAt });
    });

    it('should fail when employee is already soft-deleted', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp-1',
        deletedAt: new Date('2026-02-11T00:00:00.000Z'),
      });

      await expect(service.remove('emp-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.employee.update).not.toHaveBeenCalled();
    });
  });
});
