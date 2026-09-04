import 'package:flutter/material.dart';

import '../core/constants/app_colors.dart';
import '../models/feature_module_status.dart';

class FeatureModuleStatusResolver {
  const FeatureModuleStatusResolver._();

  static FeatureModuleStatus statusFor(int systemNumber) {
    if (systemNumber >= 1 && systemNumber <= 49) {
      return FeatureModuleStatus(
        label: 'Live · In-app',
        icon: Icons.check_circle_outline,
        color: AppColors.primary,
      );
    }

    if ({1, 3, 5, 9, 14, 18, 19, 37, 38, 44, 45}.contains(systemNumber)) {
      return FeatureModuleStatus(
        label: 'Critical workflow',
        icon: Icons.priority_high,
        color: AppColors.danger,
      );
    }

    if ({11, 12, 32, 35, 39, 40, 48}.contains(systemNumber)) {
      return FeatureModuleStatus(
        label: 'AI enabled',
        icon: Icons.psychology_alt_outlined,
        color: AppColors.premium,
      );
    }

    if ({23, 31, 41, 42, 43}.contains(systemNumber)) {
      return FeatureModuleStatus(
        label: 'Integration ready',
        icon: Icons.hub_outlined,
        color: AppColors.info,
      );
    }

    return FeatureModuleStatus(
      label: 'Operational module',
      icon: Icons.task_alt,
      color: AppColors.primary,
    );
  }

  static List<String> hooksFor(int systemNumber) {
    if ({1, 2, 34, 44}.contains(systemNumber)) {
      return const ['Session state', 'Role policy', 'Audit trail'];
    }
    if ({14, 15, 17, 30, 31, 32}.contains(systemNumber)) {
      return const ['Live telemetry', 'Stock ledger', 'Alert engine'];
    }
    if ({23, 26, 27, 28, 43}.contains(systemNumber)) {
      return const ['Order routing', 'Dispatch sync', 'Branch context'];
    }
    if ({11, 12, 35, 39, 40, 48}.contains(systemNumber)) {
      return const ['Prediction model', 'Recommendation queue', 'Feedback loop'];
    }
    if ({37, 38, 45, 47}.contains(systemNumber)) {
      return const ['Failover queue', 'Incident log', 'Recovery action'];
    }
    return const ['UI workflow', 'State controller', 'Action log'];
  }
}
