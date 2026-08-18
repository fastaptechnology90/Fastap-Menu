import 'package:flutter/material.dart';

import '../../core/theme/dashboard_tone.dart';
import 'kds_view_mode.dart';

class KdsOrder {
  const KdsOrder({
    required this.id,
    required this.orderId,
    required this.kotNumber,
    required this.section,
    required this.category,
    required this.assignedChef,
    required this.guestType,
    required this.deliveryType,
    required this.items,
    required this.addOns,
    required this.modifiers,
    required this.cookingNotes,
    required this.status,
    required this.priority,
    required this.timerSeconds,
    required this.progress,
    required this.sortOrder,
    required this.vip,
    required this.allergy,
    required this.reFireRequested,
    this.tableNumber,
    this.roomNumber,
    this.location = '',
  });

  final String id;
  final String orderId;
  final String kotNumber;
  final String section;
  final String category;
  final String assignedChef;
  final String guestType;
  final String deliveryType;
  final List<String> items;
  final List<String> addOns;
  final List<String> modifiers;
  final List<String> cookingNotes;
  final KdsStatus status;
  final String priority;
  final int timerSeconds;
  final double progress;
  final int sortOrder;
  final bool vip;
  final bool allergy;
  final bool reFireRequested;
  final String? tableNumber;
  final String? roomNumber;
  final String location;

  String get timerLabel {
    if (timerSeconds <= 0) {
      return '00:00';
    }
    final minutes = timerSeconds ~/ 60;
    final seconds = timerSeconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  String get statusLabel => status.label;

  bool get isDelayed => status == KdsStatus.delayed;

  bool get isPriority => priority != 'normal' || vip;

  Color get statusColor => DashboardTone.colorForOrderStatus(status.apiValue);

  IconData get locationIcon =>
      DashboardTone.iconForOrderLocation(location.isEmpty ? deliveryType : location);

  factory KdsOrder.fromJson(Map<String, dynamic> json) {
    final statusValue = json['status'] as String;
    return KdsOrder(
      id: json['id'] as String,
      orderId: json['orderId'] as String? ?? json['id'] as String,
      kotNumber: json['kotNumber'] as String,
      section: json['section'] as String,
      category: json['category'] as String? ?? json['section'] as String,
      assignedChef: json['assignedChef'] as String? ?? 'Unassigned',
      guestType: json['guestType'] as String? ?? 'Regular',
      deliveryType: json['deliveryType'] as String? ?? 'Dine-in',
      items: _stringList(json['items']),
      addOns: _stringList(json['addOns']),
      modifiers: _stringList(json['modifiers']),
      cookingNotes: _stringList(json['cookingNotes']),
      status: KdsStatus.fromApi(statusValue),
      priority: json['priority'] as String? ?? 'normal',
      timerSeconds: json['timerSeconds'] as int? ?? 0,
      progress: (json['progress'] as num?)?.toDouble() ?? 0,
      sortOrder: json['sortOrder'] as int? ?? 0,
      vip: json['vip'] as bool? ?? false,
      allergy: json['allergy'] as bool? ?? false,
      reFireRequested: json['reFireRequested'] as bool? ?? false,
      tableNumber: json['tableNumber'] as String?,
      roomNumber: json['roomNumber'] as String?,
      location: json['location'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'orderId': orderId,
      'kotNumber': kotNumber,
      'section': section,
      'category': category,
      'assignedChef': assignedChef,
      'guestType': guestType,
      'deliveryType': deliveryType,
      'items': items,
      'addOns': addOns,
      'modifiers': modifiers,
      'cookingNotes': cookingNotes,
      'status': status.apiValue,
      'priority': priority,
      'timerSeconds': timerSeconds,
      'progress': progress,
      'sortOrder': sortOrder,
      'vip': vip,
      'allergy': allergy,
      'reFireRequested': reFireRequested,
      'tableNumber': tableNumber,
      'roomNumber': roomNumber,
      'location': location,
      'timer': timerLabel,
      'statusLabel': statusLabel,
    };
  }

  KdsOrder copyWith({
    KdsStatus? status,
    int? timerSeconds,
    double? progress,
    int? sortOrder,
    bool? reFireRequested,
  }) {
    return KdsOrder(
      id: id,
      orderId: orderId,
      kotNumber: kotNumber,
      section: section,
      category: category,
      assignedChef: assignedChef,
      guestType: guestType,
      deliveryType: deliveryType,
      items: items,
      addOns: addOns,
      modifiers: modifiers,
      cookingNotes: cookingNotes,
      status: status ?? this.status,
      priority: priority,
      timerSeconds: timerSeconds ?? this.timerSeconds,
      progress: progress ?? this.progress,
      sortOrder: sortOrder ?? this.sortOrder,
      vip: vip,
      allergy: allergy,
      reFireRequested: reFireRequested ?? this.reFireRequested,
      tableNumber: tableNumber,
      roomNumber: roomNumber,
      location: location,
    );
  }

  static List<String> _stringList(dynamic value) {
    if (value is! List) {
      return const [];
    }
    return value.map((item) => item.toString()).toList();
  }
}
