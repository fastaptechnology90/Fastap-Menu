import 'package:flutter/material.dart';
import 'package:kitchenapp/core/constants/app_constants.dart';
import 'package:kitchenapp/core/theme/app_theme.dart';
import 'package:kitchenapp/presentation/screens/auth/auth_gate.dart';

class WaiterApp extends StatelessWidget {
  const WaiterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: AppConstants.appTitle,
      theme: AppTheme.light,
      home: const AuthGate(),
    );
  }
}
