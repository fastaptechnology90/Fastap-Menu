import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:kitchenapp/app/fastap_kitchen_app.dart';
import 'package:kitchenapp/core/config/app_variant_content.dart';
import 'package:kitchenapp/core/storage/app_preferences.dart';
import 'package:kitchenapp/data/enterprise_feature_catalog.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('App loads splash then login surface', (
    WidgetTester tester,
  ) async {
    await AppPreferences().setOnboardingComplete();

    await tester.pumpWidget(const FastapKitchenApp());
    await tester.pump();
    expect(find.text('Preparing your kitchen workspace…'), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 1900));
    await tester.pump(const Duration(milliseconds: 500));

    // The heading and subtitle are per-variant now (kitchen / waiter /
    // housekeeping), so this reads them from the same source the screen does.
    // Hard-coding 'Staff sign in' made the test fail once the kitchen build
    // started saying 'Kitchen staff sign in' — the screen was fine, the
    // expectation was stale.
    expect(find.text(AppVariantContent.loginTitle), findsOneWidget);
    expect(
      find.textContaining(AppVariantContent.loginSubtitle),
      findsOneWidget,
    );
    expect(find.text('Mobile OTP login'), findsOneWidget);
  });

  test('enterprise catalog contains every provided system', () {
    expect(EnterpriseFeatureCatalog.systems.length, 49);
    expect(
      EnterpriseFeatureCatalog.systems.first.title,
      'Authentication & Security System',
    );
    expect(
      EnterpriseFeatureCatalog.systems.last.title,
      'Waiter Auto Assignment System',
    );
    expect(EnterpriseFeatureCatalog.totalFeatureCount, greaterThan(250));
  });
}
