class RushAlert {
  const RushAlert({
    required this.id,
    required this.title,
    required this.message,
    required this.severity,
    required this.timestamp,
  });

  final String id;
  final String title;
  final String message;
  final String severity;
  final DateTime timestamp;

  factory RushAlert.fromJson(Map<String, dynamic> json) {
    return RushAlert(
      id: json['id'] as String,
      title: json['title'] as String,
      message: json['message'] as String,
      severity: json['severity'] as String? ?? 'high',
      timestamp: DateTime.parse(json['timestamp'] as String),
    );
  }
}
