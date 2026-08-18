# Fastap Housekeeping App

Rooms, cleaning, and maintenance staff app. Shares UI/models with `kitchenapp` but owns its own layered architecture.

## Structure

```
lib/
├── main.dart
├── app/
│   ├── app_bootstrap.dart
│   └── housekeeping_app.dart
├── core/
│   ├── constants/
│   ├── config/
│   └── api/
│       ├── endpoints/                 # Hygiene, room service, auth, alerts
│       └── services/
├── data/
│   ├── housekeeping_role_registry.dart
│   ├── housekeeping_access_policy.dart
│   ├── housekeeping_feature_catalog.dart
│   └── housekeeping_system_api_registry.dart
├── state/
│   └── controllers/
│       ├── housekeeping_auth_controller.dart
│       └── housekeeping_operations_controller.dart
└── presentation/
    └── screens/auth/housekeeping_auth_gate.dart
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

Demo login: `housekeeping@spicegarden.com` / `Staff@123`
