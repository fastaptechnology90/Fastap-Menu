import 'package:flutter/material.dart';

class StationLoad extends StatelessWidget {
  const StationLoad({
    super.key,
    required this.name,
    required this.value,
    required this.meta,
    required this.color,
  });

  final String name;
  final double value;
  final String meta;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  name,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
              Text(
                meta,
                style: TextStyle(color: color, fontWeight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: 8),
          LinearProgressIndicator(
            value: value,
            color: color,
            backgroundColor: color.withAlpha(33),
            minHeight: 8,
            borderRadius: BorderRadius.circular(8),
          ),
        ],
      ),
    );
  }
}
