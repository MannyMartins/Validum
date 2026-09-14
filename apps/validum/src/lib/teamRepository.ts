import { getActiveOrganizationId, isSupabaseConfigured, supabase } from './supabaseClient';

export type OrganizationRole = 'owner' | 'admin' | 'operator' | 'auditor' | 'analyst' | 'viewer';
export type MemberStatus = 'active' | 'invited' | 'revoked';

export interface OrganizationMember {
  organizationId: string;
  userId: string;
  fullName: string;
  email: string;
  role: OrganizationRole;
  status: MemberStatus;
  active: boolean;
  invitedAt?: string;
  acceptedAt?: string;
  revokedAt?: string;
  isCurrentUser: boolean;
}

export interface TeamSnapshot {
  organizationId: string;
  currentUserId: string;
  currentRole: OrganizationRole | null;
  members: OrganizationMember[];
}

export interface InviteOrganizationResult {
  invitationWasSent: boolean;
  message: string;
}

function requireSupabase() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase debe estar configurado para administrar usuarios internos.');
  }
  return supabase;
}

function normalizeProfile(value: unknown): { email?: string; display_name?: string } {
  if (Array.isArray(value)) return (value[0] || {}) as { email?: string; display_name?: string };
  return (value || {}) as { email?: string; display_name?: string };
}

export async function loadOrganizationTeam(): Promise<TeamSnapshot> {
  const client = requireSupabase();
  const organizationId = await getActiveOrganizationId();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('La sesión ya no es válida.');

  const { data, error } = await client
    .from('organization_members')
    .select(`
      organization_id,
      user_id,
      role,
      active,
      status,
      invited_email,
      invited_at,
      accepted_at,
      revoked_at,
      profile:profiles!organization_members_profile_fkey(email,display_name)
    `)
    .eq('organization_id', organizationId)
    .order('invited_at', { ascending: false, nullsFirst: false });

  if (error) throw error;

  const members = (data || []).map(row => {
    const profile = normalizeProfile(row.profile);
    const role = String(row.role) as OrganizationRole;
    const active = Boolean(row.active);
    const status = (row.status || (active ? 'active' : 'revoked')) as MemberStatus;
    return {
      organizationId: String(row.organization_id),
      userId: String(row.user_id),
      fullName: String(profile.display_name || row.invited_email || 'Usuario sin nombre'),
      email: String(profile.email || row.invited_email || ''),
      role,
      status,
      active,
      invitedAt: row.invited_at || undefined,
      acceptedAt: row.accepted_at || undefined,
      revokedAt: row.revoked_at || undefined,
      isCurrentUser: String(row.user_id) === authData.user.id,
    } satisfies OrganizationMember;
  });

  return {
    organizationId,
    currentUserId: authData.user.id,
    currentRole: members.find(member => member.isCurrentUser)?.role || null,
    members,
  };
}

export async function inviteOrganizationMember(input: {
  organizationId: string;
  fullName: string;
  email: string;
  role: 'admin' | 'operator' | 'auditor';
}): Promise<InviteOrganizationResult> {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('invite-organization-user', {
    body: input,
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return {
    invitationWasSent: data?.invitationWasSent !== false,
    message: String(data?.message || 'Invitación enviada y acceso registrado.'),
  };
}

export async function revokeOrganizationMember(organizationId: string, userId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('revoke_organization_member', {
    target_organization_id: organizationId,
    target_user_id: userId,
  });
  if (error) throw error;
}

export async function changeOrganizationMemberRole(
  organizationId: string,
  userId: string,
  role: 'admin' | 'operator' | 'auditor',
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('set_organization_member_role', {
    target_organization_id: organizationId,
    target_user_id: userId,
    new_role: role,
  });
  if (error) throw error;
}
