import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';

class DashboardTone {
  const DashboardTone._();

  static Color colorFor(String tone) {
    return switch (tone) {
      'danger' => AppColors.danger,
      'warning' => AppColors.warning,
      'info' => AppColors.info,
      'premium' => AppColors.premium,
      _ => AppColors.primary,
    };
  }

  static IconData iconForWidget(String key) {
    return switch (key) {
      'activeOrders' => Icons.local_fire_department,
      'delayedOrders' => Icons.notification_important_outlined,
      'vipOrders' => Icons.workspace_premium_outlined,
      'priorityOrders' => Icons.priority_high,
      'pendingKots' => Icons.pending_actions_outlined,
      'completedOrders' => Icons.task_alt_outlined,
      'rejectedOrders' => Icons.block_outlined,
      'staffAvailability' => Icons.groups_2_outlined,
      'sectionWorkload' => Icons.grid_view_outlined,
      'rushAlerts' => Icons.campaign_outlined,
      _ => Icons.dashboard_outlined,
    };
  }

  static IconData iconForMetric(String key) {
    return switch (key) {
      'kitchenEfficiency' => Icons.speed,
      'avgPrepTime' => Icons.timer_outlined,
      'delayRatio' => Icons.warning_amber_rounded,
      'orderBacklog' => Icons.queue_outlined,
      'peakKitchenLoad' => Icons.stacked_line_chart,
      'staffProductivity' => Icons.insights_outlined,
      'livePrepSpeed' => Icons.bolt_outlined,
      _ => Icons.analytics_outlined,
    };
  }

  static IconData iconForSection(String section) {
    return switch (section) {
      'Tandoor' => Icons.local_fire_department_outlined,
      'Chinese' => Icons.ramen_dining_outlined,
      'Beverage' => Icons.local_cafe_outlined,
      'Dessert' => Icons.cake_outlined,
      'Bakery' => Icons.bakery_dining_outlined,
      'Grill' => Icons.outdoor_grill_outlined,
      'Fry' => Icons.fastfood_outlined,
      'Salad' => Icons.eco_outlined,
      _ => Icons.restaurant_outlined,
    };
  }

  static IconData iconForOrderLocation(String location) {
    final lower = location.toLowerCase();
    if (lower.contains('room')) {
      return Icons.hotel_outlined;
    }
    if (lower.contains('zomato') ||
        lower.contains('swiggy') ||
        lower.contains('takeaway')) {
      return Icons.delivery_dining_outlined;
    }
    if (lower.contains('banquet')) {
      return Icons.celebration_outlined;
    }
    return Icons.receipt_long_outlined;
  }

  static Color colorForOrderStatus(String status) {
    return switch (status) {
      'delayed' || 'rejected' || 'cancelled' => AppColors.danger,
      'ready' => AppColors.primary,
      'served' => AppColors.primary,
      'new' || 'accepted' => AppColors.info,
      're_fire' => AppColors.warning,
      'preparing' => AppColors.warning,
      _ when status.contains('vip') => AppColors.premium,
      _ => AppColors.warning,
    };
  }
}
