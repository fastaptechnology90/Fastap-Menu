import 'package:flutter/material.dart';

import '../core/constants/app_colors.dart';
import '../models/kitchen_order.dart';
import '../models/metric.dart';

class KitchenSeedData {
  const KitchenSeedData._();

  static final sections = [
    'All',
    'Main',
    'Tandoor',
    'Chinese',
    'Beverage',
    'Dessert',
    'Bakery',
    'Bar',
    'Grill',
    'Fry',
    'Salad',
    'Pizza',
  ];

  static final liveMetrics = [
    Metric(
      label: 'Active orders',
      value: '42',
      detail: '+8 rush',
      icon: Icons.local_fire_department,
      color: AppColors.danger,
    ),
    Metric(
      label: 'Avg prep time',
      value: '13m',
      detail: '-2m today',
      icon: Icons.timer_outlined,
      color: AppColors.info,
    ),
    Metric(
      label: 'Kitchen efficiency',
      value: '91%',
      detail: '+6%',
      icon: Icons.speed,
      color: AppColors.primary,
    ),
    Metric(
      label: 'Delayed KOTs',
      value: '6',
      detail: '2 critical',
      icon: Icons.notification_important_outlined,
      color: AppColors.warning,
    ),
  ];

  static final insightMetrics = [
    Metric(
      label: 'Peak load',
      value: '7:45 PM',
      detail: 'Forecasted',
      icon: Icons.stacked_line_chart,
      color: AppColors.premium,
    ),
    Metric(
      label: 'Waste risk',
      value: '4.2 kg',
      detail: 'Dessert batch',
      icon: Icons.delete_sweep_outlined,
      color: AppColors.warning,
    ),
    Metric(
      label: 'Complaint ratio',
      value: '1.8%',
      detail: '-0.7%',
      icon: Icons.thumb_up_outlined,
      color: AppColors.primary,
    ),
    Metric(
      label: 'Offline queue',
      value: 'Ready',
      detail: 'Failover tested',
      icon: Icons.cloud_sync_outlined,
      color: AppColors.info,
    ),
  ];

  static final orders = [
    KitchenOrder(
      title: 'KOT #1842',
      location: 'Table 12',
      section: 'Tandoor',
      items: ['2x Butter naan', '1x Tandoori platter', 'No onion chutney'],
      status: 'Preparing',
      timer: '07:18',
      progress: 0.62,
      color: AppColors.info,
      icon: Icons.receipt_long_outlined,
      priorityIcon: Icons.timer_outlined,
    ),
    KitchenOrder(
      title: 'KOT #1843',
      location: 'Room 804',
      section: 'Main',
      items: ['1x Dal makhani', '1x Steamed rice', 'Nut allergy protocol'],
      status: 'VIP',
      timer: '04:42',
      progress: 0.78,
      color: AppColors.premium,
      icon: Icons.hotel_outlined,
      priorityIcon: Icons.workspace_premium_outlined,
      vip: true,
      allergy: true,
    ),
    KitchenOrder(
      title: 'KOT #1844',
      location: 'Zomato',
      section: 'Chinese',
      items: ['2x Hakka noodles', '1x Manchurian gravy', 'Extra spicy'],
      status: 'Delayed',
      timer: '16:05',
      progress: 0.36,
      color: AppColors.danger,
      icon: Icons.delivery_dining_outlined,
      priorityIcon: Icons.warning_amber_rounded,
    ),
    KitchenOrder(
      title: 'KOT #1845',
      location: 'Banquet A',
      section: 'Dessert',
      items: ['40x Gulab jamun', '40x Ice cream scoop', 'Batch expiry 28m'],
      status: 'Batch',
      timer: '11:30',
      progress: 0.54,
      color: AppColors.primary,
      icon: Icons.celebration_outlined,
      priorityIcon: Icons.groups_2_outlined,
    ),
    KitchenOrder(
      title: 'KOT #1846',
      location: 'Takeaway',
      section: 'Beverage',
      items: ['2x Cold coffee', '1x Mango lassi', 'Spill-proof packing'],
      status: 'Ready soon',
      timer: '02:12',
      progress: 0.88,
      color: AppColors.primary,
      icon: Icons.local_cafe_outlined,
      priorityIcon: Icons.task_alt,
    ),
    KitchenOrder(
      title: 'KOT #1847',
      location: 'Table 4',
      section: 'Grill',
      items: [
        '1x Grilled fish',
        'Seafood allergy nearby',
        'QC temperature check',
      ],
      status: 'Safety',
      timer: '09:51',
      progress: 0.49,
      color: AppColors.warning,
      icon: Icons.outdoor_grill_outlined,
      priorityIcon: Icons.health_and_safety_outlined,
      allergy: true,
    ),
  ];
}
