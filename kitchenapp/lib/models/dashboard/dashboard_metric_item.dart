class DashboardMetricItem {
  const DashboardMetricItem({
    required this.key,
    required this.label,
    required this.value,
    required this.detail,
    required this.tone,
  });

  final String key;
  final String label;
  final String value;
  final String detail;
  final String tone;

  factory DashboardMetricItem.fromJson(Map<String, dynamic> json) {
    return DashboardMetricItem(
      key: json['key'] as String? ?? '',
      label: json['label'] as String? ?? '',
      value: json['value'] as String? ?? '—',
      detail: (json['detail'] ?? json['trend'])?.toString() ?? '',
      tone: json['tone'] as String? ?? 'primary',
    );
  }
}
