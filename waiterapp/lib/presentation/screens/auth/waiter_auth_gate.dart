import 'package:flutter/material.dart';
import 'package:kitchenapp/core/constants/app_durations.dart';
import 'package:kitchenapp/core/storage/app_preferences.dart';
import 'package:kitchenapp/presentation/screens/auth/login_screen.dart';
import 'package:kitchenapp/presentation/screens/main/main_shell_screen.dart';
import 'package:kitchenapp/presentation/screens/onboarding/onboarding_screen.dart';
import 'package:kitchenapp/presentation/screens/splash/splash_screen.dart';
import 'package:kitchenapp/state/controllers/auth_controller.dart';
import 'package:kitchenapp/widgets/auth/activity_tracker.dart';

import '../../../state/controllers/waiter_auth_controller.dart';

enum WaiterAppFlow { bootstrapping, onboarding, unauthenticated, authenticated }

class WaiterAuthGate extends StatefulWidget {
  const WaiterAuthGate({super.key});

  @override
  State<WaiterAuthGate> createState() => _WaiterAuthGateState();
}

class _WaiterAuthGateState extends State<WaiterAuthGate> {
  late final WaiterAuthController _auth;
  WaiterAppFlow _flow = WaiterAppFlow.bootstrapping;

  @override
  void initState() {
    super.initState();
    _auth = WaiterAuthController();
    _auth.addListener(_onAuthChanged);
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    await Future<void>.delayed(AppDurations.splashDelay);
    final onboardingDone = await AppPreferences().isOnboardingComplete();
    await _auth.bootstrap();

    if (!mounted) return;

    if (_auth.isAuthenticated) {
      setState(() => _flow = WaiterAppFlow.authenticated);
      return;
    }

    setState(
      () => _flow = onboardingDone
          ? WaiterAppFlow.unauthenticated
          : WaiterAppFlow.onboarding,
    );
  }

  void _onAuthChanged() {
    if (_auth.isAuthenticated) {
      setState(() => _flow = WaiterAppFlow.authenticated);
    } else if (_auth.status == AuthStatus.unauthenticated &&
        _flow == WaiterAppFlow.authenticated) {
      setState(() => _flow = WaiterAppFlow.unauthenticated);
    }
  }

  @override
  void dispose() {
    _auth.removeListener(_onAuthChanged);
    _auth.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return switch (_flow) {
      WaiterAppFlow.bootstrapping => const SplashScreen(),
      WaiterAppFlow.onboarding => OnboardingScreen(
          onComplete: () => setState(() => _flow = WaiterAppFlow.unauthenticated),
        ),
      WaiterAppFlow.unauthenticated => LoginScreen(auth: _auth),
      WaiterAppFlow.authenticated => ActivityTracker(
          auth: _auth,
          child: MainShellScreen(auth: _auth),
        ),
    };
  }
}
