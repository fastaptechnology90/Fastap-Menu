#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
flutter run --dart-define=API_MODE=mock "$@"
