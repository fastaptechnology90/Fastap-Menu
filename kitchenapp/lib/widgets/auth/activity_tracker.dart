import 'package:flutter/material.dart';

import '../../state/auth_controller.dart';

/// Records kitchen activity for session idle-timeout and audit trails.
class ActivityTracker extends StatefulWidget {
  const ActivityTracker({
    super.key,
    required this.auth,
    required this.child,
  });

  final AuthController auth;
  final Widget child;

  @override
  State<ActivityTracker> createState() => _ActivityTrackerState();
}

class _ActivityTrackerState extends State<ActivityTracker> {
  DateTime? _lastPulse;

  void _pulse() {
    final now = DateTime.now();
    if (_lastPulse != null &&
        now.difference(_lastPulse!) < const Duration(seconds: 45)) {
      return;
    }
    _lastPulse = now;
    widget.auth.recordActivity('interaction');
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => _pulse(),
      child: widget.child,
    );
  }
}
