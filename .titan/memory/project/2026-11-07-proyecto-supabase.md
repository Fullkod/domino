# Proyecto Supabase de Dominó

Date: 2026-11-07
Fuente: Roberto, en sesión.

- Proyecto `domino`, ref `dcjqxeggkgmbgkzdmpbj`, región `us-east-1`, organización «Fullkod» de la cuenta de Supabase
  de Roberto. Creado con el CLI; para liberar el cupo del plan gratis se pausó «Klau's Shop» (`bhwyagfoyylgrdgyngrm`,
  restaurable desde el dashboard).
- Credenciales solo en `.env.local` (ignorado por git): `SUPABASE_ACCESS_TOKEN` (cuenta de Roberto),
  `SUPABASE_DB_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `TASKNIC_API_KEY`.
- MCP de Supabase: `.mcp.json` → `scripts/supabase-mcp.mjs`, que lee el token del `.env.local` (una cuenta por
  proyecto). CLI enlazado con `supabase link`.
- Migración inicial **aún no aplicada** al remoto (espera permiso de Roberto).
