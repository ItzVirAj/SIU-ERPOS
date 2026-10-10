/**
 * Role & Permissions Definitions - Single Source of Truth
 *
 * Semantics & Guidelines:
 * - EMPLOYEES:
 *   VIEW = basic directory fields only (name, role, department, work email);
 *   WRITE = create/edit employees, suspend/restore, revoke sessions, reset passwords;
 *   MANAGE = soft-delete/terminate employees and change roles.
 *   All employee actions are additionally limited by hierarchy
 *   (actor.level must be strictly higher than target.level; owner is the exception for non-self actions)
 *   - this hierarchy check is implemented in a later task, not now.
 *   HR and CTO CAN soft-delete employees (EMPLOYEES = MANAGE) but only those with a strictly lower role level.
 * - ROLES:
 *   only owner has MANAGE (can edit role definitions); the owner's access can never be reduced.
 * - AUDIT_LOGS:
 *   never above VIEW (immutable logs).
 * - Every authenticated active user can always manage their own password,
 *   sessions and basic profile; this is outside the matrix.
 */

import { AppModule, AccessLevel } from './prisma-client'

export { AppModule, AccessLevel }

export const MODULES = [
  AppModule.WORK,
  AppModule.COLLAB,
  AppModule.CRM,
  AppModule.FINANCE,
  AppModule.PRODUCTS,
  AppModule.REPORTS,
  AppModule.AUTOMATIONS,
  AppModule.EMPLOYEES,
  AppModule.ROLES,
  AppModule.DEV_SETTINGS,
  AppModule.COMPANY_SETTINGS,
  AppModule.AUDIT_LOGS,
] as const

export type LegacyTeamRole = 'admin' | 'developer' | 'viewer'

export interface RoleDefinition {
  key: string
  name: string
  description: string
  level: number
  legacyTeamRole: LegacyTeamRole
  access: Record<AppModule, AccessLevel>
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'System owner with full administrative and governance privileges',
    level: 100,
    legacyTeamRole: 'admin',
    access: {
      [AppModule.WORK]: AccessLevel.MANAGE,
      [AppModule.COLLAB]: AccessLevel.MANAGE,
      [AppModule.CRM]: AccessLevel.MANAGE,
      [AppModule.FINANCE]: AccessLevel.MANAGE,
      [AppModule.PRODUCTS]: AccessLevel.MANAGE,
      [AppModule.REPORTS]: AccessLevel.MANAGE,
      [AppModule.AUTOMATIONS]: AccessLevel.MANAGE,
      [AppModule.EMPLOYEES]: AccessLevel.MANAGE,
      [AppModule.ROLES]: AccessLevel.MANAGE,
      [AppModule.DEV_SETTINGS]: AccessLevel.MANAGE,
      [AppModule.COMPANY_SETTINGS]: AccessLevel.MANAGE,
      [AppModule.AUDIT_LOGS]: AccessLevel.VIEW,
    },
  },
  {
    key: 'ceo',
    name: 'Chief Executive Officer',
    description: 'Executive leadership with comprehensive organizational oversight',
    level: 90,
    legacyTeamRole: 'admin',
    access: {
      [AppModule.WORK]: AccessLevel.MANAGE,
      [AppModule.COLLAB]: AccessLevel.MANAGE,
      [AppModule.CRM]: AccessLevel.MANAGE,
      [AppModule.FINANCE]: AccessLevel.MANAGE,
      [AppModule.PRODUCTS]: AccessLevel.MANAGE,
      [AppModule.REPORTS]: AccessLevel.MANAGE,
      [AppModule.AUTOMATIONS]: AccessLevel.MANAGE,
      [AppModule.EMPLOYEES]: AccessLevel.MANAGE,
      [AppModule.ROLES]: AccessLevel.VIEW,
      [AppModule.DEV_SETTINGS]: AccessLevel.VIEW,
      [AppModule.COMPANY_SETTINGS]: AccessLevel.MANAGE,
      [AppModule.AUDIT_LOGS]: AccessLevel.VIEW,
    },
  },
  {
    key: 'cto',
    name: 'Chief Technology Officer',
    description: 'Technical leadership, engineering operations, and developer administration',
    level: 80,
    legacyTeamRole: 'admin',
    access: {
      [AppModule.WORK]: AccessLevel.MANAGE,
      [AppModule.COLLAB]: AccessLevel.MANAGE,
      [AppModule.CRM]: AccessLevel.VIEW,
      [AppModule.FINANCE]: AccessLevel.VIEW,
      [AppModule.PRODUCTS]: AccessLevel.MANAGE,
      [AppModule.REPORTS]: AccessLevel.WRITE,
      [AppModule.AUTOMATIONS]: AccessLevel.MANAGE,
      [AppModule.EMPLOYEES]: AccessLevel.MANAGE,
      [AppModule.ROLES]: AccessLevel.NONE,
      [AppModule.DEV_SETTINGS]: AccessLevel.MANAGE,
      [AppModule.COMPANY_SETTINGS]: AccessLevel.VIEW,
      [AppModule.AUDIT_LOGS]: AccessLevel.VIEW,
    },
  },
  {
    key: 'hr',
    name: 'Human Resources',
    description: 'Employee management, directory administration, and HR operations',
    level: 70,
    legacyTeamRole: 'admin',
    access: {
      [AppModule.WORK]: AccessLevel.VIEW,
      [AppModule.COLLAB]: AccessLevel.WRITE,
      [AppModule.CRM]: AccessLevel.NONE,
      [AppModule.FINANCE]: AccessLevel.NONE,
      [AppModule.PRODUCTS]: AccessLevel.NONE,
      [AppModule.REPORTS]: AccessLevel.VIEW,
      [AppModule.AUTOMATIONS]: AccessLevel.NONE,
      [AppModule.EMPLOYEES]: AccessLevel.MANAGE,
      [AppModule.ROLES]: AccessLevel.NONE,
      [AppModule.DEV_SETTINGS]: AccessLevel.NONE,
      [AppModule.COMPANY_SETTINGS]: AccessLevel.VIEW,
      [AppModule.AUDIT_LOGS]: AccessLevel.VIEW,
    },
  },
  {
    key: 'finance_manager',
    name: 'Finance Manager',
    description: 'Financial management, invoicing, payments, and financial reporting',
    level: 70,
    legacyTeamRole: 'developer',
    access: {
      [AppModule.WORK]: AccessLevel.VIEW,
      [AppModule.COLLAB]: AccessLevel.WRITE,
      [AppModule.CRM]: AccessLevel.VIEW,
      [AppModule.FINANCE]: AccessLevel.MANAGE,
      [AppModule.PRODUCTS]: AccessLevel.VIEW,
      [AppModule.REPORTS]: AccessLevel.WRITE,
      [AppModule.AUTOMATIONS]: AccessLevel.NONE,
      [AppModule.EMPLOYEES]: AccessLevel.VIEW,
      [AppModule.ROLES]: AccessLevel.NONE,
      [AppModule.DEV_SETTINGS]: AccessLevel.NONE,
      [AppModule.COMPANY_SETTINGS]: AccessLevel.NONE,
      [AppModule.AUDIT_LOGS]: AccessLevel.VIEW,
    },
  },
  {
    key: 'admin',
    name: 'Admin (IT/Office)',
    description: 'IT systems, developer settings, office infrastructure, and administration',
    level: 60,
    legacyTeamRole: 'admin',
    access: {
      [AppModule.WORK]: AccessLevel.VIEW,
      [AppModule.COLLAB]: AccessLevel.WRITE,
      [AppModule.CRM]: AccessLevel.NONE,
      [AppModule.FINANCE]: AccessLevel.NONE,
      [AppModule.PRODUCTS]: AccessLevel.NONE,
      [AppModule.REPORTS]: AccessLevel.VIEW,
      [AppModule.AUTOMATIONS]: AccessLevel.NONE,
      [AppModule.EMPLOYEES]: AccessLevel.VIEW,
      [AppModule.ROLES]: AccessLevel.NONE,
      [AppModule.DEV_SETTINGS]: AccessLevel.MANAGE,
      [AppModule.COMPANY_SETTINGS]: AccessLevel.WRITE,
      [AppModule.AUDIT_LOGS]: AccessLevel.VIEW,
    },
  },
  {
    key: 'project_manager',
    name: 'Project Manager',
    description: 'Project management, product oversight, issues, and delivery workflows',
    level: 60,
    legacyTeamRole: 'developer',
    access: {
      [AppModule.WORK]: AccessLevel.MANAGE,
      [AppModule.COLLAB]: AccessLevel.WRITE,
      [AppModule.CRM]: AccessLevel.VIEW,
      [AppModule.FINANCE]: AccessLevel.NONE,
      [AppModule.PRODUCTS]: AccessLevel.MANAGE,
      [AppModule.REPORTS]: AccessLevel.WRITE,
      [AppModule.AUTOMATIONS]: AccessLevel.WRITE,
      [AppModule.EMPLOYEES]: AccessLevel.VIEW,
      [AppModule.ROLES]: AccessLevel.NONE,
      [AppModule.DEV_SETTINGS]: AccessLevel.NONE,
      [AppModule.COMPANY_SETTINGS]: AccessLevel.NONE,
      [AppModule.AUDIT_LOGS]: AccessLevel.NONE,
    },
  },
  {
    key: 'sales_manager',
    name: 'Sales Manager',
    description: 'Sales pipeline leadership, CRM management, and deal operations',
    level: 60,
    legacyTeamRole: 'developer',
    access: {
      [AppModule.WORK]: AccessLevel.VIEW,
      [AppModule.COLLAB]: AccessLevel.WRITE,
      [AppModule.CRM]: AccessLevel.MANAGE,
      [AppModule.FINANCE]: AccessLevel.VIEW,
      [AppModule.PRODUCTS]: AccessLevel.VIEW,
      [AppModule.REPORTS]: AccessLevel.WRITE,
      [AppModule.AUTOMATIONS]: AccessLevel.NONE,
      [AppModule.EMPLOYEES]: AccessLevel.VIEW,
      [AppModule.ROLES]: AccessLevel.NONE,
      [AppModule.DEV_SETTINGS]: AccessLevel.NONE,
      [AppModule.COMPANY_SETTINGS]: AccessLevel.NONE,
      [AppModule.AUDIT_LOGS]: AccessLevel.NONE,
    },
  },
  {
    key: 'team_lead',
    name: 'Team Lead',
    description: 'Team operational leadership, task assignment, and delivery coordination',
    level: 50,
    legacyTeamRole: 'developer',
    access: {
      [AppModule.WORK]: AccessLevel.WRITE,
      [AppModule.COLLAB]: AccessLevel.WRITE,
      [AppModule.CRM]: AccessLevel.NONE,
      [AppModule.FINANCE]: AccessLevel.NONE,
      [AppModule.PRODUCTS]: AccessLevel.VIEW,
      [AppModule.REPORTS]: AccessLevel.VIEW,
      [AppModule.AUTOMATIONS]: AccessLevel.VIEW,
      [AppModule.EMPLOYEES]: AccessLevel.VIEW,
      [AppModule.ROLES]: AccessLevel.NONE,
      [AppModule.DEV_SETTINGS]: AccessLevel.NONE,
      [AppModule.COMPANY_SETTINGS]: AccessLevel.NONE,
      [AppModule.AUDIT_LOGS]: AccessLevel.NONE,
    },
  },
  {
    key: 'developer',
    name: 'Developer',
    description: 'Software engineering, issue tracking, and technical contributions',
    level: 40,
    legacyTeamRole: 'developer',
    access: {
      [AppModule.WORK]: AccessLevel.WRITE,
      [AppModule.COLLAB]: AccessLevel.WRITE,
      [AppModule.CRM]: AccessLevel.NONE,
      [AppModule.FINANCE]: AccessLevel.NONE,
      [AppModule.PRODUCTS]: AccessLevel.VIEW,
      [AppModule.REPORTS]: AccessLevel.VIEW,
      [AppModule.AUTOMATIONS]: AccessLevel.NONE,
      [AppModule.EMPLOYEES]: AccessLevel.VIEW,
      [AppModule.ROLES]: AccessLevel.NONE,
      [AppModule.DEV_SETTINGS]: AccessLevel.WRITE,
      [AppModule.COMPANY_SETTINGS]: AccessLevel.NONE,
      [AppModule.AUDIT_LOGS]: AccessLevel.NONE,
    },
  },
  {
    key: 'sales_executive',
    name: 'Sales Executive',
    description: 'Lead handling, client communications, and CRM pipeline execution',
    level: 40,
    legacyTeamRole: 'developer',
    access: {
      [AppModule.WORK]: AccessLevel.VIEW,
      [AppModule.COLLAB]: AccessLevel.WRITE,
      [AppModule.CRM]: AccessLevel.WRITE,
      [AppModule.FINANCE]: AccessLevel.NONE,
      [AppModule.PRODUCTS]: AccessLevel.VIEW,
      [AppModule.REPORTS]: AccessLevel.VIEW,
      [AppModule.AUTOMATIONS]: AccessLevel.NONE,
      [AppModule.EMPLOYEES]: AccessLevel.VIEW,
      [AppModule.ROLES]: AccessLevel.NONE,
      [AppModule.DEV_SETTINGS]: AccessLevel.NONE,
      [AppModule.COMPANY_SETTINGS]: AccessLevel.NONE,
      [AppModule.AUDIT_LOGS]: AccessLevel.NONE,
    },
  },
  {
    key: 'accountant',
    name: 'Accountant',
    description: 'Financial bookkeeping, invoice processing, and financial reporting',
    level: 40,
    legacyTeamRole: 'developer',
    access: {
      [AppModule.WORK]: AccessLevel.VIEW,
      [AppModule.COLLAB]: AccessLevel.WRITE,
      [AppModule.CRM]: AccessLevel.NONE,
      [AppModule.FINANCE]: AccessLevel.WRITE,
      [AppModule.PRODUCTS]: AccessLevel.VIEW,
      [AppModule.REPORTS]: AccessLevel.VIEW,
      [AppModule.AUTOMATIONS]: AccessLevel.NONE,
      [AppModule.EMPLOYEES]: AccessLevel.VIEW,
      [AppModule.ROLES]: AccessLevel.NONE,
      [AppModule.DEV_SETTINGS]: AccessLevel.NONE,
      [AppModule.COMPANY_SETTINGS]: AccessLevel.NONE,
      [AppModule.AUDIT_LOGS]: AccessLevel.NONE,
    },
  },
  {
    key: 'viewer',
    name: 'Viewer',
    description: 'Read-only view access across work and collaboration spaces',
    level: 10,
    legacyTeamRole: 'viewer',
    access: {
      [AppModule.WORK]: AccessLevel.VIEW,
      [AppModule.COLLAB]: AccessLevel.VIEW,
      [AppModule.CRM]: AccessLevel.NONE,
      [AppModule.FINANCE]: AccessLevel.NONE,
      [AppModule.PRODUCTS]: AccessLevel.NONE,
      [AppModule.REPORTS]: AccessLevel.NONE,
      [AppModule.AUTOMATIONS]: AccessLevel.NONE,
      [AppModule.EMPLOYEES]: AccessLevel.NONE,
      [AppModule.ROLES]: AccessLevel.NONE,
      [AppModule.DEV_SETTINGS]: AccessLevel.NONE,
      [AppModule.COMPANY_SETTINGS]: AccessLevel.NONE,
      [AppModule.AUDIT_LOGS]: AccessLevel.NONE,
    },
  },
]

export const ROLES_BY_KEY: Record<string, RoleDefinition> = Object.fromEntries(
  ROLE_DEFINITIONS.map((role) => [role.key, role])
)
