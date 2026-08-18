import 'package:flutter/material.dart';
import 'package:kitchenapp/core/config/app_variant_config.dart';

import 'app/fastap_kitchen_app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  AppVariantConfig.configure(StaffAppVariant.kitchen);
  runApp(const FastapKitchenApp());
}
