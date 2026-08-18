import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/kds/kds_view_mode.dart';
import '../../state/kitchen_command_controller.dart';

class KdsToolbar extends StatelessWidget {
  const KdsToolbar({
    super.key,
    required this.controller,
    required this.onRefresh,
    this.prioritySoundEnabled = true,
    this.onPrioritySoundChanged,
    this.compact = false,
  });

  final KitchenCommandController controller;
  final VoidCallback onRefresh;
  final bool prioritySoundEnabled;
  final ValueChanged<bool>? onPrioritySoundChanged;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final stats = controller.kds?.stats;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(compact ? 12 : 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(compact ? 16 : 10),
        border: Border.all(color: AppColors.panelBorder),
        boxShadow: compact
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ]
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!compact)
            Wrap(
              spacing: 12,
              runSpacing: 10,
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'System 3 · Live KDS',
                      style: TextStyle(
                        color: AppColors.primaryText,
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Real-time KOT display · Auto refresh · Live timers',
                      style: TextStyle(
                        color: AppColors.secondaryText,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (onPrioritySoundChanged != null)
                      FilterChip(
                        selected: prioritySoundEnabled,
                        onSelected: onPrioritySoundChanged,
                        avatar: Icon(
                          prioritySoundEnabled
                              ? Icons.notifications_active_outlined
                              : Icons.notifications_off_outlined,
                          size: 18,
                          color: prioritySoundEnabled
                              ? AppColors.warning
                              : AppColors.secondaryText,
                        ),
                        label: Text(
                          prioritySoundEnabled
                              ? 'Priority alerts on'
                              : 'Priority alerts off',
                        ),
                        selectedColor: AppColors.warning.withAlpha(28),
                        checkmarkColor: AppColors.warning,
                      ),
                    OutlinedButton.icon(
                      onPressed: controller.kdsLoading ? null : onRefresh,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.primary,
                        side: BorderSide(
                          color: AppColors.primary.withValues(alpha: 0.35),
                        ),
                      ),
                      icon: const Icon(Icons.refresh, size: 18),
                      label: const Text('Sync'),
                    ),
                  ],
                ),
              ],
            )
          else
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Live KDS',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          color: AppColors.primaryText,
                          fontSize: 15,
                        ),
                      ),
                      if (stats != null)
                        Text(
                          '${stats.total} KOTs · auto-sync',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.secondaryText,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                    ],
                  ),
                ),
                if (onPrioritySoundChanged != null)
                  IconButton(
                    tooltip: prioritySoundEnabled
                        ? 'Priority alerts on'
                        : 'Priority alerts off',
                    onPressed: () =>
                        onPrioritySoundChanged?.call(!prioritySoundEnabled),
                    icon: Icon(
                      prioritySoundEnabled
                          ? Icons.notifications_active_outlined
                          : Icons.notifications_off_outlined,
                      color: prioritySoundEnabled
                          ? AppColors.warning
                          : AppColors.secondaryText,
                    ),
                  ),
                IconButton(
                  tooltip: 'Sync KDS',
                  onPressed: controller.kdsLoading ? null : onRefresh,
                  icon: const Icon(Icons.refresh_rounded),
                ),
              ],
            ),
          if (stats != null) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                _StatChip('${stats.total} active', AppColors.primary),
                _StatChip('${stats.delayed} delayed', AppColors.danger),
                _StatChip('${stats.vip} VIP', AppColors.premium),
                _StatChip('${stats.priority} priority', AppColors.warning),
                if (controller.kds != null)
                  _SyncChip(
                    syncedAt: controller.kds!.lastSyncedAt,
                    syncing: controller.kdsLoading,
                  ),
              ],
            ),
          ],
          const SizedBox(height: 14),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: KdsViewMode.values.map((mode) {
                final selected = controller.kdsViewMode == mode;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          mode.icon,
                          size: 16,
                          color: selected ? Colors.white : AppColors.primary,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          mode.label,
                          style: TextStyle(
                            color: selected ? Colors.white : AppColors.primaryText,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    selected: selected,
                    onSelected: (_) => controller.selectKdsViewMode(mode),
                    selectedColor: AppColors.primary,
                    backgroundColor: AppColors.chipBackground,
                    side: BorderSide(
                      color: selected
                          ? AppColors.primary
                          : AppColors.panelBorder,
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          if (!{
            KdsViewMode.vip,
            KdsViewMode.priority,
          }.contains(controller.kdsViewMode)) ...[
            const SizedBox(height: 10),
            _FilterChips(
              selected: controller.kdsFilter,
              onSelected: controller.selectKdsFilter,
              compact: compact,
            ),
          ],
        ],
      ),
    );
  }
}

class _FilterChips extends StatelessWidget {
  const _FilterChips({
    required this.selected,
    required this.onSelected,
    required this.compact,
  });

  final KdsFilter selected;
  final ValueChanged<KdsFilter> onSelected;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final chips = KdsFilter.values.map((filter) {
      final isSelected = selected == filter;
      return Padding(
        padding: const EdgeInsets.only(right: 8),
        child: ChoiceChip(
          label: Text(
            compact ? _shortFilterLabel(filter) : filter.label,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: compact ? 12 : 13,
              color: isSelected ? Colors.white : AppColors.primaryText,
            ),
          ),
          selected: isSelected,
          onSelected: (_) => onSelected(filter),
          selectedColor: AppColors.primary,
          backgroundColor: AppColors.chipBackground,
          side: BorderSide(
            color: isSelected ? AppColors.primary : AppColors.panelBorder,
          ),
          visualDensity: VisualDensity.compact,
        ),
      );
    }).toList();

    if (compact) {
      return SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(children: chips),
      );
    }

    return Wrap(spacing: 8, runSpacing: 8, children: chips);
  }

  static String _shortFilterLabel(KdsFilter filter) {
    return switch (filter) {
      KdsFilter.all => 'All',
      KdsFilter.vip => 'VIP',
      KdsFilter.priority => 'Priority',
    };
  }
}

class _SyncChip extends StatelessWidget {
  const _SyncChip({required this.syncedAt, required this.syncing});

  final DateTime syncedAt;
  final bool syncing;

  @override
  Widget build(BuildContext context) {
    final ago = DateTime.now().difference(syncedAt);
    final label = ago.inSeconds < 5
        ? 'Synced just now'
        : 'Synced ${ago.inSeconds}s ago';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.chipBackground,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.sync,
            size: 14,
            color: syncing ? AppColors.secondaryText : AppColors.primary,
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip(this.label, this.color);

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withAlpha(24),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 12),
      ),
    );
  }
}
