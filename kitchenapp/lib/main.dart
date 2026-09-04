import 'package:flutter/material.dart';
import 'package:kitchenapp/core/config/app_variant_config.dart';
import 'package:kitchenapp/core/constants/app_colors.dart';

import 'app/fastap_kitchen_app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  AppVariantConfig.configure(StaffAppVariant.kitchen);
  await loadThemeMode();
  runApp(const FastapKitchenApp());
}
