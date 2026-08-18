class SectionWorkload {
  const SectionWorkload({
    required this.section,
    required this.activeOrders,
    required this.load,
    required this.staffAssigned,
  });

  final String section;
  final int activeOrders;
  final double load;
  final int staffAssigned;

  factory SectionWorkload.fromJson(Map<String, dynamic> json) {
    return SectionWorkload(
      section: json['section'] as String,
      activeOrders: json['activeOrders'] as int,
      load: (json['load'] as num).toDouble(),
      staffAssigned: json['staffAssigned'] as int,
    );
  }
}
