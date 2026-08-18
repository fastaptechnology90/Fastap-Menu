import 'package:flutter/material.dart';

import 'package:kitchenapp/core/constants/app_durations.dart';
import 'package:kitchenapp/core/storage/app_preferences.dart';
import 'package:kitchenapp/presentation/screens/auth/login_screen.dart';
import 'package:kitchenapp/presentation/screens/main/main_shell_screen.dart';
import 'package:kitchenapp/widgets/auth/activity_tracker.dart';
import 'package:kitchenapp/presentation/screens/onboarding/onboarding_screen.dart';
import 'package:kitchenapp/presentation/screens/splash/splash_screen.dart';
import 'package:kitchenapp/state/auth_controller.dart';

enum AppFlow { bootstrapping, onboarding, unauthenticated, authenticated }

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  late final AuthController _auth;
  AppFlow _flow = AppFlow.bootstrapping;

  @override
  void initState() {
    super.initState();
    _auth = AuthController();
    _auth.addListener(_onAuthChanged);
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    await Future<void>.delayed(AppDurations.splashDelay);
    final onboardingDone = await AppPreferences().isOnboardingComplete();
    await _auth.bootstrap();

    if (!mounted) return;

    if (_auth.isAuthenticated) {
      setState(() => _flow = AppFlow.authenticated);
      return;
    }

    setState(
      () => _flow = onboardingDone ? AppFlow.unauthenticated : AppFlow.onboarding,
    );
  }

  void _onAuthChanged() {
    if (_auth.isAuthenticated) {
      setState(() => _flow = AppFlow.authenticated);
    } else if (_auth.status == AuthStatus.unauthenticated &&
        _flow == AppFlow.authenticated) {
      setState(() => _flow = AppFlow.unauthenticated);
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
      AppFlow.bootstrapping => const SplashScreen(),
      AppFlow.onboarding => OnboardingScreen(
          onComplete: () => setState(() => _flow = AppFlow.unauthenticated),
        ),
      AppFlow.unauthenticated => LoginScreen(auth: _auth),
      AppFlow.authenticated => ActivityTracker(
          auth: _auth,
          child: MainShellScreen(auth: _auth),
        ),
    };
  }
}
