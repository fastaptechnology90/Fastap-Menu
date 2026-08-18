import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_spacing.dart';
import '../../core/theme/dashboard_tone.dart';
import '../../models/dashboard/dashboard_widget_item.dart';

class DashboardWidgetGrid extends StatelessWidget {
  const DashboardWidgetGrid({super.key, required this.widgets});

  final List<DashboardWidgetItem> widgets;

  static const cardMinHeight = 100.0;

  @override
  Widget build(BuildContext context) {
    if (widgets.isEmpty) return const SizedBox.shrink();

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth > 900 ? 3 : 2;
        final rows = (widgets.length / columns).ceil();

        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var row = 0; row < rows; row++) ...[
              if (row > 0) const SizedBox(height: AppSpacing.md),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var col = 0; col < columns; col++) ...[
                    if (col > 0) const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: _cellFor(row, col, columns),
                    ),
                  ],
                ],
              ),
            ],
          ],
        );
      },
    );
  }

  Widget _cellFor(int row, int col, int columns) {
    final index = row * columns + col;
    if (index >= widgets.length) {
      return const SizedBox.shrink();
    }
    return _DashboardKpiCard(item: widgets[index], index: index);
  }
}

class _DashboardKpiCard extends StatelessWidget {
  const _DashboardKpiCard({required this.item, required this.index});

  final DashboardWidgetItem item;
  final int index;

  @override
  Widget build(BuildContext context) {
    final tone = DashboardTone.colorFor(item.tone);

    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: DashboardWidgetGrid.cardMinHeight),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
          border: Border.all(color: AppColors.panelBorder),
        ),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: tone.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      DashboardTone.iconForWidget(item.key),
                      size: 16,
                      color: tone,
                    ),
                  ),
                  const Spacer(),
                  Flexible(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: tone.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        item.detail,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: tone,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                item.label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.secondaryText,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 4),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  item.value,
                  maxLines: 1,
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    color: tone.withValues(alpha: 0.95),
                    height: 1,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
