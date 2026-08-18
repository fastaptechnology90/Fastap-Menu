import 'package:flutter/material.dart';

import 'package:kitchenapp/core/constants/constants.dart';
import 'package:kitchenapp/core/theme/theme.dart';
import 'package:kitchenapp/presentation/screens/auth/auth_gate.dart';

class FastapKitchenApp extends StatelessWidget {
  const FastapKitchenApp({super.key});

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
