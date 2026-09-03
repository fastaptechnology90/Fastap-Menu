import 'package:flutter/material.dart';

import '../core/theme/dashboard_tone.dart';

class KitchenOrder {
  const KitchenOrder({
    required this.title,
    required this.location,
    required this.section,
    required this.items,
    required this.status,
    required this.timer,
    required this.progress,
    required this.color,
    required this.icon,
    required this.priorityIcon,
    this.id,
    this.vip = false,
    this.allergy = false,
    this.addOns = const [],
    this.modifiers = const [],
    this.cookingNotes = const [],
    this.rawStatus = '',
    this.waiterName,
    this.isRoom = false,
    this.total = 0,
    this.paymentStatus = 'pending',
  });

  final String? id;
  final String title;
  final String location;
  final String section;
  final List<String> items;
  final String status;
  // Machine status from the API ('new','accepted','preparing','ready','delayed',…) used to
  // decide which kitchen actions to offer. `status` above is the human label for display.
  final String rawStatus;
  final String timer;
  final double progress;
  final Color color;
  final IconData icon;
  final IconData priorityIcon;
  final bool vip;
  final bool allergy;
  final List<String> addOns;
  final List<String> modifiers;
  final List<String> cookingNotes;
  // Name of the waiter this order is assigned to (for the waiter app's
  // "My Deliveries" view). Set once the kitchen marks the order ready.
  final String? waiterName;
  // True for room-service orders (housekeeping deliveries); false for table
  // orders (waiter deliveries).
  final bool isRoom;
  // Bill total and whether it's been paid (for the waiter's Payment Received).
  final double total;
  final String paymentStatus;

  static List<String> _stringList(dynamic raw) =>
      raw is List ? raw.map((e) => e.toString()).toList() : const [];

  /// Optimistically re-derives the display label, colour and priority icon for
  /// a new machine status, so a home-card action reflects instantly before the
  /// background dashboard sync returns.
  KitchenOrder withRawStatus(String newStatus) {
    return KitchenOrder(
      id: id,
      title: title,
      location: location,
      section: section,
      items: items,
      status: _statusLabel(newStatus, vip),
      rawStatus: newStatus,
      timer: timer,
      progress: progress,
      color: DashboardTone.colorForOrderStatus(newStatus),
      icon: icon,
      priorityIcon: _priorityIcon(newStatus, vip ? 'vip' : 'normal', vip),
      vip: vip,
      allergy: allergy,
      addOns: addOns,
      modifiers: modifiers,
      cookingNotes: cookingNotes,
      waiterName: waiterName,
      isRoom: isRoom,
      total: total,
      paymentStatus: paymentStatus,
    );
  }

  factory KitchenOrder.fromJson(Map<String, dynamic> json) {
    final status = json['status'] as String;
    final priority = json['priority'] as String? ?? 'normal';
    final vip = json['vip'] as bool? ?? false;

    return KitchenOrder(
      id: json['id'] as String?,
      title: json['kotNumber'] as String? ?? json['title'] as String,
      location: json['location'] as String,
      section: json['section'] as String,
      items: (json['items'] as List<dynamic>).map((item) => item.toString()).toList(),
      status: json['statusLabel'] as String? ?? _statusLabel(status, vip),
      rawStatus: status,
      timer: json['timer'] as String? ?? '00:00',
      progress: (json['progress'] as num?)?.toDouble() ?? 0.0,
      color: DashboardTone.colorForOrderStatus(status),
      icon: DashboardTone.iconForOrderLocation(json['location'] as String),
      priorityIcon: _priorityIcon(status, priority, vip),
      vip: vip,
      allergy: json['allergy'] as bool? ?? false,
      addOns: _stringList(json['addOns']),
      modifiers: _stringList(json['modifiers']),
      cookingNotes: _stringList(json['cookingNotes']),
      waiterName: json['waiterName'] as String?,
      isRoom: json['isRoom'] as bool? ?? false,
      total: (json['total'] as num?)?.toDouble() ?? 0,
      paymentStatus: json['paymentStatus'] as String? ?? 'pending',
    );
  }

  static String _statusLabel(String status, bool vip) {
    if (vip && status == 'preparing') {
      return 'VIP';
    }
    return switch (status) {
      'new' => 'New order',
      'accepted' => 'Accepted',
      'preparing' => 'Preparing',
      'ready' => 'Ready soon',
      'served' => 'Served',
      'delayed' => 'Delayed',
      'on_hold' => 'On hold',
      'rejected' => 'Rejected',
      _ => status,
    };
  }

  static IconData _priorityIcon(String status, String priority, bool vip) {
    if (status == 'delayed') {
      return Icons.warning_amber_rounded;
    }
    if (vip || priority == 'vip') {
      return Icons.workspace_premium_outlined;
    }
    if (priority == 'express') {
      return Icons.bolt_outlined;
    }
    if (status == 'ready') {
      return Icons.task_alt;
    }
    return Icons.timer_outlined;
  }
}
