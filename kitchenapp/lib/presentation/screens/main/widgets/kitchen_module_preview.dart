import 'package:flutter/material.dart';

import 'package:kitchenapp/core/constants/app_colors.dart';
import 'package:kitchenapp/core/constants/app_spacing.dart';
import 'package:kitchenapp/presentation/screens/main/widgets/home_summary.dart';

class KitchenPreviewStat {
  const KitchenPreviewStat(this.label, this.value, this.icon, this.color);

  final String label;
  final String value;
  final IconData icon;
  final Color color;
}

class KitchenPreviewStatGrid extends StatelessWidget {
  const KitchenPreviewStatGrid({super.key, required this.stats});

  final List<KitchenPreviewStat> stats;

  @override
  Widget build(BuildContext context) {
    final items = stats.take(4).toList();
    return Column(
      children: [
        for (var row = 0; row < 2; row++)
          if (row * 2 < items.length) ...[
            if (row > 0) const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Expanded(child: _StatTile(item: items[row * 2])),
                if (row * 2 + 1 < items.length) ...[
                  const SizedBox(width: AppSpacing.md),
                  Expanded(child: _StatTile(item: items[row * 2 + 1])),
                ] else
                  const Expanded(child: SizedBox.shrink()),
              ],
            ),
          ],
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.item});

  final KitchenPreviewStat item;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(item.icon, size: 18, color: item.color),
          const SizedBox(height: AppSpacing.sm),
          Text(
            item.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.secondaryText,
            ),
          ),
          const SizedBox(height: 2),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              item.value,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w900,
                color: item.color.withValues(alpha: 0.95),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class KitchenPreviewList extends StatelessWidget {
  const KitchenPreviewList({
    super.key,
    required this.title,
    required this.items,
  });

  final String title;
  final List<KitchenPreviewRow> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        HomeSectionTitle(title: title, subtitle: '${items.length} shown'),
        const SizedBox(height: AppSpacing.md),
        if (items.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.xl),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
              border: Border.all(color: AppColors.panelBorder),
            ),
            child: Text(
              'Nothing to show for this section.',
              style: TextStyle(color: AppColors.secondaryText),
            ),
          )
        else
          ...items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: _PreviewRow(item: item),
            ),
          ),
      ],
    );
  }
}

class KitchenPreviewRow {
  const KitchenPreviewRow({
    required this.title,
    required this.subtitle,
    required this.trailing,
    required this.color,
    required this.icon,
  });

  final String title;
  final String subtitle;
  final String trailing;
  final Color color;
  final IconData icon;
}

class _PreviewRow extends StatelessWidget {
  const _PreviewRow({required this.item});

  final KitchenPreviewRow item;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.md,
      ),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: item.color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(item.icon, color: item.color, size: 20),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: AppColors.primaryText,
                  ),
                ),
                Text(
                  item.subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.secondaryText,
                  ),
                ),
              ],
            ),
          ),
          Text(
            item.trailing,
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: item.color,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class KitchenModuleLoading extends StatelessWidget {
  const KitchenModuleLoading({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(48),
        child: CircularProgressIndicator(),
      ),
    );
  }
}

class KitchenModuleError extends StatelessWidget {
  const KitchenModuleError({
    super.key,
    required this.message,
    required this.onRetry,
  });

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.xxl),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        children: [
          Icon(Icons.cloud_off_outlined, color: AppColors.secondaryText),
          const SizedBox(height: AppSpacing.md),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: AppSpacing.md),
          FilledButton(
            onPressed: onRetry,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
            ),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
