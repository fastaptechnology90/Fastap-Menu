import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_spacing.dart';
import '../../models/dashboard/section_workload.dart';

class SectionWorkloadPanel extends StatelessWidget {
  const SectionWorkloadPanel({super.key, required this.workloads});

  final List<SectionWorkload> workloads;

  @override
  Widget build(BuildContext context) {
    final sorted = [...workloads]
      ..sort((a, b) => b.activeOrders.compareTo(a.activeOrders));
    final items = sorted.take(6).toList();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
        border: Border.all(color: AppColors.panelBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.grid_view_rounded, color: AppColors.primary, size: 22),
              SizedBox(width: AppSpacing.sm),
              Text(
                'Section workload',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                  color: AppColors.primaryText,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          if (items.isEmpty)
            const Text(
              'No workload data for this section.',
              style: TextStyle(color: AppColors.secondaryText),
            )
          else
            ...items.map((item) {
              final color = item.load > 0.75
                  ? AppColors.danger
                  : item.load > 0.45
                      ? AppColors.warning
                      : AppColors.primary;

              return Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.section,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ),
                        Text(
                          '${item.activeOrders} orders · ${item.staffAssigned} staff',
                          style: TextStyle(
                            color: color,
                            fontWeight: FontWeight.w700,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: LinearProgressIndicator(
                        value: item.load.clamp(0.0, 1.0),
                        minHeight: 8,
                        backgroundColor: color.withValues(alpha: 0.12),
                        color: color,
                      ),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}
