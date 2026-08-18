import 'package:flutter/material.dart';

enum StaffRole {
  headChef('Head chef', Icons.emoji_people_outlined),
  sousChef('Sous chef', Icons.restaurant_outlined),
  lineCook('Line cook', Icons.soup_kitchen_outlined),
  tandoorChef('Tandoor chef', Icons.local_fire_department_outlined),
  chineseChef('Chinese chef', Icons.ramen_dining_outlined),
  beverageChef('Beverage chef', Icons.local_bar_outlined),
  dessertChef('Dessert chef', Icons.cake_outlined),
  bakeryChef('Bakery chef', Icons.bakery_dining_outlined),
  kitchenHelper('Kitchen helper', Icons.handyman_outlined),
  kitchenManager('Kitchen manager', Icons.manage_accounts_outlined),
  expeditor('Expeditor', Icons.fact_check_outlined),
  packingStaff('Packing staff', Icons.inventory_2_outlined),
  waiter('Waiter', Icons.room_service_outlined),
  housekeeping('Housekeeping', Icons.cleaning_services_outlined);

  const StaffRole(this.label, this.icon);

  final String label;
  final IconData icon;

  static StaffRole fromApi(String value) {
    return StaffRole.values.firstWhere(
      (role) => role.name == value || role.label == value,
      orElse: () => StaffRole.lineCook,
    );
  }
}
