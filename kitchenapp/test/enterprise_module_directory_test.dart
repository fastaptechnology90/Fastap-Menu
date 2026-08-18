import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/data/enterprise_module_directory.dart';

void main() {
  test('module directory lists all command center tabs', () {
    final destinations = EnterpriseModuleDirectory.destinations();

    expect(destinations.length, 50);
    expect(destinations.first.navIndex, 0);
    expect(destinations.last.navIndex, 49);
    expect(destinations.last.label, 'Enterprise Features Catalog');
  });

  test('module search finds systems by title', () {
    final results = EnterpriseModuleDirectory.search('hidden enterprise');

    expect(results.any((item) => item.systemNumber == 47), isTrue);
  });

  test('module search finds tabs by index', () {
    final results = EnterpriseModuleDirectory.search('48');

    expect(results.any((item) => item.navIndex == 47), isTrue);
  });

  test('module search finds waiter auto assignment', () {
    final results = EnterpriseModuleDirectory.search('waiter auto');

    expect(results.any((item) => item.systemNumber == 49), isTrue);
    expect(results.any((item) => item.navIndex == 48), isTrue);
  });
}
