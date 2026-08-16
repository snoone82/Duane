import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { RoleSelect } from "@/components/team/RoleSelect";
import { StatusPill } from "@/components/ui/StatusPill";
import { Table, Thead, Th, Td, Tr } from "@/components/ui/Table";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Team & access" };

export default async function TeamPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect("/");

  const supabase = await createClient();
  const [{ data: profiles }, { data: portalLinks }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email,role,created_at").order("created_at", { ascending: true }),
    supabase.from("clients").select("name,portal_user_id").not("portal_user_id", "is", null),
  ]);

  const portalClientByUser = new Map((portalLinks ?? []).map((c) => [c.portal_user_id as string, c.name]));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold text-ink">Team &amp; access</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Every account and what it can see. Changing a role takes effect the next time that person loads a page.
      </p>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <Table>
          <Thead>
            <tr>
              <Th>Person</Th>
              <Th>Role</Th>
              <Th>Portal link</Th>
              <Th>Joined</Th>
            </tr>
          </Thead>
          <tbody>
            {(profiles ?? []).map((person) => (
              <Tr key={person.id}>
                <Td>
                  <p className="text-sm text-ink">{person.full_name || person.email}</p>
                  <p className="text-xs text-ink-faint">{person.email}</p>
                </Td>
                <Td className="w-64">
                  {person.id === profile.id ? (
                    <div>
                      <StatusPill label="Admin (you)" color="teal" />
                      <p className="mt-1 text-xs text-ink-faint">Another admin can change your role.</p>
                    </div>
                  ) : (
                    <RoleSelect userId={person.id} currentRole={person.role} />
                  )}
                </Td>
                <Td>
                  {person.role === "client" ? (
                    portalClientByUser.has(person.id) ? (
                      <span className="text-sm text-ink-soft">{portalClientByUser.get(person.id)}</span>
                    ) : (
                      <span className="text-xs text-ink-faint">Not linked — do this on the client&rsquo;s Overview tab</span>
                    )
                  ) : (
                    <span className="text-xs text-ink-faint">—</span>
                  )}
                </Td>
                <Td>
                  <span className="text-xs text-ink-faint">{formatDate(person.created_at.slice(0, 10))}</span>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-ink-soft">
        <p className="mb-1 font-medium text-ink">Adding a new login</p>
        <p>
          Accounts are created in Supabase (Dashboard → Authentication → Users → Add user — set a password directly).
          New accounts start as Member; set the right role here, then for portal clients link the account on the
          client&rsquo;s Overview tab and send them a password link via &ldquo;Forgot password?&rdquo; on the sign-in screen.
        </p>
      </div>
    </div>
  );
}
