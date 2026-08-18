import 'package:flutter/material.dart';

import 'package:kitchenapp/core/constants/app_colors.dart';
import 'package:kitchenapp/navigation/module_refresh_registry.dart';
import 'package:kitchenapp/presentation/screens/main/widgets/home_summary.dart';
import 'package:kitchenapp/state/kitchen_command_controller.dart';

/// Header shown on full-screen module pages opened from Ops/Alerts.
class ModuleDetailHeader extends StatelessWidget {
  const ModuleDetailHeader({
    super.key,
    required this.navIndex,
    required this.title,
    required this.onRefresh,
    this.loading = false,
  });

  final int navIndex;
  final String title;
  final VoidCallback onRefresh;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return HomeSectionTitle(
      title: title,
      subtitle: 'Module $navIndex',
      trailing: IconButton(
        onPressed: loading ? null : onRefresh,
        icon: loading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.refresh_rounded),
      ),
    );
  }

  static Color accentFor(int navIndex) {
    if ({17, 35, 36}.contains(navIndex)) return AppColors.warning;
    if ({12, 38, 39}.contains(navIndex)) return AppColors.info;
    if ({10, 11, 47, 48, 49}.contains(navIndex)) return AppColors.premium;
    return AppColors.primary;
  }
}

Future<void> refreshModule(
  KitchenCommandController controller,
  int navIndex,
) {
  return ModuleRefreshRegistry.refresh(controller, navIndex);
}

bool moduleLoading(KitchenCommandController controller, int navIndex) {
  return ModuleRefreshRegistry.isLoading(controller, navIndex);
}
