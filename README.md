# @wal-li/page

## Getting Started

```bash
npm i -g @wal-li/page
```

```bash
wlp <project-dir>
```

## Includes

- `@wal-li/core`'s `runScript`.
- LiquidJS.

## Syntax

**All-in-one page.**

```html
<!-- file "(head)" -->
<script path="(head)"></script>
<template path="(head)"> Head </template>
<!-- endfile -->

<!-- file "(layout)" -->
<script path="(layout)">
  exports.init = function () {};
  exports.handler = function () {};
</script>
<template path="(layout)"> Header {% block content %} Default Content {% endblock %} Footer </template>
<!-- endfile -->

<!-- file "pages/index" -->
<script path="pages/index">
  exports.init = function () {};
  exports.handler = function () {};
</script>
<template path="pages/index"> {% layout "layout %} {% block content %} Custom Content {% endblock%} </template>
<!-- endfile -->
```

**Single page.**

```html
<script>
  exports.init = function () {};
  exports.handler = function () {};
</script>

<template> {% layout "layout %} {% block content %} Custom Content {% endblock%} </template>
```

## License

MIT.
