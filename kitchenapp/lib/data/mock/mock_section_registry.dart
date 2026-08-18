class MockSectionRegistry {
  const MockSectionRegistry._();

  static const kitchenSections = [
    _SectionMeta(
      id: 'main',
      name: 'Main',
      label: 'Main kitchen',
      headChef: 'Chef Arjun Mehta',
      capacity: 12,
      iconKey: 'main',
    ),
    _SectionMeta(
      id: 'tandoor',
      name: 'Tandoor',
      label: 'Tandoor section',
      headChef: 'Ravi Tandoor',
      capacity: 8,
      iconKey: 'tandoor',
    ),
    _SectionMeta(
      id: 'chinese',
      name: 'Chinese',
      label: 'Chinese section',
      headChef: 'Mei Lin',
      capacity: 10,
      iconKey: 'chinese',
    ),
    _SectionMeta(
      id: 'beverage',
      name: 'Beverage',
      label: 'Beverage section',
      headChef: 'Bar Team',
      capacity: 9,
      iconKey: 'beverage',
    ),
    _SectionMeta(
      id: 'dessert',
      name: 'Dessert',
      label: 'Dessert section',
      headChef: 'Dessert Team',
      capacity: 7,
      iconKey: 'dessert',
    ),
    _SectionMeta(
      id: 'bakery',
      name: 'Bakery',
      label: 'Bakery section',
      headChef: 'Bakery Team',
      capacity: 6,
      iconKey: 'bakery',
    ),
    _SectionMeta(
      id: 'bar',
      name: 'Bar',
      label: 'Bar section',
      headChef: 'Head Bartender',
      capacity: 8,
      iconKey: 'bar',
    ),
    _SectionMeta(
      id: 'grill',
      name: 'Grill',
      label: 'Grill section',
      headChef: 'Grill Station',
      capacity: 9,
      iconKey: 'grill',
    ),
    _SectionMeta(
      id: 'fry',
      name: 'Fry',
      label: 'Fry section',
      headChef: 'Fry Station',
      capacity: 8,
      iconKey: 'fry',
    ),
    _SectionMeta(
      id: 'salad',
      name: 'Salad',
      label: 'Salad section',
      headChef: 'Cold Prep',
      capacity: 6,
      iconKey: 'salad',
    ),
    _SectionMeta(
      id: 'pizza',
      name: 'Pizza',
      label: 'Pizza section',
      headChef: 'Pizza Chef Marco',
      capacity: 7,
      iconKey: 'pizza',
    ),
  ];

  static List<String> get filterSections => ['All', ...sectionNames];

  static List<String> get sectionNames =>
      kitchenSections.map((section) => section.name).toList();

  static _SectionMeta? byName(String name) {
    for (final section in kitchenSections) {
      if (section.name == name) {
        return section;
      }
    }
    return null;
  }
}

class _SectionMeta {
  const _SectionMeta({
    required this.id,
    required this.name,
    required this.label,
    required this.headChef,
    required this.capacity,
    required this.iconKey,
  });

  final String id;
  final String name;
  final String label;
  final String headChef;
  final int capacity;
  final String iconKey;
}
