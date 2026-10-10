import {
  EmployeeListResponse,
  EmployeeDetail,
  RolesListResponse,
  MyAccessResponse,
  CreateEmployeeInput,
  CreateEmployeeResponse,
  UpdateEmployeeInput,
  ChangeRoleInput,
  SuspendEmployeeInput,
  RevokeSessionsInput,
  ResetPasswordInput,
  ResetPasswordResponse,
  DeleteEmployeeInput,
} from "@/lib/types/admin"

export class AdminApiError extends Error {
  public status: number
  public code?: string
  public fieldErrors?: Record<string, string[]>
  public details?: string[]

  constructor(
    status: number,
    message: string,
    code?: string,
    details?: string[],
    fieldErrors?: Record<string, string[]>
  ) {
    super(message)
    this.name = "AdminApiError"
    this.status = status
    this.code = code
    this.details = details
    this.fieldErrors = fieldErrors
  }
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json")
  }
  headers.set("Cache-Control", "no-store")

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "same-origin",
  })

  if (!response.ok) {
    let errorData: any = {}
    try {
      errorData = await response.json()
    } catch {
      errorData = { error: response.statusText }
    }

    const message =
      errorData.error ||
      errorData.message ||
      `Request failed with status ${response.status}`
    const code = errorData.code

    // Central handling for authentication & security invariants
    if (typeof window !== "undefined") {
      if (response.status === 401) {
        window.location.href = "/sign-in"
        throw new AdminApiError(401, "Session expired. Redirecting to sign in...", "UNAUTHORIZED")
      }
      if (response.status === 403 && code === "PASSWORD_CHANGE_REQUIRED") {
        window.location.href = "/force-password-change"
        throw new AdminApiError(403, "Password change required. Redirecting...", "PASSWORD_CHANGE_REQUIRED")
      }
    }

    throw new AdminApiError(
      response.status,
      message,
      code,
      errorData.details,
      errorData.fieldErrors
    )
  }

  return response.json()
}

export const adminClient = {
  async listEmployees(params?: {
    search?: string
    roleKey?: string
    status?: string
    page?: number
    pageSize?: number
  }): Promise<EmployeeListResponse> {
    const query = new URLSearchParams()
    if (params?.search) query.set("search", params.search)
    if (params?.roleKey && params.roleKey !== "all") query.set("roleKey", params.roleKey)
    if (params?.status && params.status !== "all") query.set("status", params.status)
    if (params?.page) query.set("page", params.page.toString())
    if (params?.pageSize) query.set("pageSize", params.pageSize.toString())

    const url = `/api/admin/employees${query.toString() ? `?${query.toString()}` : ""}`
    return request<EmployeeListResponse>(url, { method: "GET" })
  },

  async getEmployee(id: string): Promise<EmployeeDetail> {
    return request<EmployeeDetail>(`/api/admin/employees/${encodeURIComponent(id)}`, {
      method: "GET",
    })
  },

  async createEmployee(data: CreateEmployeeInput): Promise<CreateEmployeeResponse> {
    return request<CreateEmployeeResponse>("/api/admin/employees", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async updateEmployee(id: string, data: UpdateEmployeeInput): Promise<any> {
    return request<any>(`/api/admin/employees/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  },

  async changeRole(id: string, data: ChangeRoleInput): Promise<any> {
    return request<any>(`/api/admin/employees/${encodeURIComponent(id)}/role`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  },

  async suspendEmployee(id: string, data: SuspendEmployeeInput): Promise<any> {
    return request<any>(`/api/admin/employees/${encodeURIComponent(id)}/suspend`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async restoreEmployee(id: string): Promise<any> {
    return request<any>(`/api/admin/employees/${encodeURIComponent(id)}/restore`, {
      method: "POST",
    })
  },

  async revokeSessions(id: string, data?: RevokeSessionsInput): Promise<any> {
    return request<any>(`/api/admin/employees/${encodeURIComponent(id)}/revoke-sessions`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    })
  },

  async resetPassword(id: string, data: ResetPasswordInput): Promise<ResetPasswordResponse> {
    return request<ResetPasswordResponse>(
      `/api/admin/employees/${encodeURIComponent(id)}/reset-password`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    )
  },

  async deleteEmployee(id: string, data?: DeleteEmployeeInput): Promise<any> {
    return request<any>(`/api/admin/employees/${encodeURIComponent(id)}`, {
      method: "DELETE",
      body: JSON.stringify(data || {}),
    })
  },

  async listRoles(): Promise<RolesListResponse> {
    return request<RolesListResponse>("/api/admin/roles", {
      method: "GET",
    })
  },

  async getMyAccess(): Promise<MyAccessResponse> {
    return request<MyAccessResponse>("/api/me/access", {
      method: "GET",
    })
  },
}
