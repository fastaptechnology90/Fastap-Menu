# This folder is not the running server. Do not edit it.

The API that actually serves the platform is **`artifacts/api-server`**. Everything in
this folder is an older, separate Express application that nothing starts and nothing
imports.

Nothing was deleted — this note exists so the next person does not spend hours fixing
a file that never runs.

## How to tell them apart

|  | `server/` (this folder) | `artifacts/api-server` |
|---|---|---|
| package name | `fastapmenu-server` | `@workspace/api-server` |
| In `pnpm-workspace.yaml`? | **No** — packages are `artifacts/*`, `lib/*`, `lib/integrations/*`, `scripts` | Yes |
| Started by any script? | **No** | `pnpm dev:api` |
| PM2 process | `fastapmenu-api` — **stopped**, after 1,082,629 restarts | `fastap-api` — running |
| Last touched | 24 June 2026 | actively worked on |

## Why this is easy to get wrong

The handover PDF says to start `fastapmenu-api`. That instruction refers to **this**
folder, and it is out of date — that process crashed a million times and PM2 gave up
on it. The live site has been served by `fastap-api` from `/opt/fastap-os` the whole
time.

If you were sent here by the handover document, you are in the wrong place.

## Before removing it

Ask the client first. It has its own `drizzle.config.ts` and `src/seed.ts`, so it may
still point at data or migrations someone relies on. Confirm, take a backup, then
remove — in that order.

---

*Note added 8 August 2026. No file in this folder was changed.*
