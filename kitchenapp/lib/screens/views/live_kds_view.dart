import 'package:flutter/material.dart';
// See the note in kitchen_tab.dart — ScrollCacheExtent is not exported by
// material.dart, and `dart fix` migrated the call without adding this import.
import 'package:flutter/rendering.dart';

import '../../core/constants/app_colors.dart';
import '../../models/kds/kds_order.dart';
import '../../models/kds/kds_snapshot.dart';
import '../../models/kds/kds_view_mode.dart';
import '../../services/kds_priority_sound_service.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/kds/kds_order_tile.dart';
import '../../widgets/kds/kds_system_capabilities.dart';
import '../../widgets/kds/kds_toolbar.dart';

class LiveKdsView extends StatefulWidget {
  const LiveKdsView({
    super.key,
    required this.controller,
    this.compact = false,
    this.primaryScroll = false,
  });

  final KitchenCommandController controller;
  final bool compact;

  /// Single scroll surface for tab embedding (no nested shrinkWrap grids).
  final bool primaryScroll;

  @override
  State<LiveKdsView> createState() => _LiveKdsViewState();
}

class _LiveKdsViewState extends State<LiveKdsView> {
  final KdsPrioritySoundService _soundService = KdsPrioritySoundService();
  bool _prioritySoundEnabled = true;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onControllerChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onControllerChanged);
    super.dispose();
  }

  void _onControllerChanged() {
    if (_prioritySoundEnabled) {
      _soundService.evaluate(widget.controller.kds);
    }
  }

  void _togglePrioritySound(bool enabled) {
    setState(() {
      _prioritySoundEnabled = enabled;
      if (!enabled) {
        _soundService.reset();
      } else {
        _soundService.evaluate(widget.controller.kds);
      }
    });
  }

  Future<void> _refresh() => widget.controller.refreshKds();

  @override
  Widget build(BuildContext context) {
    if (widget.controller.kdsLoading && widget.controller.kds == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = widget.controller.kds;
    if (snapshot == null) {
      return _EmptyState(
        message: widget.controller.kdsErrorMessage ?? 'KDS unavailable',
        onRetry: _refresh,
      );
    }

    if (widget.primaryScroll) {
      return _PrimaryScrollBody(
        controller: widget.controller,
        snapshot: snapshot,
        compact: widget.compact,
        prioritySoundEnabled: _prioritySoundEnabled,
        onPrioritySoundChanged: _togglePrioritySound,
        onRefresh: _refresh,
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        KdsToolbar(
          controller: widget.controller,
          onRefresh: _refresh,
          prioritySoundEnabled: _prioritySoundEnabled,
          onPrioritySoundChanged: _togglePrioritySound,
          compact: widget.compact,
        ),
        if (widget.controller.kdsErrorMessage != null) ...[
          const SizedBox(height: 12),
          _ErrorBanner(
            message: widget.controller.kdsErrorMessage!,
            onRetry: _refresh,
          ),
        ],
        const SizedBox(height: 16),
        _KdsBody(
          controller: widget.controller,
          snapshot: snapshot,
          nested: true,
        ),
      ],
    );
  }
}

class _PrimaryScrollBody extends StatelessWidget {
  const _PrimaryScrollBody({
    required this.controller,
    required this.snapshot,
    required this.compact,
    required this.prioritySoundEnabled,
    required this.onPrioritySoundChanged,
    required this.onRefresh,
  });

  final KitchenCommandController controller;
  final KdsSnapshot snapshot;
  final bool compact;
  final bool prioritySoundEnabled;
  final ValueChanged<bool> onPrioritySoundChanged;
  final Future<void> Function() onRefresh;

  static const _scrollPhysics = AlwaysScrollableScrollPhysics(
    parent: ClampingScrollPhysics(),
  );

  @override
  Widget build(BuildContext context) {
    final enableReorder = !snapshot.isGrouped &&
        controller.kdsViewMode == KdsViewMode.queue &&
        controller.kdsFilter == KdsFilter.all;

    if (enableReorder) {
      return RefreshIndicator(
        onRefresh: onRefresh,
        color: AppColors.primary,
        child: ReorderableListView.builder(
          padding: const EdgeInsets.fromLTRB(0, 0, 0, 24),
          physics: _scrollPhysics,
          buildDefaultDragHandles: false,
          itemCount: snapshot.orders.length + 1,
          onReorder: (oldIndex, newIndex) {
            if (oldIndex == 0 || newIndex == 0) return;
            var from = oldIndex - 1;
            var to = newIndex - 1;
            if (to > from) to--;
            final ids = snapshot.orders.map((order) => order.id).toList();
            final moved = ids.removeAt(from);
            ids.insert(to, moved);
            controller.reorderKds(ids);
          },
          itemBuilder: (context, index) {
            if (index == 0) {
              return KeyedSubtree(
                key: const ValueKey('kds-header'),
                child: _ScrollHeader(
                  controller: controller,
                  compact: compact,
                  prioritySoundEnabled: prioritySoundEnabled,
                  onPrioritySoundChanged: onPrioritySoundChanged,
                  onRefresh: onRefresh,
                ),
              );
            }
            final order = snapshot.orders[index - 1];
            return Padding(
              key: ValueKey(order.id),
              padding: const EdgeInsets.only(bottom: 12),
              child: KdsOrderTile(
                order: order,
                controller: controller,
                enableReorder: true,
                index: index - 1,
              ),
            );
          },
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      color: AppColors.primary,
      child: CustomScrollView(
        scrollCacheExtent: ScrollCacheExtent.pixels(400), physics: _scrollPhysics,
        slivers: [
          SliverToBoxAdapter(
            child: _ScrollHeader(
              controller: controller,
              compact: compact,
              prioritySoundEnabled: prioritySoundEnabled,
              onPrioritySoundChanged: onPrioritySoundChanged,
              onRefresh: onRefresh,
            ),
          ),
          if (snapshot.orders.isEmpty)
            const SliverToBoxAdapter(child: _EmptyOrdersCard())
          else if (snapshot.isGrouped)
            ..._groupedSlivers(context, snapshot, controller)
          else
            _orderGridSliver(context, snapshot.orders, controller, false),
          const SliverPadding(padding: EdgeInsets.only(bottom: 24)),
        ],
      ),
    );
  }

  List<Widget> _groupedSlivers(
    BuildContext context,
    KdsSnapshot snapshot,
    KitchenCommandController controller,
  ) {
    return [
      for (final group in snapshot.groups) ...[
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(0, 8, 0, 10),
            child: Text(
              group.label,
              style: const TextStyle(
                color: AppColors.primaryText,
                fontWeight: FontWeight.w900,
                fontSize: 16,
              ),
            ),
          ),
        ),
        _orderGridSliver(context, group.orders, controller, false),
      ],
    ];
  }

  Widget _orderGridSliver(
    BuildContext context,
    List<KdsOrder> orders,
    KitchenCommandController controller,
    bool enableReorder,
  ) {
    return SliverLayoutBuilder(
      builder: (context, constraints) {
        return SliverToBoxAdapter(
          child: _KdsOrderWrap(
            orders: orders,
            controller: controller,
            enableReorder: enableReorder,
            maxWidth: constraints.crossAxisExtent,
          ),
        );
      },
    );
  }
}

class _ScrollHeader extends StatelessWidget {
  const _ScrollHeader({
    required this.controller,
    required this.compact,
    required this.prioritySoundEnabled,
    required this.onPrioritySoundChanged,
    required this.onRefresh,
  });

  final KitchenCommandController controller;
  final bool compact;
  final bool prioritySoundEnabled;
  final ValueChanged<bool> onPrioritySoundChanged;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        KdsToolbar(
          controller: controller,
          onRefresh: () => onRefresh(),
          prioritySoundEnabled: prioritySoundEnabled,
          onPrioritySoundChanged: onPrioritySoundChanged,
          compact: compact,
        ),
        if (controller.kdsErrorMessage != null) ...[
          const SizedBox(height: 12),
          _ErrorBanner(
            message: controller.kdsErrorMessage!,
            onRetry: () => onRefresh(),
          ),
        ],
        const SizedBox(height: 8),
        const KdsSystemCapabilitiesExpandable(),
        const SizedBox(height: 12),
      ],
    );
  }
}

class _EmptyOrdersCard extends StatelessWidget {
  const _EmptyOrdersCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: const Text(
        'No KOTs match this view and filter.',
        style: TextStyle(color: AppColors.secondaryText),
      ),
    );
  }
}

class _KdsBody extends StatelessWidget {
  const _KdsBody({
    required this.controller,
    required this.snapshot,
    this.nested = false,
  });

  final KitchenCommandController controller;
  final KdsSnapshot snapshot;
  final bool nested;

  @override
  Widget build(BuildContext context) {
    if (snapshot.orders.isEmpty) {
      return const _EmptyOrdersCard();
    }

    if (snapshot.isGrouped) {
      return Column(
        children: snapshot.groups.map((group) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  group.label,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 10),
                _OrderGrid(
                  orders: group.orders,
                  controller: controller,
                  enableReorder: false,
                  nested: nested,
                ),
              ],
            ),
          );
        }).toList(),
      );
    }

    final enableReorder =
        controller.kdsViewMode == KdsViewMode.queue &&
        controller.kdsFilter == KdsFilter.all;

    if (enableReorder && !nested) {
      return ReorderableListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: snapshot.orders.length,
        onReorder: (oldIndex, newIndex) {
          if (newIndex > oldIndex) newIndex--;
          final ids = snapshot.orders.map((order) => order.id).toList();
          final moved = ids.removeAt(oldIndex);
          ids.insert(newIndex, moved);
          controller.reorderKds(ids);
        },
        itemBuilder: (context, index) {
          final order = snapshot.orders[index];
          return Padding(
            key: ValueKey(order.id),
            padding: const EdgeInsets.only(bottom: 14),
            child: KdsOrderTile(
              order: order,
              controller: controller,
              enableReorder: true,
              index: index,
            ),
          );
        },
      );
    }

    return _OrderGrid(
      orders: snapshot.orders,
      controller: controller,
      enableReorder: false,
      nested: nested,
    );
  }
}

class _OrderGrid extends StatelessWidget {
  const _OrderGrid({
    required this.orders,
    required this.controller,
    required this.enableReorder,
    this.nested = true,
  });

  final List<KdsOrder> orders;
  final KitchenCommandController controller;
  final bool enableReorder;
  final bool nested;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          physics: nested
              ? const NeverScrollableScrollPhysics()
              : const ClampingScrollPhysics(),
          child: _KdsOrderWrap(
            orders: orders,
            controller: controller,
            enableReorder: enableReorder,
            maxWidth: constraints.maxWidth,
          ),
        );
      },
    );
  }
}

class _KdsOrderWrap extends StatelessWidget {
  const _KdsOrderWrap({
    required this.orders,
    required this.controller,
    required this.enableReorder,
    required this.maxWidth,
  });

  final List<KdsOrder> orders;
  final KitchenCommandController controller;
  final bool enableReorder;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    final columns = maxWidth > 1100 ? 3 : maxWidth > 680 ? 2 : 1;
    const spacing = 12.0;
    final cardWidth = columns == 1
        ? maxWidth
        : (maxWidth - spacing * (columns - 1)) / columns;
    final dense = columns > 1;

    return Wrap(
      spacing: spacing,
      runSpacing: spacing,
      children: [
        for (var i = 0; i < orders.length; i++)
          SizedBox(
            width: cardWidth,
            child: KdsOrderTile(
              order: orders[i],
              controller: controller,
              enableReorder: enableReorder,
              index: i,
              dense: dense,
            ),
          ),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        children: [
          const Icon(Icons.monitor_outlined, size: 48, color: AppColors.primary),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.bodyText),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: onRetry,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
            ),
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.warning.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded, color: AppColors.warning),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: AppColors.bodyText,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          TextButton(
            onPressed: onRetry,
            style: TextButton.styleFrom(foregroundColor: AppColors.warning),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
