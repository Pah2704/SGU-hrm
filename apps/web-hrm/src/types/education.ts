export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type DegreeType =
  | 'TRUNG_CAP'
  | 'CAO_DANG'
  | 'DAI_HOC'
  | 'THAC_SI'
  | 'TIEN_SI';

export interface DegreeRecord {
  id: string;
  employeeId: string;
  degreeType: DegreeType;
  major: string;
  institution: string;
  graduationYear: number;
  degreeNumber?: string | null;
  fileUrl?: string | null;
  status: ApprovalStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateRecord {
  id: string;
  employeeId: string;
  name: string;
  issuedBy: string;
  issuedDate?: string | null;
  expiryDate?: string | null;
  fileUrl?: string | null;
  status: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDegreePayload {
  degreeType: DegreeType;
  major: string;
  institution: string;
  graduationYear: number;
  degreeNumber?: string;
  fileUrl?: string;
}

export interface CreateCertificatePayload {
  name: string;
  issuedBy: string;
  issuedDate?: string;
  expiryDate?: string;
  fileUrl?: string;
}
