// Smoke test for the Housekeeping app.
//
// This file used to hold the counter demo that `flutter create` generates. It
// referenced `MyApp`, a class this project never had, so `flutter test` failed to
// compile and no test in this package could run.
//
// The app opens on AuthGate, which starts a ~1.8s splash timer in initState.
// The pumps below let that timer finish, matching kitchenapp's own widget test —
// without them the test ends with a pending timer and fails.

import 'package:flutter_test/flutter_test.dart';

import 'package:housekeepingapp/app/app_bootstrap.dart';
import 'package:housekeepingapp/app/housekeeping_app.dart';

void main() {
  testWidgets('Housekeeping app boots past the splash screen', (
    WidgetTester tester,
  ) async {
    AppBootstrap.initialize();

    await tester.pumpWidget(const HousekeepingApp());
    await tester.pump();

    await tester.pump(const Duration(milliseconds: 1900));
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.byType(HousekeepingApp), findsOneWidget);
  });
}
