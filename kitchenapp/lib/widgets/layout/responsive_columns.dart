import 'package:flutter/material.dart';

class ResponsiveColumns extends StatelessWidget {
  const ResponsiveColumns({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth > 1100
            ? 3
            : constraints.maxWidth > 720
            ? 2
            : 1;

        if (columns == 1) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: _spaced(children),
          );
        }

        final rows = <Widget>[];
        for (var index = 0; index < children.length; index += columns) {
          final rowChildren = <Widget>[];
          for (var column = 0; column < columns; column++) {
            final childIndex = index + column;
            rowChildren.add(
              Expanded(
                child: childIndex < children.length
                    ? children[childIndex]
                    : const SizedBox.shrink(),
              ),
            );
            if (column < columns - 1) {
              rowChildren.add(const SizedBox(width: 14));
            }
          }
          rows.add(
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: rowChildren,
            ),
          );
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: _spaced(rows),
        );
      },
    );
  }

  List<Widget> _spaced(List<Widget> items) {
    if (items.isEmpty) {
      return items;
    }

    return [
      for (var index = 0; index < items.length; index++) ...[
        if (index > 0) const SizedBox(height: 14),
        items[index],
      ],
    ];
  }
}
