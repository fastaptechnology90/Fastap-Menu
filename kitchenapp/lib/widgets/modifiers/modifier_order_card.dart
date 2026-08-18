import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/modifiers/modifier_snapshot.dart';

class ModifierOrderCard extends StatelessWidget {
  const ModifierOrderCard({
    super.key,
    required this.order,
    required this.onAction,
  });

  final ModifierOrder order;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final hasFlash = order.modifiers.any((entry) => entry.flashAlert);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: hasFlash
              ? AppColors.danger
              : order.allergy
              ? AppColors.warning
              : AppColors.panelBorder,
          width: hasFlash || order.allergy ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                order.allergy
                    ? Icons.warning_amber_rounded
                    : Icons.tune_outlined,
                color: order.allergy ? AppColors.danger : AppColors.primary,
                size: 18,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  order.kotNumber,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
              ),
              if (order.vip)
                const _Tag(label: 'VIP', color: AppColors.premium),
              if (order.allergy)
                const _Tag(label: 'Allergy', color: AppColors.danger),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${order.location} · ${order.section} · ${order.status}',
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            order.items.join(', '),
            style: const TextStyle(
              color: AppColors.bodyText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Modifiers',
            style: const TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          ...order.modifiers.map(
            (entry) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _ModifierEntryRow(
                entry: entry,
                onAcknowledge: entry.acknowledged
                    ? null
                    : () => onAction('acknowledge:${entry.id}'),
                onConfirmChef: entry.requiresChefConfirm && !entry.chefConfirmed
                    ? () => onAction('confirm_chef:${entry.id}')
                    : null,
              ),
            ),
          ),
          if (order.customizations.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              'Customizations',
              style: const TextStyle(
                color: AppColors.primaryText,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            ...order.customizations.map(
              (item) => Text(
                '${item.item} · ${item.label}',
                style: const TextStyle(
                  color: AppColors.info,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: order.availableActions
                .where(
                  (action) =>
                      !action.startsWith('acknowledge:') &&
                      !action.startsWith('confirm_chef:'),
                )
                .map(
                  (action) => OutlinedButton(
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
      'acknowledge_all' => 'Acknowledge all',
      'apply_modifier' => 'Apply modifier',
      'replace_side' => 'Replace side',
      _ => action,
    };
  }
}

class _ModifierEntryRow extends StatelessWidget {
  const _ModifierEntryRow({
    required this.entry,
    this.onAcknowledge,
    this.onConfirmChef,
  });

  final ModifierEntry entry;
  final VoidCallback? onAcknowledge;
  final VoidCallback? onConfirmChef;

  @override
  Widget build(BuildContext context) {
    final color = switch (entry.priority) {
      'critical' => AppColors.danger,
      'high' => AppColors.warning,
      _ => AppColors.info,
    };

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: entry.flashAlert
            ? AppColors.danger.withValues(alpha: 0.08)
            : AppColors.chipBackground,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  entry.label,
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: entry.flashAlert
                        ? AppColors.danger
                        : AppColors.primaryText,
                  ),
                ),
              ),
              _Tag(label: entry.category, color: color),
            ],
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              _StatusChip(
                label: entry.acknowledged ? 'Acknowledged' : 'Pending ack',
                color: entry.acknowledged ? AppColors.primary : AppColors.warning,
              ),
              if (entry.requiresChefConfirm)
                _StatusChip(
                  label: entry.chefConfirmed ? 'Chef confirmed' : 'Chef confirm',
                  color:
                      entry.chefConfirmed ? AppColors.primary : AppColors.danger,
                ),
            ],
          ),
          if (onAcknowledge != null || onConfirmChef != null) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                if (onAcknowledge != null)
                  TextButton(
                    onPressed: onAcknowledge,
                    child: const Text('Acknowledge'),
                  ),
                if (onConfirmChef != null)
                  TextButton(
                    onPressed: onConfirmChef,
                    child: const Text('Chef confirm'),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class ModifierSmartPanel extends StatelessWidget {
  const ModifierSmartPanel({
    super.key,
    required this.stats,
    required this.smartAlerts,
    required this.catalog,
  });

  final ModifierStats stats;
  final SmartModifierAlerts smartAlerts;
  final List<ModifierCatalogItem> catalog;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Panel(
          title: 'Smart modifier alerts',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _FlagChip('Allergy flash', smartAlerts.allergyFlashingAlerts),
              _FlagChip('Priority mods', smartAlerts.priorityModifiers),
              _FlagChip('Chef confirm', smartAlerts.chefConfirmationRequired),
              _FlagChip('Ack tracking', smartAlerts.acknowledgmentTracking),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Modifier stats',
          child: Wrap(
            spacing: 16,
            runSpacing: 10,
            children: [
              _Stat(label: 'Orders', value: '${stats.ordersWithModifiers}'),
              _Stat(label: 'Modifiers', value: '${stats.totalModifiers}'),
              _Stat(label: 'Pending ack', value: '${stats.pendingAcknowledgment}'),
              _Stat(label: 'Chef confirm', value: '${stats.pendingChefConfirm}'),
              _Stat(label: 'Allergy KOTs', value: '${stats.allergyOrders}'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Panel(
          title: 'Modifier catalog',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: catalog
                .map(
                  (item) => Chip(
                    avatar: Icon(
                      _iconForType(item.type),
                      size: 16,
                      color: AppColors.primary,
                    ),
                    label: Text(item.label),
                    backgroundColor: AppColors.primary.withValues(alpha: 0.08),
                  ),
                )
                .toList(),
          ),
        ),
      ],
    );
  }

  static IconData _iconForType(String type) {
    return switch (type) {
      'allergy' => Icons.warning_amber_rounded,
      'dietary' => Icons.eco_outlined,
      'customization' => Icons.swap_horiz,
      _ => Icons.local_fire_department_outlined,
    };
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

class _Tag extends StatelessWidget {
  const _Tag({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(left: 6),
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

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w700,
          fontSize: 11,
        ),
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
