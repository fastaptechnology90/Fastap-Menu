import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/processing/processing_snapshot.dart';

class ProcessingOrderCard extends StatelessWidget {
  const ProcessingOrderCard({
    super.key,
    required this.order,
    required this.onAction,
  });

  final ProcessingOrder order;
  final void Function(String action) onAction;

  @override
  Widget build(BuildContext context) {
    final base = order.base;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: order.held ? AppColors.warning : AppColors.panelBorder,
          width: order.held ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(base.priorityIcon, color: base.color, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  base.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              if (order.held)
                const _Tag(label: 'On hold', color: AppColors.warning),
              if (base.vip) const _Tag(label: 'VIP', color: AppColors.premium),
              if (base.allergy)
                const _Tag(label: 'Allergy', color: AppColors.danger),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${base.location} · ${base.section} · ${base.status}',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: order.lineItems
                .map(
                  (item) => Chip(
                    label: Text(item.name),
                    backgroundColor: item.status == 'cancelled'
                        ? AppColors.chipBackground
                        : AppColors.chipBackground,
                    side: BorderSide(
                      color: item.status == 'cancelled'
                          ? AppColors.danger
                          : AppColors.panelBorder,
                    ),
                  ),
                )
                .toList(),
          ),
          if (order.lineItems.any((item) => item.modification != null)) ...[
            const SizedBox(height: 8),
            Text(
              order.lineItems
                  .where((item) => item.modification != null)
                  .map((item) => '${item.name}: ${item.modification}')
                  .join(' · '),
              style: const TextStyle(
                color: AppColors.info,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ],
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: base.progress,
              minHeight: 6,
              backgroundColor: AppColors.chipBackground,
              color: base.color,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: order.availableActions
                .map(
                  (action) => OutlinedButton(
                    onPressed: () => onAction(action),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      minimumSize: const Size(0, 32),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      visualDensity: VisualDensity.compact,
                    ),
                    child: Text(
                      _actionLabel(action),
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
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
      'accept' => 'Accept',
      'reject' => 'Reject',
      'hold' => 'Hold',
      'release' => 'Release',
      'prepare' => 'Start prep',
      'ready' => 'Mark ready',
      'delay' => 'Mark delayed',
      'refire' => 'Re-fire',
      'reassign' => 'Reassign',
      'cancel_item' => 'Cancel item',
      'modify_item' => 'Modify item',
      _ => action,
    };
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

class ProcessingSmartPanel extends StatelessWidget {
  const ProcessingSmartPanel({
    super.key,
    required this.flags,
    required this.stats,
    required this.batchCooking,
    required this.cookingSequence,
    required this.onOptimize,
    required this.optimizing,
  });

  final SmartProcessingFlags flags;
  final ProcessingStats stats;
  final List<BatchCookingGroup> batchCooking;
  final List<CookingSequenceStep> cookingSequence;
  final VoidCallback onOptimize;
  final bool optimizing;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Panel(
          title: 'Smart processing',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _FlagChip('Auto queue', flags.autoQueueSorting),
              _FlagChip('AI priority', flags.aiPriorityHandling),
              _FlagChip('VIP lane', flags.vipPrioritization),
              _FlagChip('Rush optimize', flags.rushHourOptimization),
              _FlagChip('Batch cooking', flags.batchCookingManagement),
              _FlagChip('Cook sequence', flags.smartCookingSequence),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Queue stats',
          child: Wrap(
            spacing: 16,
            runSpacing: 10,
            children: [
              _Stat(label: 'Active', value: '${stats.total}'),
              _Stat(label: 'Held', value: '${stats.held}'),
              _Stat(label: 'VIP', value: '${stats.vip}'),
              _Stat(label: 'Rush', value: '${stats.rush}'),
              _Stat(label: 'Batches', value: '${stats.batchGroups}'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Batch cooking',
          child: batchCooking.isEmpty
              ? const Text(
                  'No batch groups detected for current queue.',
                  style: TextStyle(color: AppColors.secondaryText),
                )
              : Column(
                  children: batchCooking
                      .map(
                        (group) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(
                            group.label,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          subtitle: Text(group.orders.join(', ')),
                          trailing: Text('${group.orderCount} KOTs'),
                        ),
                      )
                      .toList(),
                ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Cooking sequence',
          child: cookingSequence.isEmpty
              ? const Text(
                  'Sequence will appear when prep queue is active.',
                  style: TextStyle(color: AppColors.secondaryText),
                )
              : Column(
                  children: cookingSequence
                      .map(
                        (step) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: CircleAvatar(
                            radius: 14,
                            backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                            child: Text(
                              '${step.etaMinutes}m',
                              style: const TextStyle(
                                color: AppColors.primary,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          title: Text(
                            step.kotNumber,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          subtitle: Text(step.step),
                        ),
                      )
                      .toList(),
                ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: optimizing ? null : onOptimize,
            icon: optimizing
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.auto_fix_high_outlined),
            label: const Text('AI optimize queue'),
          ),
        ),
      ],
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.title, required this.child});

  final String title;
  final Widget child;

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
          Text(
            title,
            style: const TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
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

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});

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
            fontSize: 20,
          ),
        ),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.secondaryText,
            fontWeight: FontWeight.w600,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}
