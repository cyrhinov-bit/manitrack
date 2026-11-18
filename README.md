# React + Vite

## Supabase

Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` using the project URL and publishable (or legacy anon)
key from the Supabase dashboard. Never use a `service_role` key in the browser.

Email/password sign-in requires an existing Supabase Auth user and a matching
row in `public.profiles`. The profile must have a supported `role` (`ADMIN` or
`PRODUCTEUR`); disabled accounts cannot sign in. Apply the project's existing
`supabase/schema.sql` and profile RLS policies before testing sign-in.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
