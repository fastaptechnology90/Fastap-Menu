import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/app_lifecycle.dart';
import '../../core/constants/app_colors.dart';
import '../../core/settings/alert_settings.dart';
import '../../core/theme/app_text_styles.dart';
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
          color: AppColors.surface,
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
                const SizedBox(height: 12),
                // The dishes are what a chef reads from two feet away, so they
                // come before the chips and before all the metadata.
                _DishList(items: order.items),
                if (order.allergy) ...[
                  const SizedBox(height: 12),
                  _AllergyBanner(
                    notes: [...order.modifiers, ...order.cookingNotes],
                  ),
                ],
                const SizedBox(height: 12),
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
                    if (order.reFireRequested) const MiniChip('Re-fire'),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  '${order.orderId} · ${order.assignedChef}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.secondaryText,
                    fontWeight: AppFontWeights.label,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 10),
                if (!widget.dense || _expanded) ...[
                  if (order.addOns.isNotEmpty)
                    _LineBlock(
                      title: 'Add-ons',
                      lines: order.addOns,
                    ),
                  if (!order.allergy && order.modifiers.isNotEmpty)
                    _LineBlock(
                      title: 'Modifiers',
                      lines: order.modifiers,
                      highlight: true,
                    ),
                  if (!order.allergy && order.cookingNotes.isNotEmpty)
                    _LineBlock(
                      title: 'Notes',
                      lines: order.cookingNotes,
                    ),
                ] else if (order.addOns.isNotEmpty ||
                    (!order.allergy &&
                        (order.modifiers.isNotEmpty ||
                            order.cookingNotes.isNotEmpty)))
                  TextButton(
                    onPressed: () => setState(() => _expanded = true),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      minimumSize: const Size(0, 48),
                      alignment: Alignment.centerLeft,
                      foregroundColor: AppColors.primary,
                    ),
                    child: const Text(
                      'Show add-ons & notes',
                      style: TextStyle(
                        fontWeight: AppFontWeights.strong,
                        fontSize: 14,
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
                        fontWeight: AppFontWeights.strong,
                        fontSize: 17,
                        // Proportional digits change width every tick,
                        // so a board of tiles twitches continuously.
                        fontFeatures: const [
                          FontFeature.tabularFigures(),
                        ],
                      ),
                    ),
                    const Spacer(),
                    Flexible(
                      child: Text(
                        order.category,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.end,
                        style: TextStyle(
                          color: AppColors.secondaryText,
                          fontWeight: AppFontWeights.label,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _actionsFor(order),
                      ],
                    ),
          ),
        ),
      ),
    );
  }

  Future<void> _act(String action, {String? undoAction}) async {
    if (hapticFeedbackEnabled.value) {
      unawaited(HapticFeedback.mediumImpact());
    }
    try {
      await widget.controller.performKdsAction(widget.order.id, action);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
          content: Text('Order ${_kdsActionPast(action)}'),
          // Long enough that an undo is actually reachable; the old 1.6s
          // toast was gone before a chef could look up.
          duration: const Duration(seconds: 5),
          behavior: SnackBarBehavior.floating,
          action: undoAction == null
              ? null
              : SnackBarAction(
                  label: 'Undo',
                  onPressed: () => _act(undoAction),
                ),
        ));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
          content: const Text(
            'Could not update the order. Check connection and try again.',
          ),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
        ));
    }
  }

  /// Cancelling or rejecting a ticket throws food away, so it asks first.
  Future<void> _confirmThenAct(String label, String action) async {
    final order = widget.order;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('$label ${order.kotNumber}?'),
        content: Text(
          order.items.isEmpty
              ? 'This cannot be undone from the board.'
              : '${order.items.join(', ')}\n\nThis cannot be undone from the '
                  'board.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Keep the order'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
            ),
            child: Text(label),
          ),
        ],
      ),
    );
    if (confirmed ?? false) {
      await _act(action);
    }
  }

  Widget _actionsFor(KdsOrder order) {
    final primary = <Widget>[];
    final destructive = <Widget>[];

    Widget cancel() => _ActionButton(
          'Cancel',
          Icons.block,
          () => _confirmThenAct('Cancel', 'cancel'),
          danger: true,
        );

    switch (order.status) {
      case KdsStatus.newOrder:
        primary.add(_ActionButton('Accept', Icons.check, () => _act('accept')));
        destructive.add(
          _ActionButton(
            'Reject',
            Icons.close,
            () => _confirmThenAct('Reject', 'reject'),
            danger: true,
          ),
        );
        destructive.add(cancel());
      case KdsStatus.accepted:
        primary.add(
          _ActionButton('Start', Icons.play_arrow, () => _act('prepare')),
        );
        primary.add(
          _ActionButton('Delay', Icons.schedule, () => _act('delay')),
        );
        destructive.add(cancel());
      case KdsStatus.preparing:
      case KdsStatus.delayed:
      case KdsStatus.reFireRequested:
        // "Ready" is the button a chef reaches for, so it gets the wide target.
        primary.add(
          _ActionButton(
            'Ready',
            Icons.task_alt,
            () => _act('ready', undoAction: 'prepare'),
            wide: true,
          ),
        );
        primary.add(
          _ActionButton('Delay', Icons.schedule, () => _act('delay')),
        );
        primary.add(
          _ActionButton('Re-fire', Icons.replay, () => _act('refire')),
        );
        destructive.add(cancel());
      case KdsStatus.ready:
        // The old label was "Bump", which posted the same 'ready' action again
        // and told the chef nothing about what it does.
        primary.add(
          _ActionButton(
            'Clear from board',
            Icons.keyboard_double_arrow_up,
            () => _act('ready'),
          ),
        );
      default:
        break;
    }

    if (primary.isEmpty && destructive.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (primary.isNotEmpty)
          Wrap(spacing: 10, runSpacing: 10, children: primary),
        if (destructive.isNotEmpty) ...[
          // Throwing food away sat six pixels from "Ready". It now lives below
          // a rule and a full row's gap, where a wet thumb cannot find it by
          // accident.
          const SizedBox(height: 16),
          Divider(height: 1, color: AppColors.panelBorder),
          const SizedBox(height: 12),
          Wrap(spacing: 10, runSpacing: 10, children: destructive),
        ],
      ],
    );
  }
}

/// The dishes, at the size they are actually read at.
class _DishList extends StatelessWidget {
  const _DishList({required this.items});

  final List<String> items;

  /// Splits a leading quantity ("2 x Butter Chicken") so the count can be set
  /// apart from the dish rather than buried in the same run of text.
  static final _quantity = RegExp(r'^\s*(\d+)\s*[x\u00d7*]?\s+(.*)$');

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final line in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Builder(
              builder: (context) {
                final match = _quantity.firstMatch(line);
                final qty = match?.group(1);
                final dish = match?.group(2) ?? line;
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (qty != null) ...[
                      Container(
                        constraints: const BoxConstraints(minWidth: 38),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          qty,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: AppColors.primary,
                            fontWeight: AppFontWeights.display,
                            fontSize: 22,
                            height: 1.2,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                    ],
                    Expanded(
                      child: Text(
                        dish,
                        style: TextStyle(
                          color: AppColors.primaryText,
                          fontWeight: AppFontWeights.strong,
                          fontSize: 22,
                          height: 1.25,
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
      ],
    );
  }
}

/// Allergy detail, in full.
///
/// This used to be a grey "Allergy" chip with the actual note ellipsised at two
/// lines and hidden behind a "Show add-ons & notes" link on exactly the layout
/// a wall tablet uses. Nothing here truncates and nothing collapses.
class _AllergyBanner extends StatelessWidget {
  const _AllergyBanner({required this.notes});

  final List<String> notes;

  @override
  Widget build(BuildContext context) {
    final detail = notes.where((note) => note.trim().isNotEmpty).toList();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.danger.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.danger, width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: AppColors.danger, size: 24),
              const SizedBox(width: 8),
              Text(
                'ALLERGY',
                style: TextStyle(
                  color: AppColors.danger,
                  fontWeight: AppFontWeights.display,
                  fontSize: 16,
                  letterSpacing: 1.2,
                ),
              ),
            ],
          ),
          if (detail.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'No detail sent with this ticket — check with the waiter '
                'before firing.',
                style: TextStyle(
                  color: AppColors.danger,
                  fontWeight: AppFontWeights.label,
                  fontSize: 16,
                  height: 1.3,
                ),
              ),
            )
          else
            for (final note in detail)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  note,
                  style: TextStyle(
                    color: AppColors.danger,
                    fontWeight: AppFontWeights.strong,
                    fontSize: 18,
                    height: 1.3,
                  ),
                ),
              ),
        ],
      ),
    );
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
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: AppFontWeights.display,
              fontSize: 17,
            ),
          ),
        ),
        if (enableReorder && !narrow) ...[
          ReorderableDragStartListener(
            index: index,
            child: Icon(
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
                child: Padding(
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
  });

  final String title;
  final List<String> lines;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: highlight ? AppColors.danger : AppColors.secondaryText,
              fontWeight: AppFontWeights.label,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 3),
          // A cooking instruction that is cut off is worse than no instruction,
          // so nothing here is ellipsised.
          ...lines.map(
            (line) => Text(
              line,
              style: TextStyle(
                color: highlight ? AppColors.danger : AppColors.bodyText,
                fontWeight: highlight
                    ? AppFontWeights.strong
                    : AppFontWeights.body,
                fontSize: 16,
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
    this.wide = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final bool danger;

  /// The action the chef reaches for most gets a wider target.
  final bool wide;

  @override
  Widget build(BuildContext context) {
    final color = danger ? AppColors.danger : AppColors.primary;
    return FilledButton.tonalIcon(
      onPressed: onPressed,
      icon: Icon(icon, size: 20, color: color),
      label: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: AppFontWeights.strong,
          fontSize: 15,
        ),
      ),
      style: FilledButton.styleFrom(
        foregroundColor: color,
        backgroundColor: color.withValues(alpha: 0.12),
        padding: EdgeInsets.symmetric(horizontal: wide ? 28 : 16, vertical: 12),
        // Gloved and wet hands need the platform's 48dp minimum, not 32dp with
        // a shrink-wrapped tap target.
        minimumSize: Size(wide ? 168 : 0, 52),
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
    appForeground.addListener(_syncTimer);
    _syncTimer();
  }

  /// One per-second timer per visible card, times twenty-odd cards, is a real
  /// share of a shift's battery — so it only runs while the card is counting
  /// and the app is actually on screen.
  void _syncTimer() {
    final shouldRun = widget.active && appForeground.value;
    if (shouldRun && _timer == null) {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() => _seconds += 1);
      });
    } else if (!shouldRun) {
      _timer?.cancel();
      _timer = null;
    }
  }

  @override
  void didUpdateWidget(_LiveTimer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialSeconds != widget.initialSeconds) {
      _seconds = widget.initialSeconds;
    }
    if (oldWidget.active != widget.active) {
      _syncTimer();
    }
  }

  @override
  void dispose() {
    appForeground.removeListener(_syncTimer);
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
