# Fastap Waiter App

Floor service and delivery staff app. Shares UI/models with `kitchenapp` but owns its own layered architecture.

## Structure

```
lib/
├── main.dart                          # Entry → bootstrap + WaiterApp
├── app/
│   ├── app_bootstrap.dart             # Variant + startup wiring
│   └── waiter_app.dart                # MaterialApp root
├── core/
│   ├── constants/                     # Branding, API timeouts, demo creds
│   ├── config/                        # App + API runtime config
│   └── api/
│       ├── endpoints/                 # REST path constants (waiter modules)
│       └── services/                  # Auth, waiter board, dashboard, alerts
├── data/
│   ├── waiter_role_registry.dart      # Allowed roles
│   ├── waiter_access_policy.dart      # System numbers + permissions
│   ├── waiter_feature_catalog.dart    # Feature list
│   └── waiter_system_api_registry.dart
├── state/
│   └── controllers/
│       ├── waiter_auth_controller.dart
│       └── waiter_operations_controller.dart
└── presentation/
    └── screens/auth/waiter_auth_gate.dart
```

## Run / build

```bash
flutter run --dart-define=API_MODE=external \
  --dart-define=API_BASE_URL=https://digitalrestuarants.thefingo.com

flutter build apk --release \
  --dart-define=API_MODE=external \
  --dart-define=API_BASE_URL=https://digitalrestuarants.thefingo.com \
  --dart-define=APP_ENV=production
```

Demo login: `waiter@spicegarden.com` / `Staff@123`
