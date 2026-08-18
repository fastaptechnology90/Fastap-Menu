import 'mock_order_store.dart';

import 'mock_section_registry.dart';



class MockBarBeverageRegistry {

  MockBarBeverageRegistry._();



  static final Map<String, Map<String, dynamic>> _drinks = _seedDrinks();

  static final List<Map<String, dynamic>> _bartenders = _seedBartenders();

  static int _completedToday = 11;



  static List<Map<String, dynamic>> drinkQueueFor(String section) {

    _syncFromOrderStore();

    final items = section == 'All'

        ? _drinks.values

        : _drinks.values.where((drink) => drink['section'] == section);

    return items

        .where((drink) => drink['status'] != 'completed')

        .map(_serializeDrink)

        .toList();

  }



  static List<Map<String, dynamic>> bartendersFor(String section) {

    if (section != 'All' && section != 'Beverage') {

      return [];

    }

    return _bartenders.map(Map<String, dynamic>.from).toList();

  }



  static Map<String, dynamic> performAction({

    required String drinkId,

    required String action,

    String? bartenderName,

    String? customization,

  }) {

    final drink = _drinks[drinkId];

    if (drink == null) {

      throw ArgumentError('Beverage drink not found');

    }



    final kotNumber = drink['kotNumber'] as String;

    final order = MockOrderStore.findById(drink['orderId'] as String);



    switch (action) {

      case 'assign_bartender':

        final name = bartenderName ?? 'Bar Team';

        drink['bartender'] = name;

        _updateBartenderLoad(name, 1);

        return {

          'success': true,

          'message': 'Assigned $name · $kotNumber',

        };

      case 'start_drink':

        drink['status'] = 'preparing';

        drink['timerSeconds'] = 180;

        order?['status'] = 'preparing';

        return {

          'success': true,

          'message': 'Drink prep started · ${drink['drinkName']}',

        };

      case 'apply_customization':

        drink['customization'] = customization ?? 'Custom build';

        drink['status'] = 'customizing';

        return {

          'success': true,

          'message': 'Customization applied · ${drink['drinkName']}',

        };

      case 'complete_drink':

        drink['status'] = 'completed';

        drink['timerSeconds'] = 0;

        order?['status'] = 'ready';

        order?['progress'] = 1.0;

        _completedToday++;

        final bartender = drink['bartender'] as String?;

        if (bartender != null) {

          _updateBartenderLoad(bartender, -1);

        }

        return {

          'success': true,

          'message': 'Drink completed · ${drink['drinkName']}',

        };

      case 'hold_drink':

        drink['status'] = 'on_hold';

        return {

          'success': true,

          'message': 'Drink held · $kotNumber',

        };

      default:

        throw ArgumentError('Unknown bar action: $action');

    }

  }



  static Map<String, dynamic> balanceQueue() {

    final queued = _drinks.values

        .where((drink) => drink['status'] == 'queued' && drink['bartender'] == null)

        .toList();

    if (queued.isEmpty) {

      return {

        'success': true,

        'message': 'Bar queue already balanced',

      };

    }



    final available = _bartenders

        .where((b) => b['status'] == 'available')

        .map((b) => b['name'] as String)

        .toList();

    if (available.isEmpty) {

      throw ArgumentError('No bartenders available for assignment');

    }



    var index = 0;

    for (final drink in queued) {

      final bartender = available[index % available.length];

      drink['bartender'] = bartender;

      _updateBartenderLoad(bartender, 1);

      index++;

    }



    return {

      'success': true,

      'message': 'Balanced ${queued.length} drinks across bartenders',

    };

  }



  static void _syncFromOrderStore() {

    for (final order in MockOrderStore.activeOrders('All')) {

      if (order['section'] != 'Beverage') {

        continue;

      }



      final orderId = order['id'] as String;

      final drinkId = 'BAR-$orderId';

      if (_drinks.containsKey(drinkId)) {

        final existing = _drinks[drinkId]!;

        if (existing['status'] == 'preparing') {

          existing['timerSeconds'] = order['timerSeconds'];

        }

        continue;

      }



      _drinks[drinkId] = _buildDrink(order);

    }

  }



  static Map<String, dynamic> _buildDrink(Map<String, dynamic> order) {

    final items = order['items'] as List<dynamic>;

    final modifiers = order['modifiers'] as List<dynamic>? ?? const [];

    return {

      'id': 'BAR-${order['id']}',

      'orderId': order['id'],

      'kotNumber': order['kotNumber'],

      'section': order['section'],

      'location': order['location'],

      'drinkName': items.isEmpty ? 'Beverage' : items.first.toString(),

      'customization':

          modifiers.isEmpty ? 'Standard' : modifiers.first.toString(),

      'bartender': null,

      'status': order['status'] == 'ready' ? 'completed' : 'queued',

      'timerSeconds': order['timerSeconds'] as int,

      'recipeGuidance': _recipeFor(items.isEmpty ? 'Beverage' : items.first.toString()),

    };

  }



  static List<String> _recipeFor(String drinkName) {

    final lower = drinkName.toLowerCase();

    if (lower.contains('coffee')) {

      return [

        'Pull double espresso shot',

        'Add chilled milk · less ice',

        'Seal with spill-proof lid',

      ];

    }

    if (lower.contains('lassi') || lower.contains('mango')) {

      return [

        'Blend yogurt base · 20s',

        'Check sweetness level',

        'Garnish · serve chilled',

      ];

    }

    if (lower.contains('cocktail') || lower.contains('mojito')) {

      return [

        'Muddle fresh mint',

        'Build in shaker · strain',

        'Garnish · quality check',

      ];

    }

    return [

      'Verify recipe card',

      'Prepare base · quality check',

      'Plate and dispatch',

    ];

  }



  static void _updateBartenderLoad(String name, int delta) {

    for (final bartender in _bartenders) {

      if (bartender['name'] == name) {

        bartender['activeDrinks'] =

            ((bartender['activeDrinks'] as int) + delta).clamp(0, 8);

        bartender['status'] =

            (bartender['activeDrinks'] as int) >= 3 ? 'busy' : 'available';

      }

    }

  }



  static String _formatTimer(int seconds) {

    final minutes = seconds ~/ 60;

    final remainder = seconds % 60;

    return '${minutes.toString().padLeft(2, '0')}:${remainder.toString().padLeft(2, '0')}';

  }



  static Map<String, dynamic> _serializeDrink(Map<String, dynamic> drink) {

    return {

      'id': drink['id'],

      'orderId': drink['orderId'],

      'kotNumber': drink['kotNumber'],

      'section': drink['section'],

      'location': drink['location'],

      'drinkName': drink['drinkName'],

      'customization': drink['customization'],

      'bartender': drink['bartender'],

      'status': drink['status'],

      'timerSeconds': drink['timerSeconds'],

      'timerLabel': _formatTimer(drink['timerSeconds'] as int),

      'recipeGuidance': List<String>.from(

        (drink['recipeGuidance'] as List<dynamic>?) ?? const [],

      ),

      'availableActions': _availableActions(drink),

    };

  }



  static List<String> _availableActions(Map<String, dynamic> drink) {

    if (drink['status'] == 'completed') {

      return const [];

    }



    final actions = <String>['assign_bartender', 'start_drink', 'apply_customization'];

    if (drink['status'] == 'preparing' ||

        drink['status'] == 'customizing') {

      actions.add('complete_drink');

    }

    actions.add('hold_drink');

    return actions;

  }



  static Map<String, Map<String, dynamic>> _seedDrinks() {

    return {

      'BAR-ORD-1846': {

        'id': 'BAR-ORD-1846',

        'orderId': 'ORD-1846',

        'kotNumber': 'KOT #1846',

        'section': 'Beverage',

        'location': 'Takeaway',

        'drinkName': '2x Cold coffee',

        'customization': 'Less ice',

        'bartender': 'Bar Team',

        'status': 'preparing',

        'timerSeconds': 132,

        'recipeGuidance': [

          'Pull double espresso shot',

          'Add chilled milk · less ice',

          'Seal with spill-proof lid',

        ],

      },

      'BAR-ORD-BEV-001': {

        'id': 'BAR-ORD-BEV-001',

        'orderId': 'ORD-BEV-001',

        'kotNumber': 'KOT #BEV-001',

        'section': 'Beverage',

        'location': 'Bar counter',

        'drinkName': '1x Virgin mojito',

        'customization': 'Extra mint · less sugar',

        'bartender': null,

        'status': 'queued',

        'timerSeconds': 0,

        'recipeGuidance': [

          'Muddle fresh mint',

          'Build in shaker · strain',

          'Garnish · quality check',

        ],

      },

      'BAR-ORD-BEV-002': {

        'id': 'BAR-ORD-BEV-002',

        'orderId': 'ORD-BEV-002',

        'kotNumber': 'KOT #BEV-002',

        'section': 'Beverage',

        'location': 'Table 9',

        'drinkName': '2x Mango lassi',

        'customization': 'Standard',

        'bartender': 'Priya Bar',

        'status': 'customizing',

        'timerSeconds': 95,

        'recipeGuidance': [

          'Blend yogurt base · 20s',

          'Check sweetness level',

          'Garnish · serve chilled',

        ],

      },

    };

  }



  static List<Map<String, dynamic>> _seedBartenders() {

    return [

      {

        'name': 'Bar Team',

        'status': 'busy',

        'activeDrinks': 2,

        'specialty': 'Coffee & mocktails',

      },

      {

        'name': 'Priya Bar',

        'status': 'available',

        'activeDrinks': 1,

        'specialty': 'Lassi & shakes',

      },

      {

        'name': 'Rahul Mixologist',

        'status': 'available',

        'activeDrinks': 0,

        'specialty': 'Cocktails',

      },

    ];

  }



  static int get completedToday => _completedToday;

}



class MockBarBeverageEngine {

  const MockBarBeverageEngine._();



  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {

    final drinkQueue = MockBarBeverageRegistry.drinkQueueFor(section);

    final bartenders = MockBarBeverageRegistry.bartendersFor(section);



    return {

      'section': section,

      'lastSyncedAt': DateTime.now().toIso8601String(),

      'drinkQueue': drinkQueue,

      'bartenders': bartenders,

      'stats': {

        'queuedDrinks':

            drinkQueue.where((drink) => drink['status'] == 'queued').length,

        'inProgress': drinkQueue

            .where(

              (drink) =>

                  drink['status'] == 'preparing' ||

                  drink['status'] == 'customizing',

            )

            .length,

        'customizedDrinks': drinkQueue

            .where((drink) => drink['customization'] != 'Standard')

            .length,

        'completedToday': MockBarBeverageRegistry.completedToday,

        'availableBartenders':

            bartenders.where((b) => b['status'] == 'available').length,

        'avgPrepMinutes': 4,

      },

      'barFeatures': {

        'drinkPreparationQueue': drinkQueue.isNotEmpty,

        'bartenderAssignment': bartenders.isNotEmpty,

        'cocktailCustomization': drinkQueue.any(

          (drink) => drink['customization'] != 'Standard',

        ),

        'beverageTimers': drinkQueue.any(

          (drink) => (drink['timerSeconds'] as int) > 0,

        ),

        'recipeGuidance': drinkQueue.any(

          (drink) => (drink['recipeGuidance'] as List).isNotEmpty,

        ),

      },

      'sections': MockSectionRegistry.filterSections,

    };

  }

}

