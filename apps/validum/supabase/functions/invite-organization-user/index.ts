import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"

const ALLOWED_ROLES = new Set(["admin", "operator", "auditor"])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type InviteBody = {
  organizationId?: unknown
  fullName?: unknown
  email?: unknown
  role?: unknown
}

function appRedirectUrl(req: Request): string | null {
  const configured = Deno.env.get("VALIDUM_APP_URL")?.trim()
  if (configured) return new URL("/", configured).toString()

  const origin = req.headers.get("origin")?.trim() ?? ""
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return new URL("/", origin).toString()
  }
  return null
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Metodo no permitido" }, { status: 405 })
    }

    try {
      const body = await req.json() as InviteBody
      const organizationId = String(body.organizationId ?? "").trim()
      const fullName = String(body.fullName ?? "").trim().replace(/\s+/g, " ")
      const email = String(body.email ?? "").trim().toLowerCase()
      const role = String(body.role ?? "").trim().toLowerCase()
      const callerId = String(ctx.jwtClaims?.sub ?? "")

      if (!UUID_PATTERN.test(organizationId)) {
        return Response.json({ error: "Organizacion invalida" }, { status: 400 })
      }
      if (!fullName || fullName.length > 120) {
        return Response.json({ error: "El nombre es obligatorio y no puede superar 120 caracteres" }, { status: 400 })
      }
      if (!EMAIL_PATTERN.test(email) || email.length > 254) {
        return Response.json({ error: "Correo institucional invalido" }, { status: 400 })
      }
      if (!ALLOWED_ROLES.has(role)) {
        return Response.json({ error: "Rol no permitido" }, { status: 400 })
      }
      if (!callerId) {
        return Response.json({ error: "Sesion invalida" }, { status: 401 })
      }

      const { data: callerMembership, error: membershipError } = await ctx.supabase
        .from("organization_members")
        .select("role,active,status")
        .eq("organization_id", organizationId)
        .eq("user_id", callerId)
        .maybeSingle()

      if (membershipError) throw membershipError
      if (
        !callerMembership?.active ||
        callerMembership.status === "revoked" ||
        !["owner", "admin"].includes(callerMembership.role)
      ) {
        return Response.json({ error: "No tienes permiso para invitar usuarios" }, { status: 403 })
      }

      const redirectTo = appRedirectUrl(req)
      if (!redirectTo) {
        console.error("VALIDUM_APP_URL no esta configurada para invitaciones")
        return Response.json({ error: "El enlace de acceso no esta configurado" }, { status: 503 })
      }

      const { data: invitation, error: invitationError } = await ctx.supabaseAdmin.auth.admin
        .inviteUserByEmail(email, {
          redirectTo,
          data: { full_name: fullName },
        })

      let invitedUserId = invitation.user?.id ?? ""
      let invitationWasSent = true

      if (invitationError) {
        console.error("No se pudo crear la invitacion de Auth:", invitationError.message)
        const alreadyExists = /already|registered|exists/i.test(invitationError.message)
        if (!alreadyExists) {
          return Response.json({ error: "No se pudo enviar la invitacion" }, { status: 502 })
        }

        // Una ejecución anterior puede haber creado el usuario de Auth y
        // fallado después al guardar la membresía. Recuperamos esa cuenta por
        // su perfil público para que reintentar sea idempotente.
        const { data: existingProfile, error: profileError } = await ctx.supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .limit(1)
          .maybeSingle()

        if (profileError) throw profileError
        if (!existingProfile?.id) {
          return Response.json(
            { error: "Ese correo ya tiene una cuenta, pero no fue posible vincularla automaticamente" },
            { status: 409 },
          )
        }

        invitedUserId = String(existingProfile.id)
        invitationWasSent = false
      }

      if (!invitedUserId) {
        throw new Error("Supabase no devolvio el usuario invitado")
      }

      const { data: existingMembership, error: existingMembershipError } = await ctx.supabaseAdmin
        .from("organization_members")
        .select("role,status,active,invited_at,accepted_at")
        .eq("organization_id", organizationId)
        .eq("user_id", invitedUserId)
        .maybeSingle()

      if (existingMembershipError) throw existingMembershipError

      const protectedRole = existingMembership?.role === "owner" ? "owner" : role
      const remainsActive = existingMembership?.active === true && existingMembership?.status === "active"
      const membershipStatus = remainsActive ? "active" : "invited"

      const { error: memberError } = await ctx.supabaseAdmin
        .from("organization_members")
        .upsert({
          organization_id: organizationId,
          user_id: invitedUserId,
          role: protectedRole,
          active: true,
          status: membershipStatus,
          invited_email: email,
          invited_by: callerId,
          invited_at: existingMembership?.invited_at ?? new Date().toISOString(),
          accepted_at: remainsActive ? existingMembership?.accepted_at ?? new Date().toISOString() : null,
          revoked_at: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id,user_id" })

      if (memberError) {
        console.error("La invitacion se envio pero no se pudo crear la membresia:", memberError.message)
        return Response.json({ error: "La invitacion se envio, pero el acceso requiere revision administrativa" }, { status: 500 })
      }

      return Response.json({
        member: {
          userId: invitedUserId,
          fullName,
          email,
          role: protectedRole,
          status: membershipStatus,
        },
        invitationWasSent,
        message: invitationWasSent
          ? "Invitacion enviada y acceso registrado"
          : "La cuenta ya existia y su acceso fue vinculado",
      }, { status: invitationWasSent ? 201 : 200 })
    } catch (error) {
      console.error("Error interno al invitar usuario:", error)
      return Response.json({ error: "No se pudo procesar la invitacion" }, { status: 500 })
    }
  }),
}
