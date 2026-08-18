import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/recipes/recipe_costing_snapshot.dart';

class RecipeCostingCard extends StatelessWidget {
  const RecipeCostingCard({
    super.key,
    required this.recipe,
    required this.onRecordWaste,
    required this.onAdjustPortion,
  });

  final RecipeCostingItem recipe;
  final VoidCallback onRecordWaste;
  final VoidCallback onAdjustPortion;

  @override
  Widget build(BuildContext context) {
    final highCost = recipe.foodCostPercent > 32;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: highCost ? AppColors.warning : AppColors.panelBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  recipe.name,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              if (highCost)
                const _Tag(label: 'High food cost', color: AppColors.warning),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${recipe.section} · ${recipe.portionStandard}',
            style: const TextStyle(
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
              _Stat('Plate cost', '₹${recipe.plateCost.toStringAsFixed(0)}'),
              _Stat('Food cost', '${recipe.foodCostPercent.toStringAsFixed(1)}%'),
              _Stat('Profit', '₹${recipe.profitPerPlate.toStringAsFixed(0)}'),
              _Stat('Fluctuation', '₹${recipe.costFluctuation.toStringAsFixed(1)}'),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            'Ingredient quantities',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 6),
          ...recipe.ingredients.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(
                '${item.name} · ${item.quantity} · ₹${item.cost.toStringAsFixed(0)}',
                style: const TextStyle(
                  color: AppColors.bodyText,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          const Text(
            'Cooking SOP',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 6),
          ...recipe.sopSteps.map(
            (step) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.check_circle_outline, size: 14),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      step,
                      style: const TextStyle(
                        color: AppColors.bodyText,
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(Icons.play_circle_outline, size: 16),
              const SizedBox(width: 6),
              Text(
                'Prep video · ${recipe.prepVideoUrl}',
                style: const TextStyle(
                  color: AppColors.info,
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton(
                onPressed: onRecordWaste,
                child: const Text('Record waste'),
              ),
              OutlinedButton(
                onPressed: onAdjustPortion,
                child: const Text('Adjust portion'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class RecipeCostingSidePanel extends StatelessWidget {
  const RecipeCostingSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.wasteLog,
    required this.onRefresh,
    required this.refreshing,
  });

  final RecipeCostingStats stats;
  final RecipeFeatureFlags flags;
  final List<WasteLogEntry> wasteLog;
  final VoidCallback onRefresh;
  final bool refreshing;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.panelBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Food costing overview',
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
                  _Stat('Recipes', '${stats.recipes}'),
                  _Stat('Avg food cost', '${stats.avgFoodCostPercent.toStringAsFixed(1)}%'),
                  _Stat('High cost', '${stats.highCostRecipes}'),
                  _Stat('Profitable', '${stats.profitableRecipes}'),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _FlagChip('Standard recipes', flags.standardRecipes),
                  _FlagChip('Portion standards', flags.portionStandards),
                  _FlagChip('Prep videos', flags.preparationVideos),
                  _FlagChip('Cooking SOPs', flags.cookingSops),
                  _FlagChip('Per plate costing', flags.perPlateCosting),
                  _FlagChip('Waste tracking', flags.wasteTracking),
                  _FlagChip('Profit analysis', flags.profitAnalysis),
                  _FlagChip('Cost fluctuation', flags.costFluctuationTracking),
                ],
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: refreshing ? null : onRefresh,
                icon: refreshing
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh costing'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        const Text(
          'Waste tracking log',
          style: TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w800,
            fontSize: 16,
          ),
        ),
        const SizedBox(height: 8),
        if (wasteLog.isEmpty)
          const Text(
            'No waste recorded yet.',
            style: TextStyle(color: AppColors.secondaryText),
          )
        else
          ...wasteLog.map(
            (entry) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.chipBackground,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.panelBorder),
              ),
              child: Text(
                '${entry.recipeName} · ${entry.plates} plates · ₹${entry.cost.toStringAsFixed(0)} · ${entry.reason}',
                style: const TextStyle(
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

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: const TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w900,
            fontSize: 16,
          ),
        ),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.secondaryText,
            fontWeight: FontWeight.w600,
            fontSize: 11,
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
