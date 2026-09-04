import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/batch_cooking/batch_cooking_snapshot.dart';

class BatchCookingCard extends StatelessWidget {
  const BatchCookingCard({
    super.key,
    required this.batch,
    required this.onAction,
  });

  final CookingBatch batch;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final urgent = batch.status == 'expiring';

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: urgent ? AppColors.danger : AppColors.panelBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  batch.name,
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _StatusTag(label: batch.statusLabel, status: batch.status),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${batch.section} · ${batch.remainingQuantity.toStringAsFixed(0)} / ${batch.quantity.toStringAsFixed(0)} ${batch.unit}',
            style: TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 14,
            runSpacing: 8,
            children: [
              _Meta('Timer', batch.timerLabel),
              _Meta('Expiry', '${batch.expiryMinutes}m'),
              _Meta('Reuse', '${batch.reuseCount}x'),
            ],
          ),
          const SizedBox(height: 10),
          LinearProgressIndicator(
            value: batch.progress,
            backgroundColor: AppColors.chipBackground,
            color: urgent ? AppColors.danger : AppColors.primary,
          ),
          if (batch.availableActions.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: batch.availableActions
                  .map(
                    (action) => OutlinedButton(
                      onPressed: () => onAction(action),
                      child: Text(_actionLabel(action)),
                    ),
                  )
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'start_batch' => 'Start batch',
      'extend_timing' => 'Extend timing',
      'mark_ready' => 'Mark ready',
      'mark_reuse' => 'Mark reuse',
      'consume_batch' => 'Consume',
      'dispose_expired' => 'Dispose',
      'log_reuse' => 'Log reuse',
      _ => action,
    };
  }
}

class ProductionForecastList extends StatelessWidget {
  const ProductionForecastList({super.key, required this.forecasts});

  final List<ProductionForecast> forecasts;

  @override
  Widget build(BuildContext context) {
    if (forecasts.isEmpty) {
      return Text(
        'No production forecasts for this section.',
        style: TextStyle(color: AppColors.secondaryText),
      );
    }

    return Column(
      children: forecasts
          .map(
            (forecast) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.premium.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.premium.withValues(alpha: 0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    forecast.label,
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${forecast.section} · ${forecast.forecastCovers} covers · batch ${forecast.recommendedBatchSize} · in ${forecast.startInMinutes}m',
                    style: TextStyle(
                      color: AppColors.bodyText,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${(forecast.confidence * 100).round()}% confidence',
                    style: TextStyle(
                      color: AppColors.premium,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class BatchCookingSidePanel extends StatelessWidget {
  const BatchCookingSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onRefreshForecast,
    required this.refreshing,
  });

  final BatchCookingStats stats;
  final BatchFeatureFlags flags;
  final VoidCallback onRefreshForecast;
  final bool refreshing;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Batch operations',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 16,
            runSpacing: 10,
            children: [
              _Stat('Total', stats.totalBatches),
              _Stat('Cooking', stats.cooking),
              _Stat('Ready', stats.ready),
              _Stat('Expiring', stats.expiring),
              _Stat('Reused', stats.reused),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _FlagChip('Bulk prep', flags.bulkPreparationTracking),
              _FlagChip('Batch timing', flags.batchTiming),
              _FlagChip('Expiry track', flags.batchExpiryTracking),
              _FlagChip('Reuse track', flags.batchReuseTracking),
              _FlagChip('Forecasting', flags.productionForecasting),
            ],
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: refreshing ? null : onRefreshForecast,
            icon: refreshing
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.insights_outlined, size: 18),
            label: const Text('Refresh forecast'),
          ),
        ],
      ),
    );
  }
}

class _StatusTag extends StatelessWidget {
  const _StatusTag({required this.label, required this.status});

  final String label;
  final String status;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'expiring' => AppColors.danger,
      'cooking' => AppColors.warning,
      'ready' => AppColors.primary,
      'reused' => AppColors.info,
      _ => AppColors.secondaryText,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w800,
          fontSize: 11,
        ),
      ),
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Text(
      '$label: $value',
      style: TextStyle(
        color: AppColors.secondaryText,
        fontWeight: FontWeight.w700,
        fontSize: 12,
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value);

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '$value',
          style: TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w900,
            fontSize: 20,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            color: AppColors.secondaryText,
            fontWeight: FontWeight.w600,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}

class _FlagChip extends StatelessWidget {
  const _FlagChip(this.label, this.enabled);

  final String label;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: Icon(
        enabled ? Icons.check_circle : Icons.radio_button_unchecked,
        size: 16,
        color: enabled ? AppColors.primary : AppColors.secondaryText,
      ),
      label: Text(label),
      backgroundColor: enabled
          ? AppColors.primary.withValues(alpha: 0.08)
          : AppColors.chipBackground,
    );
  }
}
