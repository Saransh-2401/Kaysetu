# Mobile app — SaaS migration status

The Flutter app (`Old Project/kaysetu_app`) was rebranded to KaySetu and
repointed at the multi-tenant backend. This file records exactly what is done
and what still has to be built, because the two platforms do not expose the
same API and pretending otherwise would ship an app that compiles and then
fails at runtime.

## Done

| Area | Change |
|---|---|
| Identity | `applicationId` / iOS bundle -> `in.kaysetu.app`; display name "KaySetu"; pubspec `kaysetu_mobile` |
| Kotlin | Package moved to `` `in`.kaysetu.app `` — `in` is a Kotlin hard keyword and **must** stay backtick-escaped |
| API host | `https://api.kaysetu.in/api` (the `/v1` segment is gone) |
| Media | `img.kaysetu.in` via `ApiConfig.mediaBaseUrl` |
| Auth | Org-scoped sign-in: `POST /auth/tenant/login {org_code, email, password}` |
| Session | Org code, org name and entitled modules persisted; `AuthService.hasModule('TRACK')` gates UI |
| Login UI | Organization-code field added, pre-filled from the last session |
| Roles | `sales_agent` **and** `field_agent` accepted (a TRACK-only org has no `sales_agent`), plus owners |
| Endpoints | Remapped to the module APIs — see the table below |

`flutter analyze`: **0 errors** (143 pre-existing lint warnings, unchanged).

## Endpoint mapping applied

| Old (pre-SaaS) | New (SaaS) |
|---|---|
| `/auth/login/` | `/auth/tenant/login` |
| `/auth/refresh/` | `/auth/refresh` |
| `/field-sales/visits/` | `/t/field/visits/` |
| `/field-sales/targets/performance/` | `/t/field/targets/performance/` |
| `/crm/leads/` | `/t/crm/leads/` |
| `/crm/customers/`, `/crm/contacts/` | `/t/parties/?kind=customer` |
| `/travel-allowance/requests|trips/` | `/t/ta/claims/` |
| `/travel-allowance/bank-details/` | `/t/ta/bank-details/` |
| `/sales/orders/` | `/t/sales-orders/` |
| `/distributor-inventory/*` | `/t/dist/*` |
| `/core/app-versions/latest/` | `/public/app-version/latest` |
| attendance | `/t/att/attendance/*` (office) · `/t/track/attendance` (duty) |

## NOT built yet — these will 404

Kept as constants so the app compiles, but **the screens using them are not
functional against the SaaS backend**:

| Endpoint | Used by | Note |
|---|---|---|
| `/auth/send-otp/`, `/auth/verify-otp/` | Login screen (OTP tab) | **No OTP auth on the backend.** Phone-OTP was the primary sign-in for field agents; only org-code + email + password exists now |
| `/auth/verify-pin/`, `/auth/user/pin/` | PIN quick-login | PIN is currently local-only; there is no server verification |
| `/auth/heartbeat/` | Home screen, background tracker | Presence ping |
| `/core/places/autocomplete|details/` | Location picker | Google Places proxy — the key must stay server-side, so this cannot be worked around in the app |
| `/reports/export/excel/` | Detailed report screen | |
| `/masters/categories/`, `/warehouse/stock/` | Product service | |

## What still has to be done

1. **Decide the sign-in story.** Either build OTP + PIN endpoints on the SaaS
   backend, or accept org-code + email + password as the only path and remove
   the OTP/PIN tabs from the login screen. Right now the OTP tab is visible and
   will fail — that is the single most user-visible gap.
2. **Verify payload shapes per screen.** Paths are mapped, but the SaaS
   serializers do not always return the same field names as the old platform
   (e.g. customers are `Party` records now). Each service file needs a pass
   against a live tenant.
3. **Module gating in the UI.** `AuthService.hasModule()` exists; the drawer and
   home tiles should use it so a TRACK-only org never sees Field Sales screens.
4. **Run against a real tenant** — nothing here has been exercised on-device.

## Signing

`android/key.properties` still references `keyAlias=salexa` /
`salexa-release.jks`. That is **cryptographic identity, not branding** — the
alias inside a keystore cannot be renamed. Because `applicationId` changed to
`in.kaysetu.app`, this is a **new Play Store listing** regardless: existing
users will not receive it as an update and must install fresh.
