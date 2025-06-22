function camelToSnake(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function snakeToCamelJSON(obj) {
  return Object.assign({}, ...Object.entries(obj).map(([key, value]) => ({ [snakeToCamel(key)]: value })));
}

function camelToSnakeJSON(obj) {
  return Object.assign({}, ...Object.entries(obj).map(([key, value]) => ({ [camelToSnake(key)]: value })));
}

module.exports = {
  camelToSnake,
  snakeToCamel,
  snakeToCamelJSON,
  camelToSnakeJSON,
};
