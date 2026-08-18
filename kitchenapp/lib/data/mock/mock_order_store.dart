import 'mock_section_registry.dart';

class MockOrderStore {
  MockOrderStore._();

  static List<String> get sections => MockSectionRegistry.filterSections;

  static final List<Map<String, dynamic>> _orders = _seedOrders();
  static int _sortSeed = 10;

  static List<Map<String, dynamic>> get orders =>
      _orders.map((order) => Map<String, dynamic>.from(order)).toList();

  static List<Map<String, dynamic>> filterBySection(String section) {
    if (section == 'All') {
      return orders;
    }
    return orders.where((order) => order['section'] == section).toList();
  }

  static List<Map<String, dynamic>> activeOrders(String section) {
    return filterBySection(section).where((order) {
      return {
        'new',
        'accepted',
        'preparing',
        'delayed',
        'ready',
        'on_hold',
        're_fire',
      }.contains(order['status']);
    }).toList();
  }

  static List<Map<String, dynamic>> processingOrders(String section) {
    return filterBySection(section).where((order) {
      return {
        'new',
        'accepted',
        'preparing',
        'delayed',
        'ready',
        'on_hold',
        're_fire',
      }.contains(order['status']);
    }).toList();
  }

  static Map<String, dynamic>? findById(String id) {
    for (final order in _orders) {
      if (order['id'] == id) {
        return order;
      }
    }
    return null;
  }

  static List<String> availableActions(Map<String, dynamic> order) {
    final status = order['status'] as String;
    return switch (status) {
      'new' => ['accept', 'reject', 'cancel', 'hold', 'reassign'],
      'accepted' => [
          'prepare',
          'hold',
          'delay',
          'reject',
          'cancel',
          'reassign',
          'cancel_item',
        ],
      'preparing' => [
          'ready',
          'delay',
          'hold',
          'refire',
          'cancel',
          'reassign',
          'cancel_item',
          'modify_item',
        ],
      'delayed' => ['prepare', 'ready', 'hold', 'refire', 'cancel', 'reassign'],
      're_fire' => ['ready', 'delay', 'refire', 'cancel', 'reassign'],
      'on_hold' => ['release', 'reject', 'reassign'],
      'ready' => const [],
      _ => const [],
    };
  }

  static List<Map<String, dynamic>> lineItemsFor(Map<String, dynamic> order) {
    final items = (order['items'] as List<dynamic>).map((item) => item.toString());
    final cancelled = (order['cancelledItems'] as List<dynamic>? ?? const [])
        .map((item) => item.toString())
        .toSet();
    final modified = (order['modifiedItems'] as Map<String, dynamic>?) ?? {};

    return items
        .map(
          (name) => {
            'name': name,
            'status': cancelled.contains(name) ? 'cancelled' : 'active',
            'modifiable': !cancelled.contains(name),
            'modification': modified[name],
          },
        )
        .toList();
  }

  static Map<String, dynamic> processAction(
    String id,
    String action, {
    String? targetSection,
    String? itemName,
    String? modification,
  }) {
    final order = findById(id);
    if (order == null) {
      throw StateError('Order not found');
    }

    switch (action) {
      case 'accept':
        order['status'] = 'accepted';
      case 'prepare':
        order['status'] = 'preparing';
      case 'ready':
        order['status'] = 'ready';
        order['progress'] = 1.0;
      case 'delay':
        order['status'] = 'delayed';
      case 'reject':
        order['status'] = 'rejected';
        order['progress'] = 0;
      case 'hold':
        order['status'] = 'on_hold';
      case 'release':
        order['status'] = 'accepted';
      case 'refire':
        order['reFireRequested'] = true;
        order['status'] = 're_fire';
        bumpSortOrder(id);
      case 'cancel':
        order['status'] = 'cancelled';
        order['progress'] = 0;
      case 'reassign':
        if (targetSection != null && targetSection.isNotEmpty) {
          order['section'] = targetSection;
        }
      case 'cancel_item':
        if (itemName != null && itemName.isNotEmpty) {
          final cancelled = List<String>.from(
            (order['cancelledItems'] as List<dynamic>?) ?? const [],
          );
          if (!cancelled.contains(itemName)) {
            cancelled.add(itemName);
          }
          order['cancelledItems'] = cancelled;
        }
      case 'modify_item':
        if (itemName != null &&
            itemName.isNotEmpty &&
            modification != null &&
            modification.isNotEmpty) {
          final modified = Map<String, dynamic>.from(
            (order['modifiedItems'] as Map<String, dynamic>?) ?? {},
          );
          modified[itemName] = modification;
          order['modifiedItems'] = modified;
        }
      default:
        throw ArgumentError('Unknown processing action: $action');
    }

    return Map<String, dynamic>.from(order);
  }

  static Map<String, dynamic> updateStatus(String id, String status) {
    final action = switch (status) {
      'accepted' => 'accept',
      'preparing' => 'prepare',
      'ready' => 'ready',
      'delayed' => 'delay',
      'rejected' => 'reject',
      're_fire' => 'refire',
      _ => null,
    };
    if (action != null) {
      return processAction(id, action);
    }

    final order = findById(id);
    if (order == null) {
      throw StateError('Order not found');
    }
    order['status'] = status;
    return Map<String, dynamic>.from(order);
  }

  static void autoSortQueue() {
    final active = _orders
        .where(
          (order) => {
            'new',
            'accepted',
            'preparing',
            'delayed',
            'on_hold',
          }.contains(order['status']),
        )
        .toList();

    active.sort((a, b) {
      int score(Map<String, dynamic> order) {
        var value = 0;
        if (order['vip'] == true) {
          value += 1000;
        }
        if (order['status'] == 'delayed') {
          value += 500;
        }
        if (order['priority'] == 'express') {
          value += 300;
        }
        if (order['priority'] == 'event') {
          value += 250;
        }
        if (order['priority'] == 'delivery' ||
            order['guestType'] == 'Delivery') {
          value += 220;
        }
        if (order['deliveryType'] == 'Room service') {
          value += 180;
        }
        if (order['childMeal'] == true) {
          value += 160;
        }
        if (order['status'] == 'new') {
          value += 200;
        }
        if (order['status'] == 'on_hold') {
          value -= 800;
        }
        value -= order['sortOrder'] as int;
        return value;
      }

      return score(b).compareTo(score(a));
    });

    for (var index = 0; index < active.length; index++) {
      active[index]['sortOrder'] = index;
    }
  }

  static void reorder(List<String> orderIds) {
    for (var index = 0; index < orderIds.length; index++) {
      final order = findById(orderIds[index]);
      if (order != null) {
        order['sortOrder'] = index + 1;
      }
    }
  }

  static void bumpSortOrder(String id) {
    if (id.isEmpty) {
      return;
    }
    _sortSeed++;
    final order = findById(id);
    if (order != null) {
      order['sortOrder'] = 0;
    }
    for (final item in _orders) {
      if (item['id'] != id) {
        item['sortOrder'] = (item['sortOrder'] as int) + 1;
      }
    }
  }

  static List<String> availablePriorityActions(Map<String, dynamic> order) {
    final status = order['status'] as String;
    if ({'ready', 'rejected', 'served'}.contains(status)) {
      return const [];
    }

    final actions = <String>[
      'queue_jump',
      'flash_alert',
      'sound_alert',
      'auto_reassign',
    ];
    if (status == 'delayed' || (order['timerSeconds'] as int) > 720) {
      actions.add('auto_escalate');
    }
    return actions;
  }

  static Map<String, dynamic> performPriorityAction(String id, String action) {
    final order = findById(id);
    if (order == null) {
      throw StateError('Order not found');
    }

    switch (action) {
      case 'queue_jump':
        bumpSortOrder(id);
        autoSortQueue();
        return {
          'success': true,
          'message': 'Queue jump applied · $id moved to front lane',
        };
      case 'flash_alert':
        order['flashAlert'] = true;
        order['flashAlertAt'] = DateTime.now().toIso8601String();
        return {
          'success': true,
          'message': 'Flash alert sent for ${order['kotNumber']}',
        };
      case 'sound_alert':
        order['soundAlert'] = true;
        order['soundAlertAt'] = DateTime.now().toIso8601String();
        return {
          'success': true,
          'message': 'Sound alert triggered for ${order['kotNumber']}',
        };
      case 'auto_escalate':
        order['status'] = 'delayed';
        order['escalated'] = true;
        bumpSortOrder(id);
        autoSortQueue();
        return {
          'success': true,
          'message': 'Auto escalation · supervisor notified for ${order['kotNumber']}',
        };
      case 'auto_reassign':
        final alternate = _alternateSection(order['section'] as String);
        order['section'] = alternate;
        order['assignedChef'] = 'Relief · $alternate';
        return {
          'success': true,
          'message': 'Auto reassigned ${order['kotNumber']} to $alternate section',
        };
      default:
        throw ArgumentError('Unknown priority action: $action');
    }
  }

  static String _alternateSection(String current) {
    final options = MockSectionRegistry.sectionNames
        .where((section) => section != current)
        .toList();
    if (options.isEmpty) {
      return current;
    }
    return options.first;
  }

  static void tickTimers() {
    for (final order in _orders) {
      final status = order['status'] as String;
      if (!{
        'preparing',
        'accepted',
        'delayed',
        'new',
        're_fire',
      }.contains(status)) {
        continue;
      }
      order['timerSeconds'] = (order['timerSeconds'] as int) + 1;
      final progress = (order['progress'] as num).toDouble();
      if (progress < 0.98) {
        order['progress'] = (progress + 0.002).clamp(0.0, 0.98);
      }
      if ((order['timerSeconds'] as int) > 900 && status == 'preparing') {
        order['status'] = 'delayed';
      }
    }
  }

  static List<Map<String, dynamic>> _seedOrders() {
    return [
      _order(
        id: 'ORD-1842',
        orderId: 'ORD-2026-1842',
        kotNumber: 'KOT #1842',
        location: 'Table 12',
        tableNumber: '12',
        section: 'Tandoor',
        category: 'Main course',
        assignedChef: 'Ravi Tandoor',
        guestType: 'Regular',
        deliveryType: 'Dine-in',
        items: ['2x Butter naan', '1x Tandoori platter'],
        addOns: ['Mint chutney'],
        modifiers: ['No onion chutney'],
        cookingNotes: ['Medium spice'],
        status: 'preparing',
        timerSeconds: 438,
        progress: 0.62,
        priority: 'normal',
        sortOrder: 3,
      ),
      _order(
        id: 'ORD-1843',
        orderId: 'ORD-2026-1843',
        kotNumber: 'KOT #1843',
        location: 'Room 804',
        roomNumber: '804',
        section: 'Main',
        category: 'Main course',
        assignedChef: 'Chef Arjun Mehta',
        guestType: 'VIP',
        deliveryType: 'Room service',
        items: ['1x Dal makhani', '1x Steamed rice'],
        addOns: ['Papad'],
        modifiers: ['Nut allergy protocol'],
        cookingNotes: ['Allergy kit required', 'Supervisor check'],
        status: 'preparing',
        timerSeconds: 282,
        progress: 0.78,
        priority: 'vip',
        vip: true,
        allergy: true,
        sortOrder: 1,
      ),
      _order(
        id: 'ORD-1844',
        orderId: 'ORD-2026-1844',
        kotNumber: 'KOT #1844',
        location: 'Zomato',
        section: 'Chinese',
        category: 'Noodles',
        assignedChef: 'Mei Lin',
        guestType: 'Delivery',
        deliveryType: 'Zomato',
        items: ['2x Hakka noodles', '1x Manchurian gravy'],
        addOns: ['Extra gravy'],
        modifiers: ['Extra spicy'],
        cookingNotes: ['Rider waiting'],
        status: 'delayed',
        timerSeconds: 965,
        progress: 0.36,
        priority: 'express',
        sortOrder: 2,
      ),
      _order(
        id: 'ORD-1845',
        orderId: 'ORD-2026-1845',
        kotNumber: 'KOT #1845',
        location: 'Banquet A',
        section: 'Dessert',
        category: 'Dessert',
        assignedChef: 'Dessert Team',
        guestType: 'Event',
        deliveryType: 'Banquet',
        items: ['40x Gulab jamun', '40x Ice cream scoop'],
        addOns: ['Silver service'],
        modifiers: ['Batch service'],
        cookingNotes: ['Batch expiry 28m'],
        status: 'preparing',
        timerSeconds: 690,
        progress: 0.54,
        priority: 'event',
        sortOrder: 4,
      ),
      _order(
        id: 'ORD-1846',
        orderId: 'ORD-2026-1846',
        kotNumber: 'KOT #1846',
        location: 'Takeaway',
        section: 'Beverage',
        category: 'Beverage',
        assignedChef: 'Bar Team',
        guestType: 'Takeaway',
        deliveryType: 'Takeaway',
        items: ['2x Cold coffee', '1x Mango lassi'],
        addOns: ['Spill-proof lid'],
        modifiers: ['Less ice'],
        cookingNotes: ['Pack separately'],
        status: 'ready',
        timerSeconds: 132,
        progress: 1,
        priority: 'delivery',
        sortOrder: 5,
      ),
      _order(
        id: 'ORD-1847',
        orderId: 'ORD-2026-1847',
        kotNumber: 'KOT #1847',
        location: 'Table 4',
        tableNumber: '4',
        section: 'Grill',
        category: 'Seafood',
        assignedChef: 'Grill Station',
        guestType: 'Regular',
        deliveryType: 'Dine-in',
        items: ['1x Grilled fish'],
        addOns: ['Lemon butter'],
        modifiers: ['Seafood allergy nearby table'],
        cookingNotes: ['QC temperature check'],
        status: 'on_hold',
        timerSeconds: 591,
        progress: 0.49,
        priority: 'normal',
        allergy: true,
        sortOrder: 6,
      ),
      _order(
        id: 'ORD-1848',
        orderId: 'ORD-2026-1848',
        kotNumber: 'KOT #1848',
        location: 'Swiggy',
        section: 'Fry',
        category: 'Fast food',
        assignedChef: 'Fry Station',
        guestType: 'Delivery',
        deliveryType: 'Swiggy',
        items: ['1x Loaded fries', '1x Chicken strips'],
        addOns: ['Dip combo'],
        modifiers: ['Crispy'],
        cookingNotes: ['Rider waiting'],
        status: 'new',
        timerSeconds: 45,
        progress: 0.08,
        priority: 'express',
        sortOrder: 0,
      ),
      _order(
        id: 'ORD-1849',
        orderId: 'ORD-2026-1849',
        kotNumber: 'KOT #1849',
        location: 'Table 7',
        tableNumber: '7',
        section: 'Salad',
        category: 'Salad',
        assignedChef: 'Cold Prep',
        guestType: 'Family',
        deliveryType: 'Dine-in',
        items: ['2x Caesar salad', '1x Kids pasta'],
        addOns: ['Extra dressing'],
        modifiers: ['Jain preparation'],
        cookingNotes: ['No onion garlic'],
        status: 'accepted',
        timerSeconds: 210,
        progress: 0.25,
        priority: 'normal',
        childMeal: true,
        sortOrder: 7,
      ),
      _order(
        id: 'ORD-1850',
        orderId: 'ORD-2026-1850',
        kotNumber: 'KOT #1850',
        location: 'Room 512',
        roomNumber: '512',
        section: 'Bakery',
        category: 'Bakery',
        assignedChef: 'Bakery Team',
        guestType: 'VIP',
        deliveryType: 'Room service',
        items: ['1x Croissant basket'],
        addOns: ['VIP tray'],
        modifiers: ['Warm service'],
        cookingNotes: ['VIP room service'],
        status: 'served',
        timerSeconds: 0,
        progress: 1,
        priority: 'vip',
        vip: true,
        sortOrder: 8,
      ),
      _order(
        id: 'ORD-1851',
        orderId: 'ORD-2026-1851',
        kotNumber: 'KOT #1851',
        location: 'Table 2',
        tableNumber: '2',
        section: 'Main',
        category: 'Starter',
        assignedChef: 'Line Cook',
        guestType: 'Regular',
        deliveryType: 'Dine-in',
        items: ['1x Paneer tikka'],
        addOns: [],
        modifiers: ['Wrong spice level reported'],
        cookingNotes: ['Rejected by guest'],
        status: 'rejected',
        timerSeconds: 0,
        progress: 0,
        priority: 'normal',
        sortOrder: 9,
      ),
      _order(
        id: 'ORD-1852',
        orderId: 'ORD-2026-1852',
        kotNumber: 'KOT #1852',
        location: 'Table 9',
        tableNumber: '9',
        section: 'Grill',
        category: 'Grill',
        assignedChef: 'Grill Station',
        guestType: 'Regular',
        deliveryType: 'Dine-in',
        items: ['1x Lamb chops'],
        addOns: ['Mint sauce'],
        modifiers: ['Well done'],
        cookingNotes: ['Guest changed mind — re-fire'],
        status: 're_fire',
        timerSeconds: 124,
        progress: 0.18,
        priority: 'normal',
        reFireRequested: true,
        sortOrder: 2,
      ),
    ];
  }

  static Map<String, dynamic> _order({
    required String id,
    required String orderId,
    required String kotNumber,
    required String location,
    required String section,
    required String category,
    required String assignedChef,
    required String guestType,
    required String deliveryType,
    required List<String> items,
    required List<String> addOns,
    required List<String> modifiers,
    required List<String> cookingNotes,
    required String status,
    required int timerSeconds,
    required double progress,
    required String priority,
    required int sortOrder,
    String? tableNumber,
    String? roomNumber,
    bool vip = false,
    bool allergy = false,
    bool childMeal = false,
    bool reFireRequested = false,
  }) {
    return {
      'id': id,
      'orderId': orderId,
      'kotNumber': kotNumber,
      'location': location,
      'tableNumber': tableNumber,
      'roomNumber': roomNumber,
      'section': section,
      'category': category,
      'assignedChef': assignedChef,
      'guestType': guestType,
      'deliveryType': deliveryType,
      'items': items,
      'addOns': addOns,
      'modifiers': modifiers,
      'cookingNotes': cookingNotes,
      'status': status,
      'timerSeconds': timerSeconds,
      'progress': progress,
      'priority': priority,
      'sortOrder': sortOrder,
      'vip': vip,
      'allergy': allergy,
      'childMeal': childMeal,
      'reFireRequested': reFireRequested,
      'cancelledItems': <String>[],
      'modifiedItems': <String, String>{},
    };
  }
}
