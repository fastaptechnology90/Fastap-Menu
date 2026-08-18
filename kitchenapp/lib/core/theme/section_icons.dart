import 'package:flutter/material.dart';

class SectionIcons {
  const SectionIcons._();

  static IconData forKey(String key) {
    return switch (key) {
      'tandoor' => Icons.local_fire_department_outlined,
      'chinese' => Icons.ramen_dining_outlined,
      'beverage' => Icons.local_cafe_outlined,
      'dessert' => Icons.cake_outlined,
      'bakery' => Icons.bakery_dining_outlined,
      'bar' => Icons.local_bar_outlined,
      'grill' => Icons.outdoor_grill_outlined,
      'fry' => Icons.fastfood_outlined,
      'salad' => Icons.eco_outlined,
      'pizza' => Icons.local_pizza_outlined,
      _ => Icons.restaurant_outlined,
    };
  }
}
