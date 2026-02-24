export enum Gender {
  MALE = 'NAM',
  FEMALE = 'NU',
}

export enum EmployeeStatus {
  WORKING = 'WORKING',
  ON_LEAVE = 'ON_LEAVE',
  LONG_LEAVE = 'LONG_LEAVE',
  RESIGNED = 'RESIGNED',
  RETIRED = 'RETIRED',
}

export interface Employee {
  id: string;
  userId?: string;
  employeeCode: string;
  citizenId: string;
  fullName: string;
  aliasName?: string;
  avatarUrl?: string;
  dob: string; // ISO Date
  gender: Gender;
  email?: string;
  phone?: string;
  unitId: string;
  unit?: {
    id: string;
    name: string;
    code: string;
  };
  status: EmployeeStatus;
  jobTitle?: string;
  citizenCardDate?: string;
  citizenCardPlace?: string;
  ethnicityId?: string;
  religionId?: string;
  initialRecruitmentDate?: string;
  initialRecruitmentAgency?: string;
  currentOrgJoinDate?: string;
  officialDate?: string;
  highestDegree?: string;
  
  // Add other fields as needed for the list view
  currentPosition?: string;
  civilServantRankId?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeDto {
  employeeCode: string;
  citizenId: string;
  fullName: string;
  aliasName?: string;
  dob: string;
  gender: Gender;
  unitId: string;
  email?: string;
  phone?: string;
  citizenCardDate?: string;
  citizenCardPlace?: string;
  ethnicityId?: string;
  religionId?: string;
  officialDate?: string;
  initialRecruitmentDate?: string;
  initialRecruitmentAgency?: string;
  currentOrgJoinDate?: string;
  // ... maps to backend DTO
}

export interface EmployeeQuery {
  page?: number;
  limit?: number;
  search?: string;
  unitId?: string;
  status?: EmployeeStatus;
}

export interface EmployeeResponse {
  data: Employee[];
  total: number;
  page: number;
  limit: number;
}
