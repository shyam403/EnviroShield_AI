# EnviroShield.ai Login + FloodSafe Integration

## Flow
1. User opens the FloodSafe app at `/`.
2. If `enviroshield_authenticated` is not set in `localStorage`, the app redirects to `/login.html`.
3. The existing HTML login screen validates the demo credentials:
   - Email: `demo@enviroshield.ai`
   - Password: `password123`
4. On successful login, the login page stores `enviroshield_authenticated=true` and redirects to `/`.
5. FloodSafe then loads normally with its existing offline map, routing, alerts, GPS and emergency functionality.
6. Google Sign-In also sets the same local session flag after the Google callback and redirects to `/`.

## Important
The current email/password login is a frontend demo authentication flow. It is not secure for production because credentials are checked in browser code. For a real deployment, replace it with Supabase/Auth or a backend session/token flow.

## Run
```bash
npm install
npm run dev
```

Then open the URL shown by Vite. The app will send unauthenticated users to `/login.html`.
