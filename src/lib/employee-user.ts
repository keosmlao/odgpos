type EmployeeRow = {
  employee_id?: number | null;
  employee_code?: string | null;
  fullname_lo?: string | null;
  fullname_en?: string | null;
  nickname?: string | null;
  title_lo?: string | null;
  title_en?: string | null;
  position_code?: string | null;
  division_code?: string | null;
  department_code?: string | null;
  unit_code?: string | null;
  employment_status?: string | null;
  line_id?: string | null;
};

export type EmployeeUser = {
  employee_id: number | null;
  employee_code: string;
  code: string;
  username: string;
  name_1: string;
  name_2: string;
  fullname_lo: string;
  fullname_en: string;
  nickname: string;
  title_lo: string;
  title_en: string;
  position_code: string;
  division_code: string;
  department_code: string;
  unit_code: string;
  employment_status: string;
  line_id: string;
};

export const EMPLOYEE_USER_SELECT = `
  SELECT
    employee_id,
    employee_code,
    fullname_lo,
    fullname_en,
    nickname,
    title_lo,
    title_en,
    position_code,
    division_code,
    department_code,
    unit_code,
    employment_status,
    line_id
  FROM odg_employee
`;

export function normalizeEmployeeUser(row: EmployeeRow): EmployeeUser {
  const code = String(row.employee_code || "").trim();
  const primaryName = String(row.fullname_lo || row.nickname || row.fullname_en || code || "Employee").trim();
  const secondaryName = String(row.fullname_en || row.fullname_lo || row.nickname || primaryName).trim();

  return {
    employee_id: typeof row.employee_id === "number" ? row.employee_id : null,
    employee_code: code,
    code,
    username: primaryName,
    name_1: primaryName,
    name_2: secondaryName,
    fullname_lo: String(row.fullname_lo || primaryName),
    fullname_en: String(row.fullname_en || secondaryName),
    nickname: String(row.nickname || ""),
    title_lo: String(row.title_lo || ""),
    title_en: String(row.title_en || ""),
    position_code: String(row.position_code || ""),
    division_code: String(row.division_code || ""),
    department_code: String(row.department_code || ""),
    unit_code: String(row.unit_code || ""),
    employment_status: String(row.employment_status || ""),
    line_id: String(row.line_id || ""),
  };
}
