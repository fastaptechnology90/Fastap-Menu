import 'package:flutter/material.dart';
import 'package:kitchenapp/core/constants/app_colors.dart';

import 'app/app_bootstrap.dart';
import 'app/waiter_app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  AppBootstrap.initialize();
  await loadThemeMode();
  runApp(const WaiterApp());
}
