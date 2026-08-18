import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/bakery/bakery_dessert_snapshot.dart';

class DessertJobCard extends StatelessWidget {
  const DessertJobCard({
    super.key,
    required this.job,
    required this.onAction,
  });

  final DessertJob job;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final typeColor = switch (job.jobType) {
      'cake' => AppColors.premium,
      'event' => AppColors.warning,
      'bakery' => AppColors.info,
      _ => AppColors.primary,
    };

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: typeColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  job.kotNumber,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _Tag(label: job.jobType, color: typeColor),
              const SizedBox(width: 8),
              _Tag(label: job.status, color: AppColors.secondaryText),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${job.itemName} · ${job.location}',
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
              _Meta('Batch', '${job.batchSize}'),
              _Meta('Timer', job.timerLabel),
              _Meta('Customization', job.customization),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: job.availableActions
                .map(
                  (action) => action == 'complete_item'
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
      'start_prep' => 'Start prep',
      'track_production' => 'Track production',
      'apply_cake_customization' => 'Customize cake',
      'plan_event_batch' => 'Plan event',
      'complete_item' => 'Complete',
      'hold_item' => 'Hold',
      _ => action,
    };
  }
}

class ProductionBatchList extends StatelessWidget {
  const ProductionBatchList({super.key, required this.batches});

  final List<ProductionBatch> batches;

  @override
  Widget build(BuildContext context) {
    if (batches.isEmpty) {
      return const _EmptyBox(message: 'No active production batches');
    }

    return Column(
      children: batches
          .map(
            (batch) => Container(
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
                          batch.itemName,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${batch.quantity} units · ${batch.expiryMinutes}m expiry',
                          style: const TextStyle(
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _Tag(label: batch.status, color: AppColors.info),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class EventPlanList extends StatelessWidget {
  const EventPlanList({super.key, required this.plans});

  final List<EventDessertPlan> plans;

  @override
  Widget build(BuildContext context) {
    if (plans.isEmpty) {
      return const _EmptyBox(message: 'No event dessert plans');
    }

    return Column(
      children: plans
          .map(
            (plan) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppColors.warning.withValues(alpha: 0.2),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          plan.eventName,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      _Tag(label: plan.status, color: AppColors.warning),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${plan.totalServings} servings · ${plan.location}',
                    style: const TextStyle(
                      color: AppColors.bodyText,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    plan.items.join(' · '),
                    style: const TextStyle(
                      color: AppColors.secondaryText,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
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

class BakerySidePanel extends StatelessWidget {
  const BakerySidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onStartProduction,
    required this.processing,
  });

  final BakeryDessertStats stats;
  final BakeryFeatureFlags flags;
  final VoidCallback onStartProduction;
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
            'Bakery metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Queued jobs', '${stats.queuedJobs}'),
          _StatRow('In production', '${stats.inProduction}'),
          _StatRow('Custom cakes', '${stats.customCakes}'),
          _StatRow('Event plans', '${stats.eventPlans}'),
          _StatRow('Active batches', '${stats.activeBatches}'),
          _StatRow('Completed today', '${stats.completedToday}'),
          const SizedBox(height: 16),
          const Text(
            'Active bakery modules',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 8),
          ...[
            ('Dessert preparation queue', flags.dessertPreparationQueue),
            ('Bakery production tracking', flags.bakeryProductionTracking),
            ('Cake customization', flags.cakeCustomization),
            ('Event dessert planning', flags.eventDessertPlanning),
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
              onPressed: processing ? null : onStartProduction,
              icon: const Icon(Icons.bakery_dining_outlined, size: 18),
              label: const Text('Start production batch'),
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
