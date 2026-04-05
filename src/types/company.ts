export type CompanyStatus = 'active' | 'inactive';

export interface Company {
  id: string;
  name: string;
  email: string;
  status: CompanyStatus;
  createdAt: number;
}

export interface NewCompany {
  name: string;
  email: string;
}
