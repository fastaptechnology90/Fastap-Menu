import 'package:flutter/material.dart';

import '../../../core/constants/app_spacing.dart';

/// Standard screen body with safe area and optional scroll + padding.
class SafeScreen extends StatelessWidget {
  const SafeScreen({
    super.key,
    required this.child,
    this.scrollable = true,
    this.padding = AppSpacing.screenPadding,
    this.bottom = true,
    this.top = false,
  });

  final Widget child;
  final bool scrollable;
  final EdgeInsetsGeometry padding;
  final bool bottom;
  final bool top;

  @override
  Widget build(BuildContext context) {
    Widget content = Padding(padding: padding, child: child);

    if (scrollable) {
      content = SingleChildScrollView(
        physics: const ClampingScrollPhysics(),
        child: content,
      );
    }

    return SafeArea(
      top: top,
      bottom: bottom,
      child: content,
    );
  }
}

/// Constrains content width on large screens to avoid stretched layouts.
class ResponsiveContent extends StatelessWidget {
  const ResponsiveContent({
    super.key,
    required this.child,
    this.maxWidth = 720,
  });

  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}

/// Builds only the active tab to reduce memory and rebuild cost.
class LazyIndexedStack extends StatefulWidget {
  const LazyIndexedStack({
    super.key,
    required this.index,
    required this.itemCount,
    required this.itemBuilder,
  });

  final int index;
  final int itemCount;
  final Widget Function(BuildContext context, int index) itemBuilder;

  @override
  State<LazyIndexedStack> createState() => _LazyIndexedStackState();
}

class _LazyIndexedStackState extends State<LazyIndexedStack> {
  final _built = <int, Widget>{};

  @override
  void didUpdateWidget(covariant LazyIndexedStack oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.itemCount != oldWidget.itemCount) {
      _built.removeWhere((key, _) => key >= widget.itemCount);
    }
  }

  @override
  Widget build(BuildContext context) {
    _built.putIfAbsent(
      widget.index,
      () => RepaintBoundary(
        key: ValueKey('tab-${widget.index}'),
        child: widget.itemBuilder(context, widget.index),
      ),
    );

    return IndexedStack(
      index: widget.index,
      sizing: StackFit.expand,
      children: List.generate(widget.itemCount, (i) {
        return _built[i] ?? const SizedBox.shrink();
      }),
    );
  }
}
