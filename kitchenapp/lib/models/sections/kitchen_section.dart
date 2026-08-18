class KitchenSectionProfile {
  const KitchenSectionProfile({
    required this.id,
    required this.name,
    required this.label,
    required this.headChef,
    required this.capacity,
    required this.activeOrders,
    required this.queueDepth,
    required this.load,
    required this.staffAssigned,
    required this.delayedOrders,
    required this.status,
    required this.isOnline,
    required this.iconKey,
    required this.parallelPrep,
  });

  final String id;
  final String name;
  final String label;
  final String headChef;
  final int capacity;
  final int activeOrders;
  final int queueDepth;
  final double load;
  final int staffAssigned;
  final int delayedOrders;
  final String status;
  final bool isOnline;
  final String iconKey;
  final bool parallelPrep;

  bool get isCritical => status == 'critical';

  bool get isRush => status == 'rush';

  factory KitchenSectionProfile.fromJson(Map<String, dynamic> json) {
    return KitchenSectionProfile(
      id: json['id'] as String,
      name: json['name'] as String,
      label: json['label'] as String,
      headChef: json['headChef'] as String,
      capacity: json['capacity'] as int,
      activeOrders: json['activeOrders'] as int,
      queueDepth: json['queueDepth'] as int,
      load: (json['load'] as num).toDouble(),
      staffAssigned: json['staffAssigned'] as int,
      delayedOrders: json['delayedOrders'] as int,
      status: json['status'] as String? ?? 'normal',
      isOnline: json['isOnline'] as bool? ?? true,
      iconKey: json['iconKey'] as String? ?? 'main',
      parallelPrep: json['parallelPrep'] as bool? ?? false,
    );
  }
}
