# Fastap Smart Hospitality — Kitchen Side App



Enterprise kitchen command center for hotel and restaurant operations. The Flutter app ships with **48 live enterprise systems** and a complete in-app mock API (default). When your 3rd-party server is ready, point the app at it with a base URL — no code changes required.



## Quick start (mock mode — default)



```powershell

cd d:\Freelnace\eli\kitchenapp

flutter pub get

flutter run

```



No backend required. All 48 systems run through the in-app `MockKitchenApiClient`.



## Connect to Fastap panel (production)



The backend exposes **`/api/v1/*`** on the main Fastap API server, wired to live restaurant orders and staff accounts.



```powershell

cd mobileapp

flutter pub get

# Quick run against production API
.\scripts\run_production.ps1

# Or manually:
flutter run --dart-define=API_MODE=external --dart-define=API_BASE_URL=https://digitalrestuarants.thefingo.com --dart-define=APP_ENV=production

# Release APK for store / sideload
.\scripts\build_production.ps1

```



**Production defaults:** Release builds automatically use `API_MODE=external` and `https://digitalrestuarants.thefingo.com`. Auth tokens are stored in encrypted secure storage on device.



**Demo staff login (Spice Garden):**



| Field | Value |

|-------|-------|

| Staff code / email | `chef@spicegarden.com` |

| Password | `Staff@123` |

| Role | Head chef |



Kitchen dashboard, KDS, order processing, and live alerts use real orders from the restaurant panel.



## Connect to your 3rd-party API



1. Implement the REST contract in **[docs/API_REFERENCE.md](docs/API_REFERENCE.md)**.

2. Run the app against your server:



```powershell

flutter run --dart-define=API_MODE=external --dart-define=API_BASE_URL=https://your-server.com

```



3. For release builds:



```powershell

flutter build apk --dart-define=API_MODE=external --dart-define=API_BASE_URL=https://your-server.com

```



The app calls `{API_BASE_URL}/api/v1/*` with `Authorization: Bearer <token>` after login.



See **[docs/INTEGRATION_GUIDE.md](docs/INTEGRATION_GUIDE.md)** for step-by-step server integration.



## Demo login



| Field | Value |

|-------|-------|

| Staff code | `KCH-001` |

| Password | `chef@123` |

| PIN | `4521` |

| OTP | `123456` (after OTP request) |



Additional demo accounts: `KCH-002` … `KCH-012` (all 12 staff roles). PINs match the pattern in `lib/data/mock/mock_staff_directory.dart`.



## Architecture



| Layer | Location |

|-------|----------|

| Views & widgets | `lib/screens/`, `lib/widgets/` |

| State | `lib/state/` |

| Services | `lib/services/` |

| Mock engines (48 systems) | `lib/data/mock/` |

| In-app mock API | `lib/core/api/mock_kitchen_api_client.dart` |

| HTTP client (external server) | `lib/core/api/http_kitchen_api_client.dart` |

| Endpoint paths | `lib/core/api/*_endpoints.dart` |



Each enterprise system follows: **endpoints → model → mock engine → service → view → nav tab**.



## API modes



| Mode | How to enable | Behavior |

|------|---------------|----------|

| `mock` (default) | `flutter run` | Full offline demo via in-app mock client |

| `external` | `--dart-define=API_MODE=external --dart-define=API_BASE_URL=...` | HTTP to your REST server |



The header shows the active mode (`Mock API` or `External API`).



## Enterprise systems (48)



Auth, Live Dashboard, KDS, Section Management, Order Processing, Course Firing, Prep, Modifiers, Chef Tasks, Staff Command, Allergy Safety, AI Assistant, Order Priority, Kitchen Comms, Inventory, Recipe Costing, Prep Stations, Batch Cooking, Delay Escalation, QC, Returns, Expeditor, Packing, Aggregator Delivery, Bar/Beverage, Bakery/Dessert, Cloud Kitchen, Banquet, Room Service, Hygiene, Equipment, Smart Energy, IoT, Staff Performance, Staff Shifts, Staff Wellness, Live Alerts, Panic/Emergency, Offline Failover, Analytics, Kitchen Heatmap, Hardware Integration, Smartwatch, Multi-Branch, Audit/Compliance, Backup/Recovery, Sandbox Training, Hidden Enterprise, Future AI Expansion.



Open the **Features** tab (index 48) for the full catalog with search and filters.



## Tests



```powershell

flutter test

```



Snapshot tests cover model parsing for each system. Current suite: **64 tests**.



## Documentation

| Step | Document | Purpose |
|------|----------|---------|
| 1 | [docs/STEP1_APP_COMPLETE.md](docs/STEP1_APP_COMPLETE.md) | Flutter app status & how to run |
| 2 | [docs/STEP2_CONNECT_SERVER.md](docs/STEP2_CONNECT_SERVER.md) | Connect your 3rd-party API |
| 3 | [docs/STEP3_API_DOCUMENTATION.md](docs/STEP3_API_DOCUMENTATION.md) | API specs — 48 modules, one by one |
| — | [docs/api/MODULE_INDEX.md](docs/api/MODULE_INDEX.md) | Numbered module index for backend team |
| — | [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | Full combined API reference |
| — | [docs/INTEGRATION_GUIDE.md](docs/INTEGRATION_GUIDE.md) | Integration & troubleshooting |



## Project structure



```

kitchenapp/

├── lib/                 # Flutter app

├── docs/                # API reference & integration guide

├── test/                # Snapshot & widget tests

└── README.md

```


