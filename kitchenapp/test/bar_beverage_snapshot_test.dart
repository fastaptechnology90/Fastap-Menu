import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/bar/bar_beverage_snapshot.dart';

void main() {
  test('bar beverage snapshot parses API payload', () {
    final snapshot = BarBeverageSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Beverage'],
      'drinkQueue': [
        {
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
          'timerLabel': '02:12',
          'recipeGuidance': ['Pull double espresso shot'],
          'availableActions': ['complete_drink', 'hold_drink'],
        },
      ],
      'bartenders': [
        {
          'name': 'Bar Team',
          'status': 'busy',
          'activeDrinks': 2,
          'specialty': 'Coffee & mocktails',
        },
      ],
      'stats': {
        'queuedDrinks': 0,
        'inProgress': 1,
        'customizedDrinks': 1,
        'completedToday': 11,
        'availableBartenders': 2,
        'avgPrepMinutes': 4,
      },
      'barFeatures': {
        'drinkPreparationQueue': true,
        'bartenderAssignment': true,
        'cocktailCustomization': true,
        'beverageTimers': true,
        'recipeGuidance': true,
      },
    });

    expect(snapshot.drinkQueue.length, 1);
    expect(snapshot.drinkQueue.first.drinkName, '2x Cold coffee');
    expect(snapshot.barFeatures.recipeGuidance, isTrue);
    expect(snapshot.stats.completedToday, 11);
  });
}
