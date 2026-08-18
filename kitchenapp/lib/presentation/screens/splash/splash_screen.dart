import 'package:flutter/material.dart';

import 'package:kitchenapp/core/config/app_variant_content.dart';
import 'package:kitchenapp/core/constants/app_colors.dart';
import 'package:kitchenapp/presentation/widgets/common/app_logo.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fade;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _fade = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _scale = Tween<double>(begin: 0.82, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutBack),
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: AppVariantContent.backgroundGradient,
          ),
        ),
        child: SafeArea(
          child: FadeTransition(
            opacity: _fade,
            child: Column(
              children: [
                const Spacer(flex: 2),
                ScaleTransition(
                  scale: _scale,
                  child: const AppLogo(size: 96),
                ),
                const Spacer(flex: 2),
                const SizedBox(
                  width: 32,
                  height: 32,
                  child: CircularProgressIndicator(
                    strokeWidth: 3,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  AppVariantContent.splashMessage,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppColors.secondaryText,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Spacer(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
