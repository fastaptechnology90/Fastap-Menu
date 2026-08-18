import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/bar/bar_beverage_snapshot.dart';

class BeverageDrinkCard extends StatelessWidget {
  const BeverageDrinkCard({
    super.key,
    required this.drink,
    required this.onAction,
  });

  final BeverageDrink drink;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (drink.status) {
      'preparing' => AppColors.info,
      'customizing' => AppColors.premium,
      'on_hold' => AppColors.warning,
      _ => AppColors.secondaryText,
    };

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: statusColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  drink.kotNumber,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _Tag(label: drink.status, color: statusColor),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${drink.drinkName} · ${drink.location}',
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 14,
            runSpacing: 8,
            children: [
              _Meta('Timer', drink.timerLabel),
              _Meta('Customization', drink.customization),
              if (drink.bartender != null) _Meta('Bartender', drink.bartender!),
            ],
          ),
          if (drink.recipeGuidance.isNotEmpty) ...[
            const SizedBox(height: 10),
            const Text(
              'Recipe guidance',
              style: TextStyle(
                color: AppColors.primaryText,
                fontWeight: FontWeight.w800,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 6),
            ...drink.recipeGuidance.map(
              (step) => Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.arrow_right, size: 16, color: AppColors.info),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        step,
                        style: const TextStyle(
                          color: AppColors.bodyText,
                          fontWeight: FontWeight.w600,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: drink.availableActions
                .map(
                  (action) => action == 'complete_drink'
                      ? FilledButton(
                          onPressed: () => onAction(action),
                          child: Text(_actionLabel(action)),
                        )
                      : OutlinedButton(
                          onPressed: () => onAction(action),
                          child: Text(_actionLabel(action)),
                        ),
                )
                .toList(),
          ),
        ],
      ),
    );
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'assign_bartender' => 'Assign',
      'start_drink' => 'Start',
      'apply_customization' => 'Customize',
      'complete_drink' => 'Complete',
      'hold_drink' => 'Hold',
      _ => action,
    };
  }
}

class BartenderPanel extends StatelessWidget {
  const BartenderPanel({super.key, required this.bartenders});

  final List<BartenderAssignment> bartenders;

  @override
  Widget build(BuildContext context) {
    if (bartenders.isEmpty) {
      return const _EmptyBox(message: 'No bartenders on shift');
    }

    return Column(
      children: bartenders
          .map(
            (bartender) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.panelBorder),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          bartender.name,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          bartender.specialty,
                          style: const TextStyle(
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _Tag(
                    label: '${bartender.activeDrinks} active',
                    color: bartender.status == 'busy'
                        ? AppColors.warning
                        : AppColors.primary,
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class BarSidePanel extends StatelessWidget {
  const BarSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onBalance,
    required this.processing,
  });

  final BarBeverageStats stats;
  final BarFeatureFlags flags;
  final VoidCallback onBalance;
  final bool processing;

  @override
  Widget build(BuildContext context) {
    return Container(
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
            'Bar metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Queued drinks', '${stats.queuedDrinks}'),
          _StatRow('In progress', '${stats.inProgress}'),
          _StatRow('Customized', '${stats.customizedDrinks}'),
          _StatRow('Completed today', '${stats.completedToday}'),
          _StatRow('Available bartenders', '${stats.availableBartenders}'),
          _StatRow('Avg prep', '${stats.avgPrepMinutes}m'),
          const SizedBox(height: 16),
          const Text(
            'Active bar modules',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 8),
          ...[
            ('Drink preparation queue', flags.drinkPreparationQueue),
            ('Bartender assignment', flags.bartenderAssignment),
            ('Cocktail customization', flags.cocktailCustomization),
            ('Beverage timers', flags.beverageTimers),
            ('Recipe guidance', flags.recipeGuidance),
          ].map(
            (entry) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  Icon(
                    entry.$2 ? Icons.check_circle : Icons.circle_outlined,
                    size: 16,
                    color: entry.$2 ? AppColors.primary : AppColors.secondaryText,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      entry.$1,
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
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onBalance,
              icon: const Icon(Icons.balance, size: 18),
              label: const Text('Balance bar queue'),
            ),
          ),
        ],
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppColors.secondaryText,
            fontWeight: FontWeight.w600,
            fontSize: 10,
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w800,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}

class _StatRow extends StatelessWidget {
  const _StatRow(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.secondaryText,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
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

class _EmptyBox extends StatelessWidget {
  const _EmptyBox({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Text(
        message,
        style: const TextStyle(
          color: AppColors.secondaryText,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
