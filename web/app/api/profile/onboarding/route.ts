import { db } from "@/lib/auth/db";
import { fail, hasSameOrigin, ok, readJson } from "@/lib/auth/http";
import { getSessionUser } from "@/lib/auth/session";
import { isCity } from "@/lib/geo";
import { parseOnboarding } from "@/lib/profile/validate";

/**
 * Saves the role-specific profile after registration. The role always comes from the server-side session,
 * never from the request body. Verification status is never taken from the client: a specialist can only
 * save a draft or send it for review; confirming it is the moderator's job. Sending for review and creating an
 * organization require a confirmed e-mail. Also used by the settings page: once a specialist profile is in review
 * or confirmed, only its service details (headline, about, city, formats, prices, ages) can change; a rejected or
 * blocked profile cannot be edited here.
 */
export async function POST(req: Request) {
  try {
    if (!hasSameOrigin(req)) return fail("forbidden_origin", 403);
    const user = await getSessionUser();
    if (!user) return fail("unauthorized", 401);

    const body = await readJson(req);
    if (!body) return fail("invalid_input", 400);
    const parsed = parseOnboarding(user.role, body, isCity);
    if (!parsed.ok) return fail("invalid_input", 400);

    // Anyone can sign up with someone else's address, so steps that put a profile in front of moderators or other
    // people need a confirmed e-mail: sending a specialist profile for review and creating an organization.
    // Accounts without an e-mail (Telegram) have no address to impersonate.
    const unverified = user.email !== null && !user.emailVerified;
    if (unverified && (parsed.role === "organization" || (parsed.role === "specialist" && parsed.data.submit))) {
      return fail("email_unverified", 403);
    }

    const client = await db().connect();
    try {
      await client.query("BEGIN");

      if (parsed.role === "parent") {
        await client.query("UPDATE users SET city = $2, updated_at = now() WHERE id = $1", [user.id, parsed.data.city]);
      } else if (parsed.role === "organization") {
        const d = parsed.data;
        await client.query(
          `INSERT INTO organizations (owner_user_id, name, org_type, city) VALUES ($1, $2, $3, $4)
           ON CONFLICT (owner_user_id) DO UPDATE SET name = $2, org_type = $3, city = $4, updated_at = now()`,
          [user.id, d.name, d.orgType, d.city],
        );
        await client.query("UPDATE users SET city = $2, updated_at = now() WHERE id = $1", [user.id, d.city]);
      } else {
        const d = parsed.data;
        const existing = await client.query<{ verification_status: string }>(
          "SELECT verification_status FROM specialist_profiles WHERE user_id = $1 FOR UPDATE",
          [user.id],
        );
        const status = existing.rows[0]?.verification_status;
        if (status === "rejected" || status === "blocked") {
          await client.query("ROLLBACK");
          return fail("profile_locked", 409);
        }
        if (status && status !== "draft" && status !== "needs_documents") {
          // In review or confirmed: what verification is based on (name, specialization, experience) stays as
          // reviewed, and the status and publication are untouched. Service details can still be kept up to date.
          await client.query(
            `UPDATE specialist_profiles SET headline = $2, bio = $3, city = $4, formats = $5, price_from = $6,
                    price_to = $7, age_min = $8, age_max = $9, updated_at = now()
              WHERE user_id = $1`,
            [user.id, d.headline, d.bio, d.city, d.formats, d.priceFrom, d.priceTo, d.ageMin, d.ageMax],
          );
        } else {
          await client.query(
            `INSERT INTO specialist_profiles
               (user_id, display_name, category, headline, bio, city, formats, price_from, price_to,
                experience_years, age_min, age_max, verification_status, is_published)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, false)
             ON CONFLICT (user_id) DO UPDATE SET
               display_name = $2, category = $3, headline = $4, bio = $5, city = $6, formats = $7, price_from = $8,
               price_to = $9, experience_years = $10, age_min = $11, age_max = $12,
               verification_status = $13, is_published = false, updated_at = now()`,
            [user.id, d.displayName, d.category, d.headline, d.bio, d.city, d.formats, d.priceFrom, d.priceTo,
             d.experienceYears, d.ageMin, d.ageMax, d.submit ? "submitted" : "draft"],
          );
        }
        await client.query("UPDATE users SET city = $2, updated_at = now() WHERE id = $1", [user.id, d.city]);
      }

      await client.query("UPDATE users SET onboarding_completed_at = coalesce(onboarding_completed_at, now()) WHERE id = $1", [user.id]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      // Unknown specialization slug (foreign key) is bad input, not a server error.
      if ((err as { code?: string }).code === "23503") return fail("invalid_input", 400);
      throw err;
    } finally {
      client.release();
    }
    return ok();
  } catch (err) {
    console.error("onboarding failed:", err instanceof Error ? err.message : "unknown error");
    return fail("server_error", 500);
  }
}
