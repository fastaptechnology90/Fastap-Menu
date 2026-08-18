import 'package:flutter/material.dart';

enum KdsViewMode {
  queue('Queue', Icons.view_list_outlined),
  timeline('Timeline', Icons.timeline_outlined),
  section('Section', Icons.grid_view_outlined),
  chef('Chef', Icons.person_outline),
  category('Category', Icons.category_outlined),
  priority('Priority', Icons.priority_high),
  vip('VIP', Icons.workspace_premium_outlined);

  const KdsViewMode(this.label, this.icon);

  final String label;
  final IconData icon;
}

enum KdsFilter {
  all('All orders'),
  vip('VIP only'),
  priority('Priority only');

  const KdsFilter(this.label);

  final String label;
}

enum KdsStatus {
  newOrder('new', 'New order'),
  accepted('accepted', 'Accepted'),
  preparing('preparing', 'Preparing'),
  ready('ready', 'Ready'),
  served('served', 'Served'),
  delayed('delayed', 'Delayed'),
  cancelled('cancelled', 'Cancelled'),
  rejected('rejected', 'Rejected'),
  reFireRequested('re_fire', 'Re-fire requested');

  const KdsStatus(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static KdsStatus fromApi(String value) {
    return KdsStatus.values.firstWhere(
      (status) => status.apiValue == value,
      orElse: () => KdsStatus.preparing,
    );
  }
}
