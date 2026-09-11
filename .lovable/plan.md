# Give Ivan admin access

## What is happening

Ivan signed in fine, but the app showed him "Request staff access / Waiting for approval". That is correct behaviour: every new sign-in stays invisible until you approve it. Right now the shop has two accounts:

- codysseus2390@gmail.com — owner, approved (you)
- service@cedarvalleytire.com — signed in, still waiting for approval

Nobody has been pre-added by email yet, so any other address Ivan uses will also land in the waiting list.

## Plan

1. Approve service@cedarvalleytire.com and set it to Manager, which is the admin level below owner: it can see everything, add employees and approve requests. Ivan can then use the app immediately.
2. Pre-add Ivan's second email as a Manager so that when he signs in with it, he is let straight in without waiting.
3. Make waiting requests impossible to miss: a count badge next to "Settings" in the sidebar and a short "1 person is waiting for access" line at the top of the dashboard that links to the approval list.
4. Rename the role wording in Settings from "Manager" to "Admin (manager)" so it reads the way you describe these accounts.

## Notes

- No emails are sent and no passwords are created for anyone. Ivan signs in with his own password or Google.
- Owner stays a single account (yours). Admins cannot promote anyone to owner or change the owner row.
- Editing the project inside Lovable is separate from app access; this plan only covers using the app.

## Technical details

- Approve/pre-add through the existing `add_staff_member` routine so the same authorization checks apply; the pending row is updated to approved/manager.
- Pending count comes from a new count on the existing shop context read, consumed by the sidebar badge and dashboard banner.
- No schema changes needed.
