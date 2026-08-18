class DashboardWidgetItem {
  const DashboardWidgetItem({
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

  factory DashboardWidgetItem.fromJson(Map<String, dynamic> json) {
    return DashboardWidgetItem(
      key: json['key'] as String? ?? '',
      label: json['label'] as String? ?? '',
      value: json['value'] as String? ?? '0',
      detail: json['detail'] as String? ?? '',
      tone: json['tone'] as String? ?? 'primary',
    );
  }
}
