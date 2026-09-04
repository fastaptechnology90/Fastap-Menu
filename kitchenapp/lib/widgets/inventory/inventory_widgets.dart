import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/inventory/inventory_snapshot.dart';

class InventoryItemCard extends StatelessWidget {
  const InventoryItemCard({
    super.key,
    required this.item,
    required this.onDeduct,
  });

  final InventoryItem item;
  final VoidCallback onDeduct;

  @override
  Widget build(BuildContext context) {
    final low = item.status == 'low';

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: low ? AppColors.warning : AppColors.panelBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  item.name,
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              if (low)
                _Tag(label: 'Low stock', color: AppColors.warning),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${item.section} · batch ${item.batchId}',
            style: TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 12,
            runSpacing: 8,
            children: [
              _Meta('On hand', '${item.onHand.toStringAsFixed(1)} ${item.unit}'),
              _Meta('Min', '${item.minLevel.toStringAsFixed(1)} ${item.unit}'),
              _Meta('Expiry', '${item.expiryDays}d'),
            ],
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: onDeduct,
            child: const Text('Live deduct 0.5'),
          ),
        ],
      ),
    );
  }
}

class InventoryBatchList extends StatelessWidget {
  const InventoryBatchList({super.key, required this.batches});

  final List<InventoryBatch> batches;

  @override
  Widget build(BuildContext context) {
    if (batches.isEmpty) {
      return Text(
        'No batch records for this section.',
        style: TextStyle(color: AppColors.secondaryText),
      );
    }

    return Column(
      children: batches
          .map(
            (batch) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: batch.status == 'expiring_soon'
                    ? AppColors.danger.withValues(alpha: 0.08)
                    : AppColors.chipBackground,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.panelBorder),
              ),
              child: Text(
                '${batch.itemName} · ${batch.quantity.toStringAsFixed(1)} ${batch.unit} · expires in ${batch.expiryDays}d',
                style: TextStyle(
                  color: AppColors.bodyText,
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
              ),
            ),
          )
          .toList(),
    );
  }
}

class InventoryAlertCard extends StatelessWidget {
  const InventoryAlertCard({
    super.key,
    required this.alert,
    required this.onAction,
  });

  final InventoryAlert alert;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final color = switch (alert.severity) {
      'critical' => AppColors.danger,
      'high' => AppColors.warning,
      _ => AppColors.info,
    };

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            alert.title,
            style: TextStyle(color: color, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            alert.detail,
            style: TextStyle(
              color: AppColors.bodyText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          if (alert.status == 'open') ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: alert.availableActions
                  .map(
                    (action) => OutlinedButton(
                      onPressed: () => onAction(action),
                      child: Text(action == 'acknowledge' ? 'Acknowledge' : 'Resolve'),
                    ),
                  )
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }
}

class SubstitutionCard extends StatelessWidget {
  const SubstitutionCard({
    super.key,
    required this.substitution,
    required this.onApply,
  });

  final IngredientSubstitution substitution;
  final VoidCallback onApply;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${substitution.itemName} → ${substitution.substituteName}',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            substitution.reason,
            style: TextStyle(
              color: AppColors.bodyText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${(substitution.confidence * 100).round()}% confidence',
            style: TextStyle(
              color: AppColors.premium,
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: onApply,
            child: const Text('Apply substitution'),
          ),
        ],
      ),
    );
  }
}

class InventorySidePanel extends StatelessWidget {
  const InventorySidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.predictions,
    required this.deductions,
    required this.onSync,
    required this.onValidate,
    required this.syncing,
  });

  final InventoryStats stats;
  final InventoryFeatureFlags flags;
  final List<ShortagePrediction> predictions;
  final List<InventoryDeduction> deductions;
  final VoidCallback onSync;
  final VoidCallback onValidate;
  final bool syncing;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
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
                'Stock ledger',
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
                  _Stat('Items', stats.totalItems),
                  _Stat('Low stock', stats.lowStock),
                  _Stat('Expiring', stats.expiringBatches),
                  _Stat('Alerts', stats.openAlerts),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _FlagChip('Live deduct', flags.liveIngredientDeduction),
                  _FlagChip('Validation', flags.stockValidation),
                  _FlagChip('Batch track', flags.batchTracking),
                  _FlagChip('Expiry track', flags.expiryTracking),
                  _FlagChip('Auto sync', flags.autoStockSynchronization),
                  _FlagChip('AI shortage', flags.aiShortagePrediction),
                  _FlagChip('Substitutions', flags.ingredientSubstitutionSuggestions),
                  _FlagChip('Recipe check', flags.recipeStockValidation),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  FilledButton.icon(
                    onPressed: syncing ? null : onSync,
                    icon: syncing
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.sync, size: 18),
                    label: const Text('Sync stock'),
                  ),
                  OutlinedButton(
                    onPressed: onValidate,
                    child: const Text('Validate recipe stock'),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'AI shortage prediction',
          style: TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w800,
            fontSize: 16,
          ),
        ),
        const SizedBox(height: 8),
        ...predictions.map(
          (prediction) => Container(
            width: double.infinity,
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.premium.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '${prediction.itemName} · shortage in ${prediction.predictedShortageHours}h · ${(prediction.confidence * 100).round()}%',
              style: TextStyle(
                color: AppColors.premium,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'Recent deductions',
          style: TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w800,
            fontSize: 16,
          ),
        ),
        const SizedBox(height: 8),
        if (deductions.isEmpty)
          Text(
            'No live deductions yet.',
            style: TextStyle(color: AppColors.secondaryText),
          )
        else
          ...deductions.map(
            (deduction) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(
                '${deduction.itemName} -${deduction.quantity} ${deduction.unit}',
                style: TextStyle(
                  color: AppColors.bodyText,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
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
