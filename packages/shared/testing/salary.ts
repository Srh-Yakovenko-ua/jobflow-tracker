import { type SalaryResponse, salaryResponseSchema } from '../src/schemas/analytics-salary.js';

const DESIGN_SALARY: SalaryResponse = {
  withSalary: 7,
  missing: 3,
  unconverted: 0,
  median: 4900,
  outcomes: [
    { key: 'offer', applications: 1, low: 5800, median: 5800, high: 5800 },
    { key: 'salary_rejection', applications: 2, low: 3800, median: 3950, high: 4100 },
    { key: 'other', applications: 4, low: 4500, median: 5050, high: 6000 },
  ],
  seniority: [
    { key: 'middle', applications: 4, low: 3800, median: 4300, high: 4900 },
    { key: 'senior', applications: 3, low: 5200, median: 5800, high: 6000 },
  ],
  stack: [
    { key: 'React', applications: 7, low: 3800, median: 4900, high: 6000 },
    { key: 'TypeScript', applications: 5, low: 4500, median: 5200, high: 6000 },
    { key: 'Node.js', applications: 2, low: 5800, median: 5900, high: 6000 },
  ],
  floor: { floor: 4500, rejections: 2, below: 7, perMonthLow: 3, perMonthHigh: 4 },
};

const NO_SALARY: SalaryResponse = {
  withSalary: 0,
  missing: 3,
  unconverted: 0,
  median: null,
  outcomes: [],
  seniority: [],
  stack: [],
  floor: null,
};

export function buildDesignSalary(): SalaryResponse {
  return salaryResponseSchema.parse(DESIGN_SALARY);
}

export function buildNoSalary(overrides: Partial<SalaryResponse> = {}): SalaryResponse {
  return salaryResponseSchema.parse({ ...NO_SALARY, ...overrides });
}
