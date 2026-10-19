# Garden Team Manager

A collaborative React web app for **Simon (supervisor)**, **Msesa (employee)** and **Karen (owner)** to manage:

- The Farm
- Rocky Bank
- Wargrave
- Msesa's 30/60/90-day onboarding
- Work tasks and daily logs
- Vegetable gardens at The Farm and Rocky Bank
- Kudu mower, ride-on mower and brushcutter records
- Rocky Bank accommodation notes and maintenance requests
- Permanent in-app communication records
- Formal progress reviews

The app uses **React + Vite**, **Netlify Functions**, and a **Neon PostgreSQL database**. The database connection string stays in the server-side Netlify environment and is never exposed to the browser.

## Important security model

The app includes three roles:

- **Simon — supervisor:** Creates and manages tasks, signs off training, reviews logs, manages machines and accommodation records, messages everyone, and creates progress reviews.
- **Msesa — employee:** Updates assigned tasks, keeps work and machine logs, records vegetable work, submits accommodation requests, messages Simon and Karen, and marks training ready for review.
- **Karen — owner:** Has management visibility and approval powers like Simon, including announcements, reviews and accommodation oversight.

All database operations pass through one authenticated Netlify Function. Passwords are stored as PostgreSQL bcrypt hashes, and signed sessions expire after seven days.

## Step 1: Create Neon database

1. Sign in at `https://console.neon.tech`.
2. Create a new project called `garden-team`.
3. Open the **SQL Editor**.
4. Open `database/schema.sql` from this project.
5. Copy the complete SQL script, paste it into Neon, and click **Run**.
6. Open the Neon **Connect** panel.
7. Copy the **pooled connection string**. It begins with `postgresql://`.

The SQL creates all app tables, the three properties, three machine records, the onboarding curriculum and three initial user accounts.

## Step 2: Change initial identity details

The seed users are:

| Person | Email | Temporary password |
|---|---|---|
| Simon | `simon@example.com` | `ChangeMe-Simon-2026!` |
| Msesa | `msesa@example.com` | `ChangeMe-Msesa-2026!` |
| Karen | `karen@example.com` | `ChangeMe-Karen-2026!` |

Use these only for the first login. Each person must immediately open **Settings** and create a private password of at least 12 characters.

To use real email addresses before first login, run this in the Neon SQL Editor:

```sql
UPDATE users SET email='SIMON_REAL_EMAIL' WHERE name='Simon';
UPDATE users SET email='MSESA_REAL_EMAIL' WHERE name='Msesa';
UPDATE users SET email='KAREN_REAL_EMAIL' WHERE name='Karen';
```

Emails currently act as sign-in names. The app does not send email messages.

## Step 3: Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
```

Create `.env` in the project root:

```env
DATABASE_URL=YOUR_NEON_POOLED_CONNECTION_STRING
JWT_SECRET=YOUR_LONG_RANDOM_SECRET
```

Generate a good secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Start the app:

```bash
npm run dev
```

Open the local URL shown by Vite, normally `http://localhost:5173`.

## Step 4: Add to GitHub

Create an empty GitHub repository, then run from this folder:

```bash
git init
git add .
git commit -m "Initial Garden Team app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

The `.gitignore` file prevents `.env` from being uploaded.

## Step 5: Deploy to Netlify

1. Sign in to Netlify.
2. Choose **Add new project** → **Import an existing project**.
3. Select GitHub and choose the repository.
4. Netlify should detect these settings from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
5. Do not deploy until the environment variables are added.
6. Open **Project configuration** → **Environment variables**.
7. Add `DATABASE_URL` with the Neon pooled connection string.
8. Add `JWT_SECRET` with the long random secret.
9. Ensure both variables are available to **Functions**.
10. Trigger a new deploy.

Netlify will provide a free `*.netlify.app` address. No domain is required.

## Step 6: First-use checklist

1. Sign in as Simon using the temporary account.
2. Change Simon's password.
3. Sign in as Msesa and change his password.
4. Sign in as Karen and change her password.
5. Simon creates one test task assigned to Msesa.
6. Msesa updates the task and adds a daily log.
7. Simon adds feedback to the daily log.
8. Each person sends a test message.
9. Confirm messages remain after signing out and back in.
10. Add a test planting or harvest record at The Farm.
11. Add a test machine log.
12. Msesa creates an accommodation maintenance request.
13. Simon acknowledges and resolves it.
14. Remove the word “test” records if no longer needed.

## App workflow

### Daily

Msesa should:

1. Read messages and assigned tasks.
2. Inspect the property and machine before work.
3. Update task status while working.
4. Add vegetable and machine records when relevant.
5. Complete a daily log before finishing.
6. Message Simon immediately about urgent damage or danger.

Simon should:

1. Check urgent messages and machine warnings.
2. Review active tasks and field logs.
3. Give specific feedback.
4. Sign off training only after practical observation.
5. Keep the next work priorities clear.

Karen can see overall work, send instructions or comments, participate in reviews and monitor progress without needing a separate report from Simon.

### Weekly

- Simon and Msesa review unfinished tasks.
- Msesa drafts what must happen next.
- Simon checks quality, risks and machine condition.
- Vegetable planting and harvest records are reviewed.
- One visible improvement is planned or checked.
- Karen can see the same record and add guidance where needed.

## Accommodation notes

The accommodation area is deliberately separate from work tasks.

- Msesa can create a **request**, such as a leaking tap or electrical problem.
- Simon and Karen can add general notes, maintenance matters, agreed house rules or inspection records.
- Simon and Karen may create a management-only note by clearing **Visible to Msesa**.
- Only Simon or Karen can acknowledge or resolve accommodation items.
- Sensitive medical, financial or unrelated personal information should not be stored here.

Before active use, Simon and Karen should add the actual written accommodation terms, including:

- What building or room is provided.
- Start date and whether accommodation is linked to employment.
- Electricity, water and other utility arrangements.
- Keys, access and security responsibilities.
- Visitors, pets, smoking and fire-safety rules if agreed.
- Cleaning, refuse and garden-boundary responsibilities.
- Which repairs Msesa must report and who pays for repairs.
- Emergency contact and procedure.
- Privacy, inspection notice and access arrangements.
- What happens to accommodation if employment ends.

This section is an operational record, not a substitute for a properly drafted employment contract or accommodation agreement.

## Data backup

Neon provides its own platform features, but important operational records should still be exported periodically. A future app version can add CSV export. Until then, use the Neon SQL Editor or `pg_dump` to create an external backup.

## Troubleshooting

### “Server error. Check configuration and logs.”

- Confirm `DATABASE_URL` exists in Netlify and includes Functions scope.
- Confirm the SQL schema ran successfully.
- Open Netlify **Logs & Metrics** → **Functions** → `api`.
- Redeploy after changing environment variables.

### Sign-in fails

- Confirm the email exactly matches the `users` table.
- Use the temporary password only before changing it.
- Confirm `pgcrypto` and the seed insert ran.

### App loads but records do not

- Check browser Developer Tools → Network → `/api/bootstrap`.
- A 401 means the session is missing or expired; sign in again.
- A 500 normally means a database connection or schema problem.

### Refreshing a page gives 404

The SPA redirect is included in `netlify.toml`. Confirm Netlify used the file and redeploy.

## Useful commands

```bash
npm run dev       # Local development
npm run build     # Production build check
npm run preview   # Preview built site
```

## Suggested later improvements

- Photograph uploads using Netlify Blobs or object storage.
- Email or WhatsApp notification summaries.
- Calendar-style schedule and recurring tasks.
- Offline-capable mobile PWA for weak connectivity.
- CSV and PDF exports.
- Vegetable bed map designer.
- Fuel and consumable stock management.
- Formal accommodation agreement attachment.
- Password reset by verified email.
- Full audit history for edits and deletions.
