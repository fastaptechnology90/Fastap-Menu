import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/waiter_take_order_endpoints.dart';
import '../services/auth_service.dart';

class WaiterFloorTable {
  const WaiterFloorTable({
    required this.id,
    required this.name,
    required this.zone,
    required this.capacity,
    required this.status,
    required this.isRoom,
  });

  final int id;
  final String name;
  final String zone;
  final int capacity;
  final String status;
  final bool isRoom;

  factory WaiterFloorTable.fromJson(Map<String, dynamic> json) {
    return WaiterFloorTable(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: json['name']?.toString() ?? '',
      zone: json['zone']?.toString() ?? 'Floor',
      capacity: (json['capacity'] as num?)?.toInt() ?? 0,
      status: json['status']?.toString() ?? 'free',
      isRoom: json['isRoom'] == true,
    );
  }
}

class WaiterMenuVariant {
  const WaiterMenuVariant({required this.name, this.displayPrice});

  final String name;
  /// Null when the menu only names the size (base dish price still applies).
  final double? displayPrice;

  factory WaiterMenuVariant.fromJson(Map<String, dynamic> json) {
    final raw = json['displayPrice'];
    return WaiterMenuVariant(
      name: json['name']?.toString() ?? '',
      displayPrice: raw == null ? null : (raw as num?)?.toDouble(),
    );
  }
}

class WaiterMenuAddon {
  const WaiterMenuAddon({required this.name, required this.displayPrice});

  final String name;
  final double displayPrice;

  factory WaiterMenuAddon.fromJson(Map<String, dynamic> json) {
    return WaiterMenuAddon(
      name: json['name']?.toString() ?? '',
      displayPrice: (json['displayPrice'] as num?)?.toDouble() ?? 0,
    );
  }
}

class WaiterMenuItem {
  const WaiterMenuItem({
    required this.id,
    required this.name,
    required this.description,
    required this.displayPrice,
    this.variants = const [],
    this.addons = const [],
  });

  final int id;
  final String name;
  final String description;
  /// Display-only base; placeOrder never sends this as a charged price.
  final double displayPrice;
  final List<WaiterMenuVariant> variants;
  final List<WaiterMenuAddon> addons;

  bool get hasOptions => variants.isNotEmpty || addons.isNotEmpty;

  factory WaiterMenuItem.fromJson(Map<String, dynamic> json) {
    final variants = (json['variants'] as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map((e) => WaiterMenuVariant.fromJson(Map<String, dynamic>.from(e)))
        .where((v) => v.name.isNotEmpty)
        .toList();
    final addons = (json['addons'] as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map((e) => WaiterMenuAddon.fromJson(Map<String, dynamic>.from(e)))
        .where((a) => a.name.isNotEmpty)
        .toList();
    return WaiterMenuItem(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      displayPrice: (json['displayPrice'] as num?)?.toDouble() ?? 0,
      variants: variants,
      addons: addons,
    );
  }
}

/// One configurable line in the waiter cart (same dish can appear twice
/// with different variants/addons).
class WaiterCartLine {
  WaiterCartLine({
    required this.menuItemId,
    required this.name,
    required this.quantity,
    this.variant,
    this.addonNames = const [],
    required this.displayUnitEstimate,
  });

  final int menuItemId;
  final String name;
  int quantity;
  final String? variant;
  final List<String> addonNames;
  /// Approximate unit for the footer only — server bill is authoritative.
  final double displayUnitEstimate;

  double get displayLineEstimate => displayUnitEstimate * quantity;

  Map<String, dynamic> toApiJson() => {
        'menuItemId': menuItemId,
        'quantity': quantity,
        if (variant != null && variant!.trim().isNotEmpty) 'variant': variant,
        if (addonNames.isNotEmpty)
          'addons': [for (final n in addonNames) {'name': n}],
      };
}

class WaiterPlaceOrderResult {
  const WaiterPlaceOrderResult({
    required this.id,
    required this.orderId,
    required this.tableName,
    required this.total,
    required this.message,
  });

  final String id;
  final int orderId;
  final String tableName;
  final double total;
  final String message;

  factory WaiterPlaceOrderResult.fromJson(Map<String, dynamic> json) {
    return WaiterPlaceOrderResult(
      id: json['id']?.toString() ?? '',
      orderId: (json['orderId'] as num?)?.toInt() ?? 0,
      tableName: json['tableName']?.toString() ?? '',
      total: (json['total'] as num?)?.toDouble() ?? 0,
      message: json['message']?.toString() ?? 'Order placed',
    );
  }
}

class WaiterTakeOrderService {
  WaiterTakeOrderService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory WaiterTakeOrderService.fromAuth(AuthService authService) {
    return WaiterTakeOrderService(apiClient: authService.apiClient);
  }

  Future<List<WaiterFloorTable>> fetchTables() async {
    final response = await _api.get(WaiterTakeOrderEndpoints.tables);
    final data = response['data'] as Map<String, dynamic>? ?? {};
    final rows = data['tables'] as List<dynamic>? ?? const [];
    return rows
        .whereType<Map>()
        .map((e) => WaiterFloorTable.fromJson(Map<String, dynamic>.from(e)))
        .where((t) => t.id > 0 && t.name.isNotEmpty)
        .toList();
  }

  Future<List<WaiterMenuItem>> fetchMenu() async {
    final response = await _api.get(WaiterTakeOrderEndpoints.menu);
    final data = response['data'] as Map<String, dynamic>? ?? {};
    final rows = data['items'] as List<dynamic>? ?? const [];
    return rows
        .whereType<Map>()
        .map((e) => WaiterMenuItem.fromJson(Map<String, dynamic>.from(e)))
        .where((t) => t.id > 0 && t.name.isNotEmpty)
        .toList();
  }

  Future<WaiterPlaceOrderResult> placeOrder({
    required int tableId,
    required List<WaiterCartLine> lines,
    String? notes,
    int guestCount = 1,
  }) async {
    final items = [
      for (final line in lines)
        if (line.quantity > 0) line.toApiJson(),
    ];
    final response = await _api.post(
      WaiterTakeOrderEndpoints.placeOrder,
      body: {
        'tableId': tableId,
        'items': items,
        'guestCount': guestCount,
        if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      },
    );
    final data = response['data'] as Map<String, dynamic>? ?? response;
    return WaiterPlaceOrderResult.fromJson(data);
  }
}
