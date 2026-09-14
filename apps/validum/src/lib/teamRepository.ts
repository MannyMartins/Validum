import { apiRequest } from './apiClient';
export type OrganizationRole = 'owner' | 'admin' | 'operator' | 'auditor' | 'analyst' | 'viewer';
export type MemberStatus = 'active' | 'invited' | 'revoked';
export interface OrganizationMember {
  organizationId: string; userId: string; fullName: string; email: string; role: OrganizationRole;
  status: MemberStatus; active: boolean; invitedAt?: string; acceptedAt?: string; revokedAt?: string; isCurrentUser: boolean;
}
export interface TeamSnapshot { organizationId: string; currentUserId: string; currentRole: OrganizationRole | null; members: OrganizationMember[]; }
export interface InviteOrganizationResult { invitationWasSent: boolean; message: string; }
export function loadOrganizationTeam(): Promise<TeamSnapshot> { return apiRequest('/team'); }
export function inviteOrganizationMember(input: { organizationId: string; fullName: string; email: string; role: 'admin' | 'operator' | 'auditor' }): Promise<InviteOrganizationResult> {
  const { organizationId: _organizationId, ...body } = input;
  return apiRequest('/team/invite', { method: 'POST', body: JSON.stringify(body) });
}
export function revokeOrganizationMember(_organizationId: string, userId: string): Promise<void> {
  return apiRequest(`/team/${encodeURIComponent(userId)}/revoke`, { method: 'POST' });
}
export function changeOrganizationMemberRole(_organizationId: string, userId: string, role: 'admin' | 'operator' | 'auditor'): Promise<void> {
  return apiRequest(`/team/${encodeURIComponent(userId)}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
}
