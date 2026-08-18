import 'package:flutter/material.dart';

import 'app/app_bootstrap.dart';
import 'app/waiter_app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  AppBootstrap.initialize();
  runApp(const WaiterApp());
}
