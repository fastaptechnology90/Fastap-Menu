import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/kds/kds_order.dart';
import '../../models/kds/kds_view_mode.dart';
import '../../state/kitchen_command_controller.dart';
import '../common/mini_chip.dart';
import '../common/status_pill.dart';

class KdsOrderTile extends StatefulWidget {
  const KdsOrderTile({
    super.key,
    required this.order,
    required this.controller,
    required this.enableReorder,
    required this.index,
    this.dense = false,
  });

  final KdsOrder order;
  final KitchenCommandController controller;
  final bool enableReorder;
  final int index;
  final bool dense;

  @override
  State<KdsOrderTile> createState() => _KdsOrderTileState();
}

class _KdsOrderTileState extends State<KdsOrderTile>
    with SingleTickerProviderStateMixin {
  late final AnimationController _blinkController;
  bool _expanded = false;

  @override
  void initState() {
    super.initState();
    _blinkController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    if (widget.order.isDelayed) {
      _blinkController.repeat(reverse: true);
    }
  }

  @override
  void didUpdateWidget(KdsOrderTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.order.isDelayed && !_blinkController.isAnimating) {
      _blinkController.repeat(reverse: true);
    } else if (!widget.order.isDelayed && _blinkController.isAnimating) {
      _blinkController.stop();
    }
  }

  @override
  void dispose() {
    _blinkController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final borderColor = order.isDelayed
        ? Color.lerp(
              AppColors.danger,
              AppColors.panelBorder,
              _blinkController.value,
            ) ??
            AppColors.danger
        : AppColors.panelBorder;

    return AnimatedBuilder(
      animation: _blinkController,
      builder: (context, child) {
        return DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border(
              left: BorderSide(color: order.statusColor, width: 4),
              top: BorderSide(
                color: order.isDelayed ? borderColor : AppColors.panelBorder,
                width: order.isDelayed ? 1.5 : 1,
              ),
              right: BorderSide(
                color: order.isDelayed ? borderColor : AppColors.panelBorder,
                width: order.isDelayed ? 1.5 : 1,
              ),
              bottom: BorderSide(
                color: order.isDelayed ? borderColor : AppColors.panelBorder,
                width: order.isDelayed ? 1.5 : 1,
              ),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: child,
        );
      },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: ColoredBox(
          color: Colors.white,
          child: Padding(
            padding: EdgeInsets.all(widget.dense ? 12 : 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Header(
                  order: order,
                  enableReorder: widget.enableReorder,
                  index: widget.index,
                  compact: widget.dense,
                ),
                const SizedBox(height: 10),
                Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            MiniChip(order.section),
                            MiniChip(order.deliveryType),
                            MiniChip(order.guestType),
                            if (order.tableNumber != null)
                              MiniChip('T${order.tableNumber}'),
                            if (order.roomNumber != null)
                              MiniChip('R${order.roomNumber}'),
                            if (order.vip) const MiniChip('VIP'),
                            if (order.allergy) const MiniChip('Allergy'),
                            if (order.reFireRequested) const MiniChip('Re-fire'),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${order.orderId} · ${order.assignedChef}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.secondaryText,
                            fontWeight: FontWeight.w700,
                            fontSize: 11,
                          ),
                        ),
                        const SizedBox(height: 10),
                        _LineBlock(
                          title: 'Items',
                          lines: order.items,
                          maxLines: widget.dense && !_expanded ? 2 : 4,
                        ),
                        if (!widget.dense || _expanded) ...[
                          if (order.addOns.isNotEmpty)
                            _LineBlock(
                              title: 'Add-ons',
                              lines: order.addOns,
                              maxLines: 2,
                            ),
                          if (order.modifiers.isNotEmpty)
                            _LineBlock(
                              title: 'Modifiers',
                              lines: order.modifiers,
                              highlight: true,
                              maxLines: 2,
                            ),
                          if (order.cookingNotes.isNotEmpty)
                            _LineBlock(
                              title: 'Notes',
                              lines: order.cookingNotes,
                              maxLines: 2,
                            ),
                        ] else if (order.addOns.isNotEmpty ||
                            order.modifiers.isNotEmpty ||
                            order.cookingNotes.isNotEmpty)
                          TextButton(
                            onPressed: () => setState(() => _expanded = true),
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              foregroundColor: AppColors.primary,
                            ),
                            child: const Text(
                              'Show add-ons & notes',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        const SizedBox(height: 10),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: LinearProgressIndicator(
                            value: order.progress,
                            color: order.statusColor,
                            backgroundColor: order.statusColor.withAlpha(33),
                            minHeight: 6,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Icon(
                              Icons.timer_outlined,
                              size: 16,
                              color: order.statusColor,
                            ),
                            const SizedBox(width: 4),
                            _LiveTimer(
                              initialSeconds: order.timerSeconds,
                              active: order.status.apiValue != 'ready' &&
                                  order.status.apiValue != 'served',
                              style: TextStyle(
                                color: order.statusColor,
                                fontWeight: FontWeight.w900,
                                fontSize: 15,
                              ),
                            ),
                            const Spacer(),
                            Flexible(
                              child: Text(
                                order.category,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.end,
                                style: const TextStyle(
                                  color: AppColors.secondaryText,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 11,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: _actionsFor(order),
                        ),
                      ],
                    ),
          ),
        ),
      ),
    );
  }

  List<Widget> _actionsFor(KdsOrder order) {
    Future<void> act(String action) async {
      try {
        await widget.controller.performKdsAction(order.id, action);
        if (!mounted) return;
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(
            content: Text('Order ${_kdsActionPast(action)}'),
            duration: const Duration(milliseconds: 1600),
            behavior: SnackBarBehavior.floating,
          ));
      } catch (_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(
            content: const Text('Could not update the order. Check connection and try again.'),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ));
      }
    }

    return switch (order.status) {
      KdsStatus.newOrder => [
          _ActionButton('Accept', Icons.check, () => act('accept')),
          _ActionButton('Reject', Icons.close, () => act('reject'), danger: true),
          _ActionButton('Cancel', Icons.block, () => act('cancel'), danger: true),
        ],
      KdsStatus.accepted => [
          _ActionButton('Start', Icons.play_arrow, () => act('prepare')),
          _ActionButton('Delay', Icons.schedule, () => act('delay')),
          _ActionButton('Cancel', Icons.block, () => act('cancel'), danger: true),
        ],
      KdsStatus.preparing ||
      KdsStatus.delayed ||
      KdsStatus.reFireRequested => [
          _ActionButton('Ready', Icons.task_alt, () => act('ready')),
          _ActionButton('Delay', Icons.schedule, () => act('delay')),
          _ActionButton('Re-fire', Icons.replay, () => act('refire')),
          _ActionButton('Cancel', Icons.block, () => act('cancel'), danger: true),
        ],
      KdsStatus.ready => [
          _ActionButton(
            'Bump',
            Icons.keyboard_double_arrow_up,
            () => act('ready'),
          ),
        ],
      _ => [],
    };
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.order,
    required this.enableReorder,
    required this.index,
    required this.compact,
  });

  final KdsOrder order;
  final bool enableReorder;
  final int index;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final narrow =
        compact || MediaQuery.sizeOf(context).width < 360;

    final title = Row(
      children: [
        Icon(order.locationIcon, color: AppColors.primary, size: 20),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            order.kotNumber,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 15,
            ),
          ),
        ),
        if (enableReorder && !narrow) ...[
          ReorderableDragStartListener(
            index: index,
            child: const Icon(
              Icons.drag_handle,
              color: AppColors.secondaryText,
              size: 20,
            ),
          ),
          const SizedBox(width: 6),
        ],
        if (!narrow)
          StatusPill(
            icon: order.isDelayed
                ? Icons.warning_amber_rounded
                : Icons.circle,
            label: order.statusLabel,
            color: order.statusColor,
          ),
      ],
    );

    if (!narrow) {
      return title;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        title,
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: StatusPill(
                icon: order.isDelayed
                    ? Icons.warning_amber_rounded
                    : Icons.circle,
                label: order.statusLabel,
                color: order.statusColor,
              ),
            ),
            if (enableReorder)
              ReorderableDragStartListener(
                index: index,
                child: const Padding(
                  padding: EdgeInsets.only(left: 8),
                  child: Icon(
                    Icons.drag_handle,
                    color: AppColors.secondaryText,
                    size: 20,
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _LineBlock extends StatelessWidget {
  const _LineBlock({
    required this.title,
    required this.lines,
    this.highlight = false,
    this.maxLines = 3,
  });

  final String title;
  final List<String> lines;
  final bool highlight;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: highlight ? AppColors.danger : AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 11,
            ),
          ),
          const SizedBox(height: 2),
          ...lines.map(
            (line) => Text(
              line,
              maxLines: maxLines,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: highlight ? AppColors.danger : AppColors.bodyText,
                fontWeight: FontWeight.w600,
                fontSize: 12,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// Past-tense label for the toast shown after a KDS action succeeds.
String _kdsActionPast(String action) => switch (action) {
      'accept' => 'accepted',
      'reject' => 'rejected',
      'cancel' => 'cancelled',
      'prepare' => 'started',
      'ready' => 'marked ready',
      'delay' => 'delayed',
      'refire' => 're-fired',
      'hold' => 'held',
      'release' => 'released',
      _ => 'updated',
    };

class _ActionButton extends StatelessWidget {
  const _ActionButton(
    this.label,
    this.icon,
    this.onPressed, {
    this.danger = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final color = danger ? AppColors.danger : AppColors.primary;
    return FilledButton.tonalIcon(
      onPressed: onPressed,
      icon: Icon(icon, size: 14, color: color),
      label: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w800,
          fontSize: 12,
        ),
      ),
      style: FilledButton.styleFrom(
        foregroundColor: color,
        backgroundColor: color.withValues(alpha: 0.1),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        minimumSize: const Size(0, 32),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        visualDensity: VisualDensity.compact,
      ),
    );
  }
}

// A ticking MM:SS timer that rebuilds ONLY itself once a second — instead of the whole KDS
// board rebuilding every second (which made the app janky). It starts from the value the API
// gave and re-syncs whenever a refresh brings a new base.
class _LiveTimer extends StatefulWidget {
  const _LiveTimer({required this.initialSeconds, required this.active, this.style});

  final int initialSeconds;
  final bool active;
  final TextStyle? style;

  @override
  State<_LiveTimer> createState() => _LiveTimerState();
}

class _LiveTimerState extends State<_LiveTimer> {
  late int _seconds;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _seconds = widget.initialSeconds;
    if (widget.active) _start();
  }

  void _start() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _seconds += 1);
    });
  }

  @override
  void didUpdateWidget(_LiveTimer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialSeconds != widget.initialSeconds) {
      _seconds = widget.initialSeconds;
    }
    if (oldWidget.active != widget.active) {
      if (widget.active) {
        _start();
      } else {
        _timer?.cancel();
      }
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String get _label {
    final safe = _seconds < 0 ? 0 : _seconds;
    final m = safe ~/ 60;
    final s = safe % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) => Text(_label, style: widget.style);
}
